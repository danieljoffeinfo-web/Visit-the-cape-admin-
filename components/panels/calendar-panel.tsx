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
  kind: 'fleet' | 'tour'
  title: string
  subtitle: string
  start: string
  end: string
}

type EventColor = {
  bg: string
  border: string
  text: string
  accent: string
  soft: string
}

const FLEET_EVENT_COLORS: EventColor[] = [
  { bg: 'rgba(184,149,106,0.20)', border: 'rgba(184,149,106,0.45)', text: '#f5d6ab', accent: '#b8956a', soft: 'rgba(184,149,106,0.10)' },
  { bg: 'rgba(76,175,132,0.20)', border: 'rgba(76,175,132,0.42)', text: '#95efbe', accent: '#4caf84', soft: 'rgba(76,175,132,0.10)' },
  { bg: 'rgba(100,149,237,0.20)', border: 'rgba(100,149,237,0.42)', text: '#a9c7ff', accent: '#6495ed', soft: 'rgba(100,149,237,0.10)' },
  { bg: 'rgba(239,83,80,0.18)', border: 'rgba(239,83,80,0.42)', text: '#ffb2af', accent: '#ef5350', soft: 'rgba(239,83,80,0.10)' },
  { bg: 'rgba(244,197,66,0.18)', border: 'rgba(244,197,66,0.42)', text: '#ffe08a', accent: '#f4c542', soft: 'rgba(244,197,66,0.10)' },
  { bg: 'rgba(142,106,216,0.18)', border: 'rgba(142,106,216,0.42)', text: '#ceb4ff', accent: '#8e6ad8', soft: 'rgba(142,106,216,0.10)' },
  { bg: 'rgba(0,188,212,0.18)', border: 'rgba(0,188,212,0.42)', text: '#8ff2ff', accent: '#00bcd4', soft: 'rgba(0,188,212,0.10)' },
  { bg: 'rgba(255,112,67,0.18)', border: 'rgba(255,112,67,0.42)', text: '#ffc0ab', accent: '#ff7043', soft: 'rgba(255,112,67,0.10)' },
]

const TOUR_EVENT_COLOR: EventColor = {
  bg: 'rgba(80,122,201,0.18)',
  border: 'rgba(122,169,255,0.34)',
  text: '#a9c7ff',
  accent: '#7aa9ff',
  soft: 'rgba(122,169,255,0.08)',
}

