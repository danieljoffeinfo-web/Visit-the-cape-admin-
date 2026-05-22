import { NextRequest, NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'

export async function GET(request: NextRequest) {
  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth
  const status = request.nextUrl.searchParams.get('status') || 'ALL'

  try {
    // Build where clause based on status filter
    let where: string | undefined
    if (status && status !== 'ALL') {
      where = `Status=="${status}"`
    }

    const response = await xero.accountingApi.getInvoices(
      tenantId,
      undefined,    // ifModifiedSince
      where,        // where
      'DueDateUTC DESC', // order
      undefined,    // IDs
      undefined,    // invoiceNumbers
      undefined,    // contactIDs
      undefined,    // statuses
      1,            // page
      false,        // includeArchived
      false,        // createdByMyApp
      undefined,    // unitdp
      false         // summaryOnly
    )
    return NextResponse.json(response.body.invoices || [])
  } catch (err) {
    console.error('Xero invoices error:', err)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}
