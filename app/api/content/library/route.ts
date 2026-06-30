import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { CONTENT_LIBRARY_BUCKET, contentMediaProxySrc } from '@/lib/content-library'
import { supabaseAdmin } from '@/lib/supabase-admin'

export async function GET() {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('content_media')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(200)

  if (error) {
    console.error('Content media list error:', error)
    return NextResponse.json({ error: 'Failed to load media library' }, { status: 500 })
  }

  const media = (data || []).map((item) => ({
    ...item,
    url: contentMediaProxySrc(item.storage_path),
  }))

  return NextResponse.json({ media })
}

export async function DELETE(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Media id is required' }, { status: 400 })

  const { data: media, error: fetchError } = await supabaseAdmin
    .from('content_media')
    .select('id,storage_path')
    .eq('id', id)
    .maybeSingle()

  if (fetchError || !media) {
    return NextResponse.json({ error: 'Media not found' }, { status: 404 })
  }

  await supabaseAdmin.storage.from(CONTENT_LIBRARY_BUCKET).remove([media.storage_path])
  const { error } = await supabaseAdmin.from('content_media').delete().eq('id', id)

  if (error) {
    console.error('Content media delete error:', error)
    return NextResponse.json({ error: 'Failed to delete media' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
