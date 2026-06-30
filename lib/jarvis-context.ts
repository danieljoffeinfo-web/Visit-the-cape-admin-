import { format } from 'date-fns'
import { buildDashboardSnapshot } from '@/lib/dashboard-server'
import { fetchEnquiriesFromSource } from '@/lib/enquiries-server'
import { listFleetVehicles } from '@/lib/fleet-db'
import { getFleetAvailability } from '@/lib/fleet-availability'
import { getContentSupabaseAdmin } from '@/lib/content-supabase-admin'
import { supabaseAdmin } from '@/lib/supabase-admin'

export type JarvisToolName =
  | 'get_dashboard'
  | 'get_bookings'
  | 'get_enquiries'
  | 'get_tours_pricing'
  | 'get_fleet'
  | 'get_content_library'
  | 'get_activity_logs'
  | 'get_departures'

export const JARVIS_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'get_dashboard',
      description: 'Get dashboard snapshot: unread enquiries, seats remaining, revenue last 7 days, fleet status, CRM stats, outstanding invoices.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_bookings',
      description: 'List recent bookings across tours, private enquiries, and fleet rentals.',
      parameters: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['all', 'tours', 'private', 'fleet', 'internal'], description: 'Filter by booking type' },
          limit: { type: 'number', description: 'Max rows (default 25, max 50)' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_enquiries',
      description: 'List website enquiries with status, tour type, and contact details.',
      parameters: {
        type: 'object',
        properties: {
          status: { type: 'string', description: 'Filter by status e.g. new, replied, booked' },
          limit: { type: 'number' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_tours_pricing',
      description: 'Get all website tours with pricing (per person, private), duration, category, published status.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_fleet',
      description: 'Get fleet vehicles, daily rates, and availability calendar for the next 60 days.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_content_library',
      description: 'Get scheduled social content allocations (Instagram, TikTok, Facebook) with captions and dates.',
      parameters: {
        type: 'object',
        properties: {
          month: { type: 'string', description: 'YYYY-MM month to filter allocations' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_activity_logs',
      description: 'Get recent admin activity audit logs.',
      parameters: {
        type: 'object',
        properties: {
          limit: { type: 'number' },
          entity_type: { type: 'string' },
        },
        additionalProperties: false,
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'get_departures',
      description: 'Get upcoming tag-along tour departures with seat counts for the next 30 days.',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
    },
  },
]

async function safeQuery<T>(label: string, fn: () => Promise<T>): Promise<T | { error: string }> {
  try {
    return await fn()
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: `${label}: ${message}` }
  }
}

export async function executeJarvisTool(
  name: JarvisToolName,
  args: Record<string, unknown>,
): Promise<unknown> {
  switch (name) {
    case 'get_dashboard':
      return safeQuery('dashboard', () => buildDashboardSnapshot())

    case 'get_bookings': {
      const type = String(args.type || 'all')
      const limit = Math.min(Number(args.limit) || 25, 50)

      const [tagAlongRes, enquiriesRes, fleetRes] = await Promise.all([
        supabaseAdmin.from('tag_along_bookings').select('id,reference,customer_name,email,tour_date,passengers,amount,status,created_at').order('created_at', { ascending: false }).limit(limit),
        supabaseAdmin.from('enquiries').select('id,name,email,tour_type,status,created_at').order('created_at', { ascending: false }).limit(limit),
        supabaseAdmin.from('tour_bookings').select('id,name,email,passengers,amount,status,notes,created_at').eq('booking_type', 'fleet').order('created_at', { ascending: false }).limit(limit),
      ])

      const bookings = {
        tours: tagAlongRes.data || [],
        private: enquiriesRes.data || [],
        fleet: (fleetRes.data || []).map((row) => ({
          id: row.id,
          name: row.name,
          email: row.email,
          passengers: row.passengers,
          amount: row.amount,
          status: row.status,
          created_at: row.created_at,
        })),
      }

      if (type === 'tours') return { bookings: bookings.tours.slice(0, limit) }
      if (type === 'private') return { bookings: bookings.private.slice(0, limit) }
      if (type === 'fleet') return { bookings: bookings.fleet.slice(0, limit) }
      return bookings
    }

    case 'get_enquiries': {
      const limit = Math.min(Number(args.limit) || 30, 100)
      let enquiries = await fetchEnquiriesFromSource()
      const status = args.status ? String(args.status).toLowerCase() : null
      if (status) {
        enquiries = enquiries.filter((e) => (e.status || '').toLowerCase() === status)
      }
      return { enquiries: enquiries.slice(0, limit) }
    }

    case 'get_tours_pricing':
      return safeQuery('tours', async () => {
        const supabase = getContentSupabaseAdmin()
        const { data, error } = await supabase
          .from('tours')
          .select('id,slug,name,category,duration,price_pax,price_note,price_private,is_published,is_featured,region')
          .order('display_order', { ascending: true })
        if (error) throw error
        return { tours: data || [] }
      })

    case 'get_fleet':
      return safeQuery('fleet', async () => {
        const today = format(new Date(), 'yyyy-MM-dd')
        const in60 = format(new Date(Date.now() + 60 * 86400000), 'yyyy-MM-dd')
        const [vehiclesResult, availability] = await Promise.all([
          listFleetVehicles(),
          getFleetAvailability(today, in60),
        ])
        return {
          vehicles: (vehiclesResult.data || []).map((v) => ({
            id: v.id,
            title: v.title,
            daily_rate: v.base_price,
            active: v.active,
          })),
          vehicleCount: availability.vehicleCount,
          fullyBookedDates: availability.fullyBookedDates.slice(0, 30),
        }
      })

    case 'get_content_library': {
      const month = args.month ? String(args.month) : format(new Date(), 'yyyy-MM')
      const start = `${month}-01`
      const endDate = new Date(start)
      endDate.setMonth(endDate.getMonth() + 1)
      endDate.setDate(0)
      const end = format(endDate, 'yyyy-MM-dd')

      const { data: allocations, error: allocError } = await supabaseAdmin
        .from('content_allocations')
        .select('id,scheduled_date,platform,placement,caption,status,media_id')
        .gte('scheduled_date', start)
        .lte('scheduled_date', end)
        .order('scheduled_date', { ascending: true })

      if (allocError?.message?.toLowerCase().includes('content_allocations')) {
        return { error: 'Content library tables not set up yet. Run supabase/content_library.sql.' }
      }

      const { data: media } = await supabaseAdmin
        .from('content_media')
        .select('id,filename,media_kind')
        .limit(100)

      return { month, allocations: allocations || [], mediaCount: (media || []).length }
    }

    case 'get_activity_logs': {
      const limit = Math.min(Number(args.limit) || 40, 100)
      let query = supabaseAdmin
        .from('activity_logs')
        .select('action,entity_type,entity_id,entity_label,user_name,created_at')
        .order('created_at', { ascending: false })
        .limit(limit)

      if (args.entity_type) {
        query = query.eq('entity_type', String(args.entity_type))
      }

      const { data, error } = await query
      if (error) return { error: error.message }
      return { logs: data || [] }
    }

    case 'get_departures': {
      const today = format(new Date(), 'yyyy-MM-dd')
      const in30 = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd')
      const { data, error } = await supabaseAdmin
        .from('tag_along_tours')
        .select('id,name,date,seats_total,booked_seats,departure_time,vehicle_name')
        .gte('date', today)
        .lte('date', in30)
        .order('date', { ascending: true })

      if (error) return { error: error.message }
      return {
        departures: (data || []).map((d) => ({
          ...d,
          seats_remaining: Math.max(0, (d.seats_total || 0) - (d.booked_seats || 0)),
        })),
      }
    }

    default:
      return { error: `Unknown tool: ${name}` }
  }
}

export async function buildJarvisBriefContext(): Promise<string> {
  try {
    const snapshot = await buildDashboardSnapshot()
    const today = format(new Date(), 'yyyy-MM-dd')
    return `Live brief (${today}): ${snapshot.unreadCount} unread enquiries, ${snapshot.seatsRemaining} tour seats left (30d), ${snapshot.fleet.filter((f) => f.status === 'available').length}/${snapshot.fleet.length} fleet available, CRM ${snapshot.crm.totalCustomers} customers (${snapshot.crm.newThisWeek} new this week).`
  } catch {
    return 'Live brief unavailable — use tools for current data.'
  }
}
