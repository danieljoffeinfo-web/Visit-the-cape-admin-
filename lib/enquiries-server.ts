import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getContentSupabaseAdmin } from '@/lib/content-supabase-admin'
import type { Enquiry } from '@/lib/enquiries'

/**
 * Enquiries live in ONE of two Supabase projects: the website/content project
 * (where the public site writes them) or the admin project.
 *
 * Reads and writes must agree on which one, otherwise marking an enquiry as
 * replied updates a row nobody is looking at. `getEnquiriesDb()` is the single
 * place that decides, and every read and write below goes through it.
 */

export type EnquiriesSource = 'external-api' | 'content' | 'admin'

function hasExternalApi() {
  return Boolean(process.env.INQUIRIES_API_URL?.trim())
}

function hasContentProject() {
  return Boolean(process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY?.trim())
}

/** Which source owns enquiry rows right now. */
export function getEnquiriesSource(): EnquiriesSource {
  if (hasExternalApi()) return 'external-api'
  if (hasContentProject()) return 'content'
  return 'admin'
}

/**
 * The Supabase client that owns enquiry rows.
 *
 * Returns null when enquiries come from an external HTTP API, since there is no
 * database for the admin to write to in that case.
 */
export function getEnquiriesDb(): { client: SupabaseClient; source: EnquiriesSource } | null {
  const source = getEnquiriesSource()
  if (source === 'external-api') return null

  if (source === 'content') {
    try {
      return { client: getContentSupabaseAdmin(), source }
    } catch (err) {
      console.warn('Content Supabase unavailable, using admin project for enquiries:', err)
      return { client: supabaseAdmin, source: 'admin' }
    }
  }

  return { client: supabaseAdmin, source }
}

function normalizeEnquiry(row: Record<string, unknown>): Enquiry {
  return {
    id: String(row.id),
    name: String(row.name || ''),
    email: String(row.email || ''),
    phone: row.phone ? String(row.phone) : null,
    tour_type: row.tour_type ? String(row.tour_type) : null,
    message: row.message ? String(row.message) : null,
    date: row.date ? String(row.date) : null,
    passengers: row.passengers != null ? Number(row.passengers) : null,
    status: row.status ? String(row.status) : 'new',
    created_at: String(row.created_at || new Date().toISOString()),
    replied_at: row.replied_at ? String(row.replied_at) : null,
  }
}

/** Website forms post `experience`; the admin reads `tour_type`. */
function withTourType(row: Record<string, unknown>): Record<string, unknown> {
  return {
    ...row,
    tour_type: row.tour_type || row.experience || null,
  }
}

export async function fetchEnquiriesFromSource(): Promise<Enquiry[]> {
  const apiUrl = process.env.INQUIRIES_API_URL?.trim()

  if (apiUrl) {
    const apiKey = process.env.INQUIRIES_API_KEY?.trim()
    const headers: Record<string, string> = { Accept: 'application/json' }
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const response = await fetch(apiUrl, { headers, cache: 'no-store' })
    if (!response.ok) {
      throw new Error(`Inquiries API returned ${response.status}`)
    }

    const payload = await response.json()
    const rows = Array.isArray(payload) ? payload : payload.enquiries || payload.data || []
    return rows.map((row: Record<string, unknown>) => normalizeEnquiry(row))
  }

  const db = getEnquiriesDb()
  if (!db) return []

  const { data, error } = await db.client
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data || []).map((row) => normalizeEnquiry(withTourType(row as Record<string, unknown>)))
}

/** Unread enquiries, read from the same source the inbox reads. */
export async function fetchUnreadEnquiries(limit = 100): Promise<Enquiry[]> {
  const enquiries = await fetchEnquiriesFromSource()
  return enquiries
    .filter((enquiry) => {
      const status = (enquiry.status || '').toLowerCase()
      return !status || status === 'new' || status === 'unread'
    })
    .slice(0, limit)
}

export async function updateEnquiryStatus(id: string, status: string, extra?: Record<string, unknown>) {
  const db = getEnquiriesDb()
  if (!db) {
    // Enquiries are owned by an external API — nothing local to update.
    return null
  }

  const { data, error } = await db.client
    .from('enquiries')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw error
  if (!data) return null
  return normalizeEnquiry(withTourType(data as Record<string, unknown>))
}

/** Permanently remove an enquiry from whichever project owns it. */
export async function deleteEnquiry(id: string) {
  const db = getEnquiriesDb()
  if (!db) {
    throw new Error('Enquiries come from an external API and cannot be deleted here')
  }

  const { error } = await db.client.from('enquiries').delete().eq('id', id)
  if (error) throw error

  // Reply history lives in the admin project and is not FK-linked, so clear it
  // explicitly or it is orphaned.
  await supabaseAdmin.from('enquiry_replies').delete().eq('enquiry_id', id)
}

/** Delete every enquiry from the owning project. Used by the clear-all-data flow. */
export async function deleteAllEnquiries() {
  const db = getEnquiriesDb()
  if (!db) return { cleared: false, source: 'external-api' as const }

  const { error } = await db.client.from('enquiries').delete().neq('id', '00000000-0000-0000-0000-000000000000')
  if (error) throw error
  return { cleared: true, source: db.source }
}

/**
 * Reply audit trail. Always stored in the admin project even when the enquiry
 * itself lives in the content project, so `enquiry_id` is a plain reference
 * rather than a foreign key — see supabase/enquiry_replies.sql.
 */
export async function recordEnquiryReply(input: {
  enquiryId: string
  adminName: string
  adminEmail: string
  toEmail: string
  subject: string
  body: string
  resendId?: string | null
}) {
  const { error } = await supabaseAdmin.from('enquiry_replies').insert({
    enquiry_id: input.enquiryId,
    admin_name: input.adminName,
    admin_email: input.adminEmail,
    to_email: input.toEmail,
    subject: input.subject,
    body: input.body,
    resend_id: input.resendId || null,
  })

  if (error) {
    console.error('Failed to record enquiry reply:', error)
  }
}

export async function fetchEnquiryReplies(enquiryId: string) {
  const { data, error } = await supabaseAdmin
    .from('enquiry_replies')
    .select('*')
    .eq('enquiry_id', enquiryId)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.message.toLowerCase().includes('enquiry_replies')) return []
    throw error
  }

  return data || []
}
