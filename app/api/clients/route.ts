import { NextRequest, NextResponse } from 'next/server'
import { logActivityServer } from '@/lib/activity-log-server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { listClients } from '@/lib/clients-server'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  try {
    return NextResponse.json({ clients: await listClients() })
  } catch (error) {
    console.error('Clients fetch error:', error)
    return NextResponse.json({ error: 'Failed to load clients' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const name = String(body.name || '').trim()
  const email = String(body.email || '').trim().toLowerCase()

  if (!name || !email) {
    return NextResponse.json({ error: 'Name and email are required' }, { status: 400 })
  }

  /* Email is the match key everywhere else, so a duplicate is a mistake worth
     naming rather than a second row to reconcile later. */
  const { data: clash } = await supabaseAdmin
    .from('customers')
    .select('id,name')
    .ilike('email', email)
    .maybeSingle()

  if (clash) {
    return NextResponse.json(
      { error: `${clash.name} already uses that email address` },
      { status: 409 },
    )
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .insert({
      name,
      email,
      phone: String(body.phone || '').trim() || null,
      account_number: String(body.accountNumber || '').trim() || null,
      notes: String(body.notes || '').trim() || null,
      total_bookings: 0,
      xero_total_invoiced: 0,
    })
    .select('*')
    .single()

  if (error) {
    console.error('Client create error:', error)
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 })
  }

  await logActivityServer({
    admin,
    action: 'Created client',
    entityType: 'client',
    entityId: data.id,
    entityLabel: `${name} (${email})`,
    newValue: data,
  })

  return NextResponse.json({ client: data })
}

export async function PATCH(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({}))
  const id = String(body.id || '').trim()
  if (!id) return NextResponse.json({ error: 'Client id is required' }, { status: 400 })

  const { data: existing } = await supabaseAdmin
    .from('customers')
    .select('*')
    .eq('id', id)
    .maybeSingle()

  if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 })

  const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.name !== undefined) patch.name = String(body.name).trim()
  if (body.phone !== undefined) patch.phone = String(body.phone).trim() || null
  if (body.accountNumber !== undefined)
    patch.account_number = String(body.accountNumber).trim() || null
  if (body.notes !== undefined) patch.notes = String(body.notes).trim() || null

  /* Email is deliberately harder to change than the rest: it is the key every
     booking matches on, so editing it silently re-points history. Allowed, but
     only when it does not collide with someone else. */
  if (body.email !== undefined) {
    const email = String(body.email).trim().toLowerCase()
    if (!email) return NextResponse.json({ error: 'Email cannot be blank' }, { status: 400 })
    if (email !== String(existing.email).toLowerCase()) {
      const { data: clash } = await supabaseAdmin
        .from('customers')
        .select('id,name')
        .ilike('email', email)
        .maybeSingle()
      if (clash && clash.id !== id) {
        return NextResponse.json(
          { error: `${clash.name} already uses that email address` },
          { status: 409 },
        )
      }
    }
    patch.email = email
  }

  const { data, error } = await supabaseAdmin
    .from('customers')
    .update(patch)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Client update error:', error)
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 })
  }

  await logActivityServer({
    admin,
    action: 'Updated client',
    entityType: 'client',
    entityId: id,
    entityLabel: `${data.name} (${data.email})`,
    oldValue: existing,
    newValue: data,
  })

  return NextResponse.json({ client: data })
}
