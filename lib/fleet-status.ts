import { format, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { fullCustomerName, parseFleetBookingNotes } from '@/lib/fleet'
import { listFleetVehicles } from '@/lib/fleet-db'
import { supabaseAdmin } from '@/lib/supabase-admin'
import type { FleetVehicleStatus } from '@/lib/dashboard'

/** Cape Town calendar date (Africa/Johannesburg) for fleet rental checks. */
export function getCapeTownToday(): Date {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Johannesburg',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return startOfDay(parseISO(ymd))
}

export function getCapeTownTodayKey(): string {
  return format(getCapeTownToday(), 'yyyy-MM-dd')
}

function isActiveOnDay(day: Date, startDate: string, endDate: string): boolean {
  const start = startOfDay(parseISO(startDate))
  const end = startOfDay(parseISO(endDate))
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return false
  return isWithinInterval(day, { start, end })
}

export type FleetBookingSummary = {
  bookingId: string
  vehicleId: string
  vehicleName: string
  customerName: string
  startDate: string
  endDate: string
  status: string
  amount: number | null
  isActiveToday: boolean
}

export type FleetOperationalSnapshot = {
  today: string
  timezone: 'Africa/Johannesburg'
  vehicleCount: number
  bookedToday: number
  availableToday: number
  vehicles: Array<{
    id: string
    title: string
    daily_rate: number | null
    active: boolean
    status: FleetVehicleStatus['status']
    statusLabel: string
  }>
  activeBookingsToday: FleetBookingSummary[]
  upcomingBookings: FleetBookingSummary[]
  recentFleetBookings: FleetBookingSummary[]
}

export async function getFleetOperationalSnapshot(): Promise<FleetOperationalSnapshot> {
  const today = getCapeTownToday()
  const todayStr = format(today, 'yyyy-MM-dd')

  const [vehiclesResult, bookingsRes] = await Promise.all([
    listFleetVehicles(),
    supabaseAdmin
      .from('tour_bookings')
      .select('id,status,amount,notes,created_at')
      .eq('booking_type', 'fleet')
      .order('created_at', { ascending: false }),
  ])

  const vehicles = vehiclesResult.data || []
  const bookedTodayIds = new Set<string>()
  const summaries: FleetBookingSummary[] = []

  for (const row of bookingsRes.data || []) {
    if ((row.status || '').toLowerCase() === 'cancelled') continue
    const notes = parseFleetBookingNotes(row.notes)
    if (!notes) continue

    const active = isActiveOnDay(today, notes.rental.startDate, notes.rental.endDate)
    if (active) bookedTodayIds.add(notes.vehicle.id)

    summaries.push({
      bookingId: row.id,
      vehicleId: notes.vehicle.id,
      vehicleName: notes.vehicle.title,
      customerName: fullCustomerName(notes),
      startDate: notes.rental.startDate,
      endDate: notes.rental.endDate,
      status: row.status || 'confirmed',
      amount: row.amount ?? notes.rental.totalAmount ?? null,
      isActiveToday: active,
    })
  }

  const activeBookingsToday = summaries.filter((b) => b.isActiveToday)
  const upcomingBookings = summaries.filter(
    (b) => !b.isActiveToday && startOfDay(parseISO(b.startDate)) > today,
  )

  const vehicleRows = vehicles.map((vehicle) => {
    if (vehicle.active === false) {
      return {
        id: vehicle.id,
        title: vehicle.title,
        daily_rate: vehicle.base_price ?? null,
        active: false,
        status: 'in_service' as const,
        statusLabel: 'In service',
      }
    }
    if (bookedTodayIds.has(vehicle.id)) {
      return {
        id: vehicle.id,
        title: vehicle.title,
        daily_rate: vehicle.base_price ?? null,
        active: true,
        status: 'on_tour' as const,
        statusLabel: 'Booked',
      }
    }
    return {
      id: vehicle.id,
      title: vehicle.title,
      daily_rate: vehicle.base_price ?? null,
      active: true,
      status: 'available' as const,
      statusLabel: 'Available',
    }
  })

  return {
    today: todayStr,
    timezone: 'Africa/Johannesburg',
    vehicleCount: vehicles.length,
    bookedToday: bookedTodayIds.size,
    availableToday: vehicles.filter((v) => v.active !== false && !bookedTodayIds.has(v.id)).length,
    vehicles: vehicleRows,
    activeBookingsToday,
    upcomingBookings: upcomingBookings.slice(0, 20),
    recentFleetBookings: summaries.slice(0, 50),
  }
}

export async function getFleetStatusForDashboard(): Promise<FleetVehicleStatus[]> {
  const snapshot = await getFleetOperationalSnapshot()
  return snapshot.vehicles.map((v) => ({
    id: v.id,
    name: v.title,
    status: v.status,
    statusLabel: v.statusLabel,
  }))
}
