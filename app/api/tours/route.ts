import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { getContentSupabaseAdmin, type WebsiteTour } from '@/lib/content-supabase-admin'
import { revalidateWebsitePaths, tourRevalidationPaths } from '@/lib/revalidate-website'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = getContentSupabaseAdmin()
    const { data, error } = await supabase
      .from('tours')
      .select('*')
      .order('display_order', { ascending: true })
      .order('name', { ascending: true })

    if (error) throw error
    return NextResponse.json({ tours: (data || []) as WebsiteTour[] })
  } catch (error) {
    console.error('Tours fetch error:', error)
    return NextResponse.json({ error: 'Failed to load website tours' }, { status: 500 })
  }
}

const EDITABLE_FIELDS = [
  'name',
  'tagline',
  'category',
  'duration',
  'price_pax',
  'price_note',
  'price_private',
  'summary',
  'highlights',
  'itinerary',
  'experience_intro',
  'included',
  'excluded',
  'what_to_wear',
  'region',
  'display_order',
  'is_published',
  'is_featured',
] as const

export async function PATCH(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await request.json()
    const id = String(body?.id || '').trim()
    if (!id) {
      return NextResponse.json({ error: 'Tour id is required' }, { status: 400 })
    }

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() }
    for (const field of EDITABLE_FIELDS) {
      if (field in body) patch[field] = body[field]
    }

    if (patch.price_pax != null && (Number.isNaN(Number(patch.price_pax)) || Number(patch.price_pax) < 0)) {
      return NextResponse.json({ error: 'Invalid price per person' }, { status: 400 })
    }

    const supabase = getContentSupabaseAdmin()
    const { data, error } = await supabase
      .from('tours')
      .update(patch)
      .eq('id', id)
      .select('*')
      .single()

    if (error) throw error

    const tour = data as WebsiteTour
    const revalidation = await revalidateWebsitePaths(tourRevalidationPaths(tour))

    return NextResponse.json({ tour, revalidation })
  } catch (error) {
    console.error('Tour update error:', error)
    return NextResponse.json({ error: 'Failed to update tour' }, { status: 500 })
  }
}
