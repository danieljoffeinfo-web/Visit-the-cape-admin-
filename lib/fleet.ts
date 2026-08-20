export type FleetVehicle = {
  id: string
  title: string
  family: string
  summary?: string | null
  duration_label?: string | null
  pickup_notes?: string | null
  active?: boolean | null
  image_url?: string | null
}

export type FleetUsageType =
  | 'internal'
  | 'tour'
  | 'airport_transfer'
  | 'bus_only'
  | 'bus_driver'
  | 'bus_driver_fuel'
  | 'bus_guide_fuel'

/**
 * What the vehicle is going out as.
 *
 * The first three answer why it is out; the four below answer what the hire
 * includes, which is what the customer is actually paying for and what they
 * expect to read on the invoice. Both sets live in one list because the office
 * picks one thing per booking, not two.
 *
 * Order matters: it is the order of the dropdown.
 */
export const FLEET_USAGE_TYPES: { value: FleetUsageType; label: string }[] = [
  { value: 'tour', label: 'Tour use' },
  { value: 'internal', label: 'Internal use' },
  { value: 'airport_transfer', label: 'Airport transfer' },
  { value: 'bus_only', label: 'Bus only' },
  { value: 'bus_driver', label: 'Bus and driver' },
  { value: 'bus_driver_fuel', label: 'Bus, driver, fuel' },
  { value: 'bus_guide_fuel', label: 'Bus, tour guide, fuel' },
]

export type FleetBookingNotes = {
  kind: 'fleet-booking'
  customer: {
    firstName: string
    surname: string
    accountNumber?: string | null
    phone?: string | null
    email: string
  }
  vehicle: {
    id: string
    title: string
    registrationNumber: string
    seats: number
    imageUrl?: string | null
  }
  rental: {
    startDate: string
    endDate: string
    days: number
    seatsBooked: number
    /** Agreed rate per day. The total is this multiplied by `days`. */
    dailyRate?: number | null
    /** Total agreed for the rental, VAT inclusive. */
    totalAmount: number
    /**
     * What the invoice line should say, when the office typed something in.
     *
     * Empty on most bookings, and deliberately so: `fleetInvoiceDescription`
     * builds a line from the vehicle, the hire type and the day rate, which is
     * right often enough that making it mandatory would be busywork. This is
     * for the booking it is wrong for.
     */
    invoiceDescription?: string | null
    /** Upfront deposit required to confirm; deducted from the balance due. */
    depositAmount?: number | null
    usageType?: FleetUsageType | null
    paymentReceived?: boolean | null
    operationalStatus?: 'pending' | 'paid' | 'cancelled' | null
    notes?: string | null
  }
  /** Invoice issued for this booking. Created in the admin, not in Xero. */
  invoice?: {
    number: string
    issuedAt: string
    dueDate: string
    issuedByName?: string | null
    issuedByEmail?: string | null
  } | null
}

/** Balance still owing once any upfront deposit is taken off the total. */
export function balanceDue(rental: { totalAmount: number; depositAmount?: number | null }) {
  const deposit = Number(rental.depositAmount) || 0
  return Math.max(0, (Number(rental.totalAmount) || 0) - deposit)
}

export function isFleetVehicle(product: { family?: string | null }) {
  return (product.family || '').toLowerCase() === 'fleet'
}

export function vehicleRegistration(product: Pick<FleetVehicle, 'summary'>) {
  return (product.summary || '').trim()
}

export function vehicleSeats(product: Pick<FleetVehicle, 'duration_label'>) {
  const match = (product.duration_label || '').match(/\d+/)
  return match ? parseInt(match[0], 10) : 0
}

export function vehicleNotes(product: Pick<FleetVehicle, 'pickup_notes'>) {
  return (product.pickup_notes || '').trim()
}

export function buildSeatsLabel(seats: number) {
  return `${Math.max(1, seats)} seats`
}

export function normalizeUsageType(usageType?: string | null): FleetUsageType {
  const value = (usageType || '').toLowerCase().replace(/[\s-]+/g, '_')
  const match = FLEET_USAGE_TYPES.find((option) => option.value === value)
  return match ? match.value : 'tour'
}

export function usageTypeLabel(usageType?: string | null) {
  const value = normalizeUsageType(usageType)
  return FLEET_USAGE_TYPES.find((option) => option.value === value)?.label || 'Tour use'
}

/**
 * "R50,000.00" - comma thousands, period decimals, matching the approved
 * invoice template.
 *
 * Lives here rather than in the PDF builder because the booking dialog has to
 * show the operator the very line the invoice will carry, and the dialog runs
 * in the browser where pdf-lib must not be imported. One implementation, read
 * by both.
 */
export function formatRands(amount: number) {
  const value = Number(amount) || 0
  const [whole, decimals] = Math.abs(value).toFixed(2).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${value < 0 ? '-' : ''}R${grouped}.${decimals}`
}

/**
 * The line a fleet invoice leads with.
 *
 * Names the vehicle, then what the hire includes - which is the thing the
 * customer queries, and the reason the hire type had to reach the invoice at
 * all. The day rate follows so the total can be checked rather than taken on
 * trust: three days at R800 is an arithmetic anyone can do in their head, and
 * a bare R2,400.00 is not.
 *
 * A description typed on the booking wins outright. The office knows what this
 * particular hire was, and no template beats being told.
 */
export function fleetInvoiceDescription(input: {
  vehicleName: string
  usageType?: string | null
  dailyRate?: number | null
  days?: number | null
  custom?: string | null
}) {
  const typed = (input.custom || '').trim()
  if (typed) return typed

  const parts = [`${input.vehicleName} rental`, usageTypeLabel(input.usageType)]

  const rate = Number(input.dailyRate) || 0
  const days = Number(input.days) || 0
  if (rate > 0 && days > 0) {
    parts.push(`${formatRands(rate)} per day \u00d7 ${days} day${days === 1 ? '' : 's'}`)
  }

  return parts.join(' \u2014 ')
}

/** Total for a rental. Falls back to 0 when either input is unusable. */
export function rentalTotal(dailyRate: number | string | null | undefined, days: number) {
  const rate = Number(dailyRate)
  if (!Number.isFinite(rate) || rate <= 0 || days <= 0) return 0
  return rate * days
}

export function parseFleetBookingNotes(value?: string | null): FleetBookingNotes | null {
  if (!value) return null

  try {
    const parsed = JSON.parse(value) as FleetBookingNotes
    if (parsed?.kind !== 'fleet-booking') return null
    // Email is optional on a booking, so it must NOT be part of this check.
    // Requiring it made email-less bookings unparseable, which hid them from the
    // invoice viewer, the fleet dashboard, availability and — critically —
    // double-booking conflict detection.
    if (!parsed.vehicle?.id || !parsed.rental?.startDate || !parsed.rental?.endDate) return null
    return parsed
  } catch {
    return null
  }
}

export function fullCustomerName(notes: FleetBookingNotes | null) {
  if (!notes) return ''
  return `${notes.customer.firstName} ${notes.customer.surname}`.trim()
}
