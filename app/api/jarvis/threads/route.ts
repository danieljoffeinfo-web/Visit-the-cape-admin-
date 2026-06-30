import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { canUseJarvis } from '@/lib/jarvis-config'
import { supabaseAdmin } from '@/lib/supabase-admin'

async function assertJarvisAccess() {
  const admin = await getApprovedAdminUser()
  if (!admin) return { admin: null, error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  if (!canUseJarvis(admin)) {
    return {
      admin: null,
      error: NextResponse.json({ error: 'Jarvis is not enabled for your account' }, { status: 403 }),
    }
  }
  return { admin, error: null }
}

export async function GET() {
  const { admin, error } = await assertJarvisAccess()
  if (error) return error

  const { data, error: dbError } = await supabaseAdmin
    .from('jarvis_threads')
    .select('id,title,created_at,updated_at')
    .eq('admin_user_id', admin!.id)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (dbError) {
    if (dbError.message.toLowerCase().includes('jarvis_threads')) {
      return NextResponse.json({
        threads: [],
        setupRequired: true,
        message: 'Run supabase/jarvis_chat.sql in the admin Supabase SQL editor.',
      })
    }
    return NextResponse.json({ error: 'Failed to load conversations' }, { status: 500 })
  }

  return NextResponse.json({ threads: data || [] })
}

export async function POST(request: NextRequest) {
  const { admin, error } = await assertJarvisAccess()
  if (error) return error

  let title = 'New conversation'
  try {
    const body = await request.json()
    if (body?.title) title = String(body.title).slice(0, 120)
  } catch {
    // empty body is fine
  }

  const { data, error: dbError } = await supabaseAdmin
    .from('jarvis_threads')
    .insert({ admin_user_id: admin!.id, title })
    .select('id,title,created_at,updated_at')
    .single()

  if (dbError) {
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }

  return NextResponse.json({ thread: data })
}
