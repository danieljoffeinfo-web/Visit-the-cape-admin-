import { Contact, Invoice, LineItem } from 'xero-node'
import { getAuthedXeroClient } from './xero'
import { supabaseAdmin } from './supabase-admin'

export type XeroLineItemInput = {
  description: string
  quantity?: number
  unitAmount: number | string
}

export type XeroInvoiceInput = {
  contactName: string
  contactEmail?: string | null
  description: string
  amount: number | string
  dueDate: string
  bookingId?: string | null
  bookingType?: string | null
  reference?: string | null
  /**
   * Itemised lines, when the booking has more than one thing on it.
   *
   * Add-on bookings do: skydiving for two and a seal snorkel for one is three
   * numbers the customer agreed to separately. Sending them as one lump would
   * make the Xero invoice disagree with the PDF the dashboard generates from
   * the same booking, and the customer would be holding both.
   *
   * Omitted, it falls back to a single line at `amount`, which is what every
   * existing caller does.
   */
  lineItems?: XeroLineItemInput[]
}

export async function createXeroInvoiceForBooking(input: XeroInvoiceInput) {
  const auth = await getAuthedXeroClient()
  if (!auth) {
    return { connected: false as const, invoice: null }
  }

  const { xero, tenantId } = auth
  const numericAmount = Number(input.amount || 0)

  const lineItems: LineItem[] =
    input.lineItems && input.lineItems.length > 0
      ? input.lineItems.map(
          (line) =>
            ({
              description: line.description,
              quantity: line.quantity ?? 1,
              unitAmount: Number(line.unitAmount || 0),
              accountCode: '200',
            }) as LineItem,
        )
      : [
          {
            description: input.description,
            quantity: 1,
            unitAmount: numericAmount,
            accountCode: '200',
          } as LineItem,
        ]

  const invoice: Invoice = {
    type: Invoice.TypeEnum.ACCREC,
    contact: {
      name: input.contactName,
      emailAddress: input.contactEmail || undefined,
    } as Contact,
    lineItems,
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
