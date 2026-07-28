import { NextRequest, NextResponse } from 'next/server'
import { createXeroInvoiceForBooking } from '@/lib/xero-invoices'
import { getApprovedAdminUser } from '@/lib/auth-server'

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { contactName, contactEmail, description, amount, dueDate, bookingId, bookingType, reference } = body

  try {
    const result = await createXeroInvoiceForBooking({
      contactName,
      contactEmail,
      description,
      amount,
      dueDate,
      bookingId,
      bookingType,
      reference,
    })

    if (!result.connected) {
      return NextResponse.json({ error: 'Not connected' }, { status: 401 })
    }

    return NextResponse.json(result.invoice)
  } catch (err) {
    console.error('Create invoice error:', err)
    return NextResponse.json({ error: 'Failed to create invoice' }, { status: 500 })
  }
}
