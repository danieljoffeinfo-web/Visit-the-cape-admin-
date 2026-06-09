import { NextResponse } from 'next/server'
import {
  enrichFleetVehicle,
  parseFleetBookingNotes,
  vehicleCalendarColor,
  vehicleCalendarLabel,
} from '@/lib/fleet'
import { supabaseAdmin } from '@/lib/supabase-admin'

type FleetBookingRow = {
  id: string
  notes?: string | null
  status?: string | null
}

type DepartureRow = {
  id: string
  product_id: string
  departure_date: string
  departure_time?: string | null
}

type ProductRow = {
  id: string
  title: string
  summary?: string | null
  pickup_notes?: string | null
}

export async function GET() {
  try {
    const [fleetRes, departuresRes, productsRes, vehiclesRes] = await Promise.all([
      supabaseAdmin
        .from('tour_bookings')
        .select('id,notes,status')
        .eq('booking_type', 'fleet')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('tour_departures')
        .select('id,product_id,departure_date,departure_time')
        .order('departure_date', { ascending: true }),
      supabaseAdmin
        .from('tour_products')
        .select('id,title'),
      supabaseAdmin
        .from('tour_products')
        .select('id,title,summary,pickup_notes')
        .eq('family', 'fleet'),
    ])

    if (fleetRes.error || departuresRes.error || productsRes.error || vehiclesRes.error) {
      console.error('Calendar events fetch error:', fleetRes.error || departuresRes.error || productsRes.error || vehiclesRes.error)
      return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 })
    }

    const products = Object.fromEntries(((productsRes.data || []) as ProductRow[]).map((product) => [product.id, product]))
    const vehicles = ((vehiclesRes.data || []) as ProductRow[]).map((row) => enrichFleetVehicle(row))
    const vehicleMap = Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle]))

    const fleetEvents = ((fleetRes.data || []) as FleetBookingRow[])
      .filter((row) => (row.status || '').toLowerCase() !== 'cancelled')
      .map((row) => {
        const details = parseFleetBookingNotes(row.notes)
        if (!details) return null

        const vehicle = vehicleMap[details.vehicle.id]
        const label = vehicle ? vehicleCalendarLabel(vehicle) : details.vehicle.title
        const color = vehicle ? vehicleCalendarColor(vehicle) : null

        return {
          id: row.id,
          kind: 'fleet' as const,
          title: details.vehicle.title,
          label,
          color,
          vehicleId: details.vehicle.id,
          subtitle: `${details.customer.firstName} ${details.customer.surname}`.trim(),
          start: details.rental.startDate,
          end: details.rental.endDate,
        }
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event))

    const serviceEvents = vehicles.flatMap((vehicle) =>
      (vehicle.serviceBlocks || []).map((block) => ({
        id: `service-${vehicle.id}-${block.id}`,
        kind: 'service' as const,
        title: vehicle.title,
        label: vehicleCalendarLabel(vehicle),
        color: vehicleCalendarColor(vehicle),
        vehicleId: vehicle.id,
        subtitle: block.notes || 'Scheduled service',
        start: block.startDate,
        end: block.endDate,
      })),
    )

    const departureEvents = ((departuresRes.data || []) as DepartureRow[]).map((departure) => ({
      id: departure.id,
      kind: 'tour' as const,
      title: products[departure.product_id]?.title || 'Service departure',
      label: products[departure.product_id]?.title || 'Departure',
      color: null,
      subtitle: departure.departure_time ? `Departure at ${departure.departure_time}` : 'Scheduled departure',
      start: departure.departure_date,
      end: departure.departure_date,
    }))

    const vehicleLegend = vehicles.map((vehicle) => ({
      id: vehicle.id,
      label: vehicleCalendarLabel(vehicle),
      color: vehicleCalendarColor(vehicle),
      registration: vehicle.summary || '',
    }))

    return NextResponse.json({ events: [...fleetEvents, ...serviceEvents, ...departureEvents], vehicleLegend })
  } catch (error) {
    console.error('Calendar events route error:', error)
    return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 })
  }
}
