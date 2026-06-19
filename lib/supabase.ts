import { createBrowserClient } from '@supabase/ssr'
import { getSupabaseAnonKey, getSupabaseUrl } from '@/lib/supabase-env'

export function createSupabaseBrowserClient() {
  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()
  if (!url || !anonKey) {
    throw new Error('Supabase browser client is not configured')
  }
  return createBrowserClient(url, anonKey)
}

let browserClient: ReturnType<typeof createSupabaseBrowserClient> | null = null

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createSupabaseBrowserClient()
  }
  return browserClient
}

/** Lazy accessor — never initialize at module load (avoids crashing the app shell). */
export function getSupabase() {
  return getSupabaseBrowserClient()
}
