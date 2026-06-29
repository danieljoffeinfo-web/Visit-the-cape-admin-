import { NextRequest, NextResponse } from 'next/server'
import { FLEET_VEHICLE_BUCKET } from '@/lib/fleet-image'
import { supabaseAdmin } from '@/lib/supabase-admin'

const MIME_BY_EXT: Record<string, string> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
}

function contentTypeForPath(path: string, fallback?: string | null) {
  if (fallback) return fallback
  const ext = path.split('.').pop()?.toLowerCase() || ''
  return MIME_BY_EXT[ext] || 'application/octet-stream'
}

function isSafeStoragePath(path: string) {
  if (!path || path.startsWith('/') || path.includes('..')) return false
  return /^[a-zA-Z0-9/_\-.]+$/.test(path)
}

export async function GET(request: NextRequest) {
  const path = request.nextUrl.searchParams.get('path')?.trim() || ''
  if (!isSafeStoragePath(path)) {
    return NextResponse.json({ error: 'Invalid image path' }, { status: 400 })
  }

  const { data, error: downloadError } = await supabaseAdmin.storage
    .from(FLEET_VEHICLE_BUCKET)
    .download(path)

  if (downloadError || !data) {
    console.error('Fleet vehicle image download error:', downloadError)
    return NextResponse.json({ error: 'Image not found' }, { status: 404 })
  }

  const bytes = await data.arrayBuffer()

  return new NextResponse(bytes, {
    headers: {
      'Content-Type': contentTypeForPath(path, data.type),
      'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
    },
  })
}
