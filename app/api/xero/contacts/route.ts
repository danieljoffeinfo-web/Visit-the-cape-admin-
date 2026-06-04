import { NextResponse } from 'next/server'
import { Contact } from 'xero-node'
import { getAuthedXeroClient } from '@/lib/xero'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth

  try {
    const response = await xero.accountingApi.getContacts(tenantId)
    return NextResponse.json(response.body.contacts || [])
  } catch (err) {
    console.error('Xero contacts error:', err)
    return NextResponse.json({ error: 'Failed to fetch contacts' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth
  const body = await request.json()
  const name = String(body?.name || '').trim()
  const email = String(body?.email || '').trim()
  const existingContactId = String(body?.contactId || '').trim() || null

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  try {
    let contactId = existingContactId

    if (!contactId) {
      const response = await xero.accountingApi.createContacts(tenantId, {
        contacts: [{ name, emailAddress: email } as Contact],
      })
      contactId = response.body.contacts?.[0]?.contactID || null
    }

    const { error } = await supabaseAdmin.from('customers').upsert(
      { name, email, xero_contact_id: contactId, updated_at: new Date().toISOString() },
      { onConflict: 'email' }
    )

    if (error) {
      console.warn('Could not sync Xero contact to CRM:', error.message)
    }

    return NextResponse.json({ ok: true, contactId })
  } catch (err) {
    console.error('Xero sync contact error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
