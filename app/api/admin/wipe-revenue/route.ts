import { NextRequest, NextResponse } from 'next/server'
import { logActivityServer } from '@/lib/activity-log-server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { bookingsDb, getBookingsSource } from '@/lib/bookings-db'
import { deleteAllEnquiries, getEnquiriesSource } from '@/lib/enquiries-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

const CONFIRM_PHRASE = 'DELETE ALL DATA'

async function clearTable(table: string) {
  const { error } = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
  return error ? error.message : 'cleared'
}

/**
 * Bookings live in whichever project `getBookingsDb()` resolves to — the
 * content one in production. Clearing the admin project's copy left the real
 * rows in place, which is the same trap enquiries fell into.
 */
async function clearBookings() {
  const { error } = await bookingsDb()
    .from('tag_along_bookings')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')
  return error ? error.message : 'cleared'
}

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (admin.role !== 'owner') {
    return NextResponse.json({ error: 'Only the owner account can clear all admin data.' }, { status: 403 })
  }

  let body: { confirm?: string } = {}
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Confirmation required' }, { status: 400 })
  }

  if (body.confirm?.trim().toUpperCase() !== CONFIRM_PHRASE) {
    return NextResponse.json({ error: `Type ${CONFIRM_PHRASE} to confirm` }, { status: 400 })
  }

  const results: Record<string, string> = {}

  const tables = [
    // Jarvis was removed from the admin, but clear any rows it left behind.
    'jarvis_messages',
    'jarvis_threads',
    'content_allocations',
    'content_media',
    'enquiry_replies',
    'xero_invoice_links',
    'activity_logs',
    'tour_bookings',
    'customers',
    'tag_along_tours',
    'tour_departures',
  ]

  for (const table of tables) {
    results[table] = await clearTable(table)
  }

  results[`tag_along_bookings (${getBookingsSource()})`] = await clearBookings()

  // Enquiries are owned by the website/content project, not this one. Clearing
  // the admin copy left the inbox and the unread badge untouched.
  try {
    const enquiryResult = await deleteAllEnquiries()
    results[`enquiries (${enquiryResult.source})`] = enquiryResult.cleared
      ? 'cleared'
      : 'skipped — owned by an external API'
  } catch (error) {
    results[`enquiries (${getEnquiriesSource()})`] =
      error instanceof Error ? error.message : 'failed'
  }

  const { error: productErr } = await supabaseAdmin.from('tour_products').delete().neq('family', 'fleet')
  results['tour_products (non-fleet)'] = productErr ? productErr.message : 'cleared'

  const { data: fleet } = await supabaseAdmin.from('tour_products').select('id,title').eq('family', 'fleet')

  await logActivityServer({
    admin,
    action: 'clear_all_data',
    entityType: 'admin',
    entityLabel: 'Admin data wipe',
    metadata: { tables: Object.keys(results) },
  })

  return NextResponse.json({
    ok: true,
    results,
    fleetPreserved: fleet?.length ?? 0,
    fleetTitles: (fleet || []).map((v) => v.title),
  })
}
