import { NextResponse } from 'next/server'
import { parseFleetBookingNotes, fullCustomerName, usageTypeLabel, vehicleRegistration } from '@/lib/fleet'
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
}

export async function GET() {
  try {
    const [fleetRes, departuresRes, productsRes] = await Promise.all([
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
    ])

    if (fleetRes.error || departuresRes.error || productsRes.error) {
      console.error('Calendar events fetch error:', fleetRes.error || departuresRes.error || productsRes.error)
      return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 })
    }

    const products = Object.fromEntries(((productsRes.data || []) as ProductRow[]).map((product) => [product.id, product]))

    const fleetEvents = ((fleetRes.data || []) as FleetBookingRow[])
      .filter((row) => (row.status || '').toLowerCase() !== 'cancelled')
      .map((row) => {
        const details = parseFleetBookingNotes(row.notes)
        if (!details) return null

        return {
          id: row.id,
          kind: 'fleet' as const,
          title: details.vehicle.title,
          subtitle: `${usageTypeLabel(details.rental.usageType)} · ${fullCustomerName(details)} · ${vehicleRegistration({ summary: details.vehicle.registrationNumber }) || details.vehicle.registrationNumber}`,
          start: details.rental.startDate,
          end: details.rental.endDate,
        }
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event))

    const departureEvents = ((departuresRes.data || []) as DepartureRow[]).map((departure) => ({
      id: departure.id,
      kind: 'tour' as const,
      title: products[departure.product_id]?.title || 'Service departure',
      subtitle: departure.departure_time ? `Departure at ${departure.departure_time}` : 'Scheduled departure',
      start: departure.departure_date,
      end: departure.departure_date,
    }))

    return NextResponse.json({ events: [...fleetEvents, ...departureEvents] })
  } catch (error) {
    console.error('Calendar events route error:', error)
    return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 })
  }
}
