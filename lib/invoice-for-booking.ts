import {
  buildAddOnInvoicePdf,
  buildFleetInvoicePdf,
  buildTourInvoicePdf,
  fullCustomerName,
  parseFleetBookingNotes,
} from '@/lib/invoice-pdf'
import { parseAddOnBookingNotes } from '@/lib/add-ons'
import { bookingsDb } from '@/lib/bookings-db'
import { billingDetailsFor } from '@/lib/clients-server'
import { getEnquiriesDb } from '@/lib/enquiries-server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthedXeroClient } from '@/lib/xero'

/**
 * Building an invoice for a booking, in one place.
 *
 * This lived inside the PDF download route, which meant the only way to get an
 * invoice was to download it — there was no way to attach one to an email
 * without copying a hundred lines of table-specific branching. Both the
 * download route and the send-to-client route now call `buildInvoiceForBooking`.
 */

export type InvoiceLinkRow = {
  booking_id: string
  xero_invoice_id?: string | null
  xero_invoice_number?: string | null
  status?: string | null
}

export type BuiltInvoice = { pdfBuffer: Buffer; invoiceNumber: string }

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
  // Prefer the number issued when the booking was made so a re-download always
  // reproduces the same invoice the admin already has by email.
  const invoiceNumber =
    details.invoice?.number || link?.xero_invoice_number || `FLEET-${booking.id.slice(0, 8).toUpperCase()}`
  const createdAt = details.invoice?.issuedAt || booking.created_at || new Date().toISOString()

  const billTo = await billingDetailsFor({
    email: details.customer.email,
    fallbackName: fullCustomerName(details),
  })

  const pdfBuffer = await buildFleetInvoicePdf({
    bookingId: booking.id,
    createdAt,
    invoiceNumber,
    vehicleName: details.vehicle.title,
    registrationNumber: details.vehicle.registrationNumber || '',
    customerName: fullCustomerName(details),
    accountNumber: details.customer.accountNumber || null,
    startDate: details.rental.startDate,
    endDate: details.rental.endDate,
    days: details.rental.days,
    usageType: details.rental.usageType || 'tour',
    amount,
    /* Re-derived when the booking predates day-rate pricing, so a re-download
       still shows the arithmetic behind the total rather than dropping the
       line it was issued with. */
    dailyRate:
      details.rental.dailyRate ??
      (details.rental.days > 0 ? amount / details.rental.days : null),
    invoiceDescription: details.rental.invoiceDescription ?? null,
    depositAmount: details.rental.depositAmount ?? null,
    notes: details.rental.notes || '',
    billTo,
  })

  return { pdfBuffer, invoiceNumber }
}

/**
 * Add-on booking invoice.
 *
 * The chosen experiences and the prices they were sold at are JSON inside the
 * booking's `notes` column, so this reads the same row a tour booking reads and
 * branches on what it finds there. A row tagged `addon` whose notes will not
 * parse falls through to the tour invoice rather than 404ing — a one-line
 * invoice is a better outcome than none.
 */
async function buildAddOnPdf(bookingId: string, link: InvoiceLinkRow | null) {
  const { data: booking, error } = await bookingsDb()
    .from('tag_along_bookings')
    .select('id,name,email,tour_date,passengers,notes,booking_reference,created_at')
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !booking) return null

  const details = parseAddOnBookingNotes(booking.notes)
  if (!details) return null

  const invoiceNumber =
    details.invoice?.number ||
    link?.xero_invoice_number ||
    booking.booking_reference ||
    `ADDON-${booking.id.slice(0, 8).toUpperCase()}`
  const createdAt =
    details.invoice?.issuedAt ||
    (booking.created_at
      ? new Date(booking.created_at).toISOString().slice(0, 10)
      : new Date().toISOString().slice(0, 10))

  const billTo = await billingDetailsFor({
    email: booking.email,
    fallbackName: booking.name,
  })

  const pdfBuffer = await buildAddOnInvoicePdf({
    bookingId: booking.id,
    createdAt,
    invoiceNumber,
    customerName: booking.name,
    customerEmail: booking.email,
    bookingDate: booking.tour_date || '',
    guests: booking.passengers || 0,
    lines: details.lines,
    reference: booking.booking_reference,
    billTo,
  })

  return { pdfBuffer, invoiceNumber }
}

