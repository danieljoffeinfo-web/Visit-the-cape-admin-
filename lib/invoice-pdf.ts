import { PDFDocument, PDFFont, PDFPage, StandardFonts, rgb } from 'pdf-lib'
import { COMPANY, INVOICE_COLORS } from '@/lib/company'
import { balanceDue, fullCustomerName, parseFleetBookingNotes, usageTypeLabel } from '@/lib/fleet'
import { invoiceLogoBytes } from '@/lib/invoice-logo'

/**
 * "R50,000.00" — comma thousands, period decimals, matching the approved
 * template. Node's en-ZA locale renders "R50 000,00", so group manually.
 */
function formatMoney(amount: number) {
  const value = Number(amount) || 0
  const [whole, decimals] = Math.abs(value).toFixed(2).split('.')
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return `${value < 0 ? '-' : ''}R${grouped}.${decimals}`
}

/** "25 October 2026" — the long form used on the approved template. */
function formatLongDate(value?: string | null) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value)
  return date.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' })
}

const C = {
  bronze: rgb(INVOICE_COLORS.bronze.r, INVOICE_COLORS.bronze.g, INVOICE_COLORS.bronze.b),
  bronzeSoft: rgb(INVOICE_COLORS.bronzeSoft.r, INVOICE_COLORS.bronzeSoft.g, INVOICE_COLORS.bronzeSoft.b),
  headerBar: rgb(INVOICE_COLORS.headerBar.r, INVOICE_COLORS.headerBar.g, INVOICE_COLORS.headerBar.b),
  text: rgb(INVOICE_COLORS.text.r, INVOICE_COLORS.text.g, INVOICE_COLORS.text.b),
  muted: rgb(INVOICE_COLORS.muted.r, INVOICE_COLORS.muted.g, INVOICE_COLORS.muted.b),
  rule: rgb(INVOICE_COLORS.rule.r, INVOICE_COLORS.rule.g, INVOICE_COLORS.rule.b),
  totalsBg: rgb(INVOICE_COLORS.totalsBg.r, INVOICE_COLORS.totalsBg.g, INVOICE_COLORS.totalsBg.b),
  white: rgb(1, 1, 1),
}

const PAGE_W = 595.28
const PAGE_H = 841.89
const M = 62 // page margin
const RIGHT = PAGE_W - M

type Ctx = {
  pdf: PDFDocument
  page: PDFPage
  font: PDFFont
  bold: PDFFont
  y: number
}

function rightAlign(ctx: Ctx, text: string, rightX: number, size: number, font: PDFFont) {
  return rightX - font.widthOfTextAtSize(text, size)
}

function rule(ctx: Ctx, color = C.bronze, thickness = 1.2) {
  ctx.page.drawLine({
    start: { x: M, y: ctx.y },
    end: { x: RIGHT, y: ctx.y },
    thickness,
    color,
  })
}

/** Wrap text to a pixel width, returning the lines. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word
    if (font.widthOfTextAtSize(candidate, size) > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = candidate
    }
  }
  if (line) lines.push(line)
  return lines.length ? lines : ['—']
}

export type InvoiceLineItem = {
  description: string
  amount: number
}

export type VtcInvoiceInput = {
  invoiceNumber: string
  invoiceDate: string
  dueDate: string
  billToName: string
  billToSubtitle?: string | null
  reference?: string | null
  referenceNote?: string | null
  lineItems: InvoiceLineItem[]
  total: number
  depositAmount?: number | null
}

/**
 * Renders the approved Visit The Cape invoice: logo, BILL TO / invoice meta,
 * reference, line-item table, totals with upfront payment and balance, payment
 * instructions, then banking and registered-office details.
 */
