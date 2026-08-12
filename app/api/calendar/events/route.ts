import { NextResponse } from 'next/server'
import { parseAddOnBookingNotes } from '@/lib/add-ons'
import { bookingsDb } from '@/lib/bookings-db'
import { parseFleetBookingNotes, fullCustomerName, usageTypeLabel, vehicleRegistration } from '@/lib/fleet'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApprovedAdminUser } from '@/lib/auth-server'

type FleetBookingRow = {
  id: string
  notes?: string | null
  status?: string | null
}

type AddOnBookingRow = {
  id: string
  name?: string | null
  email?: string | null
  tour_date?: string | null
  passengers?: number | null
  status?: string | null
  notes?: string | null
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
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const [fleetRes, departuresRes, productsRes, addOnRes] = await Promise.all([
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
      /* Experiences live in tag_along_bookings tagged addon, in whichever
         project owns bookings — the same source the bookings hub reads, so the
         calendar cannot disagree with it. Resolved separately from the error
         check below: an add-on read that fails should cost the calendar its
         experiences, not its vehicles and departures. */
      (async () => {
        try {
          return await bookingsDb()
            .from('tag_along_bookings')
            .select('id,name,email,tour_date,passengers,status,notes')
            .eq('booking_type', 'addon')
            .order('tour_date', { ascending: true })
        } catch (error) {
          return { data: [], error }
        }
      })(),
    ])

    if (fleetRes.error || departuresRes.error || productsRes.error) {
      console.error('Calendar events fetch error:', fleetRes.error || departuresRes.error || productsRes.error)
      return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 })
    }

    if (addOnRes.error) console.error('Calendar add-on fetch error:', addOnRes.error)

    /* Client records, keyed on the email every booking already stores, so a
       company booking can be shown under its trading name. Failing to load
       them costs the calendar the business names, not the calendar. */
    const businessByEmail = new Map<string, string>()
    try {
      const { data: clients } = await supabaseAdmin
        .from('customers')
        .select('email,business_name')
        .limit(1000)
      for (const client of clients || []) {
        const email = String(client.email || '').trim().toLowerCase()
        const business = String(client.business_name || '').trim()
        if (email && business) businessByEmail.set(email, business)
      }
    } catch (error) {
      console.error('Calendar client lookup error:', error)
    }

    const businessFor = (email?: string | null) =>
      businessByEmail.get(String(email || '').trim().toLowerCase()) || null

    const products = Object.fromEntries(((productsRes.data || []) as ProductRow[]).map((product) => [product.id, product]))

    const fleetEvents = ((fleetRes.data || []) as FleetBookingRow[])
      .filter((row) => (row.status || '').toLowerCase() !== 'cancelled')
      .map((row) => {
        const details = parseFleetBookingNotes(row.notes)
        if (!details) return null

        const person = fullCustomerName(details)
        const business = businessFor(details.customer.email)
        const registration =
          vehicleRegistration({ summary: details.vehicle.registrationNumber }) ||
          details.vehicle.registrationNumber

        return {
          id: row.id,
          kind: 'fleet' as const,
          title: details.vehicle.title,
          /* Who booked it — the thing the office is asked about when the phone
             rings. A company shows under its trading name with the person who
             made the booking after it, because both get used: the invoice says
             one, the person on the day answers to the other. */
          customer: business ? `${business} — ${person}` : person,
          detail: `${usageTypeLabel(details.rental.usageType)} · ${registration}`,
          subtitle: `${usageTypeLabel(details.rental.usageType)} · ${person} · ${registration}`,
          start: details.rental.startDate,
          end: details.rental.endDate,
        }
      })
      .filter((event): event is NonNullable<typeof event> => Boolean(event))

    const departureEvents = ((departuresRes.data || []) as DepartureRow[]).map((departure) => ({
      id: departure.id,
      kind: 'tour' as const,
      title: products[departure.product_id]?.title || 'Service departure',
      customer: null,
      detail: departure.departure_time ? `Departs ${departure.departure_time}` : 'Scheduled departure',
      subtitle: departure.departure_time ? `Departure at ${departure.departure_time}` : 'Scheduled departure',
      start: departure.departure_date,
      end: departure.departure_date,
    }))

    const addOnEvents = ((addOnRes.data || []) as AddOnBookingRow[])
      .filter((row) => (row.status || '').toLowerCase() !== 'cancelled' && row.tour_date)
      .map((row) => {
        const details = parseAddOnBookingNotes(row.notes)
        const experiences = (details?.lines || []).map((line) => line.name).filter(Boolean)
        const guests = row.passengers || 0
        const person = row.name || 'Guest'
        const business = businessFor(row.email)
        return {
          id: row.id,
          kind: 'addon' as const,
          /* The experiences are the event; the customer is who it is for. A
             booking covering two experiences names both rather than showing
             the generic "Add-on booking" the row itself carries. */
          title: experiences.join(' + ') || 'Experience',
          customer: business ? `${business} — ${person}` : person,
          detail: guests ? `${guests} pax` : null,
          subtitle: [person, guests ? `${guests} pax` : null].filter(Boolean).join(' · '),
          start: row.tour_date as string,
          end: row.tour_date as string,
        }
      })

    return NextResponse.json({ events: [...fleetEvents, ...departureEvents, ...addOnEvents] })
  } catch (error) {
    console.error('Calendar events route error:', error)
    return NextResponse.json({ error: 'Failed to load calendar events' }, { status: 500 })
  }
}
