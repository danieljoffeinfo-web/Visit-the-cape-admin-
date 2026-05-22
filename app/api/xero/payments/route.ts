import { NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { format, subDays } from 'date-fns'

export async function GET() {
  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth
  const since = format(subDays(new Date(), 7), "yyyy-MM-dd'T'00:00:00")

  try {
    const response = await xero.accountingApi.getPayments(tenantId, new Date(since))
    return NextResponse.json(response.body.payments || [])
  } catch (err) {
    console.error('Xero payments error:', err)
    return NextResponse.json({ error: 'Failed to fetch payments' }, { status: 500 })
  }
}
