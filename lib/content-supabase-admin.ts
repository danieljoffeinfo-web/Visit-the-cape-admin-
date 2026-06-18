import { createClient, type SupabaseClient } from '@supabase/supabase-js'

const DEFAULT_CONTENT_URL = 'https://ufcawaywfgzrhfbzxtgz.supabase.co'

let client: SupabaseClient | null = null

export function getContentSupabaseAdmin() {
  if (client) return client

  const url = (process.env.CONTENT_SUPABASE_URL?.trim() || DEFAULT_CONTENT_URL).replace(/\/$/, '')
  const key = process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY?.trim()

  if (!key) {
    throw new Error('CONTENT_SUPABASE_SERVICE_ROLE_KEY is not configured')
  }

  client = createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  })

  return client
}

export type WebsiteTour = {
  id: string
  slug: string
  name: string
  tagline?: string | null
  category?: string | null
  duration?: string | null
  price_pax: number
  price_note?: string | null
  price_private?: number | null
  summary?: string | null
  highlights?: string[] | null
  itinerary?: string[] | null
  experience_intro?: string | null
  included?: string | null
  excluded?: string | null
  what_to_wear?: string | null
  region?: string | null
  display_order?: number | null
  is_published?: boolean | null
  is_featured?: boolean | null
  updated_at?: string | null
}
