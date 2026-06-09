export type FleetServiceBlock = {
  id: string
  startDate: string
  endDate: string
  notes?: string | null
}

export type FleetVehicleMeta = {
  kind: 'fleet-vehicle-meta'
  notes?: string | null
  imageUrl?: string | null
  calendarLabel?: string | null
  calendarColor?: string | null
  serviceBlocks?: FleetServiceBlock[]
}

export type FleetVehicle = {
  id: string
  title: string
  family: string
  summary?: string | null
  duration_label?: string | null
  pickup_notes?: string | null
  base_price?: number | null
  active?: boolean | null
  imageUrl?: string | null
  calendarLabel?: string | null
  calendarColor?: string | null
  serviceBlocks?: FleetServiceBlock[]
}

export type FleetUsageType = 'internal' | 'tour'

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
  }
  rental: {
    startDate: string
    endDate: string
    days: number
    seatsBooked: number
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

export function parseFleetVehicleMeta(value?: string | null): FleetVehicleMeta | null {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed.startsWith('{')) return null

  try {
    const parsed = JSON.parse(trimmed) as FleetVehicleMeta
    if (parsed?.kind !== 'fleet-vehicle-meta') return null
    return parsed
  } catch {
    return null
  }
}

export function serializeFleetVehicleMeta(meta: Omit<FleetVehicleMeta, 'kind'>): string {
  return JSON.stringify({
    kind: 'fleet-vehicle-meta',
    notes: meta.notes || null,
    imageUrl: meta.imageUrl || null,
    calendarLabel: meta.calendarLabel || null,
    calendarColor: meta.calendarColor || null,
    serviceBlocks: meta.serviceBlocks || [],
  } satisfies FleetVehicleMeta)
}

export function vehicleNotes(product: Pick<FleetVehicle, 'pickup_notes'>) {
  const meta = parseFleetVehicleMeta(product.pickup_notes)
  if (meta) return (meta.notes || '').trim()
  return (product.pickup_notes || '').trim()
}

export function enrichFleetVehicle<T extends Pick<FleetVehicle, 'pickup_notes'>>(product: T): T & Pick<FleetVehicle, 'imageUrl' | 'calendarLabel' | 'calendarColor' | 'serviceBlocks'> {
  const meta = parseFleetVehicleMeta(product.pickup_notes)
  return {
    ...product,
    imageUrl: meta?.imageUrl || null,
    calendarLabel: meta?.calendarLabel || null,
    calendarColor: meta?.calendarColor || null,
    serviceBlocks: meta?.serviceBlocks || [],
  }
}

export function vehicleCalendarLabel(vehicle: Pick<FleetVehicle, 'title' | 'calendarLabel' | 'summary'>) {
  return (vehicle.calendarLabel || '').trim() || vehicle.title
}

export function vehicleCalendarColor(vehicle: Pick<FleetVehicle, 'calendarColor'>) {
  return (vehicle.calendarColor || '').trim() || null
}

export function buildSeatsLabel(seats: number) {
  return `${Math.max(1, seats)} seats`
}

export function usageTypeLabel(usageType?: string | null) {
  return (usageType || '').toLowerCase() === 'internal' ? 'Internal use' : 'Tour use'
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
