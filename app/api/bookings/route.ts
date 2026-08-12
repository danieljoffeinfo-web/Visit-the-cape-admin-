import { NextRequest, NextResponse } from 'next/server'
import { logActivityServer } from '@/lib/activity-log-server'
import {
  addOnBookingTotal,
  summariseAddOnLines,
  type AddOnBookingNotes,
  type AddOnLine,
} from '@/lib/add-ons'
import { generateBookingReference, getApprovedAdminUser } from '@/lib/auth-server'
import type { AdminUser } from '@/lib/auth-types'
import {
  filterBookingsByTab,
  normalizeEnquiryRow,
  normalizeFleetRow,
  normalizePrivateTourBookingRow,
  normalizeTagAlongRow,
  sortBookings,
  type BookingTab,
} from '@/lib/bookings'
import { bookingsDb } from '@/lib/bookings-db'
import { getContentSupabaseAdmin } from '@/lib/content-supabase-admin'
import { deleteEnquiry, fetchEnquiriesFromSource } from '@/lib/enquiries-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

/** Shape of the rows the website's PayGate flow writes. */
type WebsiteBookingRow = Parameters<typeof normalizePrivateTourBookingRow>[0]

async function fetchWebsiteBookings(): Promise<{ data: WebsiteBookingRow[] }> {
  try {
    const { data, error } = await getContentSupabaseAdmin()
      .from('private_tour_bookings')
      .select(
        'id,booking_reference,tour_name,tour_date,passengers,amount_cents,customer_name,customer_email,payment_status,created_at',
      )
      .order('created_at', { ascending: false })
      .limit(200)
    if (error) throw error
    return { data: (data || []) as WebsiteBookingRow[] }
  } catch (error) {
    console.error('Website bookings fetch error:', error)
    return { data: [] }
  }
}

async function fetchAllBookings() {
  const [tagAlongRes, enquiries, fleetRes, invoicesRes, websiteRes] = await Promise.all([
    bookingsDb().from('tag_along_bookings').select('*').order('created_at', { ascending: false }).limit(200),
    // Private enquiries come from whichever project owns them — same source the
    // Enquiries inbox reads, so both tabs show the same rows.
    fetchEnquiriesFromSource().catch((error) => {
      console.error('Bookings private enquiries fetch error:', error)
      return []
    }),
    supabaseAdmin
      .from('tour_bookings')
      .select('id,name,email,passengers,amount,status,notes,created_at')
      .eq('booking_type', 'fleet')
      .order('created_at', { ascending: false })
      .limit(200),
    supabaseAdmin.from('xero_invoice_links').select('booking_id,status'),
    // Private tours paid for on the website. Nothing in the dashboard read this
    // table, so a customer could pay through PayGate and the booking existed
    // only in the database. Soft-failed: a schema difference here must not take
    // the whole bookings hub down with it.
    fetchWebsiteBookings(),
  ])

  if (tagAlongRes.error) throw tagAlongRes.error
  if (fleetRes.error) throw fleetRes.error

  const invoiceMap = Object.fromEntries(
    ((invoicesRes.data || []) as Array<{ booking_id: string; status?: string | null }>).map((link) => [
      link.booking_id,
      link.status,
    ]),
  )

  const tagAlong = (tagAlongRes.data || []).map(normalizeTagAlongRow)
  const privateRows = enquiries.map(normalizeEnquiryRow)
  const fleet = (fleetRes.data || []).map((row) =>
    normalizeFleetRow(row, invoiceMap[row.id] || null),
  )
  const website = websiteRes.data.map(normalizePrivateTourBookingRow)

  return sortBookings([...tagAlong, ...privateRows, ...fleet, ...website])
}