export function CalendarPanel() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [events, setEvents] = useState<CalendarEvent[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadCalendar()
  }, [])

  async function loadCalendar() {
    setLoading(true)
    try {
      const response = await fetch('/api/calendar/events', { cache: 'no-store' })
      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to load calendar')
      }

      setEvents((result.events || []) as CalendarEvent[])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load calendar')
    } finally {
      setLoading(false)
    }
  }

  const parsedEvents = useMemo(() => {
    return events.map((event) => ({
      ...event,
      startDate: parseISO(event.start),
      endDate: parseISO(event.end),
      colorKey: getEventColorKey(event),
      palette: getEventColor(event),
      label: getEventLabel(event),
    }))
  }, [events])

  const monthStart = startOfMonth(currentMonth)
  const monthEnd = endOfMonth(currentMonth)
  const calendarDays = eachDayOfInterval({ start: startOfWeek(monthStart, { weekStartsOn: 1 }), end: endOfWeek(monthEnd, { weekStartsOn: 1 }) })

  const monthEvents = useMemo(() => {
    return parsedEvents.filter((event) => {
      const startsInside = isSameMonth(event.startDate, currentMonth)
      const endsInside = isSameMonth(event.endDate, currentMonth)
      const spansMonth = event.startDate < monthStart && event.endDate > monthEnd
      return startsInside || endsInside || spansMonth
    })
  }, [currentMonth, monthEnd, monthStart, parsedEvents])

  const monthStats = useMemo(() => {
    const fleetEvents = monthEvents.filter((event) => event.kind === 'fleet')
    const serviceEvents = monthEvents.filter((event) => event.kind === 'tour')
    const vehicleCounts = new Map<string, { label: string; count: number; palette: EventColor }>()

    for (const event of fleetEvents) {
      const current = vehicleCounts.get(event.colorKey)
      if (current) {
        current.count += 1
      } else {
        vehicleCounts.set(event.colorKey, { label: event.label, count: 1, palette: event.palette })
      }
    }

    const fleetDays = fleetEvents.reduce((sum, event) => {
      return sum + calendarDays.filter((day) => isSameMonth(day, currentMonth) && isWithinInterval(day, { start: event.startDate, end: event.endDate })).length
    }, 0)

    return {
      fleetCount: fleetEvents.length,
      serviceCount: serviceEvents.length,
      totalCount: monthEvents.length,
      fleetDays,
      vehicleLegend: Array.from(vehicleCounts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }
  }, [calendarDays, currentMonth, monthEvents])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 30, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 4 }}>Calendar</h1>
          <p style={{ color: 'rgba(240,236,228,0.60)', fontSize: 13, marginTop: 0, maxWidth: 720 }}>
            Fleet bookings and service departures now sit in one cleaner planner. Every vehicle has its own colour so the road schedule is easier to read at a glance.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 999, background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.08)' }}>
          <button onClick={() => setCurrentMonth((current) => subMonths(current, 1))} style={navButton}>←</button>
          <div style={{ minWidth: 180, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24 }}>{format(currentMonth, 'MMMM yyyy')}</div>
          <button onClick={() => setCurrentMonth((current) => addMonths(current, 1))} style={navButton}>→</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 0.95fr)', gap: 20, alignItems: 'start' }}>
        <div style={{ ...cardStyle, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
            <div>
              <div style={sectionTitle}>Road planner</div>
              <div style={subtleText}>Different vehicles now keep their own colours across the month view and agenda.</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              <LegendPill label="Fleet vehicle" palette={FLEET_EVENT_COLORS[0]} />
              <LegendPill label="Service departure" palette={TOUR_EVENT_COLOR} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10, marginBottom: 10 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.36)', paddingBottom: 2 }}>
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 10 }}>
            {calendarDays.map((day) => {
              const dayEvents = parsedEvents.filter((event) => isWithinInterval(day, { start: event.startDate, end: event.endDate }))
              const visibleEvents = dayEvents.slice(0, 4)
              const extraCount = Math.max(0, dayEvents.length - visibleEvents.length)
              const isToday = isSameDay(day, new Date())
              const inCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <div
                  key={day.toISOString()}
                  style={{
                    minHeight: 154,
                    borderRadius: 16,
                    border: `1px solid ${isToday ? 'rgba(184,149,106,0.58)' : 'rgba(240,236,228,0.08)'}`,
                    background: isToday
                      ? 'linear-gradient(180deg, rgba(184,149,106,0.12), rgba(240,236,228,0.03))'
                      : inCurrentMonth
                        ? 'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(255,255,255,0.01))'
                        : 'rgba(240,236,228,0.015)',
                    padding: 10,
                    opacity: inCurrentMonth ? 1 : 0.42,
                    boxShadow: isToday ? '0 0 0 1px rgba(184,149,106,0.15) inset' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{
                      fontFamily: "'Barlow Condensed', sans-serif",
                      fontWeight: 800,
                      fontSize: 20,
                      color: isToday ? '#f5d6ab' : '#f0ece4',
                    }}>
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 ? (
                      <span style={{ fontSize: 11, color: 'rgba(240,236,228,0.55)', padding: '3px 8px', borderRadius: 999, background: 'rgba(240,236,228,0.06)' }}>
                        {dayEvents.length} on road
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: 'grid', gap: 7 }}>
                    {dayEvents.length === 0 ? (
                      <div style={{ color: 'rgba(240,236,228,0.18)', fontSize: 12, paddingTop: 10 }}>No bookings</div>
                    ) : (
                      visibleEvents.map((event) => (
                        <div
                          key={`${day.toISOString()}-${event.id}`}
                          style={{
                            padding: '8px 9px',
                            borderRadius: 10,
                            background: event.palette.bg,
                            border: `1px solid ${event.palette.border}`,
                            boxShadow: `inset 3px 0 0 ${event.palette.accent}`,
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 999, background: event.palette.accent, flexShrink: 0 }} />
                            <div style={{ fontWeight: 700, fontSize: 12, color: event.palette.text, lineHeight: 1.2 }}>{event.title}</div>
                          </div>
                          <div style={{ color: 'rgba(240,236,228,0.65)', fontSize: 11, lineHeight: 1.3 }}>{event.subtitle}</div>
                        </div>
                      ))
                    )}
                    {extraCount > 0 ? <div style={{ color: 'rgba(240,236,228,0.48)', fontSize: 11, paddingLeft: 2 }}>+ {extraCount} more</div> : null}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={cardStyle}>
            <div style={sectionTitle}>Month overview</div>
            <div style={{ color: 'rgba(240,236,228,0.48)', fontSize: 13, marginBottom: 16 }}>
              Quick view of what is happening in {format(currentMonth, 'MMMM')}.
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10 }}>
              <StatCard label="Fleet rentals" value={String(monthStats.fleetCount)} accent="#d7bc94" />
              <StatCard label="Service departures" value={String(monthStats.serviceCount)} accent="#8ab2ff" />
              <StatCard label="Total items" value={String(monthStats.totalCount)} accent="#95efbe" />
              <StatCard label="Vehicle days busy" value={String(monthStats.fleetDays)} accent="#ceb4ff" />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Vehicle colour key</div>
            <div style={{ color: 'rgba(240,236,228,0.48)', fontSize: 13, marginBottom: 14 }}>
              Each vehicle keeps the same colour wherever it appears this month.
            </div>
            <div style={{ display: 'grid', gap: 10 }}>
              {monthStats.vehicleLegend.length === 0 ? (
                <div style={{ color: 'rgba(240,236,228,0.4)' }}>No fleet vehicles booked this month yet</div>
              ) : monthStats.vehicleLegend.map((vehicle) => (
                <div key={vehicle.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, background: vehicle.palette.soft, border: `1px solid ${vehicle.palette.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
                    <span style={{ width: 12, height: 12, borderRadius: 999, background: vehicle.palette.accent, flexShrink: 0 }} />
                    <span style={{ fontWeight: 700, color: '#f0ece4', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.label}</span>
                  </div>
                  <span style={{ fontSize: 12, color: 'rgba(240,236,228,0.6)', flexShrink: 0 }}>{vehicle.count} booking{vehicle.count === 1 ? '' : 's'}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Agenda</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {loading ? (
                <div style={{ color: 'rgba(240,236,228,0.4)' }}>Loading calendar…</div>
              ) : monthEvents.length === 0 ? (
                <div style={{ color: 'rgba(240,236,228,0.4)' }}>Nothing booked this month yet</div>
              ) : monthEvents
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                .map((event) => (
                  <div key={event.id} style={{ borderRadius: 14, border: `1px solid ${event.palette.border}`, padding: 14, background: event.palette.soft, boxShadow: `inset 3px 0 0 ${event.palette.accent}` }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: '#f0ece4' }}>{event.title}</div>
                        <div style={{ color: 'rgba(240,236,228,0.58)', fontSize: 12, marginTop: 4 }}>{event.subtitle}</div>
                      </div>
                      <span style={{
                        fontSize: 10,
                        letterSpacing: '0.12em',
                        textTransform: 'uppercase',
                        color: event.palette.text,
                        background: event.palette.bg,
                        border: `1px solid ${event.palette.border}`,
                        borderRadius: 999,
                        padding: '4px 8px',
                        flexShrink: 0,
                      }}>
                        {event.kind === 'fleet' ? event.label : 'Service'}
                      </span>
                    </div>
                    <div style={{ color: 'rgba(240,236,228,0.68)', fontSize: 12, marginTop: 10 }}>
                      {format(event.startDate, 'd MMM yyyy')}{!isSameDay(event.startDate, event.endDate) ? ` → ${format(event.endDate, 'd MMM yyyy')}` : ''}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getEventLabel(event: CalendarEvent) {
  if (event.kind !== 'fleet') return 'Service departure'
  const parts = event.subtitle.split('·').map((part) => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || event.title
}

function getEventColorKey(event: CalendarEvent) {
  if (event.kind !== 'fleet') return `tour:${event.id}`
  return `fleet:${getEventLabel(event).toLowerCase()}`
}

function getEventColor(event: CalendarEvent): EventColor {
  if (event.kind !== 'fleet') return TOUR_EVENT_COLOR
  const key = getEventColorKey(event)
  const hash = key.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return FLEET_EVENT_COLORS[hash % FLEET_EVENT_COLORS.length]
}

function LegendPill({ label, palette }: { label: string; palette: EventColor }) {
  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, padding: '7px 10px', background: palette.soft, border: `1px solid ${palette.border}` }}>
      <span style={{ width: 10, height: 10, borderRadius: 999, background: palette.accent }} />
      <span style={{ fontSize: 12, color: palette.text }}>{label}</span>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ borderRadius: 14, border: '1px solid rgba(240,236,228,0.10)', background: 'rgba(240,236,228,0.035)', padding: '14px 14px 12px' }}>
      <div style={{ color: 'rgba(240,236,228,0.52)', fontSize: 12, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, lineHeight: 1, color: accent }}>{value}</div>
    </div>
  )
}

const cardStyle = {
  background: '#1a1815',
  border: '1px solid rgba(240,236,228,0.12)',
  borderRadius: 18,
  padding: '20px 24px',
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
