import type { SupabaseClient } from '@supabase/supabase-js'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getContentSupabaseAdmin } from '@/lib/content-supabase-admin'

/**
 * Which Supabase project owns `tag_along_bookings`.
 *
 * There is a table of that name in BOTH projects. The website inserts into the
 * content project's copy; the admin used to read its own project's copy, so a
 * booking made on visitthecape.co.za never appeared in the dashboard and a
 * booking made in the dashboard never appeared to the site. Same table name,
 * two databases, no overlap.
 *
 * The content project wins, for the same reason it already owns enquiries: it
 * is the one the public website can reach. The admin gets there with the
 * service-role key.
 *
 * Fleet bookings (`tour_bookings`) and the Xero links stay in the admin
 * project — the website never writes those, so there is nothing to reconcile,
 * and moving them would be churn for its own sake.
 */

export type BookingsSource = 'content' | 'admin'

function hasContentProject() {
  return Boolean(process.env.CONTENT_SUPABASE_SERVICE_ROLE_KEY?.trim())
}

export function getBookingsSource(): BookingsSource {
  return hasContentProject() ? 'content' : 'admin'
}

/**
 * The client that owns booking rows.
 *
 * Falls back to the admin project when the content service-role key is missing
 * rather than throwing: a dashboard that shows the wrong bookings is bad, and a
 * dashboard that shows a stack trace is worse.
 */
export function getBookingsDb(): { client: SupabaseClient; source: BookingsSource } {
  if (getBookingsSource() === 'content') {
    try {
      return { client: getContentSupabaseAdmin(), source: 'content' }
    } catch (err) {
      console.warn('Content Supabase unavailable, using admin project for bookings:', err)
    }
  }
  return { client: supabaseAdmin, source: 'admin' }
}

/** Shorthand for the common case — the caller only ever wants the client. */
export function bookingsDb(): SupabaseClient {
  return getBookingsDb().client
}
