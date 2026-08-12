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


/**
 * The billing block for an invoice, from the client record.
 *
 * Matched on email, which is the link that already existed: every booking
 * stores the customer's address and every client record is keyed on it. No
 * column had to be added to a booking to join the two.
 *
 * Resolved when the invoice is rendered rather than snapshotted when the
 * booking is taken, so correcting a VAT number typed wrong once fixes every
 * invoice for that client instead of only the next one.
 *
 * Falls back to the name the booking carries whenever there is no client on
 * file, no email to match on, or the lookup fails — an invoice that bills a
 * person by name is the behaviour this replaces, so degrading to it is safe.
 */
export async function billingDetailsFor(input: {
  email?: string | null
  fallbackName: string
  /** Shown under the name when there is nothing better, as it was before. */
  fallbackSubtitle?: string | null
}): Promise<{ billToName: string; billToLines: string[] }> {
  const email = String(input.email || '').trim()
  const plain = {
    billToName: input.fallbackName || '—',
    billToLines: [input.fallbackSubtitle || ''].filter(Boolean),
  }
  if (!email) return plain

  try {
    const { data } = await supabaseAdmin
      .from('customers')
      .select('name,email,business_name,vat_number,address')
      .ilike('email', email)
      .maybeSingle()

    if (!data) return plain

    const client = data as Pick<
      Client,
      'name' | 'email' | 'business_name' | 'vat_number' | 'address'
    >
    const business = String(client.business_name || '').trim()

    /* Billing a company: the company is the customer, and the person who made
       the booking becomes the attention line beneath it. Billing a person: the
       name stands alone, exactly as before. */
    const lines = [
      business ? `Attn: ${input.fallbackName || client.name}` : null,
      client.address || null,
      client.vat_number ? `VAT No. ${client.vat_number}` : null,
      client.email || null,
    ].filter((line): line is string => Boolean(line && String(line).trim()))

    return {
      billToName: business || client.name || input.fallbackName || '—',
      billToLines: lines,
    }
  } catch (error) {
    console.error('Billing details lookup failed:', error)
    return plain
  }
}
