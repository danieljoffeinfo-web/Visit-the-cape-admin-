import { eachDayOfInterval, format, parseISO } from 'date-fns'
import { parseFleetBookingNotes } from '@/lib/fleet'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type FleetAvailabilityResult = {
  vehicleCount: number
  fullyBookedDates: string[]
  availabilityByDate: Record<string, { booked: number; total: number; available: number }>
}

function dateKey(date: Date) {
  return format(date, 'yyyy-MM-dd')
}

export async function getFleetAvailability(from: string, to: string): Promise<FleetAvailabilityResult> {
  const rangeStart = parseISO(from)
  const rangeEnd = parseISO(to)
  if (Number.isNaN(rangeStart.getTime()) || Number.isNaN(rangeEnd.getTime()) || rangeEnd < rangeStart) {
    return { vehicleCount: 0, fullyBookedDates: [], availabilityByDate: {} }
  }

  const [{ data: vehicles, error: vehicleError }, { data: bookings, error: bookingError }] = await Promise.all([
    supabaseAdmin.from('tour_products').select('id').eq('family', 'fleet').eq('active', true),
    supabaseAdmin.from('tour_bookings').select('notes,status').eq('booking_type', 'fleet'),
  ])

  if (vehicleError) throw vehicleError
  if (bookingError) throw bookingError

  const vehicleCount = vehicles?.length || 0
  const bookedVehiclesByDay = new Map<string, Set<string>>()

  for (const booking of bookings || []) {
    if ((booking.status || '').toLowerCase() === 'cancelled') continue
    const notes = parseFleetBookingNotes(booking.notes)
    if (!notes?.vehicle?.id || !notes.rental?.startDate || !notes.rental?.endDate) continue

    const start = parseISO(notes.rental.startDate)
    const end = parseISO(notes.rental.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) continue

    for (const day of eachDayOfInterval({ start, end })) {
      const key = dateKey(day)
      if (!bookedVehiclesByDay.has(key)) bookedVehiclesByDay.set(key, new Set())
      bookedVehiclesByDay.get(key)!.add(notes.vehicle.id)
    }
  }

  const fullyBookedDates: string[] = []
  const availabilityByDate: FleetAvailabilityResult['availabilityByDate'] = {}

  for (const day of eachDayOfInterval({ start: rangeStart, end: rangeEnd })) {
    const key = dateKey(day)
    const booked = bookedVehiclesByDay.get(key)?.size || 0
    const available = Math.max(0, vehicleCount - booked)
    availabilityByDate[key] = { booked, total: vehicleCount, available }
    if (vehicleCount > 0 && booked >= vehicleCount) fullyBookedDates.push(key)
  }

  return { vehicleCount, fullyBookedDates, availabilityByDate }
}
