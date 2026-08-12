import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { getAuthedXeroClient } from '@/lib/xero'
import { listHiddenInvoices } from '@/lib/xero-hidden-invoices'

export async function GET(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth
  const status = request.nextUrl.searchParams.get('status') || 'ALL'
  const onlyHidden = request.nextUrl.searchParams.get('hidden') === 'true'

  try {
    // Build where clause based on status filter
    let where: string | undefined
    if (status && status !== 'ALL') {
      where = `Status=="${status}"`
    }

    const [response, summaryResponse, hidden] = await Promise.all([
      xero.accountingApi.getInvoices(
        tenantId,
        undefined,    // ifModifiedSince
        where,        // where
        'DueDate DESC', // order
        undefined,    // IDs
        undefined,    // invoiceNumbers
        undefined,    // contactIDs
        undefined,    // statuses
        1,            // page
        false,        // includeArchived
        false,        // createdByMyApp
        undefined,    // unitdp
        false         // summaryOnly
      ),
      xero.accountingApi.getInvoices(
        tenantId,
        undefined,
        undefined,
        'DueDate DESC',
        undefined,
        undefined,
        undefined,
        undefined,
        1,
        false,
        false,
        undefined,
        false,
      ),
      listHiddenInvoices(),
    ])

    const all = response.body.invoices || []

    // Hidden invoices are filtered out of the normal list. They are untouched in
    // Xero — `?hidden=true` returns just those so they can be restored.
    const invoices = all.filter((invoice) => {
      const isHidden = Boolean(invoice.invoiceID && hidden.ids.has(invoice.invoiceID))
      return onlyHidden ? isHidden : !isHidden
    })

    const summaryInvoices = summaryResponse.body.invoices || []
    const summary = {
      paid: summaryInvoices
        .filter((invoice) => String(invoice.status) === 'PAID')
        .reduce((total, invoice) => total + (invoice.total || 0), 0),
      outstanding: summaryInvoices
        .filter((invoice) => String(invoice.status) === 'AUTHORISED')
        .reduce((total, invoice) => total + (invoice.amountDue || 0), 0),
      overdue: summaryInvoices
        .filter((invoice) => String(invoice.status) === 'OVERDUE')
        .reduce((total, invoice) => total + (invoice.amountDue || 0), 0),
    }

    return NextResponse.json({
      invoices,
      summary,
      hiddenCount: all.reduce(
        (count, invoice) => count + (invoice.invoiceID && hidden.ids.has(invoice.invoiceID) ? 1 : 0),
        0,
      ),
      setupRequired: hidden.setupRequired,
    })
  } catch (err) {
    console.error('Xero invoices error:', err)
    return NextResponse.json({ error: 'Failed to fetch invoices' }, { status: 500 })
  }
}
