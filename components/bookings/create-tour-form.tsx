'use client'

import { cardStyle, inputStyle, muted } from '@/lib/bookings'

export type TourFormState = {
  customerName: string
  customerEmail: string
  customerPhone: string
  tourName: string
  tourDate: string
  guestsCount: string
  amount: string
  vehicleName: string
  notes: string
}

export const emptyTourForm: TourFormState = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  tourName: '',
  tourDate: '',
  guestsCount: '1',
  amount: '',
  vehicleName: '',
  notes: '',
}

export function CreateTourForm({
  form,
  setForm,
  saving,
  onSubmit,
  onCancel,
}: {
  form: TourFormState
  setForm: (form: TourFormState) => void
  saving: boolean
  onSubmit: () => void
  onCancel: () => void
}) {
  const fields = [
    { key: 'customerName', label: 'Customer Name *', type: 'text' },
    { key: 'customerEmail', label: 'Email *', type: 'email' },
    { key: 'customerPhone', label: 'Phone', type: 'tel' },
    { key: 'tourName', label: 'Tour Name *', type: 'text' },
    { key: 'tourDate', label: 'Tour Date *', type: 'date' },
    { key: 'guestsCount', label: 'Guests', type: 'number' },
    { key: 'amount', label: 'Amount (ZAR)', type: 'number' },
    { key: 'vehicleName', label: 'Vehicle', type: 'text' },
  ] as const

  return (
    <div style={{ ...cardStyle, marginBottom: 20 }}>
      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>
        New Tour Booking
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
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onSubmit} disabled={saving} style={{ padding: '8px 18px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13 }}>
          {saving ? 'Saving…' : 'Create Booking'}
        </button>
        <button onClick={onCancel} style={{ padding: '8px 18px', borderRadius: 5, background: 'transparent', color: muted, border: '1px solid rgba(240,236,228,0.12)', cursor: 'pointer', fontSize: 13 }}>
          Cancel
        </button>
      </div>
    </div>
  )
}
