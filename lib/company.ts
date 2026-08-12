/** Visit The Cape company details as they appear on invoices. */

export const COMPANY = {
  tradingName: 'Visit The Cape',
  legalName: 'Visit The Cape (Pty) Ltd',
  website: 'www.visitthecape.co.za',
  registration: '2022/735195/07',
  banking: {
    accountName: 'Visit The Cape (Pty) Ltd',
    bank: 'Standard Bank',
    branchCode: '000410',
    accountNumber: '041921194',
    /** Standard Bank South Africa — needed by international payers. */
    swift: 'SBZAZAJJ',
  },
  registeredOffice: [
    'Unit 3, 18 Fifth Street, Montague Gardens',
    'Western Cape, 7441',
  ],
  /** Prices are captured VAT inclusive, so line items show "Inc" in the VAT column. */
  vatNote: 'All amounts are VAT inclusive',
} as const

function addressList(value: string | undefined, fallback: string[]) {
  const parsed = (value || '')
    .split(',')
    .map((address) => address.trim())
    .filter((address) => address.includes('@'))
  return parsed.length > 0 ? parsed : fallback
}

/**
 * Everyone who gets a copy of every invoice this dashboard emails.
 *
 * Accounts and the office both need to see what went out — accounts to
 * reconcile it, the office to answer the customer who rings about it. On a
 * copy sent to a customer these are blind: the customer has no reason to see
 * either address, and a reply-all from a client should reach whoever sent it
 * rather than the archive.
 *
 * Comma-separated env override so a person can be added or removed without a
 * deploy, with a real default so the copies happen whether or not anyone
 * remembers to set it.
 */
export const INVOICE_ARCHIVE_EMAILS = addressList(process.env.INVOICE_ARCHIVE_EMAIL, [
  'tyron@drivingforce.biz',
  'tanya@visitthecape.co.za',
])

/**
 * Who is told when an enquiry comes off the website.
 *
 * Enquiries were written to the database and nowhere else, so noticing one
 * meant remembering to go and look. This is the address that finds out
 * without being asked.
 */
export const ENQUIRY_NOTIFY_EMAILS = addressList(process.env.ENQUIRY_NOTIFY_EMAIL, [
  'tanya@visitthecape.co.za',
])

/** Invoice palette sampled from the approved VC invoice template. */
export const INVOICE_COLORS = {
  bronze: { r: 0.71, g: 0.43, b: 0.18 },      // #b56e2d
  bronzeSoft: { r: 0.78, g: 0.58, b: 0.39 },  // #c69364
  headerBar: { r: 0.11, g: 0.11, b: 0.11 },   // #1d1d1d
  text: { r: 0.11, g: 0.11, b: 0.11 },
  muted: { r: 0.44, g: 0.44, b: 0.44 },
  rule: { r: 0.91, g: 0.83, b: 0.76 },        // #e9d4c1
  totalsBg: { r: 0.95, g: 0.95, b: 0.95 },
  white: { r: 1, g: 1, b: 1 },
} as const
