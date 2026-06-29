import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { FLEET_VEHICLE_BUCKET, fleetVehicleStoragePath, resolveFleetVehicleImageUrl, validateFleetVehicleImage } from '@/lib/fleet-image'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file')
    const vehicleId = String(formData.get('vehicleId') || '').trim()

    if (!vehicleId) {
      return NextResponse.json({ error: 'Vehicle ID is required' }, { status: 400 })
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Image file is required' }, { status: 400 })
    }

    const validationError = validateFleetVehicleImage(file)
    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { data: vehicle, error: vehicleError } = await supabaseAdmin
      .from('tour_products')
      .select('id,image_url')
      .eq('id', vehicleId)
      .eq('family', 'fleet')
      .maybeSingle()

    if (vehicleError || !vehicle) {
      return NextResponse.json({ error: 'Vehicle not found' }, { status: 404 })
    }

    const path = fleetVehicleStoragePath(vehicleId, file.type)
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error: uploadError } = await supabaseAdmin.storage
      .from(FLEET_VEHICLE_BUCKET)
      .upload(path, buffer, { contentType: file.type, upsert: true })

    if (uploadError) {
      console.error('Fleet vehicle image upload error:', uploadError)
      const hint = uploadError.message?.toLowerCase().includes('bucket')
        ? 'Storage bucket missing — run supabase/fleet_vehicle_images.sql'
        : 'Failed to upload image'
      return NextResponse.json({ error: hint }, { status: 500 })
    }

    const { data: publicUrlData } = supabaseAdmin.storage.from(FLEET_VEHICLE_BUCKET).getPublicUrl(path)
    const imageUrl = publicUrlData.publicUrl

    const { data: updated, error: updateError } = await supabaseAdmin
      .from('tour_products')
      .update({ image_url: imageUrl, updated_at: new Date().toISOString() })
      .eq('id', vehicleId)
      .eq('family', 'fleet')
      .select('id,image_url')
      .single()

    if (updateError) {
      console.error('Fleet vehicle image_url update error:', updateError)
      const missingColumn = updateError.message?.toLowerCase().includes('image_url')
      return NextResponse.json(
        { error: missingColumn ? 'Database column missing — run supabase/fleet_vehicle_images.sql' : 'Failed to save image URL' },
        { status: 500 },
      )
    }

    const imageUrl = await resolveFleetVehicleImageUrl(supabaseAdmin, updated.image_url)
    return NextResponse.json({ imageUrl })
  } catch (error) {
    console.error('Fleet vehicle upload route error:', error)
    return NextResponse.json({ error: 'Failed to upload vehicle image' }, { status: 500 })
  }
}
