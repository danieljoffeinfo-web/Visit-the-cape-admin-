import { supabaseAdmin } from '@/lib/supabase-admin'
import type { FleetVehicle } from '@/lib/fleet'
import { fleetVehicleImageSrc } from '@/lib/fleet-image'

const LIST_COLUMNS = 'id,title,family,summary,duration_label,pickup_notes,base_price,active'
const LIST_COLUMNS_WITH_IMAGE = `${LIST_COLUMNS},image_url`
const DETAIL_COLUMNS = 'id,title,summary,duration_label,base_price,pickup_notes,active'
const DETAIL_COLUMNS_WITH_IMAGE = `${DETAIL_COLUMNS},image_url`
const BOOKING_VEHICLE_COLUMNS = 'id,title,family,summary,duration_label,base_price'
const BOOKING_VEHICLE_COLUMNS_WITH_IMAGE = `${BOOKING_VEHICLE_COLUMNS},image_url`

function isMissingImageUrlColumn(message?: string) {
  return (message || '').toLowerCase().includes('image_url')
}

function withResolvedImageUrl<T extends { image_url?: string | null }>(vehicle: T): T {
  return {
    ...vehicle,
    image_url: fleetVehicleImageSrc(vehicle.image_url),
  }
}

export async function listFleetVehicles() {
  const withImage = await supabaseAdmin
    .from('tour_products')
    .select(LIST_COLUMNS_WITH_IMAGE)
    .eq('family', 'fleet')
    .eq('active', true)
    .order('title', { ascending: true })

  if (withImage.error && isMissingImageUrlColumn(withImage.error.message)) {
    const fallback = await supabaseAdmin
      .from('tour_products')
      .select(LIST_COLUMNS)
      .eq('family', 'fleet')
      .eq('active', true)
      .order('title', { ascending: true })

    if (fallback.error) return { data: null, error: fallback.error }
    const vehicles = (fallback.data || []).map((vehicle) => ({ ...vehicle, image_url: null }))
    return { data: vehicles as FleetVehicle[], error: null }
  }

  if (withImage.error) return { data: null, error: withImage.error }
  return { data: ((withImage.data || []) as FleetVehicle[]).map(withResolvedImageUrl), error: null }
}

export async function getFleetVehicleDetail(vehicleId: string) {
  const withImage = await supabaseAdmin
    .from('tour_products')
    .select(DETAIL_COLUMNS_WITH_IMAGE)
    .eq('id', vehicleId)
    .eq('family', 'fleet')
    .single()

  if (withImage.error && isMissingImageUrlColumn(withImage.error.message)) {
    const fallback = await supabaseAdmin
      .from('tour_products')
      .select(DETAIL_COLUMNS)
      .eq('id', vehicleId)
      .eq('family', 'fleet')
      .single()

    if (fallback.error || !fallback.data) return { data: null, error: fallback.error }
    return { data: { ...fallback.data, image_url: null }, error: null }
  }

  if (withImage.error || !withImage.data) return { data: null, error: withImage.error }
  return { data: withResolvedImageUrl(withImage.data), error: null }
}

export async function getFleetVehicleForBooking(vehicleId: string) {
  const withImage = await supabaseAdmin
    .from('tour_products')
    .select(BOOKING_VEHICLE_COLUMNS_WITH_IMAGE)
    .eq('id', vehicleId)
    .eq('family', 'fleet')
    .single<FleetVehicle>()

  if (withImage.error && isMissingImageUrlColumn(withImage.error.message)) {
    const fallback = await supabaseAdmin
      .from('tour_products')
      .select(BOOKING_VEHICLE_COLUMNS)
      .eq('id', vehicleId)
      .eq('family', 'fleet')
      .single<FleetVehicle>()

    if (fallback.error || !fallback.data) return { data: null, error: fallback.error }
    return { data: { ...fallback.data, image_url: null }, error: null }
  }

  if (withImage.error || !withImage.data) return { data: null, error: withImage.error }
  return { data: withResolvedImageUrl(withImage.data), error: null }
}
