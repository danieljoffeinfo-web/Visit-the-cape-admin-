import { NextRequest, NextResponse } from 'next/server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { logActivityServer } from '@/lib/activity-log-server'
import { hideInvoice, unhideInvoice } from '@/lib/xero-hidden-invoices'

type RouteContext = { params: Promise<{ invoiceId: string }> }

/**
 * Hide an invoice from the Accounting list.
 *
 * This does NOT void or delete anything in Xero — the accounting record is left
 * exactly as it is. Restore with PATCH.
 */
export async function DELETE(request: NextRequest, context: RouteContext) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { invoiceId } = await context.params
  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 })
  }

  const body = await request.json().catch(() => ({} as Record<string, unknown>))
  const invoiceNumber = body?.invoiceNumber ? String(body.invoiceNumber) : null
  const contactName = body?.contactName ? String(body.contactName) : null

  try {
    await hideInvoice({ invoiceId, invoiceNumber, contactName, admin })

    await logActivityServer({
      admin,
      action: 'Hid invoice from Accounting',
      entityType: 'xero_invoice',
      entityId: invoiceId,
      entityLabel: invoiceNumber || invoiceId,
      metadata: { hiddenOnly: true, xeroUnchanged: true },
    })

    return NextResponse.json({ ok: true, hidden: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to hide invoice'
    console.error('Xero invoice hide error:', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}

/** Restore a previously hidden invoice to the Accounting list. */
export async function PATCH(_request: NextRequest, context: RouteContext) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { invoiceId } = await context.params
  if (!invoiceId) {
    return NextResponse.json({ error: 'Invoice id is required' }, { status: 400 })
  }

  try {
    await unhideInvoice(invoiceId)

    await logActivityServer({
      admin,
      action: 'Restored invoice to Accounting',
      entityType: 'xero_invoice',
      entityId: invoiceId,
      entityLabel: invoiceId,
    })

    return NextResponse.json({ ok: true, hidden: false })
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to restore invoice'
    console.error('Xero invoice restore error:', err)
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
