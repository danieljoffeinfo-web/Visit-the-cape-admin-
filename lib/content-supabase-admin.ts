import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let contentClient: SupabaseClient | null = null

export function getContentSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.CONTENT_SUPABASE_URL?.trim()
  const key =
    process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.CONTENT_SUPABASE_SECRET_KEY?.trim()

  if (!url || !key) return null

  if (!contentClient) {
    contentClient = createClient(url, key, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })
  }

  return contentClient
}
