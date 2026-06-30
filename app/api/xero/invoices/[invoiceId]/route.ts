import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { logActivityServer } from '@/lib/activity-log-server'
import { voidOrDeleteXeroInvoice } from '@/lib/xero-invoice-actions'
import { getAuthedXeroClient } from '@/lib/xero'

type RouteContext = { params: Promise<{ invoiceId: string }> }

export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const auth = await getAuthedXeroClient()
  if (!auth) {
    return NextResponse.json({ error: 'Xero not connected' }, { status: 401 })
  }

  const { invoiceId } = await context.params
  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 })
  }

  let currentStatus: string | undefined
  try {
    const body = await request.json().catch(() => ({}))
    currentStatus = body?.status ? String(body.status) : undefined
  } catch {
    // optional body
  }

  try {
    const result = await voidOrDeleteXeroInvoice(auth, invoiceId, currentStatus)

    await logActivityServer({
      admin,
      action: 'void_invoice',
      entityType: 'xero_invoice',
      entityId: invoiceId,
      entityLabel: invoiceId,
      metadata: { status: result.status },
    })

    return NextResponse.json({ ok: true, ...result })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to delete invoice'
    console.error('Xero invoice delete error:', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
