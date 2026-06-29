const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024
export const FLEET_VEHICLE_BUCKET = 'fleet-vehicles'

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

export function fleetVehicleImageSrc(imageUrl?: string | null): string | null {
  if (!imageUrl) return null
  if (imageUrl.startsWith('blob:') || imageUrl.startsWith('data:')) return imageUrl

  const path = parseFleetStoragePath(imageUrl)
  if (!path) return imageUrl

  return `/api/fleet/vehicles/image?path=${encodeURIComponent(path)}`
}

export function fleetVehicleImageProxyPath(imageUrl?: string | null): string | null {
  if (!imageUrl) return null
  return parseFleetStoragePath(imageUrl)
}
