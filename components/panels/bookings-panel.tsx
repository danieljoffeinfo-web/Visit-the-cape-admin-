'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'

type Booking = {
  id: string
  name: string
  email: string
  phone?: string
  passengers?: number
  created_at: string
  tour_name?: string
  tour_date?: string
  amount?: number
}

type InvoiceLink = {
  booking_id: string
  xero_invoice_id: string
  xero_invoice_number?: string
  status: string
}

type Enquiry = {
  id: string
  name: string
  email: string
  tour_type?: string
  message?: string
  created_at: string
  amount?: number
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PAID: { bg: 'rgba(76,175,132,0.2)', color: '#4caf84' },
  AUTHORISED: { bg: 'rgba(100,149,237,0.2)', color: '#6495ed' },
  OVERDUE: { bg: 'rgba(239,83,80,0.2)', color: '#ef5350' },
  DRAFT: { bg: 'rgba(240,236,228,0.1)', color: 'rgba(240,236,228,0.55)' },
}

export function BookingsPanel() {
  const [bookings, setBookings] = useState<Booking[]>([])
  const [enquiries, setEnquiries] = useState<Enquiry[]>([])
  const [invoiceLinks, setInvoiceLinks] = useState<Record<string, InvoiceLink>>({})
  const [xeroConnected, setXeroConnected] = useState(false)
  const [activeTab, setActiveTab] = useState<'tagalong' | 'private'>('tagalong')
  const [loading, setLoading] = useState(true)
  const [raising, setRaising] = useState<string | null>(null)

  useEffect(() => {
    loadAll()
  }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [bookRes, enqRes, xeroRes] = await Promise.all([
        supabase.from('tag_along_bookings').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('enquiries').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('xero_tokens').select('tenant_id').limit(1).single(),
      ])

      setBookings((bookRes.data || []) as Booking[])
      setEnquiries((enqRes.data || []) as Enquiry[])
      setXeroConnected(!xeroRes.error && !!xeroRes.data)

      if (!xeroRes.error) {
        // Load invoice links for all bookings
        const ids = (bookRes.data || []).map((b: Booking) => b.id)
        if (ids.length > 0) {
          const { data: links } = await supabase.from('xero_invoice_links').select('*').in('booking_id', ids)
          const linkMap: Record<string, InvoiceLink> = {}
          for (const l of (links || [])) {
            linkMap[l.booking_id] = l
          }
          setInvoiceLinks(linkMap)
        }
      }
    } catch {
      toast.error('Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }

  async function raiseInvoice(booking: Booking | Enquiry, type: 'tagalong' | 'private') {
    setRaising(booking.id)
    try {
      const res = await fetch('/api/xero/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: booking.name,
          contactEmail: booking.email,
          description: type === 'tagalong'
            ? `Tag-Along Tour${(booking as Booking).tour_name ? ' — ' + (booking as Booking).tour_name : ''}${(booking as Booking).tour_date ? ' (' + format(new Date((booking as Booking).tour_date!), 'd MMM yyyy') + ')' : ''}`
            : `Private Enquiry — ${(booking as Enquiry).tour_type || 'Custom Tour'}`,
          amount: booking.amount || 0,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          bookingId: booking.id,
          bookingType: type,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Invoice raised in Xero')
      loadAll()
    } catch {
      toast.error('Failed to raise invoice')
    } finally {
      setRaising(null)
    }
  }

  const cardStyle = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Bookings</h1>
        {!xeroConnected && (
          <a href="/api/xero/connect" style={{ fontSize: 12, color: '#b8956a', textDecoration: 'none', border: '1px solid rgba(184,149,106,0.3)', padding: '5px 12px', borderRadius: 4 }}>
            Connect Xero for Invoicing
          </a>
        )}
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(240,236,228,0.04)', borderRadius: 8, padding: 4 }}>
        {[{ id: 'tagalong', l: 'Tag-Along Bookings' }, { id: 'private', l: 'Private Enquiries' }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id as 'tagalong' | 'private')} style={{
            flex: 1, padding: '9px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: activeTab === t.id ? '#1a1815' : 'transparent',
            color: activeTab === t.id ? '#b8956a' : 'rgba(240,236,228,0.55)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: activeTab === t.id ? 800 : 400,
            fontSize: 15, letterSpacing: '0.04em', textTransform: 'uppercase' as const,
          }}>
            {t.l}
          </button>
        ))}
      </div>

      {/* Tag-Along Bookings */}
      {activeTab === 'tagalong' && (
        <div style={cardStyle}>
          {loading ? <div style={{ color: 'rgba(240,236,228,0.4)', padding: 12 }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                  {['Name', 'Email', 'Passengers', 'Tour', 'Date', 'Invoice'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,236,228,0.4)' }}>No bookings yet</td></tr>}
                {bookings.map(b => {
                  const link = invoiceLinks[b.id]
                  const sc = link ? (STATUS_COLORS[link.status] || STATUS_COLORS.DRAFT) : null
                  return (
                    <tr key={b.id} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{b.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{b.email}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{b.passengers || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{b.tour_name || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{b.tour_date ? format(new Date(b.tour_date), 'd MMM yyyy') : '—'}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {link && sc ? (
                          <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', ...sc }}>
                            {link.status}
                          </span>
                        ) : xeroConnected ? (
                          <button
                            disabled={raising === b.id}
                            onClick={() => raiseInvoice(b, 'tagalong')}
                            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, border: '1px solid rgba(184,149,106,0.3)', background: 'transparent', color: '#b8956a', cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>
                            {raising === b.id ? '...' : 'Raise Invoice'}
                          </button>
                        ) : <span style={{ color: 'rgba(240,236,228,0.3)', fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Private Enquiries */}
      {activeTab === 'private' && (
        <div style={cardStyle}>
          {loading ? <div style={{ color: 'rgba(240,236,228,0.4)', padding: 12 }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                  {['Name', 'Email', 'Tour Type', 'Message', 'Received', 'Invoice'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {enquiries.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,236,228,0.4)' }}>No enquiries yet</td></tr>}
                {enquiries.map(e => {
                  const link = invoiceLinks[e.id]
                  const sc = link ? (STATUS_COLORS[link.status] || STATUS_COLORS.DRAFT) : null
                  return (
                    <tr key={e.id} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{e.name}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{e.email}</td>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>{e.tour_type || '—'}</td>
                      <td style={{ padding: '10px 12px', fontSize: 12, color: 'rgba(240,236,228,0.55)', maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.message || '—'}</div>
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{format(new Date(e.created_at), 'd MMM')}</td>
                      <td style={{ padding: '10px 12px' }}>
                        {link && sc ? (
                          <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', ...sc }}>
                            {link.status}
                          </span>
                        ) : xeroConnected ? (
                          <button
                            disabled={raising === e.id}
                            onClick={() => raiseInvoice(e, 'private')}
                            style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, border: '1px solid rgba(184,149,106,0.3)', background: 'transparent', color: '#b8956a', cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>
                            {raising === e.id ? '...' : 'Raise Invoice'}
                          </button>
                        ) : <span style={{ color: 'rgba(240,236,228,0.3)', fontSize: 12 }}>—</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}
