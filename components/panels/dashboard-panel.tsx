'use client'

import { useEffect, useState } from 'react'
import { format, formatDistanceToNow } from 'date-fns'
import {
  type DepartureRow,
  type EnquiryRow,
  type FleetVehicleStatus,
  type OutstandingInvoices,
  type RevenueDay,
} from '@/lib/dashboard'
import { cardStyle, theme } from '@/lib/theme'
import type { BookingTab } from '@/lib/bookings'

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
          background: pct >= 100 ? theme.danger : theme.bronze,
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
          <div style={{ height: 32, width: '30%', background: theme.bronzeBg, borderRadius: 4 }} />
        </div>
      ))}
    </div>
  )
}

export function DashboardPanel({
  onNavigate,
  userName,
}: {
  onNavigate: (p: string, opts?: { tab?: BookingTab; action?: string }) => void
  userName: string
}) {
  const [loading, setLoading] = useState(true)
  const [unreadCount, setUnreadCount] = useState(0)
  const [invoices, setInvoices] = useState<OutstandingInvoices>({ connected: false, total: null, fallback: 'no_data' })
  const [departures, setDepartures] = useState<DepartureRow[]>([])
  const [enquiries, setEnquiries] = useState<EnquiryRow[]>([])
  const [revenueDays, setRevenueDays] = useState<RevenueDay[]>([])
  const [fleet, setFleet] = useState<FleetVehicleStatus[]>([])

  useEffect(() => {
    loadDashboard()
  }, [])

  async function loadDashboard() {
    setLoading(true)
    try {
      const res = await fetch('/api/dashboard/snapshot', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load dashboard')

      setUnreadCount(data.unreadCount ?? 0)
      setInvoices(data.invoices ?? { connected: false, total: null, fallback: 'no_data' })
      setDepartures(data.departures ?? [])
      setEnquiries(data.unreadEnquiries ?? [])
      setRevenueDays(data.revenueDays ?? [])
      setFleet(data.fleet ?? [])
    } catch (error) {
      console.error('Dashboard load error:', error)
    } finally {
      setLoading(false)
    }
  }

  const revenueTotal = revenueDays.reduce((s, d) => s + d.amount, 0)

  const pulseCards = [
    {
      label: 'Messages to answer',
      value: loading ? '—' : String(unreadCount),
      sub: unreadCount > 0 ? 'Open the inbox and reply' : 'Nothing waiting for you',
      urgent: unreadCount > 0,
      onClick: () => onNavigate('enquiries'),
    },
    {
      label: 'Money to collect',
      value: loading
        ? '—'
        : invoices.fallback === 'connect'
          ? '—'
          : invoices.fallback === 'no_data'
            ? '—'
            : formatZAR(invoices.total || 0),
      sub: invoices.fallback === 'connect'
        ? 'Connect Xero to see unpaid invoices'
        : invoices.fallback === 'no_data'
          ? 'Xero data is unavailable'
          : 'Approved Xero invoices that are not paid yet',
      urgent: (invoices.total || 0) > 0,
      onClick: () => onNavigate('accounting'),
    },
  ]

  const quickActions = [
    { icon: '01', label: 'New tour booking', desc: 'Add a customer to a scheduled or private tour', to: 'bookings' as const, tab: 'tours' as BookingTab, action: 'create' },
    { icon: '02', label: 'Book a vehicle', desc: 'Check availability before confirming a vehicle', to: 'fleet' as const },
    { icon: '03', label: 'Book an experience', desc: 'Add an activity for a customer', to: 'experiences' as const },
  ]

  const today = new Intl.DateTimeFormat('en-ZA', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date())
  const firstName = userName.trim().split(/\s+/)[0] || 'there'

  return (
    <div className="dashboard-root">
      <style>{`
        .dashboard-root { max-width: 100%; overflow-x: hidden; }
        .dashboard-briefing { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 24px; align-items: end; padding: 26px 28px; border-radius: 12px; margin-bottom: 18px; background: #12303a; color: white; position: relative; overflow: hidden; }
        .dashboard-briefing::after { content: ''; position: absolute; right: -42px; bottom: -70px; width: 220px; height: 150px; border: 1px solid rgba(255,255,255,.14); border-radius: 50%; box-shadow: 0 0 0 28px rgba(255,255,255,.04), 0 0 0 56px rgba(255,255,255,.025); }
        .dashboard-pulse { display: grid; grid-template-columns: repeat(2, minmax(200px, 1fr)); gap: 12px; margin-bottom: 20px; }
        .dashboard-operations { display: grid; grid-template-columns: 1fr; gap: 20px; margin-bottom: 24px; }
        .dashboard-health { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; margin-bottom: 24px; }
        .dashboard-quick { margin-bottom: 0; }
        .dashboard-quick-grid { display: grid; grid-template-columns: repeat(3, minmax(0,1fr)); gap: 10px; }
        .dashboard-action { text-align: left; border: 1px solid ${theme.border}; background: ${theme.surface}; border-radius: 9px; padding: 16px; cursor: pointer; transition: transform .15s ease, border-color .15s ease; }
        .dashboard-action:hover { transform: translateY(-1px); border-color: ${theme.bronzeBorder}; }
        .pulse-card { cursor: pointer; transition: border-color 0.15s, background 0.15s; }
        .pulse-card:hover { border-color: ${theme.bronzeBorder} !important; background: ${theme.bronzeBg} !important; }
        .enquiry-row { cursor: pointer; transition: background 0.12s; border-radius: 4px; margin: 0 -8px; padding: 10px 8px !important; }
        .enquiry-row:hover { background: ${theme.bronzeBg}; }
        @media (min-width: 900px) {
          .dashboard-operations { grid-template-columns: 1.65fr 1fr; }
        }
        @media (max-width: 700px) {
          .dashboard-briefing { grid-template-columns: 1fr; }
          .dashboard-pulse, .dashboard-quick-grid { grid-template-columns: 1fr; }
        }
      `}</style>

      <section className="dashboard-briefing" aria-labelledby="briefing-title">
        <div style={{ position: 'relative', zIndex: 1 }}>
          <div style={{ fontFamily: theme.utilityFont, fontSize: 10, letterSpacing: '0.16em', textTransform: 'uppercase', color: 'rgba(255,255,255,.56)', marginBottom: 8 }}>Daily briefing</div>
          <h1 id="briefing-title" style={{ fontFamily: theme.headingFont, fontWeight: 900, fontSize: 36, letterSpacing: '0.02em', margin: 0, lineHeight: 1 }}>Good day, {firstName}.</h1>
          <p style={{ margin: '8px 0 0', color: 'rgba(255,255,255,.70)', fontSize: 14 }}>Here is what needs your attention today.</p>
        </div>
        <div style={{ position: 'relative', zIndex: 1, fontFamily: theme.utilityFont, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#ffffff', paddingBottom: 3 }}>{today}</div>
      </section>

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
                borderColor: p.urgent ? theme.bronzeBorder : card.border,
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
            <h3 style={sectionTitle}>Next 7 days</h3>
            <button
              onClick={() => onNavigate('bookings', { tab: 'tours', action: 'create' })}
              style={{
                padding: '5px 12px',
                borderRadius: 4,
                border: `1px solid ${theme.bronzeBorder}`,
                background: 'transparent',
                color: theme.bronzeDark,
                cursor: 'pointer',
                fontSize: 12,
                fontFamily: theme.bodyFont,
              }}
            >
              New tour booking
            </button>
          </div>

          {loading ? (
            <div style={{ color: mutedLight, fontSize: 13, padding: '12px 0' }}>Loading schedule...</div>
          ) : departures.length === 0 ? (
            <div style={{ color: mutedLight, fontSize: 13, padding: '12px 0' }}>No departures are scheduled for the next seven days.</div>
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
                    <div style={{ fontSize: 13, color: theme.bronzeDark, fontWeight: 600 }}>
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
            <h3 style={sectionTitle}>New messages</h3>
            {unreadCount > 0 && (
              <span
                style={{
                  fontSize: 11,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  color: theme.bronzeDark,
                  background: theme.bronzeBg,
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
            <div style={{ color: mutedLight, fontSize: 13, padding: '12px 0' }}>No customer messages need a reply.</div>
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
                    background: theme.bronze,
                    marginTop: 6,
                    flexShrink: 0,
                    boxShadow: `0 0 6px ${theme.bronzeBorder}`,
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
              <span style={{ fontSize: 13, color: theme.bronzeDark, fontWeight: 600 }}>{formatZAR(revenueTotal)}</span>
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
      </div>

      {/* Quick Actions */}
      <div style={card} className="dashboard-quick">
        <h3 style={{ ...sectionTitle, marginBottom: 14 }}>Start something</h3>
        <div className="dashboard-quick-grid">
        {quickActions.map((a) => (
          <button
            type="button"
            key={a.label}
            onClick={() => onNavigate(a.to, 'tab' in a ? { tab: a.tab, action: a.action } : undefined)}
            className="dashboard-action"
          >
            <div
              style={{
                color: theme.bronze,
                fontSize: 10,
                fontFamily: theme.utilityFont,
                letterSpacing: '0.12em',
                marginBottom: 10,
              }}
            >
              {a.icon}
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 700, color: theme.text }}>{a.label}</div>
              <div style={{ fontSize: 12, color: muted, marginTop: 3, lineHeight: 1.45 }}>{a.desc}</div>
            </div>
          </button>
        ))}
        </div>
      </div>
    </div>
  )
}
