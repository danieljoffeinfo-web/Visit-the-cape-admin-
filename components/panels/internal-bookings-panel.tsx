'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { TourBookingRow } from '@/lib/auth-types'
import { StatusBadge, UserColorBadge } from '@/components/user-badge'

const card = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }
const muted = 'rgba(240,236,228,0.45)'

const emptyForm = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  tourName: '',
  tourDate: '',
  guestsCount: '1',
  amount: '',
  notes: '',
}

export function InternalBookingsPanel() {
  const [bookings, setBookings] = useState<TourBookingRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadBookings() }, [])

  async function loadBookings() {
    setLoading(true)
    try {
      const res = await fetch('/api/internal-bookings', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setBookings(data.bookings || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load internal bookings')
    } finally {
      setLoading(false)
    }
  }

  async function createBooking() {
    if (!form.customerName || !form.customerEmail || !form.tourName || !form.tourDate) {
      toast.error('Fill all required fields')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/internal-bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      toast.success('Internal booking created')
      setShowForm(false)
      setForm(emptyForm)
      loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setSaving(false)
    }
  }

  async function cancelBooking(id: string) {
    if (!confirm('Cancel this booking?')) return
    try {
      const res = await fetch('/api/internal-bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: 'cancelled' }),
      })
      if (!res.ok) throw new Error('Failed to cancel')
      toast.success('Booking cancelled')
      loadBookings()
    } catch {
      toast.error('Failed to cancel booking')
    }
  }

  const inputStyle = {
    width: '100%',
    padding: '8px 12px',
    borderRadius: 5,
    border: '1px solid rgba(240,236,228,0.12)',
    background: 'rgba(240,236,228,0.04)',
    color: '#f0ece4',
    fontSize: 13,
    fontFamily: "'Barlow', sans-serif",
    boxSizing: 'border-box' as const,
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Internal Bookings
        </h1>
        <button
          onClick={() => setShowForm(true)}
          style={{ padding: '8px 18px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}
        >
          + New Internal Booking
        </button>
      </div>

      {showForm && (
        <div style={{ ...card, marginBottom: 20 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>
            Create Internal Booking
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
            {[
              { key: 'customerName', label: 'Customer Name *', type: 'text' },
              { key: 'customerEmail', label: 'Email *', type: 'email' },
              { key: 'customerPhone', label: 'Phone', type: 'tel' },
              { key: 'tourName', label: 'Tour Name *', type: 'text' },
              { key: 'tourDate', label: 'Date *', type: 'date' },
              { key: 'guestsCount', label: 'Guests', type: 'number' },
              { key: 'amount', label: 'Amount (ZAR)', type: 'number' },
            ].map((f) => (
              <div key={f.key}>
                <label style={{ display: 'block', fontSize: 11, color: muted, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 11, color: muted, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Notes</label>
            <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={createBooking} disabled={saving} style={{ padding: '8px 18px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
              {saving ? 'Saving…' : 'Create Booking'}
            </button>
            <button onClick={() => { setShowForm(false); setForm(emptyForm) }} style={{ padding: '8px 18px', borderRadius: 5, background: 'transparent', color: muted, border: '1px solid rgba(240,236,228,0.12)', cursor: 'pointer', fontSize: 13 }}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={card}>
        {loading ? (
          <div style={{ color: muted, padding: 12 }}>Loading internal bookings...</div>
        ) : bookings.length === 0 ? (
          <div style={{ color: muted, padding: 24, textAlign: 'center' }}>No internal bookings yet</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 720 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                  {['Reference', 'Customer', 'Tour', 'Date', 'Guests', 'Created By', 'Status', 'Payment', ''].map((h) => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {bookings.map((b) => (
                  <tr key={b.id} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 12, color: '#b8956a', fontWeight: 600 }}>{b.booking_reference || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{b.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: muted }}>{b.tour_name || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: muted }}>{b.tour_date ? format(new Date(b.tour_date), 'd MMM yyyy') : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{b.passengers || '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      {b.created_by_name ? (
                        <UserColorBadge name={b.created_by_name} color={b.created_by_color} />
                      ) : '—'}
                    </td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={b.status} /></td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={b.payment_status} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      {b.status !== 'cancelled' && (
                        <button onClick={() => cancelBooking(b.id)} style={{ fontSize: 11, color: '#ef5350', background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>
                          Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