async function buildTagAlongPdf(bookingId: string, link: InvoiceLinkRow | null, title: string) {
  const { data: booking, error } = await bookingsDb()
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

  const billTo = await billingDetailsFor({
    email: booking.email,
    fallbackName: booking.name,
  })

  const pdfBuffer = await buildTourInvoicePdf({
    bookingId: booking.id,
    createdAt,
    invoiceNumber,
    invoiceStatus,
    title,
    billTo,
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
  /* Enquiries belong to whichever project `getEnquiriesDb` names — the content
     one in production, where the columns differ from the admin project's copy
     (`experience`, and no date or passengers). Selecting the admin column list
     against it returned an error, so every private-enquiry invoice 404'd.
     Select everything and read defensively instead. */
  const db = getEnquiriesDb()
  if (!db) return null

  const { data: row, error } = await db.client
    .from('enquiries')
    .select('*')
    .eq('id', bookingId)
    .maybeSingle()

  if (error || !row) return null

  const enquiry = row as Record<string, unknown>
  const value = (key: string) => (enquiry[key] == null ? '' : String(enquiry[key]))

  const id = value('id')
  const invoiceNumber = link?.xero_invoice_number || `ENQ-${id.slice(0, 8).toUpperCase()}`
  const invoiceStatus = link?.status || 'Draft copy'
  const createdAt = enquiry.created_at
    ? new Date(value('created_at')).toISOString().slice(0, 10)
    : new Date().toISOString().slice(0, 10)

  const pdfBuffer = await buildTourInvoicePdf({
    bookingId: id,
    createdAt,
    invoiceNumber,
    invoiceStatus,
    title: 'Private enquiry invoice',
    customerName: value('name'),
    customerEmail: value('email'),
    // The website writes `experience`; the admin project's copy calls it
    // `tour_type`. Accept either rather than depending on which one answered.
    tourName: value('tour_type') || value('experience') || 'Private enquiry',
    tourDate: value('date'),
    guests: Number(enquiry.passengers) || 0,
    amount: Number(enquiry.amount) || 0,
    notes: value('message'),
  })

  return { pdfBuffer, invoiceNumber }
}

/**
 * The invoice for a booking, whatever kind it is.
 *
 * Prefers the copy Xero holds when there is one, so a re-send matches what the
 * accounts say rather than a freshly rendered approximation of it.
 */
export async function buildInvoiceForBooking(
  bookingId: string,
  kind: string | null,
): Promise<BuiltInvoice | null> {
  const { data: link } = await supabaseAdmin
    .from('xero_invoice_links')
    .select('booking_id,xero_invoice_id,xero_invoice_number,status')
    .eq('booking_id', bookingId)
    .maybeSingle()

  const typedLink = (link as InvoiceLinkRow | null) ?? null

  const xeroPdf = typedLink ? await fetchXeroInvoicePdf(typedLink) : null
  if (xeroPdf) {
    return {
      pdfBuffer: xeroPdf,
      invoiceNumber: typedLink?.xero_invoice_number || `invoice-${bookingId.slice(0, 8)}`,
    }
  }

  if (kind === 'fleet' || !kind) {
    const built = await buildFleetPdf(bookingId, typedLink)
    if (built) return built
  }
  if (kind === 'addon' || !kind) {
    const built = await buildAddOnPdf(bookingId, typedLink)
    if (built) return built
  }
  if (kind === 'tour' || kind === 'internal' || kind === 'addon' || !kind) {
    const title = kind === 'internal' ? 'Internal booking invoice' : 'Tour booking invoice'
    const built = await buildTagAlongPdf(bookingId, typedLink, title)
    if (built) return built
  }
  if (kind === 'private' || !kind) {
    const built = await buildPrivatePdf(bookingId, typedLink)
    if (built) return built
  }
  return null
}
