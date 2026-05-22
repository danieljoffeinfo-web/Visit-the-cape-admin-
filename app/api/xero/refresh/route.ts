import { NextResponse } from 'next/server'
import { refreshXeroTokenIfNeeded } from '@/lib/xero'

export async function POST() {
  try {
    const token = await refreshXeroTokenIfNeeded()
    if (!token) return NextResponse.json({ error: 'Not connected' }, { status: 401 })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Xero refresh error:', err)
    return NextResponse.json({ error: 'Refresh failed' }, { status: 500 })
  }
}
