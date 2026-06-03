import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { buildSeatsLabel } from '@/lib/fleet'

function slugifyRegistrationNumber(value: string) {
  return `fleet-${value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const title = String(body?.title || '').trim()
    const registrationNumber = String(body?.registrationNumber || '').trim()
    const seats = Math.max(1, Number.parseInt(String(body?.seats || '1'), 10) || 1)
    const defaultRate = body?.defaultRate === '' || body?.defaultRate === null || body?.defaultRate === undefined
      ? null
      : Number(body.defaultRate)
    const notes = String(body?.notes || '').trim()

    if (!title || !registrationNumber) {
      return NextResponse.json({ error: 'Vehicle name and registration number are required' }, { status: 400 })
    }

    if (!Number.isFinite(seats) || seats <= 0) {
      return NextResponse.json({ error: 'Seats must be greater than zero' }, { status: 400 })
    }

    if (defaultRate !== null && (!Number.isFinite(defaultRate) || defaultRate < 0)) {
      return NextResponse.json({ error: 'Default rate must be zero or greater' }, { status: 400 })
    }

    const slug = slugifyRegistrationNumber(registrationNumber)

    const { data: vehicle, error } = await supabaseAdmin
      .from('tour_products')
      .insert({
        slug,
        title,
        family: 'fleet',
        experience_type: 'vehicle-rental',
        booking_mode: 'fleet',
        pricing_model: 'daily-rental',
        summary: registrationNumber,
        duration_label: buildSeatsLabel(seats),
        pickup_notes: notes || null,
        base_price: defaultRate,
        active: true,
      })
      .select('id,title,summary,duration_label,base_price,pickup_notes,active')
      .single()

    if (error) {
      console.error('Fleet vehicle insert error:', error)
      const duplicate = error.code === '23505' || error.message.toLowerCase().includes('duplicate')
      return NextResponse.json(
        { error: duplicate ? 'That registration number already exists' : 'Failed to save vehicle' },
        { status: duplicate ? 409 : 500 },
      )
    }

    return NextResponse.json({ vehicle })
  } catch (error) {
    console.error('Fleet vehicle route error:', error)
    return NextResponse.json({ error: 'Failed to save vehicle' }, { status: 500 })
  }
}
