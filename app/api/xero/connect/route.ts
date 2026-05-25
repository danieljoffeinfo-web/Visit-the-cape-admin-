import { NextResponse } from 'next/server'

const xeroScopes = [
  'accounting.settings',
  'accounting.contacts',
  'accounting.invoices',
  'accounting.payments',
  'accounting.banktransactions',
  'accounting.reports.profitandloss.read',
  'accounting.reports.executivesummary.read',
  'accounting.reports.banksummary.read',
]

export async function GET() {
  const consentUrl = new URL('https://login.xero.com/identity/connect/authorize')
  consentUrl.searchParams.set('response_type', 'code')
  consentUrl.searchParams.set('client_id', process.env.XERO_CLIENT_ID!)
  consentUrl.searchParams.set('redirect_uri', process.env.XERO_REDIRECT_URI!)
  consentUrl.searchParams.set('scope', xeroScopes.join(' '))
  consentUrl.searchParams.set('state', crypto.randomUUID().replaceAll('-', ''))

  return NextResponse.redirect(consentUrl)
}
