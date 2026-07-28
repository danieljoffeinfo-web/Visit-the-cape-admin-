/**
 * Shared dashboard types.
 *
 * The snapshot is built server-side in `lib/dashboard-server.ts` and served by
 * `/api/dashboard/snapshot`. This file is types only — an older browser-side
 * copy of that logic lived here, querying Supabase directly from the client. It
 * was unused and read enquiries from a different project than the inbox, so it
 * has been removed rather than left to drift.
 */

export type EnquiryRow = {
  id: string
  name: string
  tour_type?: string | null
  created_at: string
  status?: string | null
}

export type DepartureRow = {
  id: string
  name: string
  date: string
  seats_total: number
  booked_seats: number
  vehicle_name?: string | null
  departure_time?: string | null
}

export type FleetVehicleStatus = {
  id: string
  name: string
  status: 'available' | 'on_tour' | 'in_service'
  statusLabel: string
}

export type OutstandingInvoices = {
  connected: boolean
  total: number | null
  fallback: 'connect' | 'no_data' | null
}

export type CrmSnapshot = {
  newThisWeek: number
  totalCustomers: number
  repeatBookerPercent: number | null
}

export type RevenueDay = {
  date: string
  label: string
  amount: number
}