export async function GET(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let type = (request.nextUrl.searchParams.get('type') || 'all') as BookingTab | 'tour'
  if (type === 'tour') type = 'tours'

  try {
    const all = await fetchAllBookings()
    const bookings = filterBookingsByTab(all, type)
    return NextResponse.json({ bookings })
  } catch (error) {
    console.error('Bookings fetch error:', error)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
}

/**
 * Book one or more add-on adventures for a customer.
 *
 * It writes the same `tag_along_bookings` row a tour booking writes, tagged
 * `booking_type: 'addon'`, with the chosen experiences as JSON in `notes`. That
 * is what lets it inherit the whole existing pipeline — the bookings table, the
 * invoice PDF, the Xero link, the revenue chart — instead of growing a second
 * one alongside it.
 *
 * The total is computed here from quantity × unit price rather than taken from
 * the request, so what is invoiced is always what the line items add up to. The
 * unit price itself does come from the form: several add-ons are quoted per
 * enquiry, and letting the person on the phone type the agreed number is the
 * entire point.
 */
async function createAddOnBooking(admin: AdminUser, body: Record<string, unknown>) {
  const customerName = String(body.customerName || '').trim()
  const customerEmail = String(body.customerEmail || '').trim()
  const bookingDate = String(body.tourDate || '').trim()

  if (!customerName || !customerEmail || !bookingDate) {
    return NextResponse.json({ error: 'Name, email and date are required' }, { status: 400 })
  }

  const rawLines = Array.isArray(body.lines) ? body.lines : []
  const lines: AddOnLine[] = rawLines.flatMap((entry) => {
    const line = entry as Record<string, unknown>
    const name = String(line.name || '').trim()
    if (!name) return []
    const quantity = Math.max(1, Math.round(Number(line.quantity) || 1))
    const unitAmount = Math.max(0, Number(line.unitAmount) || 0)
    return [{ slug: String(line.slug || ''), name, quantity, unitAmount }]
  })

  if (lines.length === 0) {
    return NextResponse.json({ error: 'Choose at least one add-on' }, { status: 400 })
  }

  const total = addOnBookingTotal(lines)
  const bookingReference = generateBookingReference('ADDON')
  const notes: AddOnBookingNotes = {
    kind: 'addon',
    lines,
    note: body.notes ? String(body.notes) : null,
    invoice: { number: bookingReference, issuedAt: new Date().toISOString().slice(0, 10) },
  }

  const row = {
    name: customerName,
    email: customerEmail,
    phone: body.customerPhone ? String(body.customerPhone) : null,
    tour_name: summariseAddOnLines(lines),
    tour_date: bookingDate,
    tour_id: null,
    passengers: body.guestsCount ? parseInt(String(body.guestsCount), 10) : 1,
    amount: total,
    notes: JSON.stringify(notes),
    booking_reference: bookingReference,
    source: 'internal',
    booking_type: 'addon',
    status: body.status ? String(body.status) : 'confirmed',
    payment_status: body.paymentStatus ? String(body.paymentStatus) : 'pending',
    created_by_user_id: admin.id,
    created_by_name: admin.full_name,
    created_by_color: admin.color,
  }

  const { data, error } = await bookingsDb().from('tag_along_bookings').insert(row).select('*').single()
  if (error) {
    console.error('Add-on booking create error:', error)
    return NextResponse.json({ error: 'Failed to create add-on booking' }, { status: 500 })
  }

  await logActivityServer({
    admin,
    action: 'Created add-on booking',
    entityType: 'addon_booking',
    entityId: data.id,
    entityLabel: `${customerName} — ${row.tour_name}`,
    newValue: row,
  })

  return NextResponse.json({ booking: normalizeTagAlongRow(data) })
}

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = request.nextUrl.searchParams.get('type')
  const body = await request.json()

  if (type === 'addon') {
    return createAddOnBooking(admin, body)
  }

  if (type !== 'tour' && type !== 'internal') {
    return NextResponse.json({ error: 'Invalid booking type' }, { status: 400 })
  }

  const {
    customerName,
    customerEmail,
    customerPhone,
    tourName,
    tourDate,
    tourId,
    guestsCount,
    amount,
    vehicleName,
    notes,
    status,
    paymentStatus,
  } = body

  if (!customerName || !customerEmail || !tourName || !tourDate) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  const isInternal = type === 'internal'
  const bookingReference = generateBookingReference(isInternal ? 'INT' : 'TOUR')
  const row = {
    name: customerName,
    email: customerEmail,
    phone: customerPhone || null,
    tour_name: tourName,
    tour_date: tourDate,
    tour_id: tourId || null,
    passengers: guestsCount ? parseInt(String(guestsCount), 10) : 1,
    amount: amount ? parseFloat(String(amount)) : null,
    vehicle_name: vehicleName || null,
    notes: notes || null,
    booking_reference: bookingReference,
    source: isInternal ? 'internal' : 'manual',
    booking_type: isInternal ? 'internal' : 'tour',
    status: status || 'confirmed',
    payment_status: paymentStatus || 'pending',
    created_by_user_id: admin.id,
    created_by_name: admin.full_name,
    created_by_color: admin.color,
  }

  const { data, error } = await bookingsDb().from('tag_along_bookings').insert(row).select('*').single()
  if (error) {
    console.error('Booking create error:', error)
    return NextResponse.json({ error: 'Failed to create booking' }, { status: 500 })
  }

  await logActivityServer({
    admin,
    action: isInternal ? 'Created internal booking' : 'Created tour booking manually',
    entityType: isInternal ? 'internal_booking' : 'tour_booking',
    entityId: data.id,
    entityLabel: `${customerName} — ${tourName}`,
    newValue: row,
  })

  return NextResponse.json({ booking: normalizeTagAlongRow(data) })
}

