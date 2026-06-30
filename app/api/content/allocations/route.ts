import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import type { ContentAllocation, ContentPlacement, ContentPlatform, ContentStatus } from '@/lib/content-library'
import { contentMediaProxySrc } from '@/lib/content-library'
import { supabaseAdmin } from '@/lib/supabase-admin'

function parseAllocationBody(body: Record<string, unknown>) {
  return {
    mediaId: body.mediaId ? String(body.mediaId) : null,
    scheduledDate: String(body.scheduledDate || '').trim(),
    platform: String(body.platform || '').trim() as ContentPlatform,
    placement: (String(body.placement || 'post').trim() as ContentPlacement) || 'post',
    caption: String(body.caption || ''),
    status: (String(body.status || 'draft').trim() as ContentStatus) || 'draft',
  }
}

export async function GET(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const month = request.nextUrl.searchParams.get('month')
  let query = supabaseAdmin
    .from('content_allocations')
    .select('*')
    .order('scheduled_date', { ascending: true })

  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const start = `${month}-01`
    const end = `${month}-31`
    query = query.gte('scheduled_date', start).lte('scheduled_date', end)
  }

  const { data, error } = await query

  if (error) {
    console.error('Content allocations list error:', error)
    const missingTable = error.message?.toLowerCase().includes('content_allocations')
    return NextResponse.json(
      { error: missingTable ? 'Database tables missing — run supabase/content_library.sql' : 'Failed to load content allocations' },
      { status: 500 },
    )
  }

  const mediaIds = [...new Set((data || []).map((row) => row.media_id).filter(Boolean))]
  const mediaMap = new Map<string, Record<string, unknown>>()
  if (mediaIds.length > 0) {
    const { data: mediaRows } = await supabaseAdmin.from('content_media').select('*').in('id', mediaIds)
    for (const item of mediaRows || []) mediaMap.set(item.id, item)
  }

  const allocations = (data || []).map((row) => {
    const media = row.media_id ? mediaMap.get(row.media_id) : null
    return {
      id: row.id,
      media_id: row.media_id,
      scheduled_date: row.scheduled_date,
      platform: row.platform,
      placement: row.placement,
      caption: row.caption,
      status: row.status,
      created_at: row.created_at,
      updated_at: row.updated_at,
      media: media
        ? {
            ...media,
            url: contentMediaProxySrc(String(media.storage_path)),
          }
        : null,
    }
  })

  return NextResponse.json({ allocations })
}

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = parseAllocationBody(await request.json())
  if (!body.scheduledDate || !body.platform) {
    return NextResponse.json({ error: 'Date and platform are required' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin
    .from('content_allocations')
    .insert({
      media_id: body.mediaId,
      scheduled_date: body.scheduledDate,
      platform: body.platform,
      placement: body.placement,
      caption: body.caption,
      status: body.status,
      updated_at: new Date().toISOString(),
    })
    .select('*')
    .single()

  if (error) {
    console.error('Content allocation create error:', error)
    return NextResponse.json({ error: 'Failed to create allocation' }, { status: 500 })
  }

  let media = null
  if (data.media_id) {
    const { data: mediaRow } = await supabaseAdmin.from('content_media').select('*').eq('id', data.media_id).maybeSingle()
    media = mediaRow ? { ...mediaRow, url: contentMediaProxySrc(mediaRow.storage_path) } : null
  }

  return NextResponse.json({
    allocation: {
      ...data,
      media,
    },
  })
}

export async function PATCH(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const id = String(body.id || '').trim()
  if (!id) return NextResponse.json({ error: 'Allocation id is required' }, { status: 400 })

  const parsed = parseAllocationBody(body)
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (body.scheduledDate !== undefined) updates.scheduled_date = parsed.scheduledDate
  if (body.platform !== undefined) updates.platform = parsed.platform
  if (body.placement !== undefined) updates.placement = parsed.placement
  if (body.caption !== undefined) updates.caption = parsed.caption
  if (body.status !== undefined) updates.status = parsed.status
  if (body.mediaId !== undefined) updates.media_id = parsed.mediaId

  const { data, error } = await supabaseAdmin
    .from('content_allocations')
    .update(updates)
    .eq('id', id)
    .select('*')
    .single()

  if (error) {
    console.error('Content allocation update error:', error)
    return NextResponse.json({ error: 'Failed to update allocation' }, { status: 500 })
  }

  let media = null
  if (data.media_id) {
    const { data: mediaRow } = await supabaseAdmin.from('content_media').select('*').eq('id', data.media_id).maybeSingle()
    media = mediaRow ? { ...mediaRow, url: contentMediaProxySrc(mediaRow.storage_path) } : null
  }

  return NextResponse.json({
    allocation: {
      ...data,
      media,
    },
  })
}

export async function DELETE(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const id = request.nextUrl.searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'Allocation id is required' }, { status: 400 })

  const { error } = await supabaseAdmin.from('content_allocations').delete().eq('id', id)
  if (error) {
    console.error('Content allocation delete error:', error)
    return NextResponse.json({ error: 'Failed to delete allocation' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
