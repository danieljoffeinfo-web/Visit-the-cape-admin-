import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'

type CustomerRow = {
  id: string
  name: string
  email: string
  phone?: string | null
  total_bookings?: number | null
  created_at?: string | null
  updated_at?: string | null
  xero_contact_id?: string | null
  xero_total_invoiced?: number | null
  xero_last_status?: string | null
}

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('id,name,email,phone,total_bookings,created_at,updated_at,xero_contact_id,xero_total_invoiced,xero_last_status')
      .order('updated_at', { ascending: false })

    if (error) {
      console.error('CRM customers fetch error:', error)
      return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 })
    }

    const customers = ((data || []) as CustomerRow[]).map((customer) => ({
      ...customer,
      created_at: customer.created_at || customer.updated_at || new Date().toISOString(),
    }))

    return NextResponse.json({ customers })
  } catch (error) {
    console.error('CRM customers route error:', error)
    return NextResponse.json({ error: 'Failed to load customers' }, { status: 500 })
  }
}
