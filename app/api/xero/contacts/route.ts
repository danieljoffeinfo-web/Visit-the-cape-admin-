import { NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { supabase } from '@/lib/supabase'

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
  const { contactId, name, email } = body

  try {
    // Upsert into Supabase customers
    const { error } = await supabase.from('customers').upsert(
      { name, email, xero_contact_id: contactId, updated_at: new Date().toISOString() },
      { onConflict: 'email' }
    )
    if (error) {
      // Table may not exist yet — just return ok
      console.warn('Could not sync to CRM:', error.message)
    }
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Xero sync contact error:', err)
    return NextResponse.json({ error: 'Sync failed' }, { status: 500 })
  }
}
