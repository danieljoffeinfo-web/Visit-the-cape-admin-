import { NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { getContentSupabaseAdmin } from '@/lib/content-supabase-admin'
import type { AddOn } from '@/lib/add-ons'

/**
 * The add-on catalogue, read from the website's content project.
 *
 * Unpublished rows are included: the dashboard should be able to book something
 * that has been pulled from the public site — a repeat customer asking for last
 * season's experience is a sale, not a bug. The form marks them.
 */
export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getContentSupabaseAdmin()
    const { data, error } = await supabase
      .from('add_ons')
      .select('id,slug,emoji,name,tagline,description,location,vibe,price,price_note,group_size,image,display_order,is_published')
      .order('display_order', { ascending: true })

    if (error) throw error

    const addOns = ((data || []) as AddOn[]).map((row) => ({
      ...row,
      price: row.price == null ? null : Number(row.price),
    }))

    return NextResponse.json({ addOns })
  } catch (error) {
    console.error('Add-ons fetch error:', error)
    return NextResponse.json({ error: 'Failed to load add-ons' }, { status: 500 })
  }
}
