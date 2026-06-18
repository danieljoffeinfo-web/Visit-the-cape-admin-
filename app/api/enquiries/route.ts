import { NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { fetchEnquiriesFromSource } from '@/lib/enquiries-server'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const enquiries = await fetchEnquiriesFromSource()
    return NextResponse.json({ enquiries })
  } catch (error) {
    console.error('Enquiries fetch error:', error)
    return NextResponse.json({ error: 'Failed to load enquiries' }, { status: 500 })
  }
}
