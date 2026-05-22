import { NextResponse } from 'next/server'
import { createXeroClient } from '@/lib/xero'

export async function GET() {
  const xero = createXeroClient()
  const consentUrl = await xero.buildConsentUrl()
  return NextResponse.redirect(consentUrl)
}