export async function buildVtcInvoicePdf(input: VtcInvoiceInput): Promise<Buffer> {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([PAGE_W, PAGE_H])
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)
  const ctx: Ctx = { pdf, page, font, bold, y: PAGE_H }

  // ---- Logo, centred ----------------------------------------------------
  const logo = await pdf.embedJpg(invoiceLogoBytes())
  const logoW = 168
  const logoH = (logo.height / logo.width) * logoW
  page.drawImage(logo, { x: (PAGE_W - logoW) / 2, y: PAGE_H - 8 - logoH, width: logoW, height: logoH })

  ctx.y = PAGE_H - 199
  rule(ctx)

  // ---- INVOICE heading --------------------------------------------------
  ctx.y -= 40
  page.drawText('INVOICE', { x: M, y: ctx.y, size: 30, font: bold, color: C.text })
  ctx.y -= 15
  rule(ctx)

  // ---- BILL TO (left) + invoice meta (right) ----------------------------
  ctx.y -= 30
  const metaLabelX = 360
  page.drawText('BILL TO', { x: M, y: ctx.y, size: 9.5, font: bold, color: C.bronze })

  const meta: Array<[string, string]> = [
    ['Invoice number', input.invoiceNumber],
    ['Invoice date', formatLongDate(input.invoiceDate)],
    ['Due date', formatLongDate(input.dueDate)],
  ]
  let metaY = ctx.y
  for (const [label, value] of meta) {
    page.drawText(label, { x: metaLabelX, y: metaY, size: 9.5, font: bold, color: C.muted })
    page.drawText(value, { x: rightAlign(ctx, value, RIGHT, 10, font), y: metaY, size: 10, font, color: C.text })
    metaY -= 24
  }

  ctx.y -= 27
  page.drawText(input.billToName || '—', { x: M, y: ctx.y, size: 14, font: bold, color: C.text })
  if (input.billToSubtitle) {
    ctx.y -= 19
    page.drawText(input.billToSubtitle, { x: M, y: ctx.y, size: 10.5, font, color: C.muted })
  }

  ctx.y = Math.min(ctx.y, metaY) - 20

  // ---- Reference --------------------------------------------------------
  if (input.reference) {
    page.drawText('REFERENCE', { x: M, y: ctx.y, size: 9.5, font: bold, color: C.bronze })
    ctx.y -= 20
    for (const line of wrap(input.reference, font, 10.5, RIGHT - M)) {
      page.drawText(line, { x: M, y: ctx.y, size: 10.5, font, color: C.text })
      ctx.y -= 15
    }
    if (input.referenceNote) {
      ctx.y -= 5
      for (const line of wrap(input.referenceNote, font, 10, RIGHT - M)) {
        page.drawText(line, { x: M, y: ctx.y, size: 10, font, color: C.muted })
        ctx.y -= 14
      }
    }
    ctx.y -= 22
  }

  // ---- Line item table --------------------------------------------------
  const amountRightX = RIGHT - 62
  const barH = 26
  page.drawRectangle({ x: M, y: ctx.y - barH + 8, width: RIGHT - M, height: barH, color: C.headerBar })
  const barTextY = ctx.y - barH + 17
  page.drawText('DESCRIPTION', { x: M + 14, y: barTextY, size: 9, font: bold, color: C.white })
  page.drawText('AMOUNT', { x: rightAlign(ctx, 'AMOUNT', amountRightX, 9, bold), y: barTextY, size: 9, font: bold, color: C.white })
  page.drawText('VAT', { x: rightAlign(ctx, 'VAT', RIGHT - 14, 9, bold), y: barTextY, size: 9, font: bold, color: C.white })
  ctx.y -= barH + 12

  for (const item of input.lineItems) {
    const descLines = wrap(item.description, font, 11, amountRightX - M - 30)
    const rowTop = ctx.y
    descLines.forEach((line, index) => {
      page.drawText(line, { x: M + 14, y: ctx.y - index * 15, size: 11, font, color: C.text })
    })
    const money = formatMoney(item.amount)
    page.drawText(money, { x: rightAlign(ctx, money, amountRightX, 11, bold), y: rowTop, size: 11, font: bold, color: C.text })
    page.drawText('Inc', { x: rightAlign(ctx, 'Inc', RIGHT - 14, 9, font), y: rowTop, size: 9, font, color: C.muted })
    ctx.y -= descLines.length * 15 + 6
  }

  page.drawText(COMPANY.vatNote, { x: M + 14, y: ctx.y, size: 9.5, font, color: C.muted })
  ctx.y -= 14
  page.drawLine({ start: { x: M, y: ctx.y }, end: { x: RIGHT, y: ctx.y }, thickness: 0.8, color: C.rule })

  // ---- Totals block (right aligned) -------------------------------------
  const deposit = Number(input.depositAmount) || 0
  const hasDeposit = deposit > 0
  const balance = balanceDue({ totalAmount: input.total, depositAmount: deposit })

  const totalRows: Array<{ label: string; value: string; bronze?: boolean }> = [
    { label: 'TOTAL (VAT INCLUSIVE)', value: formatMoney(input.total) },
  ]
  if (hasDeposit) {
    totalRows.push({ label: 'UPFRONT PAYMENT', value: formatMoney(deposit), bronze: true })
    totalRows.push({ label: 'BALANCE', value: formatMoney(balance) })
  }

  const boxX = 300
  const boxH = totalRows.length * 30 + 16
  ctx.y -= 12
  page.drawRectangle({ x: boxX, y: ctx.y - boxH, width: RIGHT - boxX, height: boxH, color: C.totalsBg })

  let rowY = ctx.y - 26
  for (const row of totalRows) {
    const color = row.bronze ? C.bronze : C.text
    page.drawText(row.label, { x: boxX + 18, y: rowY, size: 10, font: bold, color })
    page.drawText(row.value, { x: rightAlign(ctx, row.value, RIGHT - 18, 12, bold), y: rowY, size: 12, font: bold, color })
    rowY -= 30
  }
  ctx.y -= boxH + 30

  // ---- Footer geometry, pinned to the page bottom -----------------------
  // Fixed so a long description can never push the footer off the page or let
  // the payment box overlap it.
  const FOOTER_RULE_Y = 96
  const FOOTER_LABEL_Y = 77
  const FOOTER_LINES_Y = 57

  // ---- Payment instructions, sitting just above the footer --------------
  if (hasDeposit) {
    const headline = `A ${formatMoney(deposit)} upfront payment is required to confirm the booking.`
    const detail = `The remaining balance of ${formatMoney(balance)} is due by ${formatLongDate(input.dueDate)}.`
    const headlineLines = wrap(headline, bold, 10.5, RIGHT - M - 36)
    const detailLines = wrap(detail, font, 10.5, RIGHT - M - 36)
    const boxHeight = 36 + headlineLines.length * 15 + detailLines.length * 15

    // Sit where the totals left off, but never lower than the footer allows.
    const boxBottom = Math.max(ctx.y - boxHeight, FOOTER_RULE_Y + 32)
    const boxTop = boxBottom + boxHeight

    page.drawRectangle({
      x: M,
      y: boxBottom,
      width: RIGHT - M,
      height: boxHeight,
      borderColor: C.bronze,
      borderWidth: 1,
    })

    let py = boxTop - 22
    page.drawText('PAYMENT INSTRUCTIONS', { x: M + 18, y: py, size: 9.5, font: bold, color: C.bronze })
    py -= 21
    for (const line of headlineLines) {
      page.drawText(line, { x: M + 18, y: py, size: 10.5, font: bold, color: C.text })
      py -= 15
    }
    py -= 3
    for (const line of detailLines) {
      page.drawText(line, { x: M + 18, y: py, size: 10.5, font, color: C.text })
      py -= 15
    }
  }

  // ---- Footer: banking + registered office ------------------------------
  page.drawLine({ start: { x: M, y: FOOTER_RULE_Y }, end: { x: RIGHT, y: FOOTER_RULE_Y }, thickness: 1.2, color: C.bronze })

  page.drawText('BANKING DETAILS', { x: M, y: FOOTER_LABEL_Y, size: 9.5, font: bold, color: C.bronze })
  page.drawText('REGISTERED OFFICE', { x: 330, y: FOOTER_LABEL_Y, size: 9.5, font: bold, color: C.bronze })

  const bankLines = [
    `Account Name: ${COMPANY.banking.accountName}`,
    `Bank: ${COMPANY.banking.bank}`,
    `Branch Code: ${COMPANY.banking.branchCode}`,
    `Account Number: ${COMPANY.banking.accountNumber}`,
  ]
  const officeLines = [
    ...COMPANY.registeredOffice,
    `Registration: ${COMPANY.registration}`,
    COMPANY.website,
  ]

  bankLines.forEach((line, index) => {
    page.drawText(line, { x: M, y: FOOTER_LINES_Y - index * 14.5, size: 9.5, font, color: C.muted })
  })
  officeLines.forEach((line, index) => {
    page.drawText(line, { x: 330, y: FOOTER_LINES_Y - index * 14.5, size: 9.5, font, color: C.muted })
  })

  return Buffer.from(await pdf.save())
}

