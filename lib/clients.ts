/**
 * Clients — the people bookings are made for.
 *
 * This is the `customers` table, which already existed but was only ever
 * written when a fleet booking happened to raise a Xero invoice. Everything
 * else — every tour booking, every add-on, every rental invoiced outside Xero —
 * left no record, so the list read as empty and the same client had their
 * details retyped on every booking.
 */

export type Client = {
  id: string
  name: string
  email: string
  phone?: string | null
  account_number?: string | null
  /* Optional, for clients invoicing through a company. Most bookings are
     individuals, so nothing here is ever required. */
  business_name?: string | null
  vat_number?: string | null
  address?: string | null
  notes?: string | null
  total_bookings: number
  xero_contact_id?: string | null
  xero_total_invoiced?: number | null
  xero_last_status?: string | null
  created_at: string
  updated_at: string
}

/** What a booking form needs back when an existing client is chosen. */
export type ClientPrefill = {
  firstName: string
  surname: string
  email: string
  phone: string
  accountNumber: string
}

/**
 * Split a stored display name back into the two fields the fleet form uses.
 *
 * The client record keeps one `name` because that is what an invoice bills to
 * and what Xero stores; the booking form asks for first name and surname
 * separately. Everything before the last space is the first name, so
 * "Mary-Anne van der Merwe" keeps its surname intact rather than losing the
 * particles.
 */
export function splitClientName(name: string): { firstName: string; surname: string } {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return { firstName: '', surname: '' }
  if (parts.length === 1) return { firstName: parts[0], surname: '' }
  return { firstName: parts[0], surname: parts.slice(1).join(' ') }
}

export function clientPrefill(client: Client): ClientPrefill {
  const { firstName, surname } = splitClientName(client.name)
  return {
    firstName,
    surname,
    email: client.email || '',
    phone: client.phone || '',
    accountNumber: client.account_number || '',
  }
}

export function fullName(firstName: string, surname: string) {
  return [firstName, surname].map((p) => String(p || '').trim()).filter(Boolean).join(' ')
}

/** Case-insensitive match across the fields someone would actually search by. */
export function searchClients(clients: Client[], query: string) {
  const q = query.trim().toLowerCase()
  if (!q) return clients
  return clients.filter((c) =>
    [c.name, c.email, c.phone, c.account_number, c.business_name, c.vat_number]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q)),
  )
}
