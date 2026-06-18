import { getContentSupabaseAdmin } from '@/lib/content-supabase-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { Enquiry } from '@/lib/enquiries'

function enquiriesClient() {
  return getContentSupabaseAdmin() ?? supabaseAdmin
}

function normalizeEnquiry(row: Record<string, unknown>): Enquiry {
  const tourType = row.tour_type || row.experience

  return {
    id: String(row.id),
    name: String(row.name || ''),
    email: String(row.email || ''),
    phone: row.phone ? String(row.phone) : null,
    tour_type: tourType ? String(tourType) : null,
    message: row.message ? String(row.message) : null,
    date: row.date ? String(row.date) : null,
    passengers: row.passengers != null ? Number(row.passengers) : null,
    status: row.status ? String(row.status) : 'new',
    created_at: String(row.created_at || new Date().toISOString()),
    replied_at: row.replied_at ? String(row.replied_at) : null,
  }
}

export async function fetchEnquiriesFromSource(): Promise<Enquiry[]> {
  const apiUrl = process.env.INQUIRIES_API_URL?.trim()
  const apiKey = process.env.INQUIRIES_API_KEY?.trim()

  if (apiUrl) {
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

  const client = enquiriesClient()
  const { data, error } = await client
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data || []).map((row) => normalizeEnquiry(row as Record<string, unknown>))
}

export async function updateEnquiryStatus(id: string, status: string, extra?: Record<string, unknown>) {
  const client = enquiriesClient()
  const patch: Record<string, unknown> = {
    status,
    ...extra,
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await client
    .from('enquiries')
    .update(patch)
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) {
    if (getContentSupabaseAdmin() && error.message.toLowerCase().includes('updated_at')) {
      const { updated_at: _drop, ...withoutUpdatedAt } = patch
      const retry = await client
        .from('enquiries')
        .update(withoutUpdatedAt)
        .eq('id', id)
        .select('*')
        .maybeSingle()
      if (retry.error) throw retry.error
      if (!retry.data) return null
      return normalizeEnquiry(retry.data as Record<string, unknown>)
    }
    throw error
  }

  if (!data) return null
  return normalizeEnquiry(data as Record<string, unknown>)
}

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

export async function deleteEnquiry(id: string): Promise<boolean> {
  const client = enquiriesClient()
  const { data, error } = await client.from('enquiries').delete().eq('id', id).select('id').maybeSingle()

  if (error) throw error
  if (!data) return false

  const { error: repliesError } = await supabaseAdmin.from('enquiry_replies').delete().eq('enquiry_id', id)
  if (repliesError && !repliesError.message.toLowerCase().includes('enquiry_replies')) {
    console.error('Failed to delete enquiry replies:', repliesError)
  }

  return true
}