/** Fleet rental invoice in the approved layout. */
export async function buildFleetInvoicePdf(input: {
  bookingId: string
  createdAt: string
  invoiceNumber: string
  vehicleName: string
  registrationNumber: string
  customerName: string
  accountNumber?: string | null
  startDate: string
  endDate: string
  days: number
  usageType: string
  amount: number
  depositAmount?: number | null
  notes?: string | null
}) {
  const registration = input.registrationNumber ? ` - ${input.registrationNumber}` : ''
  const reference = `${input.vehicleName} rental${registration}`
  const period = `Rental period: ${formatLongDate(input.startDate)} to ${formatLongDate(input.endDate)} (${input.days} day${input.days === 1 ? '' : 's'})`

  return buildVtcInvoicePdf({
    invoiceNumber: input.invoiceNumber,
    invoiceDate: input.createdAt,
    // The rental end date is when the balance falls due.
    dueDate: input.endDate,
    billToName: input.customerName || '—',
    billToSubtitle: input.accountNumber ? `Account ${input.accountNumber}` : null,
    reference,
    referenceNote: period,
    lineItems: [
      {
        description: `${input.vehicleName} rental - ${usageTypeLabel(input.usageType).toLowerCase()}`,
        amount: input.amount,
      },
    ],
    total: input.amount,
    depositAmount: input.depositAmount,
  })
}

/** Tour / internal booking invoice in the same layout. */
export async function buildTourInvoicePdf(input: {
  bookingId: string
  createdAt: string
  invoiceNumber: string
  invoiceStatus?: string
  title?: string
  customerName: string
  customerEmail?: string | null
  customerPhone?: string | null
  tourName: string
  tourDate: string
  guests: number
  reference?: string | null
  amount: number
  depositAmount?: number | null
  notes?: string | null
}) {
  return buildVtcInvoicePdf({
    invoiceNumber: input.invoiceNumber,
    invoiceDate: input.createdAt,
    dueDate: input.tourDate || input.createdAt,
    billToName: input.customerName || '—',
    billToSubtitle: input.customerEmail || null,
    reference: input.tourName,
    referenceNote: input.tourDate
      ? `Tour date: ${formatLongDate(input.tourDate)}${input.guests ? ` · ${input.guests} guest${input.guests === 1 ? '' : 's'}` : ''}`
      : null,
    lineItems: [{ description: input.tourName, amount: input.amount }],
    total: input.amount,
    depositAmount: input.depositAmount,
  })
}

export { formatMoney, formatLongDate, fullCustomerName, parseFleetBookingNotes }
