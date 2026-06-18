'use client'

import type { UnifiedBooking } from '@/lib/bookings'
import { cardStyle, inputStyle, muted } from '@/lib/bookings'

export type EditBookingFormState = {
  customerName: string
  customerEmail: string
  customerPhone: string
  tourName: string
  tourDate: string
  guestsCount: string
  amount: string
  vehicleName: string
  notes: string
  status: string
  paymentStatus: string
}

export function bookingToEditForm(booking: UnifiedBooking): EditBookingFormState {
  return {
    customerName: booking.customer_name,
    customerEmail: booking.customer_email,
    customerPhone: '',
    tourName: booking.tour_or_vehicle,
    tourDate: booking.date ? booking.date.slice(0, 10) : '',
    guestsCount: String(booking.guests || 1),
    amount: booking.amount != null ? String(booking.amount) : '',
    vehicleName: '',
    notes: booking.message || '',
    status: booking.status || 'confirmed',
    paymentStatus: booking.payment_status || 'pending',
  }
}

export function EditBookingForm({
  booking,
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
}: {
  booking: UnifiedBooking
  form: EditBookingFormState
  setForm: (form: EditBookingFormState) => void
  saving: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  const fields = [
    { key: 'customerName', label: 'Customer Name *', type: 'text' },
    { key: 'customerEmail', label: 'Email *', type: 'email' },
    { key: 'tourName', label: 'Tour Name *', type: 'text' },
    { key: 'tourDate', label: 'Date *', type: 'date' },
    { key: 'guestsCount', label: 'Guests', type: 'number' },
    { key: 'amount', label: 'Amount (ZAR)', type: 'number' },
  ] as const

  return (
    <div style={{ ...cardStyle, marginBottom: 20, border: '1px solid rgba(184,149,106,0.25)' }}>
      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>
        Edit Booking — {booking.booking_reference || booking.customer_name}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={{ display: 'block', fontSize: 11, color: muted, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{f.label}</label>
            <input
              type={f.type}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              style={inputStyle}
            />
          </div>
        ))}
        <div>
          <label style={{ display: 'block', fontSize: 11, color: muted, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Status</label>
          <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} style={inputStyle}>
            <option value="confirmed">Confirmed</option>
            <option value="pending">Pending</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </div>
        <div>
          <label style={{ display: 'block', fontSize: 11, color: muted, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Payment</label>
          <select value={form.paymentStatus} onChange={(e) => setForm({ ...form, paymentStatus: e.target.value })} style={inputStyle}>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="refunded">Refunded</option>
          </select>
        </div>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, color: muted, marginBottom: 4, letterSpacing: '0.08em', textTransform: 'uppercase' }}>Notes</label>
        <textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} style={{ ...inputStyle, resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSubmit} disabled={saving} style={{ padding: '8px 18px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          {saving ? 'Saving…' : 'Save Changes'}
        </button>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 5, background: 'transparent', color: muted, border: '1px solid rgba(240,236,228,0.12)', cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
