import { NextRequest, NextResponse } from 'next/server'
import { logActivityServer } from '@/lib/activity-log-server'
import { generateBookingReference, getApprovedAdminUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('tag_along_bookings')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Tour bookings fetch error:', error)
    return NextResponse.json({ error: 'Failed to load tour bookings' }, { status: 500 })
  }

  return NextResponse.json({ bookings: data || [] })
}

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
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

  const bookingReference = generateBookingReference('TOUR')
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
    source: 'manual',
    booking_type: 'tour',
    status: status || 'confirmed',
    payment_status: paymentStatus || 'pending',
    created_by_user_id: admin.id,
    created_by_name: admin.full_name,
    created_by_color: admin.color,
  }

  const { data, error } = await supabaseAdmin
    .from('tag_along_bookings')
    .insert(row)
    .select('*')
    .single()

  if (error) {
    console.error('Tour booking create error:', error)
    return NextResponse.json({ error: 'Failed to create tour booking' }, { status: 500 })
  }

  await logActivityServer({
    admin,
    action: 'Created tour booking manually',
    entityType: 'tour_booking',
    entityId: data.id,
    entityLabel: `${customerName} — ${tourName}`,
    newValue: row,
  })

  return NextResponse.json({ booking: data })
}

export async function PATCH(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const { id, ...updates } = body
  if (!id) {
    return NextResponse.json({ error: 'Booking ID required' }, { status: 400 })
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
  if (updates.status !== undefined) allowed.status = updates.status
  if (updates.payment_status !== undefined) allowed.payment_status = updates.payment_status
  if (updates.invoice_status !== undefined) allowed.invoice_status = updates.invoice_status
  if (updates.vehicle_name !== undefined) allowed.vehicle_name = updates.vehicle_name
  if (updates.notes !== undefined) allowed.notes = updates.notes
  if (updates.guestsCount !== undefined) allowed.passengers = parseInt(String(updates.guestsCount), 10)
  if (updates.amount !== undefined) allowed.amount = parseFloat(String(updates.amount))
  allowed.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('tag_along_bookings')
    .update(allowed)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Tour booking update error:', error)
    return NextResponse.json({ error: 'Failed to update booking' }, { status: 500 })
  }

  const action =
    updates.status === 'cancelled'
      ? 'Cancelled tour booking'
      : updates.vehicle_name !== undefined
        ? 'Assigned vehicle'
        : 'Updated tour booking'

  await logActivityServer({
    admin,
    action,
    entityType: 'tour_booking',
    entityId: id,
    entityLabel: existing.name ? `${existing.name} — ${existing.tour_name || 'Tour'}` : id,
    oldValue: existing,
    newValue: data,
  })

  return NextResponse.json({ booking: data })
}
