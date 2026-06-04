import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { fullCustomerName, parseFleetBookingNotes } from '@/lib/fleet'
import { supabaseAdmin } from '@/lib/supabase-admin'

type BookingRow = {
  id: string
  amount: number | null
  notes: string | null
  created_at?: string | null
}

type InvoiceLinkRow = {
  booking_id: string
  xero_invoice_number?: string | null
  status?: string | null
}

function formatMoney(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

async function buildInvoicePdf(input: {
  bookingId: string
  createdAt: string
  invoiceNumber: string
  invoiceStatus: string
  vehicleName: string
  registrationNumber: string
  customerName: string
  accountNumber: string
  phone: string
  email: string
  startDate: string
  endDate: string
  days: number
  seatsBooked: number
  usageType: string
  amount: number
  notes: string
}) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const { height } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const gold = rgb(0.72, 0.58, 0.42)
  const white = rgb(0.94, 0.93, 0.89)
  const muted = rgb(0.56, 0.54, 0.50)

  page.drawRectangle({ x: 0, y: 0, width: 595.28, height: 841.89, color: rgb(0.07, 0.06, 0.05) })
  page.drawText('DFT TOURS', { x: 40, y: height - 60, size: 24, font: bold, color: gold })
  page.drawText('Fleet Booking Invoice', { x: 40, y: height - 88, size: 16, font: bold, color: white })

  const rightX = 365
  page.drawText(`Invoice: ${input.invoiceNumber}`, { x: rightX, y: height - 60, size: 12, font: bold, color: white })
  page.drawText(`Status: ${input.invoiceStatus}`, { x: rightX, y: height - 78, size: 11, font, color: white })
  page.drawText(`Created: ${input.createdAt}`, { x: rightX, y: height - 96, size: 11, font, color: white })

  let y = height - 145
  const section = (title: string) => {
    page.drawText(title, { x: 40, y, size: 12, font: bold, color: gold })
    y -= 18
  }
  const line = (label: string, value: string) => {
    page.drawText(label, { x: 40, y, size: 10, font: bold, color: muted })
    page.drawText(value || '—', { x: 180, y, size: 11, font, color: white })
    y -= 16
  }

  section('Customer')
  line('Name', input.customerName)
  line('Account number', input.accountNumber)
  line('Phone', input.phone)
  line('Email', input.email)
  y -= 8

  section('Vehicle')
  line('Vehicle', input.vehicleName)
  line('Registration', input.registrationNumber)
  line('Usage type', input.usageType)
  line('Seats booked', String(input.seatsBooked))
  y -= 8

  section('Rental')
  line('Start date', input.startDate)
  line('End date', input.endDate)
  line('Days', String(input.days))
  line('Amount', formatMoney(input.amount))
  y -= 8

  section('Notes')
  const noteText = input.notes || 'No notes supplied'
  page.drawText(noteText.slice(0, 220), { x: 40, y, size: 11, font, color: white, maxWidth: 500, lineHeight: 14 })
  y -= 48

  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: rgb(0.2, 0.18, 0.16) })
  y -= 30
  page.drawText('Total due', { x: 360, y, size: 12, font: bold, color: white })
  page.drawText(formatMoney(input.amount), { x: 455, y, size: 16, font: bold, color: gold })

  page.drawText(`Booking ID: ${input.bookingId}`, { x: 40, y: 30, size: 9, font, color: muted })

  return Buffer.from(await pdf.save())
}

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('booking_id')
  if (!bookingId) {
    return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
  }

  const [{ data: booking, error: bookingError }, { data: link, error: linkError }] = await Promise.all([
    supabaseAdmin
      .from('tour_bookings')
      .select('id,amount,notes,created_at')
      .eq('id', bookingId)
      .eq('booking_type', 'fleet')
      .maybeSingle(),
    supabaseAdmin
      .from('xero_invoice_links')
      .select('booking_id,xero_invoice_number,status')
      .eq('booking_id', bookingId)
      .maybeSingle(),
  ])

  if (bookingError) {
    console.error('Invoice PDF booking lookup error:', bookingError)
    return NextResponse.json({ error: 'Failed to load booking' }, { status: 500 })
  }

  if (linkError) {
    console.error('Invoice PDF invoice-link lookup error:', linkError)
  }

  if (!booking) {
    return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
  }

  const details = parseFleetBookingNotes(booking.notes)
  if (!details) {
    return NextResponse.json({ error: 'Booking details are unavailable' }, { status: 422 })
  }

  const amount = Number(booking.amount || details.rental.totalAmount || 0)
  const invoiceNumber = (link as InvoiceLinkRow | null)?.xero_invoice_number || `FLEET-${booking.id.slice(0, 8).toUpperCase()}`
  const invoiceStatus = (link as InvoiceLinkRow | null)?.status || 'Draft copy'
  const createdAt = booking.created_at ? new Date(booking.created_at).toISOString().slice(0, 10) : new Date().toISOString().slice(0, 10)

  try {
    const pdfBuffer = await buildInvoicePdf({
      bookingId: booking.id,
      createdAt,
      invoiceNumber,
      invoiceStatus,
      vehicleName: details.vehicle.title,
      registrationNumber: details.vehicle.registrationNumber || '—',
      customerName: fullCustomerName(details),
      accountNumber: details.customer.accountNumber || '—',
      phone: details.customer.phone || '—',
      email: details.customer.email || '—',
      startDate: details.rental.startDate,
      endDate: details.rental.endDate,
      days: details.rental.days,
      seatsBooked: details.rental.seatsBooked,
      usageType: details.rental.usageType || 'tour',
      amount,
      notes: details.rental.notes || '',
    })

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${invoiceNumber}.pdf"`,
      },
    })
  } catch (error) {
    console.error('Invoice PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate invoice PDF' }, { status: 500 })
  }
}
