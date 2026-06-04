import { Invoice } from 'xero-node'
import { NextRequest, NextResponse } from 'next/server'
import { differenceInCalendarDays, isValid, parseISO } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildSeatsLabel, parseFleetBookingNotes, usageTypeLabel, vehicleRegistration, vehicleSeats } from '@/lib/fleet'
import { getAuthedXeroClient } from '@/lib/xero'
import { createXeroInvoiceForBooking } from '@/lib/xero-invoices'

type TourProductRow = {
  id: string
  title: string
  family: string
  summary?: string | null
  duration_label?: string | null
  base_price?: number | null
}

export async function GET() {
  try {
    const [bookingsRes, invoicesRes] = await Promise.all([
      supabaseAdmin
        .from('tour_bookings')
        .select('id,product_id,status,amount,notes,created_at')
        .eq('booking_type', 'fleet')
        .order('created_at', { ascending: false }),
      supabaseAdmin
        .from('xero_invoice_links')
        .select('booking_id,xero_invoice_id,xero_invoice_number,status'),
    ])

    if (bookingsRes.error) {
      console.error('Fleet bookings fetch error:', bookingsRes.error)
      return NextResponse.json({ error: 'Failed to load fleet bookings' }, { status: 500 })
    }

    if (invoicesRes.error) {
      console.error('Fleet invoice links fetch error:', invoicesRes.error)
      return NextResponse.json({ error: 'Failed to load fleet bookings' }, { status: 500 })
    }

    const invoiceLinks = (invoicesRes.data || []) as Array<{ booking_id: string; xero_invoice_id?: string | null; xero_invoice_number?: string | null; status?: string | null }>

    let auth: Awaited<ReturnType<typeof getAuthedXeroClient>> = null
    try {
      auth = await getAuthedXeroClient()
    } catch (error) {
      console.error('Fleet bookings Xero auth warning:', error)
      auth = null
    }

    const refreshedInvoiceLinks = auth
      ? await Promise.all(invoiceLinks.map(async (link) => {
          if (!link.xero_invoice_id) return link

          try {
            const response = await auth.xero.accountingApi.getInvoice(auth.tenantId, link.xero_invoice_id)
            const invoice = response.body.invoices?.[0]
            const status = invoice?.status ? String(invoice.status) : link.status || null

            if (status && status !== link.status) {
              await supabaseAdmin
                .from('xero_invoice_links')
                .update({ status, updated_at: new Date().toISOString() })
                .eq('booking_id', link.booking_id)
            }

            return { ...link, status }
          } catch {
            return link
          }
        }))
      : invoiceLinks

    return NextResponse.json({
      bookings: bookingsRes.data || [],
      invoiceLinks: refreshedInvoiceLinks,
    })
  } catch (error) {
    console.error('Fleet bookings route error:', error)
    return NextResponse.json({ error: 'Failed to load fleet bookings' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      vehicleId,
      firstName,
      surname,
      accountNumber,
      phone,
      email,
      startDate,
      endDate,
      amount,
      seatsBooked,
      usageType,
      notes,
    } = body

    if (!vehicleId || !firstName || !surname || !email || !startDate || !endDate || amount === undefined || amount === null) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    const start = parseISO(startDate)
    const end = parseISO(endDate)
    if (!isValid(start) || !isValid(end) || end < start) {
      return NextResponse.json({ error: 'Booking dates are invalid' }, { status: 400 })
    }

    const rentalDays = differenceInCalendarDays(end, start) + 1
    const totalAmount = Number(amount)
    if (!Number.isFinite(totalAmount) || totalAmount <= 0) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
    }

    const bookingUsageType = String(usageType || 'tour').toLowerCase() === 'internal' ? 'internal' : 'tour'

    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from('tour_products')
      .select('id,title,family,summary,duration_label,base_price')
      .eq('id', vehicleId)
      .eq('family', 'fleet')
      .single<TourProductRow>()

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const totalSeats = vehicleSeats(vehicle)
    const bookedSeats = Math.max(1, Math.min(Number(seatsBooked) || totalSeats || 1, totalSeats || Number(seatsBooked) || 1))

    const { data: existingBookings } = await supabaseAdmin
      .from('tour_bookings')
      .select('id,notes,status')
      .eq('product_id', vehicleId)
      .eq('booking_type', 'fleet')

    const overlap = (existingBookings || []).find((row: { id: string; notes?: string | null; status?: string | null }) => {
      if ((row.status || '').toLowerCase() === 'cancelled') return false
      const parsed = parseFleetBookingNotes(row.notes)
      if (!parsed) return false
      const existingStart = parseISO(parsed.rental.startDate)
      const existingEnd = parseISO(parsed.rental.endDate)
      return start <= existingEnd && end >= existingStart
    })

    if (overlap) {
      return NextResponse.json({ error: 'This vehicle is already booked for some of those dates' }, { status: 409 })
    }

    const bookingNotes = {
      kind: 'fleet-booking' as const,
      customer: {
        firstName: String(firstName).trim(),
        surname: String(surname).trim(),
        accountNumber: accountNumber ? String(accountNumber).trim() : null,
        phone: phone ? String(phone).trim() : null,
        email: String(email).trim(),
      },
      vehicle: {
        id: vehicle.id,
        title: vehicle.title,
        registrationNumber: vehicleRegistration(vehicle),
        seats: totalSeats,
      },
      rental: {
        startDate,
        endDate,
        days: rentalDays,
        seatsBooked: bookedSeats,
        totalAmount,
        usageType: bookingUsageType,
        paymentReceived: false,
        notes: notes ? String(notes).trim() : null,
      },
    }

    const { data: insertedBooking, error: bookingError } = await supabaseAdmin
      .from('tour_bookings')
      .insert({
        product_id: vehicle.id,
        booking_type: 'fleet',
        status: 'confirmed',
        name: `${String(firstName).trim()} ${String(surname).trim()}`.trim(),
        email: String(email).trim(),
        phone: phone ? String(phone).trim() : null,
        passengers: bookedSeats,
        amount: totalAmount,
        notes: JSON.stringify(bookingNotes),
      })
      .select('id,created_at')
      .single()

    if (bookingError || !insertedBooking) {
      console.error('Fleet booking insert error:', bookingError)
      return NextResponse.json({ error: 'Failed to save booking' }, { status: 500 })
    }

    const { count: customerBookingCount } = await supabaseAdmin
      .from('tour_bookings')
      .select('id', { count: 'exact', head: true })
      .eq('email', String(email).trim())

    await supabaseAdmin.from('customers').upsert({
      name: `${String(firstName).trim()} ${String(surname).trim()}`.trim(),
      email: String(email).trim(),
      phone: phone ? String(phone).trim() : null,
      total_bookings: customerBookingCount || 1,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'email' })

    const invoiceResult = await createXeroInvoiceForBooking({
      contactName: `${String(firstName).trim()} ${String(surname).trim()}`.trim(),
      contactEmail: String(email).trim(),
      description: `${vehicle.title}${vehicleRegistration(vehicle) ? ` (${vehicleRegistration(vehicle)})` : ''} rental · ${usageTypeLabel(bookingUsageType)} · ${startDate} to ${endDate} · ${rentalDays} day${rentalDays === 1 ? '' : 's'}`,
      amount: totalAmount,
      dueDate: endDate,
      bookingId: insertedBooking.id,
      bookingType: 'fleet',
      reference: accountNumber ? String(accountNumber).trim() : insertedBooking.id,
    })

    if (invoiceResult.invoice) {
      await supabaseAdmin.from('customers').upsert({
        name: `${String(firstName).trim()} ${String(surname).trim()}`.trim(),
        email: String(email).trim(),
        phone: phone ? String(phone).trim() : null,
        total_bookings: customerBookingCount || 1,
        xero_contact_id: invoiceResult.invoice.contact?.contactID || null,
        xero_last_status: invoiceResult.invoice.status || null,
        xero_total_invoiced: totalAmount,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'email' })
    }

    return NextResponse.json({
      booking: {
        id: insertedBooking.id,
        vehicleId: vehicle.id,
        vehicleName: vehicle.title,
        registrationNumber: vehicleRegistration(vehicle),
        seats: buildSeatsLabel(totalSeats),
        usageType: bookingUsageType,
        startDate,
        endDate,
        rentalDays,
        totalAmount,
      },
      invoice: invoiceResult.invoice,
      xeroConnected: invoiceResult.connected,
    })
  } catch (error) {
    console.error('Fleet booking route error:', error)
    return NextResponse.json({ error: 'Failed to create fleet booking' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const bookingId = String(body?.id || '').trim()
    const amountRaw = body?.amount
    const paymentReceivedRaw = body?.paymentReceived

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
    }

    const nextAmount = amountRaw === undefined || amountRaw === null ? null : Number(amountRaw)
    const updatingAmount = nextAmount !== null
    const updatingPaymentReceived = typeof paymentReceivedRaw === 'boolean'

    if (!updatingAmount && !updatingPaymentReceived) {
      return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
    }

    if (updatingAmount && (!Number.isFinite(nextAmount) || nextAmount <= 0)) {
      return NextResponse.json({ error: 'Amount must be greater than zero' }, { status: 400 })
    }

    const { data: bookingRow, error: bookingFetchError } = await supabaseAdmin
      .from('tour_bookings')
      .select('id,notes,email')
      .eq('id', bookingId)
      .eq('booking_type', 'fleet')
      .single()

    if (bookingFetchError || !bookingRow) {
      console.error('Fleet booking fetch error:', bookingFetchError)
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const parsedNotes = parseFleetBookingNotes(bookingRow.notes)
    const updatedNotes = parsedNotes
      ? JSON.stringify({
          ...parsedNotes,
          rental: {
            ...parsedNotes.rental,
            totalAmount: updatingAmount ? nextAmount! : parsedNotes.rental.totalAmount,
            paymentReceived: updatingPaymentReceived ? paymentReceivedRaw : parsedNotes.rental.paymentReceived || false,
          },
        })
      : bookingRow.notes

    const { data: updatedBooking, error: updateError } = await supabaseAdmin
      .from('tour_bookings')
      .update({
        ...(updatingAmount ? { amount: nextAmount } : {}),
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', bookingId)
      .eq('booking_type', 'fleet')
      .select('id,amount,notes')
      .single()

    if (updateError || !updatedBooking) {
      console.error('Fleet booking update error:', updateError)
      return NextResponse.json({ error: 'Failed to update booking amount' }, { status: 500 })
    }

    const { data: invoiceLink } = await supabaseAdmin
      .from('xero_invoice_links')
      .select('xero_invoice_number,status')
      .eq('booking_id', bookingId)
      .maybeSingle()

    return NextResponse.json({
      booking: updatedBooking,
      invoiceLinked: Boolean(invoiceLink),
      invoiceNumber: invoiceLink?.xero_invoice_number || null,
      invoiceStatus: invoiceLink?.status || null,
      paymentReceived: updatingPaymentReceived ? paymentReceivedRaw : null,
    })
  } catch (error) {
    console.error('Fleet booking patch route error:', error)
    return NextResponse.json({ error: 'Failed to update booking amount' }, { status: 500 })
  }
}


export async function DELETE(request: NextRequest) {
  try {
    const body = await request.json()
    const bookingId = String(body?.id || '').trim()

    if (!bookingId) {
      return NextResponse.json({ error: 'Booking ID is required' }, { status: 400 })
    }

    const { data: bookingRow, error: bookingError } = await supabaseAdmin
      .from('tour_bookings')
      .select('id,status')
      .eq('id', bookingId)
      .eq('booking_type', 'fleet')
      .single()

    if (bookingError || !bookingRow) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    const { data: invoiceLink } = await supabaseAdmin
      .from('xero_invoice_links')
      .select('xero_invoice_id,status')
      .eq('booking_id', bookingId)
      .maybeSingle()

    if ((invoiceLink?.status || '').toUpperCase() === 'PAID') {
      return NextResponse.json({ error: 'This booking has a paid Xero invoice and cannot be deleted automatically.' }, { status: 409 })
    }

    if (invoiceLink?.xero_invoice_id) {
      const auth = await getAuthedXeroClient()
      if (auth) {
        try {
          await auth.xero.accountingApi.updateInvoice(auth.tenantId, invoiceLink.xero_invoice_id, {
            invoices: [{ invoiceID: invoiceLink.xero_invoice_id, status: Invoice.StatusEnum.VOIDED }],
          })
          await supabaseAdmin
            .from('xero_invoice_links')
            .update({ status: 'VOIDED', updated_at: new Date().toISOString() })
            .eq('booking_id', bookingId)
        } catch (error) {
          console.error('Xero invoice void error:', error)
        }
      }
    }

    const { error: cancelError } = await supabaseAdmin
      .from('tour_bookings')
      .update({ status: 'cancelled', updated_at: new Date().toISOString() })
      .eq('id', bookingId)
      .eq('booking_type', 'fleet')

    if (cancelError) {
      console.error('Fleet booking cancel error:', cancelError)
      return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Fleet booking delete route error:', error)
    return NextResponse.json({ error: 'Failed to delete booking' }, { status: 500 })
  }
}
