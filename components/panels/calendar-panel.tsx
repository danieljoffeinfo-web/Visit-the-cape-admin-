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
  isToday,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { toast } from 'sonner'
import { cardStyle, pageTitle, secondaryButton, sectionTitle, theme } from '@/lib/theme'

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
  { bg: 'rgba(184,149,106,0.16)', border: 'rgba(184,149,106,0.32)', text: '#6b5238', accent: '#b8956a', soft: 'rgba(184,149,106,0.08)' },
  { bg: 'rgba(61,139,99,0.12)', border: 'rgba(61,139,99,0.28)', text: '#2d5a42', accent: '#3d8b63', soft: 'rgba(61,139,99,0.06)' },
  { bg: 'rgba(100,149,237,0.12)', border: 'rgba(100,149,237,0.28)', text: '#3d5080', accent: '#6495ed', soft: 'rgba(100,149,237,0.06)' },
  { bg: 'rgba(196,92,74,0.10)', border: 'rgba(196,92,74,0.24)', text: '#7a3f35', accent: '#c45c4a', soft: 'rgba(196,92,74,0.06)' },
  { bg: 'rgba(142,106,216,0.12)', border: 'rgba(142,106,216,0.28)', text: '#4f3d70', accent: '#8e6ad8', soft: 'rgba(142,106,216,0.06)' },
  { bg: 'rgba(0,150,167,0.10)', border: 'rgba(0,150,167,0.24)', text: '#2d5f66', accent: '#0096a7', soft: 'rgba(0,150,167,0.06)' },
  { bg: 'rgba(210,120,60,0.12)', border: 'rgba(210,120,60,0.28)', text: '#6b4528', accent: '#d2783c', soft: 'rgba(210,120,60,0.06)' },
  { bg: 'rgba(180,140,50,0.12)', border: 'rgba(180,140,50,0.28)', text: '#5c4820', accent: '#b48c32', soft: 'rgba(180,140,50,0.06)' },
]

const TOUR_EVENT_COLOR: EventColor = {
  bg: 'rgba(100,149,237,0.14)',
  border: 'rgba(100,149,237,0.30)',
  text: '#3d5080',
  accent: '#6495ed',
  soft: 'rgba(100,149,237,0.08)',
}

