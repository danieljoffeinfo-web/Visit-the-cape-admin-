import { NextResponse } from 'next/server'
import { getApprovedAdminUser, getSessionUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const user = await getSessionUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const { data: adminRow } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('auth_user_id', user.id)
    .maybeSingle()

  if (!adminRow) {
    return NextResponse.json({ error: 'No admin profile found' }, { status: 403 })
  }

  if (!adminRow.is_approved) {
    return NextResponse.json({ error: 'Not approved' }, { status: 403 })
  }

  return NextResponse.json({ admin: adminRow, email: user.email })
}

export async function POST() {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  return NextResponse.json({ admin })
}
