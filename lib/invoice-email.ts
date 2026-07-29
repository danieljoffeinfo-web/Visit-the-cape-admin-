import { Resend } from 'resend'
import { COMPANY } from '@/lib/company'
import { formatMoney } from '@/lib/invoice-pdf'
import type { AdminUser } from '@/lib/auth-types'

/**
 * Emails a copy of a generated invoice to the admin who created the booking.
 *
 * Never throws: a mail failure must not roll back a saved booking. Returns a
 * result the caller can surface in the UI instead.
 */
export async function emailInvoiceToCreator(input: {
  admin: AdminUser
  pdf: Buffer
  invoiceNumber: string
  subjectLine: string
  summaryLines: string[]
  total: number
  depositAmount?: number | null
}): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return { sent: false, reason: 'RESEND_API_KEY is not configured' }
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'Visit The Cape <onboarding@resend.dev>'
  const deposit = Number(input.depositAmount) || 0

  const rows = input.summaryLines
    .map((line) => `<tr><td style="padding:4px 0;color:#5c534a;font-size:13px;">${escapeHtml(line)}</td></tr>`)
    .join('')

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#2c2620;line-height:1.6;max-width:560px;">
      <p style="font-size:15px;margin:0 0 16px;">Hi ${escapeHtml(input.admin.full_name.split(' ')[0] || 'there')},</p>
      <p style="font-size:14px;margin:0 0 16px;">
        Invoice <strong>${escapeHtml(input.invoiceNumber)}</strong> has been generated and is attached to this email.
      </p>
      <table style="width:100%;border-collapse:collapse;margin:0 0 16px;">${rows}</table>
      <table style="width:100%;border-collapse:collapse;border-top:1px solid #e8e2d8;margin-top:12px;">
        <tr>
          <td style="padding:10px 0;font-size:14px;"><strong>Total (VAT inclusive)</strong></td>
          <td style="padding:10px 0;font-size:14px;text-align:right;"><strong>${formatMoney(input.total)}</strong></td>
        </tr>
        ${deposit > 0 ? `<tr>
          <td style="padding:4px 0;font-size:14px;color:#b56e2d;">Upfront payment</td>
          <td style="padding:4px 0;font-size:14px;text-align:right;color:#b56e2d;">${formatMoney(deposit)}</td>
        </tr>
        <tr>
          <td style="padding:4px 0;font-size:14px;"><strong>Balance</strong></td>
          <td style="padding:4px 0;font-size:14px;text-align:right;"><strong>${formatMoney(Math.max(0, input.total - deposit))}</strong></td>
        </tr>` : ''}
      </table>
      <p style="font-size:12px;color:#8a8078;margin-top:24px;">
        This invoice has not been sent to Xero. ${escapeHtml(COMPANY.tradingName)} admin console.
      </p>
    </div>
  `

  const text = [
    `Invoice ${input.invoiceNumber} has been generated and is attached.`,
    '',
    ...input.summaryLines,
    '',
    `Total (VAT inclusive): ${formatMoney(input.total)}`,
    ...(deposit > 0
      ? [`Upfront payment: ${formatMoney(deposit)}`, `Balance: ${formatMoney(Math.max(0, input.total - deposit))}`]
      : []),
    '',
    'This invoice has not been sent to Xero.',
  ].join('\n')

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: [input.admin.email],
      subject: input.subjectLine,
      html,
      text,
      attachments: [
        {
          filename: `${input.invoiceNumber}.pdf`,
          content: input.pdf.toString('base64'),
        },
      ],
    })

    if (error) {
      console.error('Invoice email error:', error)
      return { sent: false, reason: error.message || 'Email provider rejected the message' }
    }

    return { sent: true }
  } catch (err) {
    console.error('Invoice email threw:', err)
    return { sent: false, reason: err instanceof Error ? err.message : 'Unknown email error' }
  }
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
