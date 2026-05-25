import { XeroClient } from 'xero-node'
import { supabase } from './supabase'

export function createXeroClient() {
  return new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: [
      'accounting.settings',
      'accounting.contacts',
      'accounting.invoices',
      'accounting.payments',
      'accounting.banktransactions',
      'accounting.reports.profitandloss.read',
      'accounting.reports.executivesummary.read',
      'accounting.reports.banksummary.read',
    ],
  })
}

export async function getXeroTokens() {
  const { data } = await supabase
    .from('xero_tokens')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(1)
    .single()
  return data
}

export async function saveXeroTokens(tokens: {
  access_token: string
  refresh_token: string
  tenant_id: string
  org_name: string
  expires_at: string
}) {
  const { error } = await supabase.from('xero_tokens').upsert(
    { ...tokens, updated_at: new Date().toISOString() },
    { onConflict: 'tenant_id' }
  )
  if (error) throw error
}

export async function refreshXeroTokenIfNeeded(): Promise<string | null> {
  const tokenRow = await getXeroTokens()
  if (!tokenRow) return null

  const expiresAt = new Date(tokenRow.expires_at).getTime()
  const now = Date.now()
  const fiveMinutes = 5 * 60 * 1000

  if (expiresAt - now > fiveMinutes) {
    return tokenRow.access_token
  }

  // Need to refresh
  const xero = createXeroClient()
  xero.setTokenSet({
    access_token: tokenRow.access_token,
    refresh_token: tokenRow.refresh_token,
  })

  const newTokenSet = await xero.refreshToken()

  await saveXeroTokens({
    access_token: newTokenSet.access_token!,
    refresh_token: newTokenSet.refresh_token!,
    tenant_id: tokenRow.tenant_id,
    org_name: tokenRow.org_name,
    expires_at: new Date(Date.now() + (newTokenSet.expires_in || 1800) * 1000).toISOString(),
  })

  return newTokenSet.access_token!
}

export async function getAuthedXeroClient(): Promise<{ xero: XeroClient; tenantId: string } | null> {
  const tokenRow = await getXeroTokens()
  if (!tokenRow) return null

  const accessToken = await refreshXeroTokenIfNeeded()
  if (!accessToken) return null

  const xero = createXeroClient()
  xero.setTokenSet({
    access_token: accessToken,
    refresh_token: tokenRow.refresh_token,
  })

  return { xero, tenantId: tokenRow.tenant_id }
}

export function formatZAR(amount: number): string {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}
