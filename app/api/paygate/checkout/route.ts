import { NextRequest, NextResponse } from 'next/server'

const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.visitthecape.co.za').replace(/\/$/, '')

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/"/g, '&quot;')
}

async function readBody(request: NextRequest) {
  const contentType = request.headers.get('content-type') || ''
  if (contentType.includes('application/json')) {
    return request.json() as Promise<Record<string, unknown>>
  }
  const form = await request.formData()
  const body: Record<string, unknown> = {}
  form.forEach((value, key) => {
    body[key] = typeof value === 'string' ? value : value.toString()
  })
  return body
}

export async function POST(request: NextRequest) {
  try {
    const body = await readBody(request)
    const experience = String(body?.experience || '').trim()
    const name = String(body?.name || '').trim()
    const email = String(body?.email || '').trim()
    const phone = body?.phone ? String(body.phone).trim() : null
    const passengers = Number(body?.passengers) || 1
    const date = String(body?.date || '').trim()

    if (!experience || !name || !email) {
      return new NextResponse('Missing required booking fields', { status: 400 })
    }

    const paygateRes = await fetch(`${SITE_URL}/api/paygate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ experience, name, email, phone, passengers, date }),
      cache: 'no-store',
    })

    if (!paygateRes.ok) {
      const text = await paygateRes.text().catch(() => '')
      console.error('PayGate proxy failed:', paygateRes.status, text)
      return new NextResponse('Payment service unavailable. Please email hello@visitthecape.co.za', { status: 502 })
    }

    const data = await paygateRes.json() as { url?: string; params?: Record<string, string> }
    if (!data.url || !data.params) {
      return new NextResponse('Invalid payment response', { status: 502 })
    }

    const fields = Object.entries(data.params)
      .map(([key, value]) => `<input type="hidden" name="${escapeHtml(key)}" value="${escapeHtml(String(value))}">`)
      .join('\n')

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Redirecting to payment</title>
  <style>
    body { margin: 0; font-family: system-ui, sans-serif; background: #0c0b09; color: #f5f0e6;
      display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 2rem; text-align: center; }
  </style>
</head>
<body>
  <p>Redirecting to secure payment&hellip;</p>
  <form id="pg" method="POST" action="${escapeHtml(data.url)}">
    ${fields}
    <noscript><button type="submit">Continue to payment</button></noscript>
  </form>
  <script>document.getElementById('pg').submit();</script>
</body>
</html>`

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    console.error('PayGate checkout error:', error)
    return new NextResponse('Payment could not be started. Please email hello@visitthecape.co.za', { status: 500 })
  }
}
