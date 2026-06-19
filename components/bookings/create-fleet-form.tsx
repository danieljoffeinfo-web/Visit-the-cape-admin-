'use client'

import { useEffect, useState } from 'react'
import { addDays, format } from 'date-fns'
import { toast } from 'sonner'
import { isFleetVehicle, vehicleRegistration, vehicleSeats } from '@/lib/fleet'
import { VehicleImageThumb } from '@/components/fleet/vehicle-image-upload'
import { cardStyle, fieldLabel, inputStyle, primaryButton, secondaryButton, sectionTitle, theme } from '@/lib/theme'

type VehicleRow = {
  id: string
  title: string
  family: string
  summary?: string | null
  duration_label?: string | null
  base_price?: number | null
  image_url?: string | null
}

export function CreateFleetForm({ saving, onSaved, onCancel }: { saving?: boolean; onSaved: () => void; onCancel: () => void }) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({
    vehicleId: '',
    usageType: 'tour',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    amount: '',
    seatsBooked: '1',
    firstName: '',
    surname: '',
    email: '',
    phone: '',
    notes: '',
  })

  useEffect(() => {
    fetch('/api/fleet/vehicles', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        const list = ((data.vehicles || []) as VehicleRow[]).filter(isFleetVehicle)
        setVehicles(list)
        if (list[0]) {
          setForm((current) => ({
            ...current,
            vehicleId: list[0].id,
            seatsBooked: String(vehicleSeats(list[0]) || 1),
          }))
        }
      })
      .catch(() => toast.error('Failed to load fleet vehicles'))
  }, [])

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === form.vehicleId) || null

  async function submit() {
    if (!form.vehicleId || !form.firstName || !form.surname || !form.email || !form.amount) {
      toast.error('Complete vehicle, customer, and amount fields')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/fleet/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          amount: Number(form.amount),
          seatsBooked: Number(form.seatsBooked) || 1,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create fleet booking')
      toast.success('Fleet booking created')
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create fleet booking')
    } finally {
      setSubmitting(false)
    }
  }

  const busy = submitting || saving

  return (
    <div style={{ ...cardStyle, marginBottom: 20 }}>
      <h3 style={{ ...sectionTitle, marginBottom: 16 }}>
        New Fleet Booking
      </h3>
      {vehicles.length === 0 ? (
        <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 12 }}>No fleet vehicles yet. Add vehicles in Fleet Manager first.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
          <div>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Vehicle *</label>
            <select value={form.vehicleId} onChange={(e) => setForm({ ...form, vehicleId: e.target.value })} style={inputStyle}>
              {vehicles.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.title} {vehicleRegistration(v) ? `(${vehicleRegistration(v)})` : ''}
                </option>
              ))}
            </select>
            {selectedVehicle && (
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginTop: 10 }}>
                <VehicleImageThumb imageUrl={selectedVehicle.image_url} title={selectedVehicle.title} size={52} />
                <span style={{ color: theme.textMuted, fontSize: 12 }}>
                  {selectedVehicle.image_url ? 'Vehicle photo on file' : 'No photo uploaded for this vehicle yet'}
                </span>
              </div>
            )}
          </div>
          <div>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Start date *</label>
            <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>End date *</label>
            <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Amount (ZAR) *</label>
            <input type="number" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>First name *</label>
            <input value={form.firstName} onChange={(e) => setForm({ ...form, firstName: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Surname *</label>
            <input value={form.surname} onChange={(e) => setForm({ ...form, surname: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Email *</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} style={inputStyle} />
          </div>
          <div>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Phone</label>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} style={inputStyle} />
          </div>
        </div>
      )}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={submit} disabled={busy || vehicles.length === 0} style={primaryButton}>
          {busy ? 'Saving…' : 'Create Fleet Booking'}
        </button>
        <button onClick={onCancel} style={secondaryButton}>
          Cancel
        </button>
      </div>
    </div>
  )
}
