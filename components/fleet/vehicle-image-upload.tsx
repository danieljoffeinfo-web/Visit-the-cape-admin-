'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { fieldLabel, secondaryButton, theme } from '@/lib/theme'
import { fleetVehicleImageSrc } from '@/lib/fleet-image'

type VehicleImageUploadProps = {
  vehicleId?: string | null
  imageUrl?: string | null
  onUploaded?: (imageUrl: string) => void
  deferUpload?: boolean
  onFileSelect?: (file: File | null) => void
  compact?: boolean
}

export async function uploadFleetVehicleImage(vehicleId: string, file: File) {
  const formData = new FormData()
  formData.append('file', file)
  formData.append('vehicleId', vehicleId)

  const response = await fetch('/api/fleet/vehicles/upload', { method: 'POST', body: formData })
  const result = await response.json()

  if (!response.ok) {
    throw new Error(result.error || 'Failed to upload image')
  }

  return result.imageUrl as string
}

export function VehicleImageUpload({
  vehicleId,
  imageUrl,
  onUploaded,
  deferUpload,
  onFileSelect,
  compact,
}: VehicleImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [localPreview, setLocalPreview] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    return () => {
      if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
    }
  }, [localPreview])

  const displayUrl = localPreview || fleetVehicleImageSrc(imageUrl) || null

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    if (localPreview?.startsWith('blob:')) URL.revokeObjectURL(localPreview)
    setLocalPreview(URL.createObjectURL(file))

    if (deferUpload) {
      onFileSelect?.(file)
      event.target.value = ''
      return
    }

    if (!vehicleId) {
      toast.error('Save the vehicle first, then upload its image')
      onFileSelect?.(file)
      event.target.value = ''
      return
    }

    setUploading(true)
    try {
      const nextUrl = await uploadFleetVehicleImage(vehicleId, file)
      onUploaded?.(nextUrl)
      toast.success('Vehicle image uploaded')
    } catch (error) {
      setLocalPreview(null)
      onFileSelect?.(null)
      toast.error(error instanceof Error ? error.message : 'Failed to upload image')
    } finally {
      setUploading(false)
      event.target.value = ''
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={fieldLabel}>Vehicle photo</span>
      <div style={{ display: 'flex', gap: 12, alignItems: compact ? 'center' : 'flex-start', flexWrap: 'wrap' }}>
        <div
          style={{
            width: compact ? 72 : 120,
            height: compact ? 72 : 90,
            borderRadius: 8,
            border: `1px solid ${theme.border}`,
            background: theme.surfaceMuted,
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={displayUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.textFaint, textAlign: 'center', padding: 8 }}>
              No photo
            </span>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, flex: 1, minWidth: 160 }}>
          <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp" onChange={handleFileChange} style={{ display: 'none' }} />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            style={{ ...secondaryButton, opacity: uploading ? 0.7 : 1, cursor: uploading ? 'not-allowed' : 'pointer' }}
          >
            {uploading ? 'Uploading…' : displayUrl ? 'Replace photo' : 'Choose photo'}
          </button>
          <span style={{ fontSize: 12, color: theme.textMuted, lineHeight: 1.45 }}>
            {deferUpload ? 'Photo uploads when you save the vehicle · JPEG, PNG, or WebP · max 5 MB' : 'JPEG, PNG, or WebP · max 5 MB'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function VehicleImageThumb({ imageUrl, title, size = 44 }: { imageUrl?: string | null; title: string; size?: number }) {
  const resolvedImageUrl = fleetVehicleImageSrc(imageUrl)

  if (resolvedImageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={resolvedImageUrl}
        alt={title}
        style={{
          width: size,
          height: size,
          borderRadius: 6,
          objectFit: 'cover',
          border: `1px solid ${theme.border}`,
          flexShrink: 0,
          background: theme.surfaceMuted,
        }}
      />
    )
  }

  return (
    <div
      aria-hidden
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        border: `1px solid ${theme.border}`,
        background: theme.surfaceMuted,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: Math.max(14, size * 0.32),
        opacity: 0.5,
      }}
    >
      🚐
    </div>
  )
}
