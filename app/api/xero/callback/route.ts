import { NextRequest, NextResponse } from 'next/server'
import { createXeroClient, saveXeroTokens } from '@/lib/xero'

export async function GET(request: NextRequest) {
  const url = request.url
  const xero = createXeroClient()

  try {
    const tokenSet = await xero.apiCallback(url)
    await xero.updateTenants()
    const tenants = xero.tenants

    if (!tenants || tenants.length === 0) {
      return NextResponse.redirect(new URL('/settings?xero=error&reason=no_tenants', request.url))
    }

    const tenant = tenants[0]
    await saveXeroTokens({
      access_token: tokenSet.access_token!,
      refresh_token: tokenSet.refresh_token!,
      tenant_id: tenant.tenantId,
      org_name: tenant.tenantName,
      expires_at: new Date(Date.now() + (tokenSet.expires_in || 1800) * 1000).toISOString(),
    })

    return NextResponse.redirect(new URL('/settings?xero=connected', request.nextUrl.origin))
  } catch (err) {
    console.error('Xero callback error:', err)
    return NextResponse.redirect(new URL('/settings?xero=error', request.nextUrl.origin))
  }
}
