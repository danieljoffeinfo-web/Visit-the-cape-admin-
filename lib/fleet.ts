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

export type FleetUsageType = 'internal' | 'tour' | 'airport_transfer'

export const FLEET_USAGE_TYPES: { value: FleetUsageType; label: string }[] = [
  { value: 'tour', label: 'Tour use' },
  { value: 'internal', label: 'Internal use' },
  { value: 'airport_transfer', label: 'Airport transfer' },
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
    /** Legacy: rate per day on bookings taken before amounts were typed in. */
    dailyRate?: number | null
    /** Total agreed for the rental, VAT inclusive. */
    totalAmount: number
    /** Upfront deposit required to confirm; deducted from the balance due. */
    depositAmount?: number | null
    usageType?: FleetUsageType | null
    paymentReceived?: boolean | null
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
