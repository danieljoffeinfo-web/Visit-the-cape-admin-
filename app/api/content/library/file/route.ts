import { NextRequest, NextResponse } from 'next/server'
import { CONTENT_LIBRARY_BUCKET } from '@/lib/content-library'
import { supabaseAdmin } from '@/lib/supabase-admin'

function isSafeStoragePath(path: string) {
  if (!path || path.startsWith('/') || path.includes('..')) return false
  return /^[a-zA-Z0-9/_\-.]+$/.test(path)
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')?.trim() || ''
  if (!isSafeStoragePath(path)) {
    return NextResponse.json({ error: 'Invalid file path' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.storage.from(CONTENT_LIBRARY_BUCKET).download(path)
  if (error || !data) {
    console.error('Content library file download error:', error)
    return NextResponse.json({ error: 'File not found' }, { status: 404 })
  }

  const bytes = await data.arrayBuffer()
  return new NextResponse(bytes, {
    headers: {
      'Content-Type': data.type || 'application/octet-stream',
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
