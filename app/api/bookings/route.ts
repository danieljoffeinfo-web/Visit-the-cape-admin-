import { NextRequest, NextResponse } from 'next/server'
import { logActivityServer } from '@/lib/activity-log-server'
import { generateBookingReference, getApprovedAdminUser } from '@/lib/auth-server'
import {
  filterBookingsByTab,
  normalizeTagAlongRow,
  sortBookings,
  type BookingTab,
} from '@/lib/bookings'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function fetchAllBookings() {
  const { data, error } = await supabaseAdmin
    .from('tag_along_bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) throw error
  return sortBookings((data || []).map(normalizeTagAlongRow))
}

export async function GET(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let type = (request.nextUrl.searchParams.get('type') || 'all') as BookingTab | 'tour' | 'internal'
  if (type === 'tour' || type === 'internal') type = 'tours'

  try {
    const all = await fetchAllBookings()
    const bookings = filterBookingsByTab(all, type)
    return NextResponse.json({ bookings })
  } catch (error) {
    console.error('Bookings fetch error:', error)
    return NextResponse.json({ error: 'Failed to load bookings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const type = request.nextUrl.searchParams.get('type')
  const body = await request.json()

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

  const { data, error } = await supabaseAdmin.from('tag_along_bookings').insert(row).select('*').single()
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

  if (kind !== 'tour' && kind !== 'internal') {
    return NextResponse.json({ error: 'Only tour bookings can be edited here' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('tag_along_bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const allowed: Record<string, unknown> = {}
  if (updates.customerName !== undefined) allowed.name = String(updates.customerName).trim()
  if (updates.customerEmail !== undefined) allowed.email = String(updates.customerEmail).trim()
  if (updates.customerPhone !== undefined) allowed.phone = updates.customerPhone ? String(updates.customerPhone).trim() : null
  if (updates.tourName !== undefined) allowed.tour_name = String(updates.tourName).trim()
  if (updates.tourDate !== undefined) allowed.tour_date = updates.tourDate
  if (updates.status !== undefined) allowed.status = updates.status
  if (updates.payment_status !== undefined) allowed.payment_status = updates.payment_status
  if (updates.invoice_status !== undefined) allowed.invoice_status = updates.invoice_status
  if (updates.vehicleName !== undefined) allowed.vehicle_name = updates.vehicleName || null
  if (updates.notes !== undefined) allowed.notes = updates.notes || null
  if (updates.guestsCount !== undefined) allowed.passengers = parseInt(String(updates.guestsCount), 10)
  if (updates.amount !== undefined) allowed.amount = updates.amount === '' || updates.amount === null ? null : parseFloat(String(updates.amount))
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
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

export async function DELETE(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, kind } = body
  if (!id || !kind) {
    return NextResponse.json({ error: 'Booking id and kind required' }, { status: 400 })
  }

  if (kind !== 'tour' && kind !== 'internal') {
    return NextResponse.json({ error: 'Only tour bookings can be deleted here' }, { status: 400 })
  }

  const { data: existing } = await supabaseAdmin
    .from('tag_along_bookings')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin.from('tag_along_bookings').delete().eq('id', id)
  if (error) {
    console.error('Booking delete error:', error)
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
  }

  const internal = existing.source === 'internal' || existing.booking_type === 'internal'
  await logActivityServer({
    admin,
    action: internal ? 'Deleted internal booking' : 'Deleted tour booking',
    entityType: internal ? 'internal_booking' : 'tour_booking',
    entityId: id,
    entityLabel: existing.name ? `${existing.name} — ${existing.tour_name || 'Booking'}` : id,
    oldValue: existing,
  })

  return NextResponse.json({ ok: true })
}
