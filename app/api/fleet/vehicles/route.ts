import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildSeatsLabel } from '@/lib/fleet'

function slugifyRegistrationNumber(value: string) {
  return `fleet-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

function parseVehiclePayload(body: any) {
  const title = String(body?.title || '').trim()
  const registrationNumber = String(body?.registrationNumber || '').trim()
  const seats = Math.max(1, Number.parseInt(String(body?.seats || '1'), 10) || 1)
  const defaultRate = body?.defaultRate === '' || body?.defaultRate === null || body?.defaultRate === undefined
    ? null
    : Number(body.defaultRate)
  const notes = String(body?.notes || '').trim()

  return { title, registrationNumber, seats, defaultRate, notes }
}

function validateVehiclePayload(vehicle: ReturnType<typeof parseVehiclePayload>) {
  if (!vehicle.title || !vehicle.registrationNumber) {
    return 'Vehicle name and registration number are required'
  }

  if (!Number.isFinite(vehicle.seats) || vehicle.seats <= 0) {
    return 'Seats must be greater than zero'
  }

  if (vehicle.defaultRate !== null && (!Number.isFinite(vehicle.defaultRate) || vehicle.defaultRate < 0)) {
    return 'Default rate must be zero or greater'
  }

  return null
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('tour_products')
      .select('id,title,family,summary,duration_label,pickup_notes,base_price,active,image_url')
      .eq('family', 'fleet')
      .order('title', { ascending: true })

    if (error) {
      console.error('Fleet vehicles fetch error:', error)
      return NextResponse.json({ error: 'Failed to load vehicles' }, { status: 500 })
    }

    return NextResponse.json({ vehicles: data || [] })
  } catch (error) {
    console.error('Fleet vehicles route error:', error)
    return NextResponse.json({ error: 'Failed to load vehicles' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const vehicle = parseVehiclePayload(await request.json())
    const validationError = validateVehiclePayload(vehicle)

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const slug = slugifyRegistrationNumber(vehicle.registrationNumber)

    const { data: createdVehicle, error } = await supabaseAdmin
      .from('tour_products')
      .insert({
        slug,
        title: vehicle.title,
        family: 'fleet',
        experience_type: 'vehicle-rental',
        booking_mode: 'fleet',
        pricing_model: 'daily-rental',
        summary: vehicle.registrationNumber,
        duration_label: buildSeatsLabel(vehicle.seats),
        pickup_notes: vehicle.notes || null,
        base_price: vehicle.defaultRate,
        active: true,
      })
      .select('id,title,summary,duration_label,base_price,pickup_notes,active,image_url')
      .single()

    if (error) {
      console.error('Fleet vehicle insert error:', error)
      const duplicate = error.code === '23505' || error.message.toLowerCase().includes('duplicate')
      return NextResponse.json(
        { error: duplicate ? 'That registration number already exists' : 'Failed to save vehicle' },
        { status: duplicate ? 409 : 500 },
      )
    }

    return NextResponse.json({ vehicle: createdVehicle })
  } catch (error) {
    console.error('Fleet vehicle route error:', error)
    return NextResponse.json({ error: 'Failed to save vehicle' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json()
    const vehicleId = String(body?.id || '').trim()
    const vehicle = parseVehiclePayload(body)
    const validationError = validateVehiclePayload(vehicle)

    if (!vehicleId) {
      return NextResponse.json({ error: 'Vehicle ID is required' }, { status: 400 })
    }

    if (validationError) {
      return NextResponse.json({ error: validationError }, { status: 400 })
    }

    const { data: updatedVehicle, error } = await supabaseAdmin
      .from('tour_products')
      .update({
        slug: slugifyRegistrationNumber(vehicle.registrationNumber),
        title: vehicle.title,
        summary: vehicle.registrationNumber,
        duration_label: buildSeatsLabel(vehicle.seats),
        pickup_notes: vehicle.notes || null,
        base_price: vehicle.defaultRate,
        updated_at: new Date().toISOString(),
      })
      .eq('id', vehicleId)
      .eq('family', 'fleet')
      .select('id,title,summary,duration_label,base_price,pickup_notes,active,image_url')
      .single()

    if (error || !updatedVehicle) {
      console.error('Fleet vehicle update error:', error)
      const duplicate = Boolean(error) && (error.code === '23505' || error.message.toLowerCase().includes('duplicate'))
      return NextResponse.json(
        { error: duplicate ? 'That registration number already exists' : 'Failed to update vehicle' },
        { status: duplicate ? 409 : 500 },
      )
    }

    return NextResponse.json({ vehicle: updatedVehicle })
  } catch (error) {
    console.error('Fleet vehicle patch route error:', error)
    return NextResponse.json({ error: 'Failed to update vehicle' }, { status: 500 })
  }
}
