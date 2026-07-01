import { NextRequest } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { canUseJarvis, isJarvisConfigured, jarvisSystemPrompt } from '@/lib/jarvis-config'
import { buildJarvisBriefContext } from '@/lib/jarvis-context'
import { runJarvisCompletion, type ChatMessage } from '@/lib/jarvis-openrouter'
import { getOrCreatePrimaryThread } from '@/lib/jarvis-session'
import { supabaseAdmin } from '@/lib/supabase-admin'

export const runtime = 'nodejs'
export const maxDuration = 60

async function getOwnedThread(threadId: string, adminUserId: string) {
  const { data } = await supabaseAdmin
    .from('jarvis_threads')
    .select('id,title')
    .eq('id', threadId)
    .eq('admin_user_id', adminUserId)
    .maybeSingle()
  return data
}

function deriveTitle(message: string): string {
  const cleaned = message.replace(/\s+/g, ' ').trim()
  if (!cleaned) return 'New conversation'
  return cleaned.length > 48 ? `${cleaned.slice(0, 48)}…` : cleaned
}

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }
  if (!canUseJarvis(admin)) {
    return new Response(JSON.stringify({ error: 'Jarvis is not enabled for your account' }), { status: 403 })
  }
  if (!isJarvisConfigured()) {
    return new Response(
      JSON.stringify({ error: 'Jarvis is not connected. OPENROUTER_API_KEY is missing or invalid on the server.' }),
      { status: 503 },
    )
  }

  let body: { message?: string; threadId?: string }
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), { status: 400 })
  }

  const message = String(body.message || '').trim()
  if (!message) {
    return new Response(JSON.stringify({ error: 'Message is required' }), { status: 400 })
  }

  let threadId = body.threadId ? String(body.threadId) : null

  if (threadId) {
    const owned = await getOwnedThread(threadId, admin.id)
    if (!owned) {
      return new Response(JSON.stringify({ error: 'Conversation not found' }), { status: 404 })
    }
  } else {
    const session = await getOrCreatePrimaryThread(admin.id)
    if (session.setupRequired || !session.thread) {
      return new Response(
        JSON.stringify({ error: 'Jarvis database tables missing. Run supabase/jarvis_chat.sql in Supabase.' }),
        { status: 503 },
      )
    }
    threadId = session.thread.id
  }

  const { error: userMsgError } = await supabaseAdmin.from('jarvis_messages').insert({
    thread_id: threadId,
    role: 'user',
    content: message,
  })

  if (userMsgError) {
    return new Response(JSON.stringify({ error: 'Failed to save message' }), { status: 500 })
  }

  const { data: history } = await supabaseAdmin
    .from('jarvis_messages')
    .select('role,content')
    .eq('thread_id', threadId)
    .order('created_at', { ascending: true })
    .limit(40)

  const brief = await buildJarvisBriefContext()
  const chatMessages: ChatMessage[] = [
    { role: 'system', content: `${jarvisSystemPrompt(admin)}\n\n${brief}` },
    ...((history || []) as ChatMessage[]),
  ]

  const encoder = new TextEncoder()
  let assistantText = ''

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`))
      }

      send({ type: 'meta', threadId })

      try {
        assistantText = await runJarvisCompletion(chatMessages, (chunk) => {
          send({ type: 'token', content: chunk })
        })

        await supabaseAdmin.from('jarvis_messages').insert({
          thread_id: threadId,
          role: 'assistant',
          content: assistantText,
        })

        const { count } = await supabaseAdmin
          .from('jarvis_messages')
          .select('id', { count: 'exact', head: true })
          .eq('thread_id', threadId)
          .eq('role', 'user')

        if (count === 1) {
          await supabaseAdmin
            .from('jarvis_threads')
            .update({ title: deriveTitle(message), updated_at: new Date().toISOString() })
            .eq('id', threadId)
            .eq('admin_user_id', admin.id)
        } else {
          await supabaseAdmin
            .from('jarvis_threads')
            .update({ updated_at: new Date().toISOString() })
            .eq('id', threadId)
            .eq('admin_user_id', admin.id)
        }

        send({ type: 'done', content: assistantText })
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : 'Jarvis failed to respond'
        send({ type: 'error', error: errMsg })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'application/x-ndjson',
      'Cache-Control': 'no-cache',
    },
  })
}
