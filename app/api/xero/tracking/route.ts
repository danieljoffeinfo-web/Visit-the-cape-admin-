import { NextRequest, NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { supabase } from '@/lib/supabase'

export async function GET() {
  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth

  try {
    const response = await xero.accountingApi.getTrackingCategories(tenantId)
    const categories = response.body.trackingCategories || []

    // Also load saved mappings
    const { data: mappings } = await supabase.from('xero_tracking_map').select('*')

    return NextResponse.json({ categories, mappings: mappings || [] })
  } catch (err) {
    console.error('Xero tracking error:', err)
    return NextResponse.json({ error: 'Failed to fetch tracking' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  const { tour_type, xero_category_id, xero_option_id } = body

  const { error } = await supabase.from('xero_tracking_map').upsert(
    { tour_type, xero_category_id, xero_option_id, updated_at: new Date().toISOString() },
    { onConflict: 'tour_type' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
