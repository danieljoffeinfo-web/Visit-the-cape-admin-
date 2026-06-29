import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { fullCustomerName, parseFleetBookingNotes, usageTypeLabel } from '@/lib/fleet'

function formatMoney(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type PdfPalette = {
  bg: ReturnType<typeof rgb>
  gold: ReturnType<typeof rgb>
  text: ReturnType<typeof rgb>
  muted: ReturnType<typeof rgb>
  line: ReturnType<typeof rgb>
}

const palette: PdfPalette = {
  bg: rgb(0.97, 0.96, 0.94),
  gold: rgb(0.72, 0.58, 0.42),
  text: rgb(0.17, 0.15, 0.13),
  muted: rgb(0.45, 0.42, 0.38),
  line: rgb(0.88, 0.85, 0.80),
}

async function createInvoicePage(title: string, meta: { invoiceNumber: string; invoiceStatus: string; createdAt: string }) {
  const pdf = await PDFDocument.create()
  const page = pdf.addPage([595.28, 841.89])
  const { height, width } = page.getSize()
  const font = await pdf.embedFont(StandardFonts.Helvetica)
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold)

  page.drawRectangle({ x: 0, y: 0, width, height, color: palette.bg })
  page.drawText('VISIT THE CAPE', { x: 40, y: height - 52, size: 22, font: bold, color: palette.gold })
  page.drawText(title, { x: 40, y: height - 78, size: 14, font: bold, color: palette.text })

  page.drawText(`Invoice ${meta.invoiceNumber}`, { x: 360, y: height - 52, size: 12, font: bold, color: palette.text })
  page.drawText(`Status: ${meta.invoiceStatus}`, { x: 360, y: height - 70, size: 10, font, color: palette.muted })
  page.drawText(`Date: ${meta.createdAt}`, { x: 360, y: height - 86, size: 10, font, color: palette.muted })

  return { pdf, page, font, bold, height }
}

export async function buildFleetInvoicePdf(input: {
  bookingId: string
  createdAt: string
  invoiceNumber: string
  invoiceStatus: string
  vehicleName: string
  registrationNumber: string
  customerName: string
  accountNumber: string
  phone: string
  email: string
  startDate: string
  endDate: string
  days: number
  seatsBooked: number
  usageType: string
  amount: number
  notes: string
}) {
  const { pdf, page, font, bold, height } = await createInvoicePage('Fleet booking invoice', {
    invoiceNumber: input.invoiceNumber,
    invoiceStatus: input.invoiceStatus,
    createdAt: input.createdAt,
  })

  let y = height - 130
  const section = (title: string) => {
    page.drawText(title.toUpperCase(), { x: 40, y, size: 10, font: bold, color: palette.gold })
    y -= 18
  }
  const line = (label: string, value: string) => {
    page.drawText(label, { x: 40, y, size: 10, font: bold, color: palette.muted })
    page.drawText(value || '—', { x: 170, y, size: 11, font, color: palette.text })
    y -= 16
  }

  section('Customer')
  line('Name', input.customerName)
  line('Account number', input.accountNumber)
  line('Phone', input.phone)
  line('Email', input.email)
  y -= 6

  section('Vehicle')
  line('Vehicle', input.vehicleName)
  line('Registration', input.registrationNumber)
  line('Usage type', usageTypeLabel(input.usageType))
  line('Seats booked', String(input.seatsBooked))
  y -= 6

  section('Rental')
  line('Start date', input.startDate)
  line('End date', input.endDate)
  line('Days', String(input.days))
  y -= 6

  section('Notes')
  page.drawText((input.notes || 'No notes supplied').slice(0, 240), {
    x: 40,
    y,
    size: 11,
    font,
    color: palette.text,
    maxWidth: 500,
    lineHeight: 14,
  })
  y -= 40

  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: palette.line })
  y -= 28
  page.drawText('Total due', { x: 360, y, size: 12, font: bold, color: palette.text })
  page.drawText(formatMoney(input.amount), { x: 455, y, size: 16, font: bold, color: palette.gold })
  page.drawText(`Booking ID: ${input.bookingId}`, { x: 40, y: 30, size: 9, font, color: palette.muted })

  return Buffer.from(await pdf.save())
}

export async function buildTourInvoicePdf(input: {
  bookingId: string
  createdAt: string
  invoiceNumber: string
  invoiceStatus: string
  title: string
  customerName: string
  customerEmail: string
  customerPhone?: string | null
  tourName: string
  tourDate: string
  guests: number
  reference?: string | null
  amount: number
  notes?: string | null
}) {
  const { pdf, page, font, bold, height } = await createInvoicePage(input.title, {
    invoiceNumber: input.invoiceNumber,
    invoiceStatus: input.invoiceStatus,
    createdAt: input.createdAt,
  })

  let y = height - 130
  const section = (label: string) => {
    page.drawText(label.toUpperCase(), { x: 40, y, size: 10, font: bold, color: palette.gold })
    y -= 18
  }
  const line = (label: string, value: string) => {
    page.drawText(label, { x: 40, y, size: 10, font: bold, color: palette.muted })
    page.drawText(value || '—', { x: 170, y, size: 11, font, color: palette.text })
    y -= 16
  }

  section('Customer')
  line('Name', input.customerName)
  line('Email', input.customerEmail)
  line('Phone', input.customerPhone || '—')
  if (input.reference) line('Reference', input.reference)
  y -= 6

  section('Booking')
  line('Tour / service', input.tourName)
  line('Date', input.tourDate || '—')
  line('Guests', String(input.guests || 0))
  if (input.notes) {
    y -= 6
    section('Notes')
    page.drawText(input.notes.slice(0, 240), { x: 40, y, size: 11, font, color: palette.text, maxWidth: 500, lineHeight: 14 })
    y -= 36
  }

  page.drawLine({ start: { x: 40, y }, end: { x: 555, y }, thickness: 1, color: palette.line })
  y -= 28
  page.drawText('Total due', { x: 360, y, size: 12, font: bold, color: palette.text })
  page.drawText(formatMoney(input.amount), { x: 455, y, size: 16, font: bold, color: palette.gold })
  page.drawText(`Booking ID: ${input.bookingId}`, { x: 40, y: 30, size: 9, font, color: palette.muted })

  return Buffer.from(await pdf.save())
}

export { formatMoney, fullCustomerName, parseFleetBookingNotes }
