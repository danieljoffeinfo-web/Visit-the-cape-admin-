import { Invoice } from 'xero-node'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getAuthedXeroClient } from '@/lib/xero'

export async function voidOrDeleteXeroInvoice(
  auth: NonNullable<Awaited<ReturnType<typeof getAuthedXeroClient>>>,
  invoiceId: string,
  currentStatus?: string | null,
) {
  const status = (currentStatus || '').toUpperCase()

  if (status === 'PAID') {
    throw new Error('Paid invoices cannot be deleted. Record a credit note in Xero if needed.')
  }

  if (status === 'VOIDED' || status === 'DELETED') {
    throw new Error('This invoice is already voided or deleted.')
  }

  const nextStatus =
    status === 'DRAFT' ? Invoice.StatusEnum.DELETED : Invoice.StatusEnum.VOIDED

  await auth.xero.accountingApi.updateInvoice(auth.tenantId, invoiceId, {
    invoices: [{ invoiceID: invoiceId, status: nextStatus }],
  })

  const linkStatus = nextStatus === Invoice.StatusEnum.DELETED ? 'DELETED' : 'VOIDED'

  await supabaseAdmin
    .from('xero_invoice_links')
    .update({ status: linkStatus, updated_at: new Date().toISOString() })
    .eq('xero_invoice_id', invoiceId)

  return { status: linkStatus }
}