export async function PATCH(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, kind, ...updates } = body
  if (!id || !kind) {
    return NextResponse.json({ error: 'Booking id and kind required' }, { status: 400 })
  }

  if (kind === 'fleet') {
    return NextResponse.json({ error: 'Use /api/fleet/bookings for fleet updates' }, { status: 400 })
  }

  if (kind === 'private') {
    return NextResponse.json({ error: 'Private enquiries are read-only in bookings hub' }, { status: 400 })
  }

  if (kind === 'website') {
    /* Cancel only. The details are the customer's own, entered on the website
       and paid against, so the edit dialog holds them read-only and the one
       state the office needs to set is "this is not happening".
       private_tour_bookings has no status column — payment_status is the only
       state the PayGate flow tracks, so the cancellation records itself there.
       Falling through to the branch below would look the row up in
       tag_along_bookings, where it has never existed, and answer 404. */
    if (updates.status !== 'cancelled') {
      return NextResponse.json(
        { error: 'Website bookings can only be cancelled from the bookings hub' },
        { status: 400 },
      )
    }

    const content = getContentSupabaseAdmin()
    const { data: existingWebsite } = await content
      .from('private_tour_bookings')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (!existingWebsite) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { data, error } = await content
      .from('private_tour_bookings')
      .update({ payment_status: 'cancelled' })
      .eq('id', id)
      .select('*')
      .single()

    if (error) {
      console.error('Website booking cancel error:', error)
      return NextResponse.json({ error: 'Failed to cancel booking' }, { status: 500 })
    }

    await logActivityServer({
      admin,
      action: 'Cancelled website booking',
      entityType: 'website_booking',
      entityId: id,
      entityLabel: existingWebsite.customer_name
        ? `${existingWebsite.customer_name} — ${existingWebsite.tour_name || 'Private tour'}`
        : id,
      oldValue: existingWebsite,
      newValue: data,
    })

    return NextResponse.json({ booking: normalizePrivateTourBookingRow(data) })
  }

  const { data: existing } = await bookingsDb()
    .from('tag_along_bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const allowed: Record<string, unknown> = {}
  /* Who and when, not just how much. Correcting a misspelled name or a wrong
     date used to mean cancelling the booking and taking it again. Absent means
     "leave alone", so a form sending one field cannot blank the others. */
  if (updates.customerName !== undefined) allowed.name = String(updates.customerName).trim()
  if (updates.customerEmail !== undefined) allowed.email = String(updates.customerEmail).trim()
  if (updates.customerPhone !== undefined) allowed.phone = String(updates.customerPhone).trim() || null
  if (updates.tourName !== undefined) allowed.tour_name = String(updates.tourName).trim()
  if (updates.tourDate !== undefined) allowed.tour_date = String(updates.tourDate) || null
  if (updates.status !== undefined) allowed.status = updates.status
  if (updates.payment_status !== undefined) allowed.payment_status = updates.payment_status
  if (updates.invoice_status !== undefined) allowed.invoice_status = updates.invoice_status
  if (updates.vehicle_name !== undefined) allowed.vehicle_name = updates.vehicle_name
  if (updates.notes !== undefined) allowed.notes = updates.notes
  if (updates.guestsCount !== undefined) allowed.passengers = parseInt(String(updates.guestsCount), 10)
  if (updates.amount !== undefined) allowed.amount = parseFloat(String(updates.amount))
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await bookingsDb()
    .from('tag_along_bookings')
    .update(allowed)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Booking update error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }

  const internal = existing.source === 'internal' || existing.booking_type === 'internal'
  await logActivityServer({
    admin,
    action:
      updates.status === 'cancelled'
        ? internal
          ? 'Cancelled internal booking'
          : 'Cancelled tour booking'
        : internal
          ? 'Updated internal booking'
          : 'Updated tour booking',
    entityType: internal ? 'internal_booking' : 'tour_booking',
    entityId: id,
    entityLabel: existing.name ? `${existing.name} — ${existing.tour_name || 'Booking'}` : id,
    oldValue: existing,
    newValue: data,
  })

  return NextResponse.json({ booking: normalizeTagAlongRow(data) })
}

