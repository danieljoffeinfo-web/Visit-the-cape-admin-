#!/usr/bin/env node
/**
 * Clears bookings, revenue, CRM, and invoice link data from the admin Supabase.
 * Preserves fleet vehicles (tour_products where family = 'fleet') and admin_users / xero_tokens.
 */
import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SECRET_KEY

if (!url || !key) {
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const sb = createClient(url, key)

async function wipeTable(table, filter) {
  let query = sb.from(table).delete()
  if (filter) query = filter(query)
  const { error, count } = await query.select('*', { count: 'exact', head: true })
  if (error && !error.message.includes('0 rows')) {
    console.warn(`  ${table}: ${error.message}`)
    return 0
  }
  return count ?? 0
}

async function main() {
  console.log('Wiping revenue and booking data (keeping fleet vehicles)...')

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
    const { error } = await sb.from(table).delete().neq('id', '00000000-0000-0000-0000-000000000000')
    console.log(`  ${table}: ${error ? error.message : 'cleared'}`)
  }

  const { error: productErr } = await sb.from('tour_products').delete().neq('family', 'fleet')
  console.log(`  tour_products (non-fleet): ${productErr ? productErr.message : 'cleared'}`)

  const { data: fleet } = await sb.from('tour_products').select('id,title').eq('family', 'fleet')
  console.log(`\nFleet vehicles preserved: ${fleet?.length ?? 0}`)
  for (const v of fleet || []) console.log(`  - ${v.title}`)
  console.log('\nDone.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
