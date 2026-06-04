import { NextRequest, NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('booking_id')
  if (!bookingId) {
    return NextResponse.json({ error: 'booking_id is required' }, { status: 400 })
  }

  const { data: link, error } = await supabaseAdmin
    .from('xero_invoice_links')
    .select('booking_id,xero_invoice_id,xero_invoice_number,status')
    .eq('booking_id', bookingId)
    .maybeSingle()

  if (error) {
    console.error('Invoice PDF link lookup error:', error)
    return NextResponse.json({ error: 'Failed to find invoice link' }, { status: 500 })
  }

  if (!link?.xero_invoice_id) {
    return NextResponse.json({ error: 'No Xero invoice found for this booking' }, { status: 404 })
  }

  const auth = await getAuthedXeroClient()
  if (!auth) {
    return NextResponse.json({ error: 'Xero is not connected' }, { status: 401 })
  }

  try {
    const response = await auth.xero.accountingApi.getInvoiceAsPdf(auth.tenantId, link.xero_invoice_id)
    const pdfBuffer = Buffer.isBuffer(response.body)
      ? response.body
      : Buffer.from(response.body as ArrayBuffer)
    const pdfBytes = new Uint8Array(pdfBuffer)

    return new NextResponse(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${link.xero_invoice_number || `invoice-${bookingId}`}.pdf"`,
      },
    })
  } catch (err) {
    console.error('Invoice PDF download error:', err)
    return NextResponse.json({ error: 'Failed to download invoice PDF' }, { status: 500 })
  }
}
