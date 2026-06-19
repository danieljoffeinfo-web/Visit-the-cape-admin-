'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  getCrmSnapshot,
  getFleetStatus,
  getOutstandingInvoices,
  getRevenueLast7Days,
  getSeatsRemainingNext30Days,
  getUnreadEnquiries,
  getUnreadEnquiriesCount,
  getUpcomingDeparturesNext7Days,
  type CrmSnapshot,
  type DepartureRow,
  type EnquiryRow,
  type FleetVehicleStatus,
  type OutstandingInvoices,
  type RevenueDay,
} from '@/lib/dashboard'
import { cardStyle, theme } from '@/lib/theme'

const card = cardStyle

const sectionTitle = {
  fontFamily: theme.headingFont,
  fontWeight: 800,
  fontSize: 17,
  letterSpacing: '0.04em',
  textTransform: 'uppercase' as const,
  color: theme.text,
}

const muted = theme.textMuted
const mutedLight = theme.textFaint

function formatZAR(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

function FleetStatusDot({ status }: { status: FleetVehicleStatus['status'] }) {
  const color =
    status === 'available' ? theme.success : status === 'on_tour' ? theme.bronze : theme.textFaint
  return (
    <span
      style={{
        width: 7,
        height: 7,
        borderRadius: '50%',
        background: color,
        flexShrink: 0,
        boxShadow: status === 'available' ? '0 0 6px rgba(76,175,132,0.5)' : undefined,
      }}
    />
  )
}

function ProgressBar({ filled, total }: { filled: number; total: number }) {
  const pct = total > 0 ? Math.min(100, (filled / total) * 100) : 0
  return (
    <div style={{ height: 4, borderRadius: 2, background: theme.surfaceMuted, overflow: 'hidden', marginTop: 6 }}>
      <div
        style={{
          height: '100%',
          width: `${pct}%`,
          borderRadius: 2,
          background: pct >= 100 ? '#ef5350' : '#b8956a',
          transition: 'width 0.3s ease',
        }}
      />
    </div>
  )
}

function RevenueSparkline({ days }: { days: RevenueDay[] }) {
  const max = Math.max(...days.map((d) => d.amount), 1)
  const hasData = days.some((d) => d.amount > 0)

  if (!hasData) {
    return (
      <div style={{ color: mutedLight, fontSize: 13, padding: '20px 0' }}>
        No confirmed booking revenue in the last 7 days
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 72, marginTop: 8 }}>
      {days.map((d) => (
        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
          <div
            style={{
              width: '100%',
              maxWidth: 36,
              height: `${Math.max(4, (d.amount / max) * 56)}px`,
              borderRadius: 3,
              background: d.amount > 0 ? theme.bronze : theme.surfaceMuted,
            }}
            title={d.amount > 0 ? formatZAR(d.amount) : undefined}
          />
          <span style={{ fontSize: 10, color: mutedLight, letterSpacing: '0.04em' }}>{d.label}</span>
        </div>
      ))}
    </div>
  )
}

