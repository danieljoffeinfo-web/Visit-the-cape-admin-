import { NextResponse } from 'next/server'
import { getXeroTokens, refreshXeroTokenIfNeeded } from '@/lib/xero'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getApprovedAdminUser } from '@/lib/auth-server'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const token = await getXeroTokens()
  if (!token) return NextResponse.json({ connected: false })

  const expiresAt = new Date(token.expires_at).getTime()
  const isExpired = Number.isFinite(expiresAt) ? expiresAt <= Date.now() : false

  if (isExpired) {
    const refreshed = await refreshXeroTokenIfNeeded()
    if (!refreshed) {
      return NextResponse.json({ connected: false, reconnectRequired: true })
    }
  }

  const latestToken = await getXeroTokens()
  if (!latestToken) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected: true,
    tenant_id: latestToken.tenant_id,
    org_name: latestToken.org_name,
    expires_at: latestToken.expires_at,
    updated_at: latestToken.updated_at,
  })
}

export async function DELETE() {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { error } = await supabaseAdmin
    .from('xero_tokens')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
