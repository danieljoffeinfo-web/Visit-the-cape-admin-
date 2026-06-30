import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { canUseJarvis } from '@/lib/jarvis-config'
import { supabaseAdmin } from '@/lib/supabase-admin'

type RouteContext = { params: Promise<{ threadId: string }> }

async function getOwnedThread(threadId: string, adminUserId: string) {
  const { data, error } = await supabaseAdmin
    .from('jarvis_threads')
    .select('id,title,created_at,updated_at')
    .eq('id', threadId)
    .eq('admin_user_id', adminUserId)
    .maybeSingle()

  if (error) throw error
  return data
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const admin = await getApprovedAdminUser()
  if (!admin || !canUseJarvis(admin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { threadId } = await context.params
  const thread = await getOwnedThread(threadId, admin.id)
  if (!thread) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const { data: messages, error } = await supabaseAdmin
    .from('jarvis_messages')
    .select('id,role,content,created_at')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })

  if (error) {
    return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
  }

  return NextResponse.json({ thread, messages: messages || [] })
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const admin = await getApprovedAdminUser()
  if (!admin || !canUseJarvis(admin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { threadId } = await context.params
  const thread = await getOwnedThread(threadId, admin.id)
  if (!thread) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const body = await request.json()
  const title = String(body?.title || '').trim().slice(0, 120)
  if (!title) {
    return NextResponse.json({ error: 'Title is required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('jarvis_threads')
    .update({ title, updated_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('admin_user_id', admin.id)
    .select('id,title,created_at,updated_at')
    .single()

  if (error) {
    return NextResponse.json({ error: 'Failed to update conversation' }, { status: 500 })
  }

  return NextResponse.json({ thread: data })
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const admin = await getApprovedAdminUser()
  if (!admin || !canUseJarvis(admin)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { threadId } = await context.params
  const thread = await getOwnedThread(threadId, admin.id)
  if (!thread) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  const { error } = await supabaseAdmin
    .from('jarvis_threads')
    .delete()
    .eq('id', threadId)
    .eq('admin_user_id', admin.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to delete conversation' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
