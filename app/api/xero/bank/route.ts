import { NextRequest, NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { format, subMonths } from 'date-fns'

export async function GET(request: NextRequest) {
  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth
  const reconciled = request.nextUrl.searchParams.get('reconciled')

  try {
    const fromDate = format(subMonths(new Date(), 3), 'yyyy-MM-dd')
    let where = `BankAccount.Type=="BANK"`
    if (reconciled === 'true') where += ' AND IsReconciled==true'
    if (reconciled === 'false') where += ' AND IsReconciled==false'

    const response = await xero.accountingApi.getBankTransactions(
      tenantId, new Date(fromDate), undefined, where
    )
    return NextResponse.json(response.body.bankTransactions || [])
  } catch (err) {
    console.error('Xero bank error:', err)
    return NextResponse.json({ error: 'Failed to fetch transactions' }, { status: 500 })
  }
}
