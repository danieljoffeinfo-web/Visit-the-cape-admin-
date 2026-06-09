import { NextRequest } from 'next/server'
import { GET as bookingsGet, POST as bookingsPost, PATCH as bookingsPatch } from '../bookings/route'

function withType(request: NextRequest, type: string) {
  const url = new URL(request.url)
  url.pathname = '/api/bookings'
  url.searchParams.set('type', type)
  return new NextRequest(url, {
    method: request.method,
    headers: request.headers,
    body: request.body,
  })
}

/** @deprecated Use /api/bookings?type=internal */
export async function GET(request: NextRequest) {
  return bookingsGet(withType(request, 'internal'))
}

/** @deprecated Use /api/bookings?type=internal */
export async function POST(request: NextRequest) {
  return bookingsPost(withType(request, 'internal'))
}

/** @deprecated Use /api/bookings */
export async function PATCH(request: NextRequest) {
  return bookingsPatch(request)
}
