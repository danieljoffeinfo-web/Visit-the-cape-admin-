'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

type VehicleImageUploadProps = {
  vehicleId?: string | null
  imageUrl?: string | null
  onUploaded?: (imageUrl: string) => void
  deferUpload?: boolean
  onFileSelect?: (file: File | null) => void
  compact?: boolean
}

const fieldLabel = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(240,236,228,0.45)' }

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

  const displayUrl = localPreview || imageUrl || null

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
            border: '1px solid rgba(240,236,228,0.12)',
            background: 'rgba(240,236,228,0.03)',
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
            <span style={{ fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.28)', textAlign: 'center', padding: 8 }}>
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
            style={{
              padding: '9px 14px',
              borderRadius: 6,
              background: 'transparent',
              color: '#d7bc94',
              border: '1px solid rgba(184,149,106,0.30)',
              cursor: uploading ? 'not-allowed' : 'pointer',
              fontWeight: 700,
              fontSize: 13,
              fontFamily: "'Barlow', sans-serif",
            }}
          >
            {uploading ? 'Uploading…' : displayUrl ? 'Replace photo' : 'Choose photo'}
          </button>
          <span style={{ fontSize: 12, color: 'rgba(240,236,228,0.42)', lineHeight: 1.45 }}>
            {deferUpload ? 'Photo uploads when you save the vehicle · JPEG, PNG, or WebP · max 5 MB' : 'JPEG, PNG, or WebP · max 5 MB'}
          </span>
        </div>
      </div>
    </div>
  )
}

export function VehicleImageThumb({ imageUrl, title, size = 44 }: { imageUrl?: string | null; title: string; size?: number }) {
  if (!imageUrl) return null
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={imageUrl}
      alt={title}
      style={{
        width: size,
        height: size,
        borderRadius: 6,
        objectFit: 'cover',
        border: '1px solid rgba(240,236,228,0.10)',
        flexShrink: 0,
      }}
    />
  )
}
