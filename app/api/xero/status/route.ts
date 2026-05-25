import { NextResponse } from 'next/server'
import { getXeroTokens } from '@/lib/xero'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const token = await getXeroTokens()
  if (!token) return NextResponse.json({ connected: false })

  return NextResponse.json({
    connected: true,
    tenant_id: token.tenant_id,
    org_name: token.org_name,
    expires_at: token.expires_at,
    updated_at: token.updated_at,
  })
}

export async function DELETE() {
  const { error } = await supabaseAdmin
    .from('xero_tokens')
    .delete()
    .neq('id', '00000000-0000-0000-0000-000000000000')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
