import { supabaseAdmin } from '@/lib/supabase-admin'

const PRIMARY_THREAD_TITLE = 'Jarvis'

export async function getOrCreatePrimaryThread(adminUserId: string) {
  const { data: existing, error: findError } = await supabaseAdmin
    .from('jarvis_threads')
    .select('id,title,created_at,updated_at')
    .eq('admin_user_id', adminUserId)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (findError) {
    if (findError.message.toLowerCase().includes('jarvis_threads')) {
      return { thread: null, setupRequired: true as const }
    }
    throw findError
  }

  if (existing) {
    return { thread: existing, setupRequired: false as const }
  }

  const { data: created, error: createError } = await supabaseAdmin
    .from('jarvis_threads')
    .insert({ admin_user_id: adminUserId, title: PRIMARY_THREAD_TITLE })
    .select('id,title,created_at,updated_at')
    .single()

  if (createError) {
    if (createError.message.toLowerCase().includes('jarvis_threads')) {
      return { thread: null, setupRequired: true as const }
    }
    throw createError
  }

  return { thread: created, setupRequired: false as const }
}

export async function clearPrimaryThreadMessages(threadId: string, adminUserId: string) {
  const { data: thread } = await supabaseAdmin
    .from('jarvis_threads')
    .select('id')
    .eq('id', threadId)
    .eq('admin_user_id', adminUserId)
    .maybeSingle()

  if (!thread) return false

  const { error } = await supabaseAdmin.from('jarvis_messages').delete().eq('thread_id', threadId)
  if (error) throw error

  await supabaseAdmin
    .from('jarvis_threads')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', threadId)
    .eq('admin_user_id', adminUserId)

  return true
}
