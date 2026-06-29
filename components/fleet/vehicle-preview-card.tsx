'use client'

import { buildSeatsLabel, vehicleRegistration, vehicleSeats } from '@/lib/fleet'
import type { FleetVehicleCardData } from '@/components/fleet/vehicle-card'
import { fieldLabel, theme } from '@/lib/theme'
import { fleetVehicleImageSrc } from '@/lib/fleet-image'

type VehiclePreviewCardProps = {
  vehicle: FleetVehicleCardData
  compact?: boolean
}

function money(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function VehiclePreviewCard({ vehicle, compact }: VehiclePreviewCardProps) {
  const seats = vehicleSeats(vehicle)
  const registration = vehicleRegistration(vehicle) || 'No registration'
  const dayRate = vehicle.base_price ? `${money(Number(vehicle.base_price))}/day` : 'No day rate'

  if (compact) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '10px 12px',
          borderRadius: 8,
          border: `1px solid ${theme.border}`,
          background: theme.surfaceMuted,
        }}
      >
        <VehiclePreviewImage imageUrl={vehicle.image_url} title={vehicle.title} height={52} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 13, color: theme.text }}>{vehicle.title}</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
            {registration} · {buildSeatsLabel(seats || 0)}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        borderRadius: 10,
        overflow: 'hidden',
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        boxShadow: '0 1px 3px rgba(44, 38, 32, 0.04)',
      }}
    >
      <VehiclePreviewImage imageUrl={vehicle.image_url} title={vehicle.title} height={168} />
      <div style={{ padding: '12px 14px', borderTop: `1px solid ${theme.border}`, background: theme.surfaceMuted }}>
        <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 17, color: theme.text, lineHeight: 1.15 }}>
          {vehicle.title}
        </div>
        <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
          {registration} · {buildSeatsLabel(seats || 0)} · {dayRate}
        </div>
      </div>
    </div>
  )
}

function VehiclePreviewImage({
  imageUrl,
  title,
  height,
}: {
  imageUrl?: string | null
  title: string
  height: number
}) {
  const resolvedImageUrl = fleetVehicleImageSrc(imageUrl)

  return (
    <div
      style={{
        width: '100%',
        height,
        background: `linear-gradient(160deg, ${theme.surfaceMuted} 0%, ${theme.surface} 55%, ${theme.surfaceMuted} 100%)`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: resolvedImageUrl ? 10 : 16,
      }}
    >
      {resolvedImageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedImageUrl}
          alt={title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            objectPosition: 'center',
            display: 'block',
          }}
        />
      ) : (
        <div style={{ textAlign: 'center', color: theme.textFaint }}>
          <div style={{ fontSize: 32, lineHeight: 1, opacity: 0.45, marginBottom: 6 }}>🚐</div>
          <div style={{ ...fieldLabel, color: theme.textFaint }}>No photo</div>
        </div>
      )}
    </div>
  )
}
