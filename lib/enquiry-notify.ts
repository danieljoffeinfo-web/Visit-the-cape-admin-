import { Resend } from 'resend'
import { COMPANY, ENQUIRY_NOTIFY_EMAILS } from '@/lib/company'

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export type EnquiryNotification = {
  name: string
  email: string
  phone?: string | null
  experience?: string | null
  message?: string | null
}

/**
 * Tell the office an enquiry has arrived.
 *
 * Enquiries were written to the database and nowhere else, so the only way to
 * find out about one was to remember to go and look — which is a poor way to
 * hit a 24-hour reply promise made on the form itself.
 *
 * Never throws. The enquiry is already saved by the time this runs, and a
 * customer who filled in a form correctly must not be shown a failure because
 * an email did not go out. A failure is logged and the row is still there.
 *
 * Reply-to is the enquirer, so answering the notification answers the
 * customer rather than starting a new message.
 */
export async function notifyNewEnquiry(
  enquiry: EnquiryNotification,
): Promise<{ sent: boolean; reason?: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) return { sent: false, reason: 'RESEND_API_KEY is not configured' }
  if (ENQUIRY_NOTIFY_EMAILS.length === 0) return { sent: false, reason: 'No notify address configured' }

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'invoices@visitthecape.co.za'

  const rows: Array<[string, string]> = [
    ['Name', enquiry.name],
    ['Email', enquiry.email],
    ['Phone', enquiry.phone || '—'],
    ['Experience', enquiry.experience || '—'],
    ['Message', enquiry.message || '—'],
  ]

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;color:#2c2620;max-width:560px">
      <h2 style="font-size:18px;margin:0 0 4px">New website enquiry</h2>
      <p style="font-size:13px;color:#6b635a;margin:0 0 18px">
        From the enquiry form on ${escapeHtml(COMPANY.website || 'visitthecape.co.za')}
      </p>
      <table style="border-collapse:collapse;width:100%;font-size:14px">
        ${rows
          .map(
            ([label, value]) => `
          <tr>
            <td style="padding:8px 12px 8px 0;color:#6b635a;vertical-align:top;white-space:nowrap">${escapeHtml(label)}</td>
            <td style="padding:8px 0;border-bottom:1px solid #eee">${escapeHtml(value).replace(/\n/g, '<br>')}</td>
          </tr>`,
          )
          .join('')}
      </table>
      <p style="font-size:13px;color:#6b635a;margin:18px 0 0">
        Reply to this email to answer ${escapeHtml(enquiry.name)} directly.
      </p>
    </div>
  `

  const text = rows.map(([label, value]) => `${label}: ${value}`).join('\n')

  try {
    const resend = new Resend(apiKey)
    const { error } = await resend.emails.send({
      from: fromEmail,
      to: ENQUIRY_NOTIFY_EMAILS,
      replyTo: enquiry.email,
      subject: `New enquiry — ${enquiry.name}${enquiry.experience ? ` · ${enquiry.experience}` : ''}`,
      html,
      text,
    })
    if (error) throw error
    return { sent: true }
  } catch (error) {
    console.error('Enquiry notification error:', error)
    return { sent: false, reason: error instanceof Error ? error.message : 'unknown' }
  }
}
