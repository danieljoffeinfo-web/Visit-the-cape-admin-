/**
 * Add-On Adventures — the extras sold alongside a tour.
 *
 * These live in the website's content project, in the same database the public
 * site reads. There is deliberately no second copy here: a price that is right
 * on the invoice and wrong on the website is worse than no price at all.
 */

export type AddOn = {
  id: string
  slug: string
  emoji: string | null
  name: string
  tagline: string | null
  description: string | null
  location: string | null
  vibe: string | null
  /** Null means quote-on-request — several genuinely have no fixed price. */
  price: number | null
  price_note: string | null
  group_size: string | null
  image: string | null
  display_order: number
  is_published: boolean
}

/** One add-on on a booking, at the price it was actually sold for. */
export type AddOnLine = {
  slug: string
  name: string
  quantity: number
  /** Per-unit, in rands. Captured at booking time so a later price change
   *  cannot rewrite an invoice that has already gone out. */
  unitAmount: number
}

/**
 * The JSON stored in `tag_along_bookings.notes` for an add-on booking.
 *
 * Same trick the fleet bookings use: the booking hub only has one notes column,
 * so the structured part of the booking rides inside it. `kind` is what tells
 * the two apart when reading.
 */
export type AddOnBookingNotes = {
  kind: 'addon'
  lines: AddOnLine[]
  note?: string | null
  invoice?: { number: string; issuedAt: string } | null
}

export function parseAddOnBookingNotes(value?: string | null): AddOnBookingNotes | null {
  if (!value) return null
  try {
    const parsed = JSON.parse(value) as AddOnBookingNotes
    if (parsed?.kind !== 'addon' || !Array.isArray(parsed.lines)) return null
    return parsed
  } catch {
    // Free-text notes on a normal booking land here; that is not an error.
    return null
  }
}

export function addOnLineTotal(line: AddOnLine) {
  return (Number(line.unitAmount) || 0) * (Number(line.quantity) || 0)
}

export function addOnBookingTotal(lines: AddOnLine[]) {
  return lines.reduce((sum, line) => sum + addOnLineTotal(line), 0)
}

/** "Skydiving × 2, Seal Snorkelling" — the one-line summary for a table row. */
export function summariseAddOnLines(lines: AddOnLine[]) {
  if (lines.length === 0) return 'Add-on booking'
  return lines
    .map((line) => (line.quantity > 1 ? `${line.name} × ${line.quantity}` : line.name))
    .join(', ')
}

export function formatAddOnPrice(addOn: Pick<AddOn, 'price' | 'price_note'>) {
  if (addOn.price == null) return 'Enquire for pricing'
  const amount = Number(addOn.price).toLocaleString('en-ZA')
  return addOn.price_note ? `R${amount} ${addOn.price_note}` : `R${amount}`
}
