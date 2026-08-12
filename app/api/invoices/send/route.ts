import { NextRequest, NextResponse } from 'next/server'
import { logActivityServer } from '@/lib/activity-log-server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { buildInvoiceForBooking } from '@/lib/invoice-for-booking'
import { emailInvoiceToClient } from '@/lib/invoice-email'

/**
 * Send a booking's invoice to the customer.
 *
 * Only ever reached by someone pressing a button. Nothing that creates or
 * amends a booking calls this — an invoice reaching a client is a decision, not
 * a side effect, and the one thing worse than forgetting to send it is sending
 * a wrong one automatically.
 *
 * The send is recorded in the activity log so there is an answer to "did we
 * ever send this, and who sent it".
 */
export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const bookingId = String(body.bookingId || '').trim()
  const kind = body.kind ? String(body.kind) : null
  const to = String(body.to || '').trim()
  const clientName = String(body.clientName || '').trim() || 'there'
  const summaryLines: string[] = Array.isArray(body.summaryLines)
    ? body.summaryLines.map((l: unknown) => String(l)).slice(0, 8)
    : []

  if (!bookingId) return NextResponse.json({ error: 'bookingId is required' }, { status: 400 })
  if (!to || !to.includes('@')) {
    return NextResponse.json(
      { error: 'This booking has no email address on it. Add one first.' },
      { status: 400 },
    )
  }

  try {
    const invoice = await buildInvoiceForBooking(bookingId, kind)
    if (!invoice) {
      return NextResponse.json({ error: 'No invoice could be built for that booking' }, { status: 404 })
    }

    const result = await emailInvoiceToClient({
      to,
      clientName,
      pdf: invoice.pdfBuffer,
      invoiceNumber: invoice.invoiceNumber,
      subjectLine: `Invoice ${invoice.invoiceNumber} — Visit The Cape`,
      summaryLines,
      total: Number(body.total) || 0,
      depositAmount: body.depositAmount != null ? Number(body.depositAmount) : null,
      /* Replies go to whoever sent it rather than into a no-reply void. */
      replyTo: admin.email || null,
    })

    if (!result.sent) {
      return NextResponse.json({ error: result.reason || 'Failed to send' }, { status: 502 })
    }

    await logActivityServer({
      admin,
      action: 'Sent invoice to client',
      entityType: 'invoice',
      entityId: bookingId,
      entityLabel: `${invoice.invoiceNumber} → ${to}`,
      newValue: { to, invoiceNumber: invoice.invoiceNumber },
    })

    return NextResponse.json({ sent: true, invoiceNumber: invoice.invoiceNumber, to })
  } catch (error) {
    console.error('Invoice send error:', error)
    return NextResponse.json({ error: 'Failed to send the invoice' }, { status: 500 })
  }
}
