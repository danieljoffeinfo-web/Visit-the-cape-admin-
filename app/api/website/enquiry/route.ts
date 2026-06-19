import { NextRequest, NextResponse } from 'next/server'
import { getContentSupabaseAdmin } from '@/lib/content-supabase-admin'

const ALLOWED_ORIGINS = [
  'https://www.visitthecape.co.za',
  'https://visitthecape.co.za',
  'https://dft-repo.vercel.app',
]

function corsHeaders(origin: string | null) {
  const allowed = origin && ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allowed,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get('origin')),
  })
}

export async function POST(request: NextRequest) {
  const headers = corsHeaders(request.headers.get('origin'))

  try {
    const body = await request.json()
    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim()
    const experience = String(body?.experience || '').trim()
    const message = String(body?.message || '').trim()

    if (!name || !email || !experience) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400, headers })
    }

    const supabase = getContentSupabaseAdmin()
    const { data, error } = await supabase
      .from('enquiries')
      .insert([{
        name,
        email,
        phone: body?.phone ? String(body.phone).trim() : null,
        experience,
        message: message || null,
      }])
      .select('id')
      .single()

    if (error) throw error
    return NextResponse.json({ ok: true, id: data.id }, { headers })
  } catch (error) {
    console.error('Website enquiry proxy error:', error)
    return NextResponse.json({ error: 'Failed to save enquiry' }, { status: 500, headers })
  }
}
