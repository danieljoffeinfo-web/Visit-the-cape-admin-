/**
 * One-off wipe: clears operational data from content + admin Supabase and Xero.
 * Preserves admin_users and xero_tokens (OAuth connection).
 *
 * Usage: node scripts/wipe-all-data.mjs
 * Requires env: ADMIN_SUPABASE_URL, ADMIN_SERVICE_ROLE_KEY,
 *   CONTENT_SUPABASE_URL, CONTENT_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js'

const ADMIN_URL = process.env.ADMIN_SUPABASE_URL || 'https://zsxiflghjqacoayhbsyg.supabase.co'
const ADMIN_KEY = process.env.ADMIN_SERVICE_ROLE_KEY
const CONTENT_URL = process.env.CONTENT_SUPABASE_URL || 'https://ufcawaywfgzrhfbzxtgz.supabase.co'
const CONTENT_KEY = process.env.CONTENT_SERVICE_ROLE_KEY

if (!ADMIN_KEY || !CONTENT_KEY) {
  console.error('Missing ADMIN_SERVICE_ROLE_KEY or CONTENT_SERVICE_ROLE_KEY')
  process.exit(1)
}

const admin = createClient(ADMIN_URL, ADMIN_KEY, { auth: { persistSession: false } })
const content = createClient(CONTENT_URL, CONTENT_KEY, { auth: { persistSession: false } })

async function wipeTable(client, table, filterColumn = 'id') {
  const { error, count } = await client
    .from(table)
    .delete({ count: 'exact' })
    .neq(filterColumn, '00000000-0000-0000-0000-000000000000')

  if (error) {
    // Some tables may not exist
    if (error.message.includes('does not exist') || error.code === '42P01') {
      console.log(`  ${table}: skipped (not found)`)
      return 0
    }
    throw new Error(`${table}: ${error.message}`)
  }
  console.log(`  ${table}: deleted ${count ?? '?'} rows`)
  return count ?? 0
}

async function wipeXero() {
  const { data: tokenRow, error } = await admin.from('xero_tokens').select('*').order('updated_at', { ascending: false }).limit(1).maybeSingle()
  if (error || !tokenRow) {
    console.log('Xero: not connected, skipping')
    return { voided: 0, archived: 0, paidSkipped: 0, errors: [] }
  }

  const headers = {
    Authorization: `Bearer ${tokenRow.access_token}`,
    'xero-tenant-id': tokenRow.tenant_id,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  }

  const result = { voided: 0, archived: 0, paidSkipped: 0, errors: [] }

  // Void invoices
  let page = 1
  while (true) {
    const res = await fetch(`https://api.xero.com/api.xro/2.0/Invoices?page=${page}`, { headers })
    if (!res.ok) {
      result.errors.push(`Invoices list page ${page}: HTTP ${res.status}`)
      break
    }
    const body = await res.json()
    const invoices = body.Invoices || []
    if (invoices.length === 0) break

    for (const inv of invoices) {
      const status = (inv.Status || '').toUpperCase()
      if (status === 'VOIDED' || status === 'DELETED') continue
      if (status === 'PAID') {
        result.paidSkipped++
        continue
      }
      const voidRes = await fetch(`https://api.xero.com/api.xro/2.0/Invoices/${inv.InvoiceID}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ InvoiceID: inv.InvoiceID, Status: 'VOIDED' }),
      })
      if (voidRes.ok) {
        result.voided++
        console.log(`  voided invoice ${inv.InvoiceNumber || inv.InvoiceID} (${status})`)
      } else {
        const errText = await voidRes.text()
        result.errors.push(`Void ${inv.InvoiceID}: ${voidRes.status} ${errText.slice(0, 120)}`)
      }
    }
    if (invoices.length < 100) break
    page++
  }

  // Archive contacts
  page = 1
  while (true) {
    const res = await fetch(`https://api.xero.com/api.xro/2.0/Contacts?page=${page}`, { headers })
    if (!res.ok) {
      result.errors.push(`Contacts list page ${page}: HTTP ${res.status}`)
      break
    }
    const body = await res.json()
    const contacts = body.Contacts || []
    if (contacts.length === 0) break

    for (const contact of contacts) {
      if ((contact.ContactStatus || '').toUpperCase() === 'ARCHIVED') continue
      const archiveRes = await fetch(`https://api.xero.com/api.xro/2.0/Contacts/${contact.ContactID}`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ ContactID: contact.ContactID, ContactStatus: 'ARCHIVED' }),
      })
      if (archiveRes.ok) {
        result.archived++
        console.log(`  archived contact ${contact.Name}`)
      } else {
        const errText = await archiveRes.text()
        result.errors.push(`Archive ${contact.ContactID}: ${archiveRes.status} ${errText.slice(0, 120)}`)
      }
    }
    if (contacts.length < 100) break
    page++
  }

  return result
}

async function main() {
  console.log('\n=== Xero ===')
  const xeroResult = await wipeXero()
  console.log('Xero summary:', xeroResult)

  console.log('\n=== Admin Supabase ===')
  const adminTables = [
    'enquiry_replies',
    'xero_invoice_links',
    'activity_logs',
    'tour_bookings',
    'tag_along_bookings',
    'tag_along_tours',
    'tour_departures',
    'customers',
    'enquiries',
    'tour_products',
    'xero_tracking_map',
  ]
  for (const table of adminTables) {
    await wipeTable(admin, table)
  }

  console.log('\n=== Content Supabase (public site) ===')
  for (const table of ['tag_along_bookings', 'tag_along_tours', 'enquiries']) {
    await wipeTable(content, table)
  }

  console.log('\nDone. Preserved: admin_users, xero_tokens')
}

main().catch((err) => {
  console.error('Wipe failed:', err)
  process.exit(1)
})
