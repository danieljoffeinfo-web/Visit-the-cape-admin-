import { NextRequest, NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns'

export async function GET(request: NextRequest) {
  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth
  const type = request.nextUrl.searchParams.get('type') || 'pnl'
  const range = request.nextUrl.searchParams.get('range') || '6m'
  const months = range === '1m' ? 1 : range === '3m' ? 3 : range === '1y' ? 12 : 6

  try {
    if (type === 'executive') {
      const response = await xero.accountingApi.getReportExecutiveSummary(tenantId)
      return NextResponse.json(response.body.reports || [])
    }

    if (type === 'bank') {
      const fromDate = format(subMonths(new Date(), months), 'yyyy-MM-dd')
      const toDate = format(new Date(), 'yyyy-MM-dd')
      const response = await xero.accountingApi.getReportBankSummary(tenantId, fromDate as unknown as string, toDate as unknown as string)
      return NextResponse.json(response.body.reports || [])
    }

    // P&L — build month-by-month
    const pnlData = []
    for (let i = months - 1; i >= 0; i--) {
      const monthDate = subMonths(new Date(), i)
      const from = format(startOfMonth(monthDate), 'yyyy-MM-dd')
      const to = format(endOfMonth(monthDate), 'yyyy-MM-dd')
      try {
        const response = await xero.accountingApi.getReportProfitAndLoss(
          tenantId,
          from as unknown as string,
          to as unknown as string,
        )
        pnlData.push({ month: format(monthDate, 'MMM yy'), reports: response.body.reports || [] })
      } catch {
        pnlData.push({ month: format(monthDate, 'MMM yy'), reports: [] })
      }
    }
    return NextResponse.json(pnlData)
  } catch (err) {
    console.error('Xero reports error:', err)
    return NextResponse.json({ error: 'Failed to fetch reports' }, { status: 500 })
  }
}
