'use client'

import { cardStyle, fieldLabel, inputStyle, primaryButton, secondaryButton, sectionTitle } from '@/lib/theme'

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
      <h3 style={{ ...sectionTitle, marginBottom: 16 }}>
        New Tour Booking
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
        {fields.map((f) => (
          <div key={f.key}>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>{f.label}</label>
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
        <button onClick={onSubmit} disabled={saving} style={primaryButton}>
          {saving ? 'Saving…' : 'Create Booking'}
        </button>
        <button onClick={onCancel} style={secondaryButton}>
          Cancel
        </button>
      </div>
    </div>
  )
}
