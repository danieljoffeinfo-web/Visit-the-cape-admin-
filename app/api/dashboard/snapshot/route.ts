import { NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { buildDashboardSnapshot } from '@/lib/dashboard-server'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const snapshot = await buildDashboardSnapshot()
    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('Dashboard snapshot error:', error)
    return NextResponse.json({ error: 'Failed to load dashboard' }, { status: 500 })
  }
}
