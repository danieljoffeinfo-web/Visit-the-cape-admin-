import { NextRequest, NextResponse } from 'next/server'
import { getAuthedXeroClient } from '@/lib/xero'
import { Invoice, LineItem, Contact } from 'xero-node'
import { supabase } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const auth = await getAuthedXeroClient()
  if (!auth) return NextResponse.json({ error: 'Not connected' }, { status: 401 })

  const { xero, tenantId } = auth
  const body = await request.json()
  const { contactName, contactEmail, description, amount, dueDate, bookingId, bookingType } = body

  try {
    const invoice: Invoice = {
      type: Invoice.TypeEnum.ACCREC,
      contact: {
        name: contactName,
        emailAddress: contactEmail,
      } as Contact,
      lineItems: [
        {
          description,
          quantity: 1.0,
          unitAmount: parseFloat(amount),
          accountCode: '200',
        } as LineItem,
      ],
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      dueDate: dueDate as any,
      status: Invoice.StatusEnum.AUTHORISED,
      currencyCode: 'ZAR' as unknown as Invoice['currencyCode'],
    }

    const response = await xero.accountingApi.createInvoices(tenantId, { invoices: [invoice] })
    const created = response.body.invoices?.[0]

    if (created && bookingId) {
      await supabase.from('xero_invoice_links').upsert({
        booking_id: bookingId,
        booking_type: bookingType || 'tag_along',
        xero_invoice_id: created.invoiceID!,
        xero_invoice_number: created.invoiceNumber,
        status: created.status,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'booking_id' })
    }

    return NextResponse.json(created)
  } catch (err) {
    console.error('Create invoice error:', err)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
