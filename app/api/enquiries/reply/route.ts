import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { logActivityServer } from '@/lib/activity-log-server'
import { getApprovedAdminUser } from '@/lib/auth-server'
import { fetchEnquiriesFromSource, recordEnquiryReply, updateEnquiryStatus } from '@/lib/enquiries-server'

export async function POST(request: NextRequest) {
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const apiKey = process.env.RESEND_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'Email sending is not configured (RESEND_API_KEY)' }, { status: 503 })
  }

  const fromEmail = process.env.RESEND_FROM_EMAIL?.trim() || 'Visit The Cape <onboarding@resend.dev>'
  const replyTo = process.env.ADMIN_REPLY_EMAIL?.trim() || admin.email

  const body = await request.json()
  const enquiryId = String(body?.enquiryId || '').trim()
  const message = String(body?.message || '').trim()
  const subjectOverride = body?.subject ? String(body.subject).trim() : ''

  if (!enquiryId || !message) {
    return NextResponse.json({ error: 'Enquiry id and message are required' }, { status: 400 })
  }

  try {
    const enquiries = await fetchEnquiriesFromSource()
    const enquiry = enquiries.find((row) => row.id === enquiryId)
    if (!enquiry) {
      return NextResponse.json({ error: 'Enquiry not found' }, { status: 404 })
    }

    const subject = subjectOverride || `Re: Your enquiry — ${enquiry.tour_type || 'Visit The Cape'}`
    const html = `
      <div style="font-family: Georgia, serif; color: #2c2620; line-height: 1.6; max-width: 560px;">
        <p style="white-space: pre-wrap;">${escapeHtml(message)}</p>
        <hr style="border: none; border-top: 1px solid #e8e2d8; margin: 24px 0;" />
        <p style="font-size: 13px; color: #8a8078;">— ${escapeHtml(admin.full_name)}<br/>Visit The Cape</p>
        ${enquiry.message ? `<blockquote style="margin: 20px 0 0; padding: 12px 16px; background: #f7f4ef; border-left: 3px solid #b8956a; font-size: 13px; color: #5c534a;"><strong>Your message:</strong><br/>${escapeHtml(enquiry.message)}</blockquote>` : ''}
      </div>
    `

    const resend = new Resend(apiKey)
    const { data, error } = await resend.emails.send({
      from: fromEmail,
      to: [enquiry.email],
      replyTo,
      subject,
      html,
      text: `${message}\n\n— ${admin.full_name}\nVisit The Cape`,
    })

    if (error) {
      console.error('Resend error:', error)
      return NextResponse.json({ error: error.message || 'Failed to send email' }, { status: 502 })
    }

    await recordEnquiryReply({
      enquiryId,
      adminName: admin.full_name,
      adminEmail: admin.email,
      toEmail: enquiry.email,
      subject,
      body: message,
      resendId: data?.id || null,
    })

    await updateEnquiryStatus(enquiryId, 'replied', { replied_at: new Date().toISOString() })

    await logActivityServer({
      admin,
      action: 'Replied to enquiry',
      entityType: 'enquiry',
      entityId: enquiryId,
      entityLabel: `${enquiry.name} — ${enquiry.email}`,
      newValue: { subject, to: enquiry.email },
    })

    return NextResponse.json({ ok: true, emailId: data?.id })
  } catch (error) {
    console.error('Enquiry reply error:', error)
    return NextResponse.json({ error: 'Failed to send reply' }, { status: 500 })
  }
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
