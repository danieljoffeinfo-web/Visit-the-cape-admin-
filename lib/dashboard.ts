import { addDays, format, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { getSupabase } from '@/lib/supabase'
import { parseFleetBookingNotes } from '@/lib/fleet'

export type EnquiryRow = {
  id: string
  name: string
  tour_type?: string | null
  created_at: string
  status?: string | null
}

export type DepartureRow = {
  id: string
  name: string
  date: string
  seats_total: number
  booked_seats: number
  vehicle_name?: string | null
  departure_time?: string | null
}

export type FleetVehicleStatus = {
  id: string
  name: string
  status: 'available' | 'on_tour' | 'in_service'
  statusLabel: string
}

export type OutstandingInvoices = {
  connected: boolean
  total: number | null
  fallback: 'connect' | 'no_data' | null
}

export type CrmSnapshot = {
  newThisWeek: number
  totalCustomers: number
  repeatBookerPercent: number | null
}

export type RevenueDay = {
  date: string
  label: string
  amount: number
}

const UNREAD_STATUSES = ['new', 'unread']

function isUnreadEnquiry(enquiry: EnquiryRow): boolean {
  const status = (enquiry.status || '').toLowerCase()
  // TODO: enquiries.status — once read-tracking ships, only count new/unread explicitly.
  if (!status) return true
  return UNREAD_STATUSES.includes(status)
}

let enquiriesCache: { data: EnquiryRow[]; fetchedAt: number } | null = null

async function fetchEnquiries(): Promise<{ data: EnquiryRow[]; error: unknown }> {
  if (enquiriesCache && Date.now() - enquiriesCache.fetchedAt < 30_000) {
    return { data: enquiriesCache.data, error: null }
  }

  const withStatus = await getSupabase()
    .from('enquiries')
    .select('id, name, tour_type, created_at, status')
    .order('created_at', { ascending: false })
    .limit(100)

  if (withStatus.error?.message?.toLowerCase().includes('status')) {
    const fallback = await getSupabase()
      .from('enquiries')
      .select('id, name, tour_type, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    const data = (fallback.data || []) as EnquiryRow[]
    enquiriesCache = { data, fetchedAt: Date.now() }
    return { data, error: fallback.error }
  }

  const data = (withStatus.data || []) as EnquiryRow[]
  enquiriesCache = { data, fetchedAt: Date.now() }
  return { data, error: withStatus.error }
}

export async function getUnreadEnquiriesCount(): Promise<number> {
  const { data, error } = await fetchEnquiries()
  if (error) {
    console.error('Unread enquiries count error:', error)
    return 0
  }
  return data.filter(isUnreadEnquiry).length
}

export async function getUnreadEnquiries(limit = 5): Promise<EnquiryRow[]> {
  const { data, error } = await fetchEnquiries()
  if (error) {
    console.error('Unread enquiries fetch error:', error)
    return []
  }
  return data.filter(isUnreadEnquiry).slice(0, limit)
}

export async function getSeatsRemainingNext30Days(): Promise<number> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const in30 = format(addDays(new Date(), 30), 'yyyy-MM-dd')

  const { data, error } = await getSupabase()
    .from('tag_along_tours')
    .select('seats_total, booked_seats')
    .gte('date', today)
    .lte('date', in30)

  if (error) {
    console.error('Seats remaining error:', error)
    return 0
  }

  return (data || []).reduce((sum, tour) => {
    const total = tour.seats_total || 0
    const booked = tour.booked_seats || 0
    return sum + Math.max(0, total - booked)
  }, 0)
}

export async function getOutstandingInvoices(): Promise<OutstandingInvoices> {
  try {
    const statusRes = await fetch('/api/xero/status')
    const statusData = await statusRes.json()

    if (!statusData.connected) {
      return { connected: false, total: null, fallback: 'connect' }
    }

    const invRes = await fetch('/api/xero/invoices?status=AUTHORISED')
    if (!invRes.ok) {
      return { connected: true, total: null, fallback: 'no_data' }
    }

    const invoices = await invRes.json()
    if (!Array.isArray(invoices)) {
      return { connected: true, total: null, fallback: 'no_data' }
    }

    const total = invoices.reduce(
      (sum: number, inv: { amountDue?: number }) => sum + (inv.amountDue || 0),
      0,
    )
    return { connected: true, total, fallback: null }
  } catch {
    return { connected: false, total: null, fallback: 'no_data' }
  }
}

export async function getUpcomingDeparturesNext7Days(): Promise<DepartureRow[]> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  const { data, error } = await getSupabase()
    .from('tag_along_tours')
    .select('*')
    .gte('date', today)
    .lte('date', in7)
    .order('date', { ascending: true })

  if (error) {
    console.error('Upcoming departures error:', error)
    return []
  }

  // TODO: tag_along_tours.vehicle_id — join fleet vehicle name when departure assignment ships.
  return ((data || []) as Array<Record<string, unknown>>).map((tour) => ({
    id: String(tour.id),
    name: String(tour.name || ''),
    date: String(tour.date || ''),
    seats_total: Number(tour.seats_total) || 0,
    booked_seats: Number(tour.booked_seats) || 0,
    vehicle_name: (tour.vehicle_name as string) || null,
    departure_time: (tour.departure_time as string) || (tour.time as string) || null,
  }))
}

