import { NextRequest, NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { supabase } from '@/lib/supabase'

export async function GET(request: NextRequest) {
  const bookingId = request.nextUrl.searchParams.get('booking_id')
  if (!bookingId) return NextResponse.json(null)

  const { data: link } = await supabase
    .from('xero_invoice_links')
    .select('*')
    .eq('booking_id', bookingId)
    .single()

  if (!link) return NextResponse.json(null)

  // Optionally refresh status from Xero
  const auth = await getAuthedXeroClient()
  if (auth) {
    try {
      const response = await auth.xero.accountingApi.getInvoice(auth.tenantId, link.xero_invoice_id)
      const inv = response.body.invoices?.[0]
      if (inv) {
        const status = inv.status as unknown as string
        await supabase.from('xero_invoice_links').update({ status, updated_at: new Date().toISOString() }).eq('booking_id', bookingId)
        return NextResponse.json({ ...link, status })
      }
    } catch { /* use cached status */ }
  }

  return NextResponse.json(link)
}
