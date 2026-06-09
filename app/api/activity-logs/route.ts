import { NextRequest, NextResponse } from 'next/server'
import { logActivityServer } from '@/lib/activity-log-server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { searchParams } = request.nextUrl
  const userId = searchParams.get('user_id')
  const entityType = searchParams.get('entity_type')
  const action = searchParams.get('action')
  const from = searchParams.get('from')
  const to = searchParams.get('to')
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 500)

  let query = supabaseAdmin
    .from('activity_logs')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit)

  if (userId) query = query.eq('user_id', userId)
  if (entityType) query = query.eq('entity_type', entityType)
  if (action) query = query.eq('action', action)
  if (from) query = query.gte('created_at', from)
  if (to) query = query.lte('created_at', `${to}T23:59:59`)

  const { data, error } = await query

  if (error) {
    console.error('Activity logs fetch error:', error)
    return NextResponse.json({ error: 'Failed to load activity logs' }, { status: 500 })
  }

  return NextResponse.json({ logs: data || [] })
}

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  await logActivityServer({
    admin,
    action: body.action,
    entityType: body.entityType,
    entityId: body.entityId,
    entityLabel: body.entityLabel,
    oldValue: body.oldValue,
    newValue: body.newValue,
    metadata: body.metadata,
  })

  return NextResponse.json({ ok: true })
}