function PulseSkeleton() {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
      {[0, 1, 2].map((i) => (
        <div key={i} style={{ ...card, minHeight: 100, opacity: 0.5 }}>
          <div style={{ height: 10, width: '50%', background: theme.surfaceMuted, borderRadius: 4, marginBottom: 12 }} />
          <div style={{ height: 32, width: '30%', background: 'rgba(184,149,106,0.15)', borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}

import type { BookingTab } from '@/lib/bookings'

export function DashboardPanel({
  onNavigate,
}: {
  onNavigate: (p: string, opts?: { tab?: BookingTab; action?: string }) => void
}) {
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [seatsRemaining, setSeatsRemaining] = useState(0)
  const [invoices, setInvoices] = useState<OutstandingInvoices>({ connected: false, total: null, fallback: 'no_data' })
  const [departures, setDepartures] = useState<DepartureRow[]>([])
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([])
  const [revenueDays, setRevenueDays] = useState<RevenueDay[]>([])
  const [fleet, setFleet] = useState<FleetVehicleStatus[]>([])
  const [crm, setCrm] = useState<CrmSnapshot>({ newThisWeek: 0, totalCustomers: 0, repeatBookerPercent: null })

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const [
        unreadTotal,
        seats,
        invoiceData,
        schedule,
        unreadFeed,
        revenue,
        fleetStatus,
        crmData,
      ] = await Promise.all([
        getUnreadEnquiriesCount(),
        getSeatsRemainingNext30Days(),
        getOutstandingInvoices(),
        getUpcomingDeparturesNext7Days(),
        getUnreadEnquiries(5),
        getRevenueLast7Days(),
        getFleetStatus(),
        getCrmSnapshot(),
      ])

      setUnreadCount(unreadTotal)
      setSeatsRemaining(seats)
      setInvoices(invoiceData)
      setDepartures(schedule)
      setEnquiries(unreadFeed)
      setRevenueDays(revenue)
      setFleet(fleetStatus)
      setCrm(crmData)
    } finally {
      setLoading(false)
    }
  }

  const revenueTotal = revenueDays.reduce((s, d) => s + d.amount, 0)

  const pulseCards = [
    {
      label: 'Unread Enquiries',
      value: loading ? '—' : String(unreadCount),
      sub: unreadCount > 0 ? 'Needs response' : 'All caught up',
      urgent: unreadCount > 0,
      onClick: () => onNavigate('enquiries'),
    },
    {
      label: 'Seats Remaining',
      value: loading ? '—' : String(seatsRemaining),
      sub: 'Next 30 days',
      urgent: false,
      onClick: () => onNavigate('tours'),
    },
    {
      label: 'Outstanding Invoices',
      value: loading
        ? '—'
        : invoices.fallback === 'connect'
          ? '—'
          : invoices.fallback === 'no_data'
            ? '—'
            : formatZAR(invoices.total || 0),
      sub: invoices.fallback === 'connect'
        ? 'Connect Xero'
        : invoices.fallback === 'no_data'
          ? 'No invoice data'
          : 'AUTHORISED unpaid',
      urgent: (invoices.total || 0) > 0,
      onClick: () => onNavigate('accounting'),
    },
  ]

  const quickActions = [
    { icon: '✏', label: 'Edit Website Tours', desc: 'Update descriptions, itinerary and pricing on visitthecape.co.za', to: 'tours' as const },
    { icon: '✉', label: 'View Enquiries', desc: 'Check latest customer messages', to: 'enquiries' as const },
    { icon: '📋', label: 'New Internal Booking', desc: 'Create a booking from the admin dashboard', to: 'bookings' as const, tab: 'internal' as BookingTab, action: 'create' },
    { icon: '🎫', label: 'New Tour Booking', desc: 'Create a manual tour booking on request', to: 'bookings' as const, tab: 'tours' as BookingTab, action: 'create' },
    { icon: '🚐', label: 'New Fleet Booking', desc: 'Book a vehicle for a tour or rental', to: 'bookings' as const, tab: 'fleet' as BookingTab, action: 'create' },
    { icon: '📜', label: 'View Activity Logs', desc: 'See who changed what and when', to: 'activity-logs' as const },
    { icon: '₤', label: 'Accounting', desc: 'Invoices, payments and reports', to: 'accounting' as const },
  ]

  return (
    <div className="dashboard-root">
      <style>{`
        .dashboard-root { max-width: 100%; overflow-x: hidden; }
        .dashboard-pulse { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .dashboard-operations { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 24px; }
        .dashboard-health { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .dashboard-quick { margin-bottom: 0; }
        .pulse-card { cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .pulse-card:hover { border-color: rgba(184,149,106,0.35) !important; background: rgba(184,149,106,0.04) !important; }
        .enquiry-row { cursor: pointer; transition: background 0.12s; border-radius: 4px; margin: 0 -8px; padding: 10px 8px !important; }
        .enquiry-row:hover { background: rgba(184,149,106,0.06); }
        @media (min-width: 900px) {
          .dashboard-operations { grid-template-columns: 1.65fr 1fr; }
        }
      `}</style>

      <h1
        style={{
          fontFamily: "'Barlow Condensed', sans-serif",
          fontWeight: 900,
          fontSize: 28,
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: 24,
        }}
      >
        Dashboard
      </h1>

      {/* Pulse Bar */}
      {loading ? (
        <PulseSkeleton />
      ) : (
        <div className="dashboard-pulse">
          {pulseCards.map((p) => (
            <div
              key={p.label}
              className="pulse-card"
              style={{
                ...card,
                borderColor: p.urgent ? 'rgba(184,149,106,0.4)' : card.border,
              }}
              onClick={p.onClick}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => e.key === 'Enter' && p.onClick()}
            >
              <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: muted, marginBottom: 6 }}>
                {p.label}
              </div>
              <div
                style={{
                  fontFamily: "'Barlow Condensed', sans-serif",
                  fontWeight: 900,
                  fontSize: 36,
                  color: p.urgent ? theme.bronze : theme.text,
                  lineHeight: 1,
                }}
              >
                {p.value}
              </div>
              <div style={{ fontSize: 12, color: mutedLight, marginTop: 4 }}>{p.sub}</div>
            </div>
          ))}
        </div>
      )}

      {/* Operations */}
      <div className="dashboard-operations">
        {/* Today's Schedule + Next 7 Days */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <h3 style={sectionTitle}>Today&apos;s Schedule + Next 7 Days</h3>
            <button
              onClick={() => onNavigate('tours')}
              style={{
                padding: '5px 12px',
                borderRadius: 4,
                border: '1px solid rgba(184,149,106,0.35)',
                background: 'transparent',
                color: '#b8956a',
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: "'Barlow', sans-serif",
              }}
            >
              Add Tour
            </button>
          </div>

          {loading ? (
            <div style={{ color: mutedLight, fontSize: 13, padding: '12px 0' }}>Loading schedule...</div>
          ) : departures.length === 0 ? (
            <div style={{ color: mutedLight, fontSize: 13, padding: '12px 0' }}>
              No departures scheduled.{' '}
              <button
                onClick={() => onNavigate('tours')}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#b8956a',
                  cursor: 'pointer',
                  fontSize: 13,
                  fontFamily: "'Barlow', sans-serif",
                  padding: 0,
                  textDecoration: 'underline',
                  textUnderlineOffset: 3,
                }}
              >
                Schedule a departure →
              </button>
            </div>
          ) : (
            departures.map((d) => (
              <div
                key={d.id}
                style={{ padding: '12px 0', borderBottom: `1px solid ${theme.border}` }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{d.name}</div>
                    <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
                      {format(new Date(d.date), 'EEE, d MMM')}
                      {d.departure_time ? ` · ${d.departure_time}` : ''}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <div style={{ fontSize: 13, color: '#b8956a', fontWeight: 600 }}>
                      {d.booked_seats}/{d.seats_total}
                    </div>
                    <div style={{ fontSize: 11, color: mutedLight }}>seats filled</div>
                  </div>
                </div>
                <ProgressBar filled={d.booked_seats} total={d.seats_total} />
                {d.vehicle_name ? (
                  <div style={{ fontSize: 11, color: mutedLight, marginTop: 6 }}>Vehicle: {d.vehicle_name}</div>
                ) : null}
              </div>
            ))
          )}
        </div>

        {/* Unread Enquiries Feed */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={sectionTitle}>Unread Enquiries</h3>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: '#b8956a',
                  background: 'rgba(184,149,106,0.12)',
                  padding: '2px 8px',
                  borderRadius: 10,
                }}
              >
                {unreadCount} new
              </span>
            )}
          </div>

          {loading ? (
            <div style={{ color: mutedLight, fontSize: 13, padding: '12px 0' }}>Loading enquiries...</div>
          ) : enquiries.length === 0 ? (
            <div style={{ color: mutedLight, fontSize: 13, padding: '12px 0' }}>No unread enquiries</div>
          ) : (
            enquiries.map((e) => (
              <div
                key={e.id}
                className="enquiry-row"
                style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderBottom: `1px solid ${theme.border}` }}
                onClick={() => onNavigate('enquiries')}
                role="button"
                tabIndex={0}
                onKeyDown={(ev) => ev.key === 'Enter' && onNavigate('enquiries')}
              >
                <span
                  style={{
                    width: 7,
                    height: 7,
                    borderRadius: '50%',
                    background: '#b8956a',
                    marginTop: 6,
                    flexShrink: 0,
                    boxShadow: '0 0 6px rgba(184,149,106,0.5)',
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{e.name}</div>
                  {e.tour_type && (
                    <div style={{ fontSize: 12, color: muted, marginTop: 2 }}>{e.tour_type}</div>
                  )}
                  <div style={{ fontSize: 11, color: mutedLight, marginTop: 3 }}>
                    {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Business Health */}
      <div className="dashboard-health">
        {/* Revenue Sparkline */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
            <h3 style={sectionTitle}>Revenue</h3>
            {!loading && revenueTotal > 0 && (
              <span style={{ fontSize: 13, color: '#b8956a', fontWeight: 600 }}>{formatZAR(revenueTotal)}</span>
            )}
          </div>
          <div style={{ fontSize: 11, color: mutedLight, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 4 }}>
            Last 7 days · confirmed bookings
          </div>
          {loading ? (
            <div style={{ color: mutedLight, fontSize: 13, padding: '20px 0' }}>Loading...</div>
          ) : (
            <RevenueSparkline days={revenueDays} />
          )}
        </div>

        {/* Fleet Status */}
        <div style={card}>
          <h3 style={{ ...sectionTitle, marginBottom: 14 }}>Fleet Status</h3>
          {loading ? (
            <div style={{ color: mutedLight, fontSize: 13 }}>Loading fleet...</div>
          ) : fleet.length === 0 ? (
            <div style={{ color: mutedLight, fontSize: 13 }}>
              No vehicles added yet
              {/* TODO: Fleet data — vehicles live in tour_products (family=fleet) via /api/fleet/vehicles */}
            </div>
          ) : (
            fleet.map((v) => (
              <div
                key={v.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  padding: '8px 0',
                  borderBottom: `1px solid ${theme.border}`,
                }}
              >
                <FleetStatusDot status={v.status} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {v.name}
                </span>
                <span style={{ fontSize: 11, color: muted, letterSpacing: '0.04em', flexShrink: 0 }}>{v.statusLabel}</span>
              </div>
            ))
          )}
        </div>

        {/* CRM Snapshot */}
        <div style={card}>
          <h3 style={{ ...sectionTitle, marginBottom: 14 }}>CRM Snapshot</h3>
          {loading ? (
            <div style={{ color: mutedLight, fontSize: 13 }}>Loading CRM...</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: muted }}>New this week</span>
                <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24, color: '#b8956a' }}>
                  {crm.newThisWeek}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: 12, color: muted }}>Total customers</span>
                <span style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 24, color: theme.text }}>
                  {crm.totalCustomers}
                </span>
              </div>
              {crm.repeatBookerPercent !== null && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                  <span style={{ fontSize: 12, color: muted }}>Repeat bookers</span>
                  <span style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 24, color: theme.text }}>
                    {crm.repeatBookerPercent}%
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Quick Actions */}
      <div style={card} className="dashboard-quick">
        <h3 style={{ ...sectionTitle, marginBottom: 14 }}>Quick Actions</h3>
        {quickActions.map((a) => (
          <div
            key={a.label}
            onClick={() => onNavigate(a.to, 'tab' in a ? { tab: a.tab, action: a.action } : undefined)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '10px 0',
              borderBottom: `1px solid ${theme.border}`,
              cursor: 'pointer',
            }}
          >
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                background: 'rgba(184,149,106,0.1)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#b8956a',
                fontSize: 16,
                flexShrink: 0,
              }}
            >
              {a.icon}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 1 }}>{a.desc}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
