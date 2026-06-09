'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { toast } from 'sonner'

type CalendarEvent = {
  id: string
  kind: 'fleet' | 'tour' | 'service'
  title: string
  label: string
  color?: string | null
  vehicleId?: string
  subtitle: string
  start: string
  end: string
}

type VehicleLegend = {
  id: string
  label: string
  color?: string | null
  registration: string
}

type EventColor = {
  bg: string
  border: string
  text: string
  accent: string
  soft: string
}

const DEFAULT_FLEET_COLOR = '#b8956a'
const TOUR_EVENT_COLOR: EventColor = {
  bg: 'rgba(122,169,255,0.16)',
  border: 'rgba(122,169,255,0.30)',
  text: '#acc9ff',
  accent: '#7aa9ff',
  soft: 'rgba(122,169,255,0.08)',
}

function hexToRgba(hex: string, alpha: number) {
  const clean = hex.replace('#', '')
  if (clean.length !== 6) return `rgba(184,149,106,${alpha})`
  const r = parseInt(clean.slice(0, 2), 16)
  const g = parseInt(clean.slice(2, 4), 16)
  const b = parseInt(clean.slice(4, 6), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

function paletteFromColor(hex?: string | null): EventColor {
  const accent = hex || DEFAULT_FLEET_COLOR
  return {
    bg: hexToRgba(accent, 0.18),
    border: hexToRgba(accent, 0.34),
    text: accent,
    accent,
    soft: hexToRgba(accent, 0.08),
  }
}

export function CalendarPanel() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [vehicleLegend, setVehicleLegend] = useState<VehicleLegend[]>([])
  const [loading, setLoading] = useState(true)
  const [showFleet, setShowFleet] = useState(true)
  const [showService, setShowService] = useState(true)
  const [showTours, setShowTours] = useState(true)

  useEffect(() => {
    loadCalendar()
  }, [])

  async function loadCalendar() {
    setLoading(true)
    try {
      const response = await fetch('/api/calendar/events', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load calendar')
      setEvents((result.events || []) as CalendarEvent[])
      setVehicleLegend((result.vehicleLegend || []) as VehicleLegend[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (event.kind === 'fleet' && !showFleet) return false
      if (event.kind === 'service' && !showService) return false
      if (event.kind === 'tour' && !showTours) return false
      return true
    })
  }, [events, showFleet, showService, showTours])

  const parsedEvents = useMemo(() => {
    return filteredEvents.map((event) => ({
      ...event,
      startDate: parseISO(event.start),
      endDate: parseISO(event.end),
      palette: event.kind === 'tour' ? TOUR_EVENT_COLOR : paletteFromColor(event.color),
    }))
  }, [filteredEvents])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarDays = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: 1 }),
    end: endOfWeek(monthEnd, { weekStartsOn: 1 }),
  })

  const monthEvents = useMemo(() => {
    return parsedEvents.filter((event) => {
      const startsInside = isSameMonth(event.startDate, currentMonth)
      const endsInside = isSameMonth(event.endDate, currentMonth)
      const spansMonth = event.startDate < monthStart && event.endDate > monthEnd
      return startsInside || endsInside || spansMonth
    })
  }, [currentMonth, monthEnd, monthStart, parsedEvents])

  const selectedDayEvents = useMemo(() => {
    return parsedEvents
      .filter((event) => isWithinInterval(selectedDate, { start: event.startDate, end: event.endDate }))
      .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
  }, [parsedEvents, selectedDate])

  const monthStats = useMemo(() => ({
    fleetCount: monthEvents.filter((e) => e.kind === 'fleet').length,
    serviceCount: monthEvents.filter((e) => e.kind === 'service').length,
    tourCount: monthEvents.filter((e) => e.kind === 'tour').length,
    totalCount: monthEvents.length,
  }), [monthEvents])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 30, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Calendar</h1>
          <p style={{ color: 'rgba(240,236,228,0.58)', fontSize: 13, margin: 0, maxWidth: 720 }}>
            Vehicle labels from Fleet Manager appear on each booking. Filter by type and click a day for full details.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 999, background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.08)' }}>
          <button onClick={() => setCurrentMonth((current) => subMonths(current, 1))} style={navButton}>←</button>
          <div style={{ minWidth: 180, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24 }}>{format(currentMonth, 'MMMM yyyy')}</div>
          <button onClick={() => setCurrentMonth((current) => addMonths(current, 1))} style={navButton}>→</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <FilterToggle label="Fleet rentals" active={showFleet} onClick={() => setShowFleet((v) => !v)} color={DEFAULT_FLEET_COLOR} />
        <FilterToggle label="Service blocks" active={showService} onClick={() => setShowService((v) => !v)} color="#ef5350" />
        <FilterToggle label="Tour departures" active={showTours} onClick={() => setShowTours((v) => !v)} color="#7aa9ff" />
      </div>

      {vehicleLegend.length > 0 && (
        <div style={{ ...cardStyle, padding: '14px 18px' }}>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.42)', marginBottom: 10 }}>Vehicle labels</div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {vehicleLegend.map((vehicle) => (
              <div key={vehicle.id} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 12px', borderRadius: 999, background: hexToRgba(vehicle.color || DEFAULT_FLEET_COLOR, 0.12), border: `1px solid ${hexToRgba(vehicle.color || DEFAULT_FLEET_COLOR, 0.28)}` }}>
                <span style={{ width: 10, height: 10, borderRadius: 999, background: vehicle.color || DEFAULT_FLEET_COLOR }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#f0ece4' }}>{vehicle.label}</span>
                {vehicle.registration ? <span style={{ fontSize: 11, color: 'rgba(240,236,228,0.45)' }}>{vehicle.registration}</span> : null}
              </div>
            ))}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.85fr) minmax(320px, 0.85fr)', gap: 20, alignItems: 'start' }}>
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 8 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.34)', padding: '0 4px' }}>{day}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
            {calendarDays.map((day) => {
              const dayEvents = parsedEvents
                .filter((event) => isWithinInterval(day, { start: event.startDate, end: event.endDate }))
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
              const visibleEvents = dayEvents.slice(0, 4)
              const extraCount = Math.max(0, dayEvents.length - visibleEvents.length)
              const isToday = isSameDay(day, new Date())
              const isSelected = isSameDay(day, selectedDate)
              const inCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  style={{
                    minHeight: 96,
                    borderRadius: 10,
                    border: `1px solid ${isSelected ? 'rgba(184,149,106,0.48)' : isToday ? 'rgba(122,169,255,0.34)' : 'rgba(240,236,228,0.08)'}`,
                    background: isSelected
                      ? 'linear-gradient(180deg, rgba(184,149,106,0.10), rgba(255,255,255,0.02))'
                      : isToday
                        ? 'linear-gradient(180deg, rgba(122,169,255,0.09), rgba(255,255,255,0.02))'
                        : 'rgba(255,255,255,0.015)',
                    padding: 8,
                    opacity: inCurrentMonth ? 1 : 0.32,
                    textAlign: 'left',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: isSelected ? '#f2d3a8' : '#f0ece4' }}>{format(day, 'd')}</span>
                    {dayEvents.length > 0 ? <span style={{ fontSize: 10, color: 'rgba(240,236,228,0.55)' }}>{dayEvents.length}</span> : null}
                  </div>
                  <div style={{ display: 'grid', gap: 4 }}>
                    {visibleEvents.map((event) => (
                      <div
                        key={`${day.toISOString()}-${event.id}`}
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: '4px 6px',
                          borderRadius: 4,
                          background: event.palette.bg,
                          border: `1px solid ${event.palette.border}`,
                          color: event.palette.text,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                        title={`${event.label} — ${event.subtitle}`}
                      >
                        {event.kind === 'service' ? '🔧 ' : ''}{event.label}
                      </div>
                    ))}
                    {extraCount > 0 ? <div style={{ fontSize: 10, color: 'rgba(240,236,228,0.44)' }}>+{extraCount}</div> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <div style={sectionTitle}>Selected day</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, marginBottom: 6 }}>{format(selectedDate, 'EEEE, d MMMM yyyy')}</div>
            <div style={subtleText}>{selectedDayEvents.length === 0 ? 'Nothing scheduled.' : `${selectedDayEvents.length} item${selectedDayEvents.length === 1 ? '' : 's'}.`}</div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Schedule details</div>
            <div style={{ display: 'grid', gap: 10, maxHeight: 420, overflowY: 'auto' }}>
              {loading ? (
                <div style={{ color: 'rgba(240,236,228,0.42)' }}>Loading calendar…</div>
              ) : selectedDayEvents.length === 0 ? (
                <div style={{ color: 'rgba(240,236,228,0.42)' }}>Nothing booked for this date.</div>
              ) : selectedDayEvents.map((event) => (
                <div key={event.id} style={{ borderRadius: 12, border: `1px solid ${event.palette.border}`, background: event.palette.soft, padding: 14, boxShadow: `inset 3px 0 0 ${event.palette.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: '#f0ece4', fontSize: 15 }}>{event.label}</div>
                      <div style={{ color: 'rgba(240,236,228,0.55)', fontSize: 12, marginTop: 4 }}>{event.title}</div>
                    </div>
                    <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: event.palette.text, background: event.palette.bg, border: `1px solid ${event.palette.border}`, borderRadius: 999, padding: '4px 8px', flexShrink: 0 }}>
                      {event.kind === 'fleet' ? 'Rental' : event.kind === 'service' ? 'Service' : 'Tour'}
                    </span>
                  </div>
                  <div style={{ color: 'rgba(240,236,228,0.62)', fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{event.subtitle}</div>
                  <div style={{ color: 'rgba(240,236,228,0.52)', fontSize: 12, marginTop: 10 }}>
                    {format(event.startDate, 'd MMM yyyy')}{!isSameDay(event.startDate, event.endDate) ? ` → ${format(event.endDate, 'd MMM yyyy')}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>This month</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <StatCard label="Fleet rentals" value={String(monthStats.fleetCount)} accent="#f2d3a8" />
              <StatCard label="Service" value={String(monthStats.serviceCount)} accent="#ffb4b1" />
              <StatCard label="Tours" value={String(monthStats.tourCount)} accent="#acc9ff" />
              <StatCard label="Total" value={String(monthStats.totalCount)} accent="#99efc0" />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterToggle({ label, active, onClick, color }: { label: string; active: boolean; onClick: () => void; color: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        border: `1px solid ${active ? hexToRgba(color, 0.45) : 'rgba(240,236,228,0.12)'}`,
        background: active ? hexToRgba(color, 0.12) : 'transparent',
        color: active ? '#f0ece4' : 'rgba(240,236,228,0.45)',
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: 700,
        fontFamily: "'Barlow', sans-serif",
      }}
    >
      {label}
    </button>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ borderRadius: 12, border: '1px solid rgba(240,236,228,0.10)', background: 'rgba(240,236,228,0.03)', padding: '12px 12px 10px' }}>
      <div style={{ color: 'rgba(240,236,228,0.50)', fontSize: 11, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 26, lineHeight: 1, color: accent }}>{value}</div>
    </div>
  )
}

const cardStyle = {
  background: '#1a1815',
  border: '1px solid rgba(240,236,228,0.12)',
  borderRadius: 18,
  padding: '18px',
  boxShadow: '0 18px 40px rgba(0,0,0,0.18)',
}

const navButton = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: '1px solid rgba(240,236,228,0.12)',
  background: 'rgba(240,236,228,0.03)',
  color: '#f0ece4',
  cursor: 'pointer',
  fontSize: 16,
}

const sectionTitle = {
  fontFamily: "'Barlow Condensed', sans-serif",
  fontWeight: 800,
  fontSize: 18,
  letterSpacing: '0.05em',
  textTransform: 'uppercase' as const,
  marginBottom: 6,
}

const subtleText = {
  color: 'rgba(240,236,228,0.48)',
  fontSize: 13,
}
