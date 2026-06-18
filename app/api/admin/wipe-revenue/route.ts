import { NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function POST() {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const results: Record<string, string> = {}
  const tables = [
    'xero_invoice_links',
    'activity_logs',
    'tag_along_bookings',
    'tour_bookings',
    'customers',
    'tag_along_tours',
    'tour_departures',
    'enquiries',
  ]

  for (const table of tables) {
    const { error } = await supabaseAdmin.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    results[table] = error ? error.message : 'cleared'
  }

  const { error: productErr } = await supabaseAdmin.from('tour_products').delete().neq('family', 'fleet')
  results['tour_products (non-fleet)'] = productErr ? productErr.message : 'cleared'

  const { data: fleet } = await supabaseAdmin.from('tour_products').select('id,title').eq('family', 'fleet')

  return NextResponse.json({
    ok: true,
    results,
    fleetPreserved: fleet?.length ?? 0,
    fleetTitles: (fleet || []).map((v) => v.title),
  })
}