export function CalendarPanel() {
  const [currentMonth, setCurrentMonth] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(new Date())
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
      label: getEventLabel(event),
      meta: getEventMeta(event),
      colorKey: getEventColorKey(event),
      palette: getEventColor(event),
    }))
  }, [events])

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

  const monthStats = useMemo(() => {
    const fleetEvents = monthEvents.filter((event) => event.kind === 'fleet')
    const serviceEvents = monthEvents.filter((event) => event.kind === 'tour')
    const vehicleCounts = new Map<string, { label: string; count: number; palette: EventColor }>()

    for (const event of fleetEvents) {
      const current = vehicleCounts.get(event.colorKey)
      if (current) current.count += 1
      else vehicleCounts.set(event.colorKey, { label: event.label, count: 1, palette: event.palette })
    }

    return {
      fleetCount: fleetEvents.length,
      serviceCount: serviceEvents.length,
      totalCount: monthEvents.length,
      vehicleLegend: Array.from(vehicleCounts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }
  }, [monthEvents])

  function goToToday() {
    const today = new Date()
    setCurrentMonth(startOfMonth(today))
    setSelectedDate(today)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Calendar</h1>
          <p style={{ color: theme.textMuted, fontSize: 14, margin: '6px 0 0', maxWidth: 720 }}>
            Fleet rentals and service departures at a glance. Click a day to see full booking details.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button type="button" onClick={goToToday} style={{ ...secondaryButton, padding: '8px 14px' }}>
            Today
          </button>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              borderRadius: 999,
              background: theme.surface,
              border: `1px solid ${theme.border}`,
              boxShadow: '0 1px 2px rgba(44, 38, 32, 0.04)',
            }}
          >
            <button type="button" onClick={() => setCurrentMonth((current) => subMonths(current, 1))} style={navButton} aria-label="Previous month">
              ←
            </button>
            <div style={{ minWidth: 168, textAlign: 'center', fontFamily: theme.headingFont, fontWeight: 800, fontSize: 22, color: theme.text }}>
              {format(currentMonth, 'MMMM yyyy')}
            </div>
            <button type="button" onClick={() => setCurrentMonth((current) => addMonths(current, 1))} style={navButton} aria-label="Next month">
              →
            </button>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(320px, 0.85fr)', gap: 20, alignItems: 'start' }}>
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <div>
              <div style={sectionTitle}>Monthly planner</div>
              <div style={subtleText}>Fleet vehicles and tour departures across the month.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <LegendPill label="Fleet vehicle" palette={FLEET_EVENT_COLORS[0]} />
              <LegendPill label="Service departure" palette={TOUR_EVENT_COLOR} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6, marginBottom: 6 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.textFaint, padding: '4px 0' }}>
                {day}
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
            {calendarDays.map((day) => {
              const dayEvents = parsedEvents
                .filter((event) => isWithinInterval(day, { start: event.startDate, end: event.endDate }))
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
              const visibleEvents = dayEvents.slice(0, 3)
              const extraCount = Math.max(0, dayEvents.length - visibleEvents.length)
              const today = isToday(day)
              const selected = isSameDay(day, selectedDate)
              const inCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => setSelectedDate(day)}
                  style={{
                    minHeight: 96,
                    borderRadius: 10,
                    border: `1px solid ${selected ? theme.bronze : today ? theme.bronzeBorder : theme.border}`,
                    background: selected ? theme.bronzeBg : today ? theme.surfaceMuted : theme.surface,
                    padding: 8,
                    opacity: inCurrentMonth ? 1 : 0.38,
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: selected ? `0 0 0 1px ${theme.bronzeBorder}` : 'none',
                    transition: 'border-color 0.15s ease, background 0.15s ease',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6, gap: 4 }}>
                    <span
                      style={{
                        fontFamily: theme.headingFont,
                        fontWeight: 800,
                        fontSize: 16,
                        color: selected || today ? theme.bronzeDark : theme.text,
                        width: 28,
                        height: 28,
                        borderRadius: 999,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: today && !selected ? theme.bronzeBg : 'transparent',
                      }}
                    >
                      {format(day, 'd')}
                    </span>
                    {dayEvents.length > 0 ? (
                      <span style={{ fontSize: 10, fontWeight: 700, color: theme.bronzeDark, padding: '2px 6px', borderRadius: 999, background: theme.bronzeBg }}>
                        {dayEvents.length}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: 'grid', gap: 4 }}>
                    {visibleEvents.map((event) => (
                      <div
                        key={`${day.toISOString()}-${event.id}`}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 5,
                          minWidth: 0,
                          padding: '4px 6px',
                          borderRadius: 6,
                          background: event.palette.bg,
                          border: `1px solid ${event.palette.border}`,
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: 999, background: event.palette.accent, flexShrink: 0 }} />
                        <span style={{ fontSize: 10, fontWeight: 600, color: event.palette.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {event.label}
                        </span>
                      </div>
                    ))}
                    {extraCount > 0 ? <div style={{ fontSize: 10, color: theme.textFaint, paddingLeft: 2 }}>+{extraCount} more</div> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <div style={sectionTitle}>Selected day</div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 24, color: theme.text, marginBottom: 4 }}>
              {format(selectedDate, 'EEEE, d MMMM')}
            </div>
            <div style={subtleText}>
              {selectedDayEvents.length === 0
                ? 'No vehicles on the road for this date.'
                : `${selectedDayEvents.length} booking${selectedDayEvents.length === 1 ? '' : 's'} on this date.`}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>Schedule details</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {loading ? (
                <div style={{ color: theme.textFaint }}>Loading calendar…</div>
              ) : selectedDayEvents.length === 0 ? (
                <div style={{ color: theme.textFaint, padding: '12px 0' }}>Nothing booked for this date.</div>
              ) : (
                selectedDayEvents.map((event) => (
                  <div
                    key={event.id}
                    style={{
                      borderRadius: 10,
                      border: `1px solid ${event.palette.border}`,
                      background: event.palette.soft,
                      padding: 14,
                      boxShadow: `inset 3px 0 0 ${event.palette.accent}`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, color: theme.text, fontSize: 15 }}>{event.title}</div>
                        <div style={{ color: event.palette.text, fontSize: 12, marginTop: 4 }}>{event.label}</div>
                      </div>
                      <span
                        style={{
                          fontSize: 10,
                          letterSpacing: '0.1em',
                          textTransform: 'uppercase',
                          color: event.palette.text,
                          background: event.palette.bg,
                          border: `1px solid ${event.palette.border}`,
                          borderRadius: 999,
                          padding: '4px 8px',
                          flexShrink: 0,
                          fontWeight: 600,
                        }}
                      >
                        {event.kind === 'fleet' ? 'Vehicle' : 'Service'}
                      </span>
                    </div>
                    <div style={{ color: theme.textMuted, fontSize: 12, marginTop: 8, lineHeight: 1.45 }}>{event.meta}</div>
                    <div style={{ color: theme.textFaint, fontSize: 12, marginTop: 10 }}>
                      {format(event.startDate, 'd MMM yyyy')}
                      {!isSameDay(event.startDate, event.endDate) ? ` → ${format(event.endDate, 'd MMM yyyy')}` : ''}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>Month overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard label="Fleet" value={String(monthStats.fleetCount)} accent={theme.bronzeDark} />
              <StatCard label="Service" value={String(monthStats.serviceCount)} accent="#6495ed" />
              <StatCard label="Total" value={String(monthStats.totalCount)} accent={theme.success} />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {monthStats.vehicleLegend.length === 0 ? (
                <div style={{ color: theme.textFaint }}>No fleet vehicles booked this month yet.</div>
              ) : (
                monthStats.vehicleLegend.map((vehicle) => (
                  <div
                    key={vehicle.label}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: vehicle.palette.soft,
                      border: `1px solid ${vehicle.palette.border}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 8, height: 8, borderRadius: 999, background: vehicle.palette.accent, flexShrink: 0 }} />
                      <span style={{ fontSize: 12, fontWeight: 600, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {vehicle.label}
                      </span>
                    </div>
                    <span style={{ fontSize: 11, color: theme.textMuted, flexShrink: 0 }}>{vehicle.count}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function getEventLabel(event: CalendarEvent) {
  if (event.kind !== 'fleet') return event.title
  const parts = event.subtitle.split('·').map((part) => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || event.title
}

function getEventMeta(event: CalendarEvent) {
  if (event.kind !== 'fleet') return event.subtitle
  const parts = event.subtitle.split('·').map((part) => part.trim()).filter(Boolean)
  if (parts.length <= 1) return event.subtitle
  return parts.slice(0, parts.length - 1).join(' • ')
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
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, borderRadius: 999, padding: '6px 10px', background: palette.soft, border: `1px solid ${palette.border}` }}>
      <span style={{ width: 8, height: 8, borderRadius: 999, background: palette.accent }} />
      <span style={{ fontSize: 12, color: palette.text, fontWeight: 600 }}>{label}</span>
    </div>
  )
}

function StatCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div style={{ borderRadius: 10, border: `1px solid ${theme.border}`, background: theme.surfaceMuted, padding: '12px 12px 10px' }}>
      <div style={{ color: theme.textFaint, fontSize: 11, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontFamily: theme.headingFont, fontWeight: 900, fontSize: 24, lineHeight: 1, color: accent }}>{value}</div>
    </div>
  )
}

const navButton = {
  width: 36,
  height: 36,
  borderRadius: 999,
  border: `1px solid ${theme.border}`,
  background: theme.surfaceMuted,
  color: theme.text,
  cursor: 'pointer',
  fontSize: 16,
  fontFamily: theme.bodyFont,
} as const

const subtleText = {
  color: theme.textMuted,
  fontSize: 13,
  marginTop: 4,
}
