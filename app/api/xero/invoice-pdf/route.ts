import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { buildInvoiceForBooking } from '@/lib/invoice-for-booking'

/**
 * The invoice for a booking, as a PDF.
 *
 * All the table-specific work moved to lib/invoice-for-booking so the
 * send-to-client route can attach the same document this one downloads —
 * previously the only way to obtain an invoice was through this response body.
 */
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

  try {
    const generated = await buildInvoiceForBooking(bookingId, kind)
    if (!generated) {
      return NextResponse.json({ error: 'Booking not found' }, { status: 404 })
    }
    return pdfResponse(generated.pdfBuffer, generated.invoiceNumber, inline)
  } catch (error) {
    console.error('Invoice PDF generation error:', error)
    return NextResponse.json({ error: 'Failed to generate invoice PDF' }, { status: 500 })
  }
}
