import { NextResponse } from 'next/server'
import { refreshXeroTokenIfNeeded } from '@/lib/xero'
import { getApprovedAdminUser } from '@/lib/auth-server'

export async function POST() {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    const token = await refreshXeroTokenIfNeeded()
    if (!token) return NextResponse.json({ error: 'Not connected' }, { status: 401 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Xero refresh error:', err)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
