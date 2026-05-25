import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient, saveXeroTokens } from '@/lib/xero'

const allowedReturnHosts = new Set([
  'dft-admin.vercel.app',
  'dft-admin-next.vercel.app',
])

function decodeReturnUrl(request: NextRequest, status: 'connected' | 'error', reason?: string) {
  const fallbackUrl = new URL('/?panel=settings', request.nextUrl.origin)
  fallbackUrl.searchParams.set('xero', status)
  if (reason) fallbackUrl.searchParams.set('reason', reason)

  const state = request.nextUrl.searchParams.get('state')
  if (!state) return fallbackUrl

  try {
    const parsed = JSON.parse(Buffer.from(state, 'base64url').toString('utf8')) as {
      origin?: string
      returnTo?: string
    }
    if (!parsed.origin || !parsed.returnTo?.startsWith('/')) return fallbackUrl

    const origin = new URL(parsed.origin)
    if (!allowedReturnHosts.has(origin.host)) return fallbackUrl

    const returnUrl = new URL(parsed.returnTo, origin.origin)
    returnUrl.searchParams.set('xero', status)
    if (reason) returnUrl.searchParams.set('reason', reason)
    return returnUrl
  } catch {
    return fallbackUrl
  }
}

export async function GET(request: NextRequest) {
  const url = request.url
  const state = request.nextUrl.searchParams.get('state') || undefined
  const xero = createXeroClient(state)

  try {
    const tokenSet = await xero.apiCallback(url)
    await xero.updateTenants()
    const tenants = xero.tenants

    if (!tenants || tenants.length === 0) {
      return NextResponse.redirect(decodeReturnUrl(request, 'error', 'no_tenants'))
    }

    const tenant = tenants[0]
    await saveXeroTokens({
      access_token: tokenSet.access_token!,
      refresh_token: tokenSet.refresh_token!,
      tenant_id: tenant.tenantId,
      org_name: tenant.tenantName,
      expires_at: new Date(Date.now() + (tokenSet.expires_in || 1800) * 1000).toISOString(),
    })

    return NextResponse.redirect(decodeReturnUrl(request, 'connected'))
  } catch (err) {
    console.error('Xero callback error:', err)
    return NextResponse.redirect(decodeReturnUrl(request, 'error'))
  }
}