function buildEmptyRevenueDays(): RevenueDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = format(addDays(new Date(), -6 + i), 'yyyy-MM-dd')
    return { date, label: format(new Date(date), 'EEE'), amount: 0 }
  })
}

export async function getRevenueLast7Days(): Promise<RevenueDay[]> {
  const weekAgo = format(addDays(new Date(), -6), 'yyyy-MM-dd')

  const { data, error } = await getSupabase()
    .from('tag_along_bookings')
    .select('amount, created_at, status')
    .gte('created_at', `${weekAgo}T00:00:00`)

  if (error) {
    console.error('Revenue fetch error:', error)
    return buildEmptyRevenueDays()
  }

  const bookings = (data || []).filter((row) => {
    const status = (row.status || '').toLowerCase()
    return !status || status === 'confirmed' || status === 'paid'
  })

  const byDay = new Map<string, number>()
  for (let i = 0; i < 7; i++) {
    const d = format(addDays(new Date(), -6 + i), 'yyyy-MM-dd')
    byDay.set(d, 0)
  }

  for (const booking of bookings) {
    const day = format(new Date(booking.created_at), 'yyyy-MM-dd')
    if (byDay.has(day)) {
      byDay.set(day, (byDay.get(day) || 0) + (Number(booking.amount) || 0))
    }
  }

  return Array.from(byDay.entries()).map(([date, amount]) => ({
    date,
    label: format(new Date(date), 'EEE'),
    amount,
  }))
}

export async function getFleetStatus(): Promise<FleetVehicleStatus[]> {
  try {
    const [vehiclesRes, bookingsRes] = await Promise.all([
      fetch('/api/fleet/vehicles', { cache: 'no-store' }),
      fetch('/api/fleet/bookings', { cache: 'no-store' }),
    ])

    const vehiclesJson = await vehiclesRes.json()
    const bookingsJson = await bookingsRes.json()

    if (!vehiclesRes.ok) return []

    // /api/fleet/vehicles already scopes to family=fleet in tour_products.
    const vehicles = (vehiclesJson.vehicles || []) as Array<{
      id: string
      title: string
      active?: boolean | null
    }>

    const bookings = (bookingsJson.bookings || []) as Array<{
      status?: string | null
      notes?: string | null
    }>

    const today = startOfDay(new Date())
    const bookedVehicleIds = new Set<string>()

    for (const booking of bookings) {
      if ((booking.status || '').toLowerCase() === 'cancelled') continue
      const notes = parseFleetBookingNotes(booking.notes)
      if (!notes) continue
      const start = startOfDay(parseISO(notes.rental.startDate))
      const end = startOfDay(parseISO(notes.rental.endDate))
      if (isWithinInterval(today, { start, end })) {
        bookedVehicleIds.add(notes.vehicle.id)
      }
    }

    return vehicles.map((vehicle) => {
      if (vehicle.active === false) {
        return {
          id: vehicle.id,
          name: vehicle.title,
          status: 'in_service' as const,
          statusLabel: 'In service',
        }
      }
      if (bookedVehicleIds.has(vehicle.id)) {
        return {
          id: vehicle.id,
          name: vehicle.title,
          status: 'on_tour' as const,
          statusLabel: 'On tour',
        }
      }
      return {
        id: vehicle.id,
        name: vehicle.title,
        status: 'available' as const,
        statusLabel: 'Available',
      }
    })
  } catch {
    // TODO: Fleet status — connect tour_products (family=fleet) + fleet bookings API here.
    return []
  }
}

export async function getCrmSnapshot(): Promise<CrmSnapshot> {
  try {
    const res = await fetch('/api/crm/customers', { cache: 'no-store' })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error || 'Failed to load customers')

    const customers = (json.customers || []) as Array<{
      created_at: string
      total_bookings?: number | null
    }>

    const weekAgo = addDays(new Date(), -7)
    const newThisWeek = customers.filter((c) => new Date(c.created_at) >= weekAgo).length
    const totalCustomers = customers.length

    const withBookingCounts = customers.filter((c) => typeof c.total_bookings === 'number')
    let repeatBookerPercent: number | null = null
    if (withBookingCounts.length >= 5 && totalCustomers > 0) {
      const repeaters = withBookingCounts.filter((c) => (c.total_bookings || 0) > 1).length
      repeatBookerPercent = Math.round((repeaters / withBookingCounts.length) * 100)
    }

    return { newThisWeek, totalCustomers, repeatBookerPercent }
  } catch {
    return { newThisWeek: 0, totalCustomers: 0, repeatBookerPercent: null }
  }
}
