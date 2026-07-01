import { NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { canUseJarvis } from '@/lib/jarvis-config'
import { clearPrimaryThreadMessages, getOrCreatePrimaryThread } from '@/lib/jarvis-session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUseJarvis(admin)) {
    return NextResponse.json({ error: 'Jarvis is not enabled for your account' }, { status: 403 })
  }

  try {
    const { thread, setupRequired } = await getOrCreatePrimaryThread(admin.id)
    if (setupRequired || !thread) {
      return NextResponse.json({
        setupRequired: true,
        thread: null,
        messages: [],
        message: 'Run supabase/jarvis_chat.sql in the admin Supabase SQL editor.',
      })
    }

    const { data: messages, error } = await supabaseAdmin
      .from('jarvis_messages')
      .select('id,role,content,created_at')
      .eq('thread_id', thread.id)
      .order('created_at', { ascending: true })
      .limit(80)

    if (error) {
      return NextResponse.json({ error: 'Failed to load messages' }, { status: 500 })
    }

    return NextResponse.json({
      thread,
      messages: (messages || []).filter((m) => m.role === 'user' || m.role === 'assistant'),
    })
  } catch (error) {
    console.error('Jarvis session error:', error)
    return NextResponse.json({ error: 'Failed to load Jarvis session' }, { status: 500 })
  }
}

export async function DELETE() {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (!canUseJarvis(admin)) {
    return NextResponse.json({ error: 'Jarvis is not enabled for your account' }, { status: 403 })
  }

  try {
    const { thread, setupRequired } = await getOrCreatePrimaryThread(admin.id)
    if (setupRequired || !thread) {
      return NextResponse.json({ error: 'Jarvis is not set up yet' }, { status: 503 })
    }

    await clearPrimaryThreadMessages(thread.id, admin.id)
    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Jarvis clear session error:', error)
    return NextResponse.json({ error: 'Failed to clear conversation' }, { status: 500 })
  }
}
