import type { SupabaseClient } from '@supabase/supabase-js'

const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024
export const FLEET_VEHICLE_BUCKET = 'fleet-vehicles'
const SIGNED_URL_TTL_SECONDS = 60 * 60 * 24 * 7

const FLEET_STORAGE_MARKERS = [
  `/storage/v1/object/public/${FLEET_VEHICLE_BUCKET}/`,
  `/storage/v1/object/sign/${FLEET_VEHICLE_BUCKET}/`,
  `/storage/v1/object/authenticated/${FLEET_VEHICLE_BUCKET}/`,
] as const

export function validateFleetVehicleImage(file: File) {
  if (!ALLOWED_TYPES.has(file.type)) {
    return 'Use a JPEG, PNG, or WebP image'
  }
  if (file.size > MAX_BYTES) {
    return 'Image must be 5 MB or smaller'
  }
  return null
}

export function fleetVehicleStoragePath(vehicleId: string, mimeType: string) {
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg'
  return `${vehicleId}/${Date.now()}.${ext}`
}

export function parseFleetStoragePath(imageUrl: string): string | null {
  const trimmed = imageUrl.trim()
  if (!trimmed) return null

  if (trimmed.startsWith('/api/fleet/vehicles/image')) {
    try {
      const query = trimmed.includes('?') ? trimmed.slice(trimmed.indexOf('?') + 1) : ''
      const path = new URLSearchParams(query).get('path')
      return path ? decodeURIComponent(path) : null
    } catch {
      return null
    }
  }

  if (!trimmed.includes('://') && !trimmed.startsWith('/storage/')) {
    return trimmed.replace(/^\/+/, '')
  }

  for (const marker of FLEET_STORAGE_MARKERS) {
    const index = trimmed.indexOf(marker)
    if (index === -1) continue
    const rawPath = trimmed.slice(index + marker.length).split('?')[0]
    if (!rawPath) return null
    try {
      return decodeURIComponent(rawPath)
    } catch {
      return rawPath
    }
  }

  return null
}

export function fleetVehicleProxySrc(path: string) {
  return `/api/fleet/vehicles/image?path=${encodeURIComponent(path)}`
}

export function fleetVehicleImageSrc(imageUrl?: string | null): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) return imageUrl
  if (imageUrl.includes('/object/sign/') || imageUrl.startsWith('/api/fleet/vehicles/image')) {
    return imageUrl
  }

  const path = parseFleetStoragePath(imageUrl)
  if (!path) return imageUrl

  return fleetVehicleProxySrc(path)
}

export async function resolveFleetVehicleImageUrl(
  supabase: SupabaseClient,
  imageUrl?: string | null,
): Promise<string | null> {
  if (!imageUrl) return null
  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) return imageUrl
  if (imageUrl.includes('/object/sign/')) return imageUrl
  if (imageUrl.startsWith('/api/fleet/vehicles/image')) return imageUrl

  const path = parseFleetStoragePath(imageUrl)
  if (!path) return imageUrl

  const { data, error } = await supabase.storage
    .from(FLEET_VEHICLE_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)

  if (!error && data?.signedUrl) {
    return data.signedUrl
  }

  return fleetVehicleProxySrc(path)
}
