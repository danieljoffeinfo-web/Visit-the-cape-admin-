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

/**
 * Every invoice this dashboard emails is copied here.
 *
 * A blind copy rather than a visible one: the customer has no reason to see the
 * accounts address on their invoice, and a reply-all from a client should reach
 * the person who sent it, not the archive.
 *
 * Overridable by env so it can be pointed elsewhere without a deploy, but it
 * has a real default so the copy happens whether or not anyone remembers to set
 * the variable.
 */
export const INVOICE_ARCHIVE_EMAIL =
  process.env.INVOICE_ARCHIVE_EMAIL?.trim() || 'tyron@drivingforce.biz'

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
