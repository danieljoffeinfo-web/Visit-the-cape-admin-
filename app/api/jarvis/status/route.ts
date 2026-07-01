import { NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { canUseJarvis, getJarvisModel, isJarvisConfigured } from '@/lib/jarvis-config'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  if (!canUseJarvis(admin)) {
    return NextResponse.json({ error: 'Jarvis not enabled for this account' }, { status: 403 })
  }

  return NextResponse.json({
    configured: isJarvisConfigured(),
    model: getJarvisModel(),
  })
}
