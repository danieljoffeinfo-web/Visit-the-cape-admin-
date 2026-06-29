import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import {
  buildFleetInvoicePdf,
  buildTourInvoicePdf,
  fullCustomerName,
  parseFleetBookingNotes,
} from '@/lib/invoice-pdf'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthedXeroClient } from '@/lib/xero'

type InvoiceLinkRow = {
  booking_id: string
  xero_invoice_id?: string | null
  xero_invoice_number?: string | null
  status?: string | null
}

function pdfResponse(buffer: Buffer, filename: string, inline: boolean) {
  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${inline ? 'inline' : 'attachment'}; filename="${filename}.pdf"`,
      'Cache-Control': 'private, no-cache',
    },
  })
}

async function fetchXeroInvoicePdf(link: InvoiceLinkRow) {
  if (!link.xero_invoice_id) return null

  const auth = await getAuthedXeroClient()
  if (!auth) return null

  try {
    const response = await auth.xero.accountingApi.getInvoiceAsPdf(auth.tenantId, link.xero_invoice_id)
    const body = response.body
    if (!body) return null
    const buffer = Buffer.isBuffer(body) ? body : Buffer.from(body as ArrayBuffer)
    return buffer
  } catch (error) {
    console.error('Xero invoice PDF fetch error:', error)
    return null
  }
}

async function buildFleetPdf(bookingId: string, link: InvoiceLinkRow | null) {
  const { data: booking, error } = await supabaseAdmin
    .from('tour_bookings')
    .select('id,amount,notes,created_at')
    .eq('id', bookingId)
    .eq('booking_type', 'fleet')
    .maybeSingle()

  if (error || !booking) return null

  const details = parseFleetBookingNotes(booking.notes)
  if (!details) return null

  const amount = Number(booking.amount || details.rental.totalAmount || 0)
  const invoiceNumber = link?.xero_invoice_number || `FLEET-${booking.id.slice(0, 8).toUpperCase()}`
  const invoiceStatus = link?.status || 'Draft copy'
  const createdAt = booking.created_at
    ? new Date(booking.created_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const pdfBuffer = await buildFleetInvoicePdf({
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

  return { pdfBuffer, invoiceNumber }
}

async function buildTagAlongPdf(bookingId: string, link: InvoiceLinkRow | null, title: string) {
  const { data: booking, error } = await supabaseAdmin
    .from('tag_along_bookings')
    .select('id,name,email,phone,tour_name,tour_date,passengers,amount,notes,booking_reference,invoice_status,created_at')
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !booking) return null

  const amount = Number(booking.amount || 0)
  const invoiceNumber = link?.xero_invoice_number || booking.booking_reference || `BOOK-${booking.id.slice(0, 8).toUpperCase()}`
  const invoiceStatus = link?.status || booking.invoice_status || 'Draft copy'
  const createdAt = booking.created_at
    ? new Date(booking.created_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const pdfBuffer = await buildTourInvoicePdf({
    bookingId: booking.id,
    createdAt,
    invoiceNumber,
    invoiceStatus,
    title,
    customerName: booking.name,
    customerEmail: booking.email,
    customerPhone: booking.phone,
    tourName: booking.tour_name || 'Tour booking',
    tourDate: booking.tour_date || '',
    guests: booking.passengers || 0,
    reference: booking.booking_reference,
    amount,
    notes: booking.notes,
  })

  return { pdfBuffer, invoiceNumber }
}

async function buildPrivatePdf(bookingId: string, link: InvoiceLinkRow | null) {
  const { data: enquiry, error } = await supabaseAdmin
    .from('enquiries')
    .select('id,name,email,tour_type,message,date,passengers,created_at')
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !enquiry) return null

  const invoiceNumber = link?.xero_invoice_number || `ENQ-${enquiry.id.slice(0, 8).toUpperCase()}`
  const invoiceStatus = link?.status || 'Draft copy'
  const createdAt = enquiry.created_at
    ? new Date(enquiry.created_at).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const pdfBuffer = await buildTourInvoicePdf({
    bookingId: enquiry.id,
    createdAt,
    invoiceNumber,
    invoiceStatus,
    title: 'Private enquiry invoice',
    customerName: enquiry.name,
    customerEmail: enquiry.email,
    tourName: enquiry.tour_type || 'Private enquiry',
    tourDate: enquiry.date || '',
    guests: enquiry.passengers || 0,
    amount: 0,
    notes: enquiry.message,
  })

  return { pdfBuffer, invoiceNumber }
}

export async function GET(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const bookingId = request.nextUrl.searchParams.get('booking_id')
  const kind = request.nextUrl.searchParams.get('kind')
  const inline = request.nextUrl.searchParams.get('inline') !== '0'

  if (!bookingId) {
    return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
  }

  const { data: link } = await supabaseAdmin
    .from('xero_invoice_links')
    .select('booking_id,xero_invoice_id,xero_invoice_number,status')
    .eq('booking_id', bookingId)
    .maybeSingle()

  try {
    const xeroPdf = link ? await fetchXeroInvoicePdf(link as InvoiceLinkRow) : null
    if (xeroPdf) {
      const filename = link?.xero_invoice_number || `invoice-${bookingId.slice(0, 8)}`
      return pdfResponse(xeroPdf, filename, inline)
    }

    let generated: { pdfBuffer: Buffer; invoiceNumber: string } | null = null

    if (kind === 'fleet' || !kind) {
      generated = await buildFleetPdf(bookingId, link as InvoiceLinkRow | null)
    }

    if (!generated && (kind === 'tour' || kind === 'internal' || !kind)) {
      const title = kind === 'internal' ? 'Internal booking invoice' : 'Tour booking invoice'
      generated = await buildTagAlongPdf(bookingId, link as InvoiceLinkRow | null, title)
    }

    if (!generated && (kind === 'private' || !kind)) {
      generated = await buildPrivatePdf(bookingId, link as InvoiceLinkRow | null)
    }

    if (!generated) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }

    return pdfResponse(generated.pdfBuffer, generated.invoiceNumber, inline)
  } catch (error) {
    console.error('Invoice PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate invoice PDF' }, { status: 500 })
  }
}
