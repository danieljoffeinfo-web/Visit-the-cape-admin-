'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import { toast } from 'sonner'
import type { Enquiry, EnquiryReply } from '@/lib/enquiries'
import { enquiryStatusLabel, isUnreadEnquiry } from '@/lib/enquiries'
import { cardStyle, inputStyle, pageTitle, primaryButton, secondaryButton, theme } from '@/lib/theme'

type Filter = 'all' | 'new' | 'replied'

export function EnquiriesPanel() {
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [replies, setReplies] = useState<EnquiryReply[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filter, setFilter] = useState<Filter>('all')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [replyText, setReplyText] = useState('')

  const loadEnquiries = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/enquiries', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setEnquiries(data.enquiries || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load enquiries')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadEnquiries()
  }, [loadEnquiries])

  const filtered = useMemo(() => {
    if (filter === 'new') return enquiries.filter(isUnreadEnquiry)
    if (filter === 'replied') return enquiries.filter((e) => (e.status || '').toLowerCase() === 'replied')
    return enquiries
  }, [enquiries, filter])

  const selected = enquiries.find((e) => e.id === selectedId) || null

  async function selectEnquiry(enquiry: Enquiry) {
    setSelectedId(enquiry.id)
    setReplyText('')
    setReplies([])

    if (isUnreadEnquiry(enquiry)) {
      await fetch(`/api/enquiries/${enquiry.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'read' }),
      })
      setEnquiries((rows) => rows.map((row) => (row.id === enquiry.id ? { ...row, status: 'read' } : row)))
    }

    try {
      const res = await fetch(`/api/enquiries/${enquiry.id}`, { cache: 'no-store' })
      const data = await res.json()
      if (res.ok) setReplies(data.replies || [])
    } catch {
      // replies table may not exist yet
    }
  }

  async function sendReply() {
    if (!selected || !replyText.trim()) {
      toast.error('Write a reply first')
      return
    }
    setSending(true)
    try {
      const res = await fetch('/api/enquiries/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enquiryId: selected.id, message: replyText.trim() }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success(`Reply sent to ${selected.email}`)
      setReplyText('')
      setEnquiries((rows) =>
        rows.map((row) =>
          row.id === selected.id ? { ...row, status: 'replied', replied_at: new Date().toISOString() } : row,
        ),
      )
      loadEnquiries()
      const threadRes = await fetch(`/api/enquiries/${selected.id}`)
      const threadData = await threadRes.json()
      if (threadRes.ok) setReplies(threadData.replies || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send reply')
    } finally {
      setSending(false)
    }
  }

  const newCount = enquiries.filter(isUnreadEnquiry).length

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={pageTitle}>Enquiries</h1>
          <p style={{ margin: '6px 0 0', fontSize: 14, color: theme.textMuted }}>
            Messages from the website — reply directly from here.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {(['all', 'new', 'replied'] as Filter[]).map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              style={{
                ...secondaryButton,
                background: filter === f ? theme.bronzeBg : theme.surface,
                color: filter === f ? theme.bronzeDark : theme.textMuted,
                borderColor: filter === f ? theme.bronzeBorder : theme.border,
              }}
            >
              {f === 'all' ? 'All' : f === 'new' ? `New (${newCount})` : 'Replied'}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gap: 16 }} className="admin-grid-split">
        <div style={{ ...cardStyle, padding: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.border}`, fontSize: 12, color: theme.textMuted, fontWeight: 600 }}>
            Inbox · {filtered.length}
          </div>
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {loading ? (
              <div style={{ padding: 24, color: theme.textFaint, fontSize: 13 }}>Loading…</div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, color: theme.textFaint, fontSize: 13 }}>No enquiries yet</div>
            ) : (
              filtered.map((enquiry) => {
                const active = selectedId === enquiry.id
                const unread = isUnreadEnquiry(enquiry)
                return (
                  <button
                    key={enquiry.id}
                    type="button"
                    onClick={() => selectEnquiry(enquiry)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '14px 16px',
                      border: 'none',
                      borderBottom: `1px solid ${theme.border}`,
                      background: active ? theme.bronzeBg : unread ? theme.surfaceMuted : theme.surface,
                      cursor: 'pointer',
                      fontFamily: theme.bodyFont,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: unread ? 700 : 600, color: theme.text, fontSize: 14 }}>{enquiry.name}</span>
                      {unread && <span style={{ width: 8, height: 8, borderRadius: 999, background: theme.bronze, flexShrink: 0, marginTop: 5 }} />}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 4 }}>{enquiry.tour_type || 'General enquiry'}</div>
                    <div style={{ fontSize: 11, color: theme.textFaint }}>
                      {formatDistanceToNow(new Date(enquiry.created_at), { addSuffix: true })}
                    </div>
                  </button>
                )
              })
            )}
          </div>
        </div>

        <div style={{ ...cardStyle, display: 'flex', flexDirection: 'column', minHeight: 520 }}>
          {!selected ? (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textFaint, fontSize: 14 }}>
              Select an enquiry to read and reply
            </div>
          ) : (
            <>
              <div style={{ borderBottom: `1px solid ${theme.border}`, paddingBottom: 16, marginBottom: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 22, color: theme.text }}>{selected.name}</div>
                    <div style={{ fontSize: 13, color: theme.textMuted, marginTop: 4 }}>{selected.email}{selected.phone ? ` · ${selected.phone}` : ''}</div>
                  </div>
                  <span style={{ fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', padding: '4px 10px', borderRadius: 999, background: theme.bronzeBg, color: theme.bronzeDark, border: `1px solid ${theme.bronzeBorder}`, height: 'fit-content' }}>
                    {enquiryStatusLabel(selected.status)}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: theme.textMuted, flexWrap: 'wrap' }}>
                  {selected.tour_type && <span>Tour: {selected.tour_type}</span>}
                  {selected.date && <span>Date: {format(new Date(selected.date), 'd MMM yyyy')}</span>}
                  {selected.passengers != null && <span>{selected.passengers} guests</span>}
                  <span>Received {format(new Date(selected.created_at), 'd MMM yyyy, HH:mm')}</span>
                </div>
              </div>

              {selected.message && (
                <div style={{ marginBottom: 16, padding: 16, borderRadius: 8, background: theme.surfaceMuted, border: `1px solid ${theme.border}` }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textFaint, marginBottom: 8 }}>Their message</div>
                  <div style={{ fontSize: 14, color: theme.text, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{selected.message}</div>
                </div>
              )}

              {replies.length > 0 && (
                <div style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textFaint, marginBottom: 8 }}>Your replies</div>
                  <div style={{ display: 'grid', gap: 10 }}>
                    {replies.map((reply) => (
                      <div key={reply.id} style={{ padding: 12, borderRadius: 8, border: `1px solid ${theme.bronzeBorder}`, background: theme.bronzeBg }}>
                        <div style={{ fontSize: 12, color: theme.bronzeDark, marginBottom: 6 }}>
                          {reply.admin_name || 'Admin'} · {format(new Date(reply.created_at), 'd MMM yyyy, HH:mm')}
                        </div>
                        <div style={{ fontSize: 13, color: theme.text, whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{reply.body}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ marginTop: 'auto' }}>
                <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textFaint, marginBottom: 8 }}>
                  Reply by email
                </label>
                <textarea
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  rows={5}
                  placeholder={`Write your reply to ${selected.name}…`}
                  style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }}
                />
                <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                  <button type="button" onClick={sendReply} disabled={sending || !replyText.trim()} style={{ ...primaryButton, opacity: sending ? 0.7 : 1 }}>
                    {sending ? 'Sending…' : 'Send Reply'}
                  </button>
                  <span style={{ fontSize: 12, color: theme.textFaint }}>Sent from your Visit The Cape email via Resend</span>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
