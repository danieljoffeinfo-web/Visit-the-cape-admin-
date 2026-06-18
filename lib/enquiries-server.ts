import { supabaseAdmin } from '@/lib/supabase-admin'
import { getContentSupabaseAdmin } from '@/lib/content-supabase-admin'
import type { Enquiry } from '@/lib/enquiries'

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

function mapExperienceToTourType(experience?: string | null) {
  if (!experience) return null
  return experience
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

  if (process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    try {
      const content = getContentSupabaseAdmin()
      const { data, error } = await content
        .from('enquiries')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(200)

      if (!error && data) {
        return data.map((row) =>
          normalizeEnquiry({
            ...row,
            tour_type: (row as Record<string, unknown>).tour_type || mapExperienceToTourType((row as Record<string, unknown>).experience as string),
          } as Record<string, unknown>),
        )
      }
    } catch (err) {
      console.warn('Content enquiries fetch failed, falling back to admin DB:', err)
    }
  }

  const { data, error } = await supabaseAdmin
    .from('enquiries')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return (data || []).map((row) => normalizeEnquiry(row as Record<string, unknown>))
}

export async function updateEnquiryStatus(id: string, status: string, extra?: Record<string, unknown>) {
  const { data, error } = await supabaseAdmin
    .from('enquiries')
    .update({ status, ...extra, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .maybeSingle()

  if (error) throw error
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
