import { NextRequest, NextResponse } from 'next/server'

const xeroScopes = [
  'openid',
  'profile',
  'email',
  'offline_access',
  'accounting.settings',
  'accounting.contacts',
  'accounting.invoices',
  'accounting.payments',
  'accounting.banktransactions',
  'accounting.reports.profitandloss.read',
  'accounting.reports.executivesummary.read',
  'accounting.reports.banksummary.read',
]

const allowedReturnHosts = new Set([
  'dft-admin.vercel.app',
  'dft-admin-next.vercel.app',
])

function encodeState(value: { origin: string; returnTo: string }) {
  return Buffer.from(JSON.stringify(value)).toString('base64url')
}

function getReturnTo(request: NextRequest) {
  const requestedReturnTo = request.nextUrl.searchParams.get('returnTo')
  if (requestedReturnTo?.startsWith('/')) return requestedReturnTo

  const referer = request.headers.get('referer')
  if (referer) {
    try {
      const refererUrl = new URL(referer)
      if (refererUrl.host === request.nextUrl.host || allowedReturnHosts.has(refererUrl.host)) {
        return `${refererUrl.pathname}${refererUrl.search}`
      }
    } catch {
      // Fall back to settings below.
    }
  }

  return '/?panel=settings'
}

export async function GET(request: NextRequest) {
  const returnTo = getReturnTo(request)
  const state = encodeState({
    origin: request.nextUrl.origin,
    returnTo,
  })

  const consentUrl = new URL('https://login.xero.com/identity/connect/authorize')
  consentUrl.searchParams.set('response_type', 'code')
  consentUrl.searchParams.set('client_id', process.env.XERO_CLIENT_ID!)
  consentUrl.searchParams.set('redirect_uri', process.env.XERO_REDIRECT_URI!)
  consentUrl.searchParams.set('scope', xeroScopes.join(' '))
  consentUrl.searchParams.set('state', state)

  return NextResponse.redirect(consentUrl)
}
