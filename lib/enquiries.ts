export type Enquiry = {
  id: string
  name: string
  email: string
  phone?: string | null
  tour_type?: string | null
  message?: string | null
  date?: string | null
  passengers?: number | null
  status?: string | null
  created_at: string
  replied_at?: string | null
}

export type EnquiryReply = {
  id: string
  enquiry_id: string
  admin_name?: string | null
  admin_email?: string | null
  to_email: string
  subject: string
  body: string
  created_at: string
}

export function isUnreadEnquiry(enquiry: Pick<Enquiry, 'status'>) {
  const status = (enquiry.status || '').toLowerCase()
  if (!status || status === 'new' || status === 'unread') return true
  return status !== 'read' && status !== 'replied' && status !== 'archived'
}

export function enquiryStatusLabel(status?: string | null) {
  const value = (status || 'new').toLowerCase()
  if (value === 'replied') return 'Replied'
  if (value === 'read') return 'Read'
  if (value === 'archived') return 'Archived'
  return 'New'
}
