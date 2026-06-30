import { NextRequest, NextResponse } from 'next/server'
import { addMonths, format } from 'date-fns'
import { getFleetAvailability } from '@/lib/fleet-availability'

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, max-age=300, stale-while-revalidate=600',
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS })
}

export async function GET(request: NextRequest) {
  const today = new Date()
  const defaultFrom = format(today, 'yyyy-MM-dd')
  const defaultTo = format(addMonths(today, 6), 'yyyy-MM-dd')

  const from = request.nextUrl.searchParams.get('from') || defaultFrom
  const to = request.nextUrl.searchParams.get('to') || defaultTo

  try {
    const availability = await getFleetAvailability(from, to)
    return NextResponse.json(availability, { headers: CORS_HEADERS })
  } catch (error) {
    console.error('Fleet availability error:', error)
    return NextResponse.json({ error: 'Failed to load fleet availability' }, { status: 500, headers: CORS_HEADERS })
  }
}
