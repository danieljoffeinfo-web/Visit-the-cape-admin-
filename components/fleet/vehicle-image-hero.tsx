'use client'

import { fieldLabel, secondaryButton, theme } from '@/lib/theme'

type VehicleImageHeroProps = {
  imageUrl?: string | null
  title: string
  height?: number
  editable?: boolean
  uploading?: boolean
  onChoosePhoto?: () => void
}

export function VehicleImageHero({
  imageUrl,
  title,
  height = 160,
  editable,
  uploading,
  onChoosePhoto,
}: VehicleImageHeroProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: 8,
        overflow: 'hidden',
        border: `1px solid ${theme.border}`,
        background: `linear-gradient(145deg, ${theme.surfaceMuted} 0%, ${theme.surface} 100%)`,
      }}
    >
      {imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt={title}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            display: 'block',
            background: theme.surfaceMuted,
          }}
        />
      ) : (
        <div
          style={{
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            color: theme.textFaint,
            padding: 16,
            textAlign: 'center',
          }}
        >
          <div style={{ fontSize: 28, lineHeight: 1, opacity: 0.45 }}>🚐</div>
          <div style={{ ...fieldLabel, color: theme.textFaint }}>No photo yet</div>
          {editable && onChoosePhoto && (
            <button
              type="button"
              onClick={onChoosePhoto}
              disabled={uploading}
              style={{ ...secondaryButton, padding: '6px 12px', fontSize: 12, marginTop: 4 }}
            >
              {uploading ? 'Uploading…' : 'Add photo'}
            </button>
          )}
        </div>
      )}
      {imageUrl && editable && onChoosePhoto && (
        <button
          type="button"
          onClick={onChoosePhoto}
          disabled={uploading}
          style={{
            position: 'absolute',
            right: 10,
            bottom: 10,
            ...secondaryButton,
            padding: '6px 12px',
            fontSize: 12,
            background: 'rgba(255,255,255,0.94)',
          }}
        >
          {uploading ? 'Uploading…' : 'Change photo'}
        </button>
      )}
    </div>
  )
}
