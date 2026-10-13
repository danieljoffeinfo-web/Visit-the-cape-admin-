import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'

/**
 * The website's content tables (tours, blog_posts, add_ons, site_settings,
 * private_tour_bookings) and its enquiries / tag-along bookings.
 *
 * These used to live in a separate "Visit the Cape Main" Supabase project
 * (ufcawaywfgzrhfbzxtgz), reached with CONTENT_SUPABASE_URL and
 * CONTENT_SUPABASE_SERVICE_ROLE_KEY. In October 2026 the two projects were
 * merged into this one to stop paying for both, so the "content" client is now
 * simply the admin client. CONTENT_SUPABASE_* are ignored and can be deleted
 * from Vercel.
 *
 * The function is kept so the call sites (and enquiries-server / bookings-db,
 * which still distinguish a "content" source) don't need to change.
 */
export function getContentSupabaseAdmin(): SupabaseClient {
  return supabaseAdmin
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