/**
 * Permanently delete a booking or enquiry from the bookings hub.
 *
 * Distinct from PATCH status=cancelled, which keeps the row for the record.
 * Fleet rows also clear their invoice link; the Xero invoice itself is left
 * alone, since accounting records should not vanish because a row was tidied up.
 */
export async function DELETE(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { id?: string; kind?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Booking id and kind required' }, { status: 400 })
  }

  const id = String(body.id || '').trim()
  const kind = String(body.kind || '').trim()

  if (!id || !kind) {
    return NextResponse.json({ error: 'Booking id and kind required' }, { status: 400 })
  }

  try {
    if (kind === 'private') {
      await deleteEnquiry(id)
    } else if (kind === 'fleet') {
      const { error } = await supabaseAdmin
        .from('tour_bookings')
        .delete()
        .eq('id', id)
        .eq('booking_type', 'fleet')
      if (error) throw error
      await supabaseAdmin.from('xero_invoice_links').delete().eq('booking_id', id)
    } else if (kind === 'tour' || kind === 'internal' || kind === 'addon') {
      const { error } = await bookingsDb().from('tag_along_bookings').delete().eq('id', id)
      if (error) throw error
      await supabaseAdmin.from('xero_invoice_links').delete().eq('booking_id', id)
    } else if (kind === 'website') {
      /* Owned by the content project, not this one — the website's PayGate flow
         writes them. Deleting through supabaseAdmin would report success while
         deleting nothing, since the row is not in that database at all. */
      const { error } = await getContentSupabaseAdmin()
        .from('private_tour_bookings')
        .delete()
        .eq('id', id)
      if (error) throw error
      await supabaseAdmin.from('xero_invoice_links').delete().eq('booking_id', id)
    } else {
      return NextResponse.json({ error: `Cannot delete booking of type "${kind}"` }, { status: 400 })
    }

    await logActivityServer({
      admin,
      action: 'Deleted booking',
      entityType: kind === 'private' ? 'enquiry' : `${kind}_booking`,
      entityId: id,
      entityLabel: id,
      metadata: { kind, permanent: true },
    })

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to delete booking'
    console.error('Booking delete error:', error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
