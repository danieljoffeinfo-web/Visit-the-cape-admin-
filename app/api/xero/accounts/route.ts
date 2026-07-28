import { NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { getApprovedAdminUser } from '@/lib/auth-server'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth

  try {
    const response = await xero.accountingApi.getAccounts(tenantId)
    return NextResponse.json(response.body.accounts || [])
  } catch (err) {
    console.error('Xero accounts error:', err)
    return NextResponse.json({ error: 'Failed to fetch accounts' }, { status: 500 })
  }
}
