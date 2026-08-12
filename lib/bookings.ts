import { parseAddOnBookingNotes, summariseAddOnLines, type AddOnLine } from '@/lib/add-ons'
import { parseFleetBookingNotes } from '@/lib/fleet'

export type BookingKind = 'tour' | 'internal' | 'fleet' | 'private' | 'addon' | 'website'
export type BookingTab = 'all' | 'tours' | 'addons' | 'internal' | 'website'

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
  /** Present on add-on bookings: what was chosen, and at what price. Carried on
   *  the row so raising the Xero invoice can itemise it without a second read. */
  addOnLines?: AddOnLine[]
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
  notes?: string | null
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

/** One paid private booking from the website's PayGate flow. */
type PrivateTourBookingRow = {
  id: string
  booking_reference?: string | null
  tour_name?: string | null
  tour_date?: string | null
  passengers?: number | null
  amount_cents?: number | null
  customer_name?: string | null
  customer_email?: string | null
  payment_status?: string | null
  created_at: string
}

export function normalizeTagAlongRow(row: TagAlongRow): UnifiedBooking {
  const internal = isInternalTagAlong(row)
  const kind: BookingKind = row.booking_type === 'addon' ? 'addon' : internal ? 'internal' : 'tour'
  const addOn = kind === 'addon' ? parseAddOnBookingNotes(row.notes) : null
  return {
    id: `${kind}-${row.id}`,
    raw_id: row.id,
    kind,
    booking_reference: row.booking_reference,
    customer_name: row.name,
    customer_email: row.email,
    tour_or_vehicle: addOn ? summariseAddOnLines(addOn.lines) : row.tour_name || row.vehicle_name || '—',
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
    ...(addOn ? { addOnLines: addOn.lines } : {}),
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

/**
 * A private tour paid for on the website.
 *
 * These rows were being written by the public site and read by nobody — the
 * dashboard had no query against `private_tour_bookings` at all, so a customer
 * could pay and the booking would exist only in the database. Amounts are
 * stored in cents by the PayGate flow; every other booking in the hub is in
 * rands, so convert here rather than teaching the table two units.
 */
export function normalizePrivateTourBookingRow(row: PrivateTourBookingRow): UnifiedBooking {
  const paid = (row.payment_status || '').toLowerCase() === 'paid'
  return {
    id: `website-${row.id}`,
    raw_id: row.id,
    kind: 'website',
    booking_reference: row.booking_reference,
    customer_name: row.customer_name || '—',
    customer_email: row.customer_email || '',
    tour_or_vehicle: row.tour_name || 'Private tour',
    date: row.tour_date || '',
    guests: row.passengers || 0,
    source: 'website',
    status: paid ? 'confirmed' : 'awaiting payment',
    payment_status: row.payment_status || 'pending',
    amount: row.amount_cents != null ? row.amount_cents / 100 : null,
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
    payment_status:
      invoiceStatus?.toUpperCase() === 'PAID'
        ? 'paid'
        : row.status === 'cancelled' || notes?.rental.operationalStatus === 'cancelled'
          ? 'cancelled'
          : notes?.rental.operationalStatus || (notes?.rental.paymentReceived ? 'paid' : 'pending'),
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

/**
 * Was this booking taken in-house, or did it come off the website?
 *
 * Not the same question as what KIND of booking it is, which is what the
 * Internal tab used to filter on. Every vehicle hired out by the office is a
 * fleet booking with an internal source, so a tab that matched on kind showed
 * an empty table while the All view sat there displaying the very rows the
 * operator was looking for, each one badged INTERNAL. Fleet answers "what was
 * booked"; Internal answers "who booked it", and the two overlapping is the
 * point rather than a bug.
 */
export function isStaffCreated(row: UnifiedBooking) {
  if (row.kind === 'website' || row.kind === 'private') return false
  return row.kind === 'internal' || row.kind === 'addon' || row.source === 'internal'
}

/**
 * Five views, along one question each.
 *
 * Seven tabs described the same bookings more than once. Fleet and Internal
 * were near-duplicates, since every vehicle hired out by the office is a fleet
 * booking with an internal source; Private and Website both meant "this came
 * off the site", one paid and one still an enquiry.
 *
 * What is left asks one thing at a time. Tours and Add-Ons are WHAT was
 * booked. Internal and Website are WHERE it came from — the office, or the
 * public site. A fleet rental is therefore Internal, and a private enquiry is
 * Website, which is where someone looking for either would think to go.
 */
export function filterBookingsByTab(rows: UnifiedBooking[], tab: BookingTab) {
  if (tab === 'tours') return rows.filter((r) => r.kind === 'tour')
  if (tab === 'internal') return rows.filter(isStaffCreated)
  if (tab === 'addons') return rows.filter((r) => r.kind === 'addon')
  if (tab === 'website') return rows.filter((r) => r.kind === 'website' || r.kind === 'private')
  return rows
}

export const BOOKING_TABS: { id: BookingTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tours', label: 'Tours' },
  { id: 'addons', label: 'Add-Ons' },
  { id: 'internal', label: 'Internal' },
  { id: 'website', label: 'Website' },
]

export type BookingInvoiceLink = {
  booking_id: string
  xero_invoice_id?: string | null
  xero_invoice_number?: string | null
  status: string
}

export function bookingHasViewableInvoice(
  booking: UnifiedBooking,
  link?: BookingInvoiceLink | null,
) {
  if (link) return true
  if (booking.invoice_status) return true
  /* Fleet and add-on bookings always have an invoice to show, because the
     dashboard generates one from the booking itself rather than waiting for
     Xero. Everything else needs a link or a status first. */
  return booking.kind === 'fleet' || booking.kind === 'addon'
}

export function invoiceLabelForBooking(
  booking: UnifiedBooking,
  link?: BookingInvoiceLink | null,
) {
  return link?.status || booking.invoice_status || 'View invoice'
}

export { cardStyle, inputStyle } from '@/lib/theme'

export const muted = 'rgba(44, 38, 32, 0.55)'
