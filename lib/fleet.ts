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
    /** Rate per day agreed at booking time. Total = dailyRate x days. */
    dailyRate?: number | null
    totalAmount: number
    usageType?: FleetUsageType | null
    paymentReceived?: boolean | null
    notes?: string | null
  }
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
    if (!parsed.customer?.email || !parsed.vehicle?.id || !parsed.rental?.startDate || !parsed.rental?.endDate) return null
    return parsed
  } catch {
    return null
  }
}

export function fullCustomerName(notes: FleetBookingNotes | null) {
  if (!notes) return ''
  return `${notes.customer.firstName} ${notes.customer.surname}`.trim()
}
