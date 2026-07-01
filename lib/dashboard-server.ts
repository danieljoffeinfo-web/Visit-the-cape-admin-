import { addDays, format } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { getFleetStatusForDashboard } from '@/lib/fleet-status'
import { getAuthedXeroClient } from '@/lib/xero'
import type {
  CrmSnapshot,
  DepartureRow,
  EnquiryRow,
  FleetVehicleStatus,
  OutstandingInvoices,
  RevenueDay,
} from '@/lib/dashboard'

const UNREAD_STATUSES = ['new', 'unread']

function isUnreadEnquiry(enquiry: EnquiryRow): boolean {
  const status = (enquiry.status || '').toLowerCase()
  if (!status) return true
  return UNREAD_STATUSES.includes(status)
}

async function fetchEnquiries(): Promise<EnquiryRow[]> {
  const withStatus = await supabaseAdmin
    .from('enquiries')
    .select('id, name, tour_type, created_at, status')
    .order('created_at', { ascending: false })
    .limit(100)

  if (withStatus.error?.message?.toLowerCase().includes('status')) {
    const fallback = await supabaseAdmin
      .from('enquiries')
      .select('id, name, tour_type, created_at')
      .order('created_at', { ascending: false })
      .limit(100)

    if (fallback.error) return []
    return (fallback.data || []) as EnquiryRow[]
  }

  if (withStatus.error) return []
  return (withStatus.data || []) as EnquiryRow[]
}

function buildEmptyRevenueDays(): RevenueDay[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = format(addDays(new Date(), -6 + i), 'yyyy-MM-dd')
    return { date, label: format(new Date(date), 'EEE'), amount: 0 }
  })
}

async function getSeatsRemainingNext30Days(): Promise<number> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const in30 = format(addDays(new Date(), 30), 'yyyy-MM-dd')

  const { data, error } = await supabaseAdmin
    .from('tag_along_tours')
    .select('seats_total, booked_seats')
    .gte('date', today)
    .lte('date', in30)

  if (error) return 0

  return (data || []).reduce((sum, tour) => {
    const total = tour.seats_total || 0
    const booked = tour.booked_seats || 0
    return sum + Math.max(0, total - booked)
  }, 0)
}

async function getOutstandingInvoices(): Promise<OutstandingInvoices> {
  try {
    const auth = await getAuthedXeroClient()
    if (!auth) return { connected: false, total: null, fallback: 'connect' }

    const response = await auth.xero.accountingApi.getInvoices(
      auth.tenantId,
      undefined,
      'Status=="AUTHORISED"',
      'DueDate DESC',
      undefined,
      undefined,
      undefined,
      undefined,
      1,
      false,
      false,
      undefined,
      false,
    )

    const invoices = response.body.invoices || []
    const total = invoices.reduce((sum, inv) => sum + (inv.amountDue || 0), 0)
    return { connected: true, total, fallback: null }
  } catch {
    return { connected: false, total: null, fallback: 'no_data' }
  }
}

async function getUpcomingDeparturesNext7Days(): Promise<DepartureRow[]> {
  const today = format(new Date(), 'yyyy-MM-dd')
  const in7 = format(addDays(new Date(), 7), 'yyyy-MM-dd')

  const { data, error } = await supabaseAdmin
    .from('tag_along_tours')
    .select('*')
    .gte('date', today)
    .lte('date', in7)
    .order('date', { ascending: true })

  if (error) return []

  return ((data || []) as Array<Record<string, unknown>>).map((tour) => ({
    id: String(tour.id),
    name: String(tour.name || ''),
    date: String(tour.date || ''),
    seats_total: Number(tour.seats_total) || 0,
    booked_seats: Number(tour.booked_seats) || 0,
    vehicle_name: (tour.vehicle_name as string) || null,
    departure_time: (tour.departure_time as string) || (tour.time as string) || null,
  }))
}

async function getRevenueLast7Days(): Promise<RevenueDay[]> {
  const weekAgo = format(addDays(new Date(), -6), 'yyyy-MM-dd')

  const { data, error } = await supabaseAdmin
    .from('tag_along_bookings')
    .select('amount, created_at, status')
    .gte('created_at', `${weekAgo}T00:00:00`)

  if (error) return buildEmptyRevenueDays()

  const bookings = (data || []).filter((row) => {
    const status = (row.status || '').toLowerCase()
    return !status || status === 'confirmed' || status === 'paid'
  })

  const byDay = new Map<string, number>()
  for (let i = 0; i < 7; i++) {
    const d = format(addDays(new Date(), -6 + i), 'yyyy-MM-dd')
    byDay.set(d, 0)
  }

  for (const booking of bookings) {
    const day = format(new Date(booking.created_at), 'yyyy-MM-dd')
    if (byDay.has(day)) {
      byDay.set(day, (byDay.get(day) || 0) + (Number(booking.amount) || 0))
    }
  }

  return Array.from(byDay.entries()).map(([date, amount]) => ({
    date,
    label: format(new Date(date), 'EEE'),
    amount,
  }))
}

async function getFleetStatus(): Promise<FleetVehicleStatus[]> {
  try {
    return await getFleetStatusForDashboard()
  } catch {
    return []
  }
}

async function getCrmSnapshot(): Promise<CrmSnapshot> {
  try {
    const { data, error } = await supabaseAdmin
      .from('customers')
      .select('created_at, total_bookings')

    if (error) throw error

    const customers = data || []
    const weekAgo = addDays(new Date(), -7)
    const newThisWeek = customers.filter((c) => new Date(c.created_at) >= weekAgo).length
    const totalCustomers = customers.length

    const withBookingCounts = customers.filter((c) => typeof c.total_bookings === 'number')
    let repeatBookerPercent: number | null = null
    if (withBookingCounts.length >= 5 && totalCustomers > 0) {
      const repeaters = withBookingCounts.filter((c) => (c.total_bookings || 0) > 1).length
      repeatBookerPercent = Math.round((repeaters / withBookingCounts.length) * 100)
    }

    return { newThisWeek, totalCustomers, repeatBookerPercent }
  } catch {
    return { newThisWeek: 0, totalCustomers: 0, repeatBookerPercent: null }
  }
}

export type DashboardSnapshot = {
  unreadCount: number
  unreadEnquiries: EnquiryRow[]
  seatsRemaining: number
  invoices: OutstandingInvoices
  departures: DepartureRow[]
  revenueDays: RevenueDay[]
  fleet: FleetVehicleStatus[]
  crm: CrmSnapshot
}

export async function buildDashboardSnapshot(): Promise<DashboardSnapshot> {
  const enquiries = await fetchEnquiries()
  const unread = enquiries.filter(isUnreadEnquiry)

  const [seatsRemaining, invoices, departures, revenueDays, fleet, crm] = await Promise.all([
    getSeatsRemainingNext30Days(),
    getOutstandingInvoices(),
    getUpcomingDeparturesNext7Days(),
    getRevenueLast7Days(),
    getFleetStatus(),
    getCrmSnapshot(),
  ])

  return {
    unreadCount: unread.length,
    unreadEnquiries: unread.slice(0, 5),
    seatsRemaining,
    invoices,
    departures,
    revenueDays,
    fleet,
    crm,
  }
}
