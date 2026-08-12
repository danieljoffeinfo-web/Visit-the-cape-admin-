import { supabaseAdmin } from '@/lib/supabase-admin'
import { fullName, type Client } from '@/lib/clients'

/**
 * Record a client from a booking.
 *
 * Called whenever a booking is saved, not only when Xero is involved, which is
 * the whole reason the Clients list used to look empty. Matching is on email
 * because that is the one field an invoice cannot do without and the one a
 * person is least likely to retype differently.
 *
 * Never throws. A booking that saved successfully must not fail because the
 * client record could not be written — the booking is the thing the customer
 * paid for; the client row is bookkeeping.
 */
export async function recordClientFromBooking(input: {
  name?: string | null
  firstName?: string | null
  surname?: string | null
  email?: string | null
  phone?: string | null
  accountNumber?: string | null
  /** Set when the booking raised a Xero invoice, so the CRM columns stay useful. */
  xeroContactId?: string | null
  xeroStatus?: string | null
  invoicedAmount?: number | null
}): Promise<{ recorded: boolean; reason?: string }> {
  const email = String(input.email || '').trim().toLowerCase()
  if (!email) return { recorded: false, reason: 'no email on the booking' }

  const name =
    String(input.name || '').trim() ||
    fullName(input.firstName || '', input.surname || '') ||
    email

  try {
    /* Read first so an existing client keeps details this booking did not
       collect. A blind upsert would blank a phone number captured last month
       because this form left the field empty. */
    const { data: existing } = await supabaseAdmin
      .from('customers')
      .select('id,total_bookings,phone,account_number,xero_contact_id,xero_total_invoiced')
      .ilike('email', email)
      .maybeSingle()

    const invoiced = Number(input.invoicedAmount) || 0
    const row = {
      name,
      email,
      phone: String(input.phone || '').trim() || existing?.phone || null,
      account_number: String(input.accountNumber || '').trim() || existing?.account_number || null,
      total_bookings: (existing?.total_bookings ?? 0) + 1,
      xero_contact_id: input.xeroContactId || existing?.xero_contact_id || null,
      ...(input.xeroStatus ? { xero_last_status: input.xeroStatus } : {}),
      xero_total_invoiced: Number(existing?.xero_total_invoiced ?? 0) + invoiced,
      updated_at: new Date().toISOString(),
    }

    if (existing?.id) {
      const { error } = await supabaseAdmin.from('customers').update(row).eq('id', existing.id)
      if (error) throw error
    } else {
      const { error } = await supabaseAdmin.from('customers').insert(row)
      if (error) throw error
    }

    return { recorded: true }
  } catch (error) {
    console.error('Client record error:', error)
    return { recorded: false, reason: error instanceof Error ? error.message : 'unknown' }
  }
}

export async function listClients(): Promise<Client[]> {
  const { data, error } = await supabaseAdmin
    .from('customers')
    .select('*')
    .order('updated_at', { ascending: false })
    .limit(500)

  if (error) throw error
  return (data || []) as Client[]
}
