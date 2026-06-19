const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])
const MAX_BYTES = 5 * 1024 * 1024
export const FLEET_VEHICLE_BUCKET = 'fleet-vehicles'

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
