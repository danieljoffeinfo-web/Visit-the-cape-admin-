import { parseFleetBookingNotes } from '@/lib/fleet'

export type BookingKind = 'tour' | 'internal' | 'fleet' | 'private'
export type BookingTab = 'all' | 'tours' | 'internal' | 'fleet' | 'private'

export type UnifiedBooking = {
  id: string
  kind: BookingKind
  booking_reference?: string | null
  customer_name: string
  customer_email: string
  tour_or_vehicle: string
  date: string
  guests: number
  source?: string | null
  status?: string | null
  payment_status?: string | null
  invoice_status?: string | null
  created_by_name?: string | null
  created_by_color?: string | null
  amount?: number | null
  message?: string | null
  created_at: string
  raw_id: string
}

type TagAlongRow = {
  id: string
  name: string
  email: string
  tour_name?: string | null
  tour_date?: string | null
  passengers?: number | null
  source?: string | null
  booking_type?: string | null
  status?: string | null
  payment_status?: string | null
  invoice_status?: string | null
  booking_reference?: string | null
  created_by_name?: string | null
  created_by_color?: string | null
  amount?: number | null
  vehicle_name?: string | null
  created_at: string
}

type EnquiryRow = {
  id: string
  name: string
  email: string
  tour_type?: string | null
  message?: string | null
  date?: string | null
  passengers?: number | null
  created_at: string
}

type FleetBookingRow = {
  id: string
  name?: string | null
  email?: string | null
  passengers?: number | null
  amount?: number | null
  status?: string | null
  notes?: string | null
  created_at: string
}

export function isInternalTagAlong(row: TagAlongRow) {
  return row.source === 'internal' || row.booking_type === 'internal'
}

export function normalizeTagAlongRow(row: TagAlongRow): UnifiedBooking {
  const internal = isInternalTagAlong(row)
  return {
    id: `tour-${row.id}`,
    raw_id: row.id,
    kind: internal ? 'internal' : 'tour',
    booking_reference: row.booking_reference,
    customer_name: row.name,
    customer_email: row.email,
    tour_or_vehicle: row.tour_name || row.vehicle_name || '—',
    date: row.tour_date || '',
    guests: row.passengers || 0,
    source: row.source || 'website',
    status: row.status,
    payment_status: row.payment_status,
    invoice_status: row.invoice_status,
    created_by_name: row.created_by_name,
    created_by_color: row.created_by_color,
    amount: row.amount,
    created_at: row.created_at,
  }
}

export function normalizeEnquiryRow(row: EnquiryRow): UnifiedBooking {
  return {
    id: `private-${row.id}`,
    raw_id: row.id,
    kind: 'private',
    customer_name: row.name,
    customer_email: row.email,
    tour_or_vehicle: row.tour_type || 'Private enquiry',
    date: row.date || '',
    guests: row.passengers || 0,
    source: 'website',
    status: 'enquiry',
    message: row.message,
    created_at: row.created_at,
  }
}

export function normalizeFleetRow(
  row: FleetBookingRow,
  invoiceStatus?: string | null,
): UnifiedBooking {
  const notes = parseFleetBookingNotes(row.notes)
  const customerName = notes
    ? `${notes.customer.firstName} ${notes.customer.surname}`.trim()
    : row.name || '—'

  return {
    id: `fleet-${row.id}`,
    raw_id: row.id,
    kind: 'fleet',
    booking_reference: row.id.slice(0, 8).toUpperCase(),
    customer_name: customerName,
    customer_email: notes?.customer.email || row.email || '',
    tour_or_vehicle: notes?.vehicle.title || 'Fleet rental',
    date: notes?.rental.startDate || '',
    guests: notes?.rental.seatsBooked || row.passengers || 0,
    source: 'internal',
    status: row.status || 'confirmed',
    payment_status: invoiceStatus?.toUpperCase() === 'PAID' ? 'paid' : 'pending',
    invoice_status: invoiceStatus || null,
    amount: row.amount ?? notes?.rental.totalAmount ?? null,
    created_at: row.created_at,
  }
}

export function sortBookings(rows: UnifiedBooking[]) {
  return [...rows].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  )
}

export function filterBookingsByTab(rows: UnifiedBooking[], tab: BookingTab) {
  if (tab === 'all') return rows
  if (tab === 'tours') return rows.filter((r) => r.kind === 'tour')
  if (tab === 'internal') return rows.filter((r) => r.kind === 'internal')
  if (tab === 'fleet') return rows.filter((r) => r.kind === 'fleet')
  if (tab === 'private') return rows.filter((r) => r.kind === 'private')
  return rows
}

export const BOOKING_TABS: { id: BookingTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tours', label: 'Tours' },
  { id: 'internal', label: 'Internal' },
  { id: 'fleet', label: 'Fleet' },
  { id: 'private', label: 'Private' },
]

export { cardStyle, inputStyle } from '@/lib/theme'

export const muted = 'rgba(44, 38, 32, 0.55)'
