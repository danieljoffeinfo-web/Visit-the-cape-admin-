import { Contact, Invoice, LineItem } from 'xero-node'
import { getAuthedXeroClient } from './xero'
import { supabaseAdmin } from './supabase-admin'

export type XeroInvoiceInput = {
  contactName: string
  contactEmail?: string | null
  description: string
  amount: number | string
  dueDate: string
  bookingId?: string | null
  bookingType?: string | null
  reference?: string | null
}

export async function createXeroInvoiceForBooking(input: XeroInvoiceInput) {
  const auth = await getAuthedXeroClient()
  if (!auth) {
    return { connected: false as const, invoice: null }
  }

  const { xero, tenantId } = auth
  const numericAmount = Number(input.amount || 0)

  const invoice: Invoice = {
    type: Invoice.TypeEnum.ACCREC,
    contact: {
      name: input.contactName,
      emailAddress: input.contactEmail || undefined,
    } as Contact,
    lineItems: [
      {
        description: input.description,
        quantity: 1,
        unitAmount: numericAmount,
        accountCode: '200',
      } as LineItem,
    ],
    dueDate: input.dueDate as never,
    status: Invoice.StatusEnum.AUTHORISED,
    currencyCode: 'ZAR' as unknown as Invoice['currencyCode'],
    reference: input.reference || undefined,
  }

  const response = await xero.accountingApi.createInvoices(tenantId, { invoices: [invoice] })
  const created = response.body.invoices?.[0] || null

  if (created && input.bookingId) {
    await supabaseAdmin.from('xero_invoice_links').upsert({
      booking_id: input.bookingId,
      booking_type: input.bookingType || 'tag_along',
      xero_invoice_id: created.invoiceID!,
      xero_invoice_number: created.invoiceNumber,
      status: created.status,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'booking_id' })
  }

  return { connected: true as const, invoice: created }
}
