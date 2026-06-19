'use client'

import {
  buildSeatsLabel,
  vehicleNotes,
  vehicleRegistration,
  vehicleSeats,
} from '@/lib/fleet'
import { VehicleImageHero } from '@/components/fleet/vehicle-image-hero'
import { fieldLabel, primaryButton, secondaryButton, theme } from '@/lib/theme'

export type FleetVehicleCardData = {
  id: string
  title: string
  summary?: string | null
  duration_label?: string | null
  pickup_notes?: string | null
  base_price?: number | null
  image_url?: string | null
}

type VehicleCardProps = {
  vehicle: FleetVehicleCardData
  bookingCount: number
  revenue: number
  onEdit: () => void
  onBook: () => void
}

function money(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function VehicleCard({ vehicle, bookingCount, revenue, onEdit, onBook }: VehicleCardProps) {
  const seats = vehicleSeats(vehicle)
  const notes = vehicleNotes(vehicle)

  return (
    <article
      style={{
        borderRadius: 10,
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        overflow: 'hidden',
        boxShadow: '0 1px 3px rgba(44, 38, 32, 0.04)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <VehicleImageHero imageUrl={vehicle.image_url} title={vehicle.title} height={168} />

      <div style={{ padding: '16px 16px 14px', display: 'flex', flexDirection: 'column', gap: 12, flex: 1 }}>
        <div>
          <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 20, color: theme.text, lineHeight: 1.1 }}>
            {vehicle.title}
          </div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
            {vehicleRegistration(vehicle) || 'No registration'} · {buildSeatsLabel(seats || 0)}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {[
            { label: 'Day rate', value: vehicle.base_price ? money(Number(vehicle.base_price)) : 'Not set' },
            { label: 'Bookings', value: String(bookingCount) },
            { label: 'Revenue', value: money(revenue) },
            { label: 'Seats', value: buildSeatsLabel(seats || 0) },
          ].map((item) => (
            <div
              key={item.label}
              style={{
                padding: '10px 12px',
                borderRadius: 8,
                background: theme.surfaceMuted,
                border: `1px solid ${theme.border}`,
              }}
            >
              <div style={{ ...fieldLabel, marginBottom: 4 }}>{item.label}</div>
              <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{item.value}</div>
            </div>
          ))}
        </div>

        {notes && (
          <p style={{ fontSize: 12, color: theme.textMuted, margin: 0, lineHeight: 1.45 }}>{notes}</p>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto' }}>
          <button type="button" onClick={onBook} style={primaryButton}>
            Book out
          </button>
          <button type="button" onClick={onEdit} style={secondaryButton}>
            Edit
          </button>
        </div>
      </div>
    </article>
  )
}
