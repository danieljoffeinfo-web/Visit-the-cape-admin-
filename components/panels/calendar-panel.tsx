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
import { cardStyle, pageTitle, sectionTitle, theme } from '@/lib/theme'

type CalendarEvent = {
  id: string
  kind: 'fleet' | 'tour' | 'addon'
  title: string
  subtitle: string
  /** Who booked it — the company where there is one. Null for a departure. */
  customer?: string | null
  /** The supporting line: usage and registration, pax, or departure time. */
  detail?: string | null
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
  { bg: 'rgba(184,149,106,0.18)', border: 'rgba(184,149,106,0.34)', text: '#8a6e4a', accent: '#b8956a', soft: 'rgba(184,149,106,0.08)' },
  { bg: 'rgba(61,139,99,0.14)', border: 'rgba(61,139,99,0.28)', text: '#2d6b4a', accent: '#3d8b63', soft: 'rgba(61,139,99,0.08)' },
  { bg: 'rgba(100,149,237,0.14)', border: 'rgba(100,149,237,0.28)', text: '#3a5f9e', accent: '#6495ed', soft: 'rgba(100,149,237,0.08)' },
  { bg: 'rgba(196,92,74,0.12)', border: 'rgba(196,92,74,0.28)', text: '#9e4a3d', accent: '#c45c4a', soft: 'rgba(196,92,74,0.08)' },
  { bg: 'rgba(142,106,216,0.14)', border: 'rgba(142,106,216,0.28)', text: '#5c4494', accent: '#8e6ad8', soft: 'rgba(142,106,216,0.08)' },
  { bg: 'rgba(0,188,212,0.12)', border: 'rgba(0,188,212,0.28)', text: '#1a7a86', accent: '#00bcd4', soft: 'rgba(0,188,212,0.08)' },
  { bg: 'rgba(255,112,67,0.12)', border: 'rgba(255,112,67,0.28)', text: '#b54d2a', accent: '#ff7043', soft: 'rgba(255,112,67,0.08)' },
  { bg: 'rgba(244,197,66,0.16)', border: 'rgba(244,197,66,0.30)', text: '#8a6f1f', accent: '#c9a227', soft: 'rgba(244,197,66,0.08)' },
]

const TOUR_EVENT_COLOR: EventColor = {
  bg: 'rgba(122,169,255,0.16)',
  border: 'rgba(122,169,255,0.30)',
  text: '#3a5f9e',
  accent: '#7aa9ff',
  soft: 'rgba(122,169,255,0.08)',
}

/* Experiences get their own colour rather than sharing the departure blue.
   A vehicle, a departure and an experience are three different things to have
   to arrange on a given day, and the sheet is read at a glance. */
const ADDON_EVENT_COLOR: EventColor = {
  bg: 'rgba(93,168,140,0.16)',
  border: 'rgba(93,168,140,0.32)',
  text: '#2f6b53',
  accent: '#5da88c',
  soft: 'rgba(93,168,140,0.08)',
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
    const addOnEvents = monthEvents.filter((event) => event.kind === 'addon')
    const vehicleCounts = new Map<string, { label: string; count: number; palette: EventColor }>()

    for (const event of fleetEvents) {
      const current = vehicleCounts.get(event.colorKey)
      if (current) current.count += 1
      else vehicleCounts.set(event.colorKey, { label: event.title, count: 1, palette: event.palette })
    }

    return {
      fleetCount: fleetEvents.length,
      serviceCount: serviceEvents.length,
      addOnCount: addOnEvents.length,
      totalCount: monthEvents.length,
      vehicleLegend: Array.from(vehicleCounts.values()).sort((a, b) => b.count - a.count || a.label.localeCompare(b.label)),
    }
  }, [monthEvents])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Calendar</h1>
          <p style={{ color: theme.textMuted, fontSize: 13, margin: 0, maxWidth: 720 }}>
            Cleaner monthly planner for fleet vehicles and service departures. Click any day to view the full booking details on the right.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 999, background: theme.surfaceMuted, border: `1px solid ${theme.border}` }}>
          <button onClick={() => setCurrentMonth((current) => subMonths(current, 1))} style={navButton}>←</button>
          <div style={{ minWidth: 180, textAlign: 'center', fontFamily: theme.headingFont, fontWeight: 800, fontSize: 24, color: theme.text }}>{format(currentMonth, 'MMMM yyyy')}</div>
          <button onClick={() => setCurrentMonth((current) => addMonths(current, 1))} style={navButton}>→</button>
        </div>
        <button
          type="button"
          className="cal-print-button"
          onClick={() => window.print()}
          style={{ ...navButton, width: 'auto', padding: '0 16px', borderRadius: 999 }}
          title="Print this month with every booking listed in full"
        >
          Print month
        </button>
      </div>

      {/* Paper only. The screen names the month in the nav pill, which is a
          control and is hidden when printing. */}
      <div className="cal-print-header">
        <h2>{format(currentMonth, 'MMMM yyyy')} — Visit The Cape</h2>
        <span>Printed {format(new Date(), 'd MMM yyyy, HH:mm')}</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.75fr) minmax(320px, 0.85fr)', gap: 20, alignItems: 'start' }} className="admin-grid-calendar cal-main">
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
            <div>
              <div style={sectionTitle}>Monthly planner</div>
              <div style={subtleText}>Compact day cells. Booking details stay in the side panel instead of filling the whole grid.</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <LegendPill label="Fleet vehicle" palette={FLEET_EVENT_COLORS[0]} />
              <LegendPill label="Service departure" palette={TOUR_EVENT_COLOR} />
              <LegendPill label="Experience" palette={ADDON_EVENT_COLOR} />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} style={{ textAlign: 'left', fontSize: 11, letterSpacing: '0.14em', textTransform: 'uppercase', color: theme.textFaint, padding: '0 4px' }}>{day}</div>
            ))}
          </div>

          <div className="cal-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
            {calendarDays.map((day) => {
              const dayEvents = parsedEvents
                .filter((event) => isWithinInterval(day, { start: event.startDate, end: event.endDate }))
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
              /* Every event is rendered. The screen still shows two — the cell
                 is small and the side panel carries the detail — but it hides
                 the rest with CSS rather than never emitting them, so print can
                 reveal the lot. Slicing here meant a printed page silently
                 dropped bookings. */
              const extraCount = Math.max(0, dayEvents.length - 2)
              const isToday = isSameDay(day, new Date())
              const isSelected = isSameDay(day, selectedDate)
              const inCurrentMonth = isSameMonth(day, currentMonth)

              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  className="cal-day"
                  onClick={() => setSelectedDate(day)}
                  style={{
                    minHeight: 132,
                    borderRadius: 14,
                    border: `1px solid ${isSelected ? theme.bronzeBorder : isToday ? 'rgba(122,169,255,0.34)' : theme.border}`,
                    background: isSelected ? theme.bronzeBg : isToday ? 'rgba(122,169,255,0.08)' : theme.surface,
                    padding: 10,
                    opacity: inCurrentMonth ? 1 : 0.45,
                    textAlign: 'left',
                    cursor: 'pointer',
                    boxShadow: isSelected ? `0 0 0 1px ${theme.bronzeBorder} inset` : '0 1px 3px rgba(44, 38, 32, 0.04)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8, gap: 6 }}>
                    <span style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 20, color: isSelected ? theme.bronzeDark : theme.text }}>{format(day, 'd')}</span>
                    {dayEvents.length > 0 ? (
                      <span style={{ fontSize: 10, color: theme.textMuted, padding: '3px 7px', borderRadius: 999, background: theme.surfaceMuted }}>
                        {dayEvents.length}
                      </span>
                    ) : null}
                  </div>

                  <div style={{ display: 'grid', gap: 6 }}>
                    {dayEvents.map((event) => (
                      <div
                        key={`${day.toISOString()}-${event.id}`}
                        className="cal-event"
                        style={{
                          display: 'flex',
                          alignItems: 'flex-start',
                          gap: 7,
                          minWidth: 0,
                          padding: '6px 8px',
                          borderRadius: 8,
                          background: event.palette.bg,
                          borderLeft: `3px solid ${event.palette.accent}`,
                          border: `1px solid ${event.palette.border}`,
                          borderLeftWidth: 3,
                          borderLeftColor: event.palette.accent,
                        }}
                      >
                        <span style={{ minWidth: 0, display: 'block' }}>
                          <span
                            style={{
                              display: 'block',
                              fontSize: 11.5,
                              fontWeight: 700,
                              color: event.palette.text,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {event.label}
                          </span>
                          <span
                            className="cal-event-meta"
                            style={{
                              display: 'block',
                              fontSize: 10.5,
                              color: theme.textMuted,
                              overflow: 'hidden',
                              textOverflow: 'ellipsis',
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {event.meta}
                          </span>
                        </span>
                      </div>
                    ))}
                    {extraCount > 0 ? <div className="cal-more" style={{ fontSize: 11, color: theme.textMuted, paddingLeft: 2 }}>+{extraCount} more</div> : null}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={cardStyle}>
            <div style={sectionTitle}>Selected day</div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 26, marginBottom: 6, color: theme.text }}>{format(selectedDate, 'EEEE, d MMMM yyyy')}</div>
            <div style={subtleText}>{selectedDayEvents.length === 0 ? 'No vehicles on the road for this date.' : `${selectedDayEvents.length} booking${selectedDayEvents.length === 1 ? '' : 's'} on this date.`}</div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Schedule details</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {loading ? (
                <div style={{ color: theme.textFaint }}>Loading calendar…</div>
              ) : selectedDayEvents.length === 0 ? (
                <div style={{ color: theme.textFaint }}>Nothing booked for this date.</div>
              ) : selectedDayEvents.map((event) => (
                <div key={event.id} style={{ borderRadius: 14, border: `1px solid ${event.palette.border}`, background: event.palette.soft, padding: 14, boxShadow: `inset 3px 0 0 ${event.palette.accent}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontWeight: 800, color: theme.text, fontSize: 15 }}>{event.label}</div>
                      <div style={{ color: event.palette.text, fontSize: 12.5, marginTop: 4 }}>{event.meta}</div>
                    </div>
                    <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: event.palette.text, background: event.palette.bg, border: `1px solid ${event.palette.border}`, borderRadius: 999, padding: '4px 8px', flexShrink: 0 }}>
                      {event.kind === 'fleet' ? 'Vehicle' : event.kind === 'addon' ? 'Experience' : 'Service'}
                    </span>
                  </div>
                  <div style={{ color: theme.textFaint, fontSize: 12, marginTop: 10 }}>
                    {format(event.startDate, 'd MMM yyyy')}{!isSameDay(event.startDate, event.endDate) ? ` → ${format(event.endDate, 'd MMM yyyy')}` : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={sectionTitle}>Month overview</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginBottom: 14 }}>
              <StatCard label="Fleet" value={String(monthStats.fleetCount)} accent={theme.bronzeDark} />
              <StatCard label="Service" value={String(monthStats.serviceCount)} accent="#4a6fa5" />
              <StatCard label="Experiences" value={String(monthStats.addOnCount)} accent={ADDON_EVENT_COLOR.text} />
              <StatCard label="Total" value={String(monthStats.totalCount)} accent={theme.success} />
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {monthStats.vehicleLegend.length === 0 ? (
                <div style={{ color: theme.textFaint }}>No fleet vehicles booked this month yet.</div>
              ) : monthStats.vehicleLegend.map((vehicle) => (
                <div key={vehicle.label} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '8px 10px', borderRadius: 12, background: vehicle.palette.soft, border: `1px solid ${vehicle.palette.border}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                    <span style={{ width: 10, height: 10, borderRadius: 999, background: vehicle.palette.accent, flexShrink: 0 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{vehicle.label}</span>
                  </div>
                  <span style={{ fontSize: 11, color: theme.textMuted, flexShrink: 0 }}>{vehicle.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Every booking in the month, day by day, with the detail a day cell has
          no room for. Print-only: on screen the side panel already answers this
          for the selected day, but a printout has no selected day and nothing
          to click, so without this it is a grid of names with no dates,
          vehicles or customers against them. */}
      <div className="cal-agenda">
        <h3>Bookings in {format(currentMonth, 'MMMM yyyy')}</h3>
        {monthEvents.length === 0 ? (
          <p>No bookings this month.</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Dates</th>
                <th>Type</th>
                <th>Client</th>
                <th>Vehicle / Experience</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {[...monthEvents]
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                .map((event) => (
                  <tr key={`agenda-${event.id}`}>
                    <td>
                      {format(event.startDate, 'EEE d MMM')}
                      {!isSameDay(event.startDate, event.endDate)
                        ? ` \u2192 ${format(event.endDate, 'EEE d MMM')}`
                        : ''}
                    </td>
                    <td>{event.kind === 'fleet' ? 'Fleet' : event.kind === 'addon' ? 'Experience' : 'Departure'}</td>
                    <td>{event.customer || '\u2014'}</td>
                    <td>{event.title}</td>
                    <td>{event.detail || event.subtitle || '\u2014'}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

/**
 * The line a cell leads with.
 *
 * Tanya asked for the client on the calendar, and she is right about which
 * question it answers: a day cell is read to find out who is out and who to
 * ring, not to be told a registration number that means nothing until you are
 * standing next to the vehicle. So the customer leads where there is one, and
 * the vehicle or experience becomes the supporting line.
 */
function getEventLabel(event: CalendarEvent) {
  if (event.customer) return event.customer
  if (event.kind !== 'fleet') return event.title
  /* Falls back to the old packed subtitle, so a cached page from before the
     API carried these fields still renders something sensible. */
  const parts = event.subtitle.split('·').map((part) => part.trim()).filter(Boolean)
  return parts[parts.length - 1] || event.title
}

function getEventMeta(event: CalendarEvent) {
  const parts = [event.title, event.detail].filter(Boolean)
  if (event.customer && parts.length > 0) return parts.join(' · ')
  if (event.kind !== 'fleet') return event.subtitle
  const split = event.subtitle.split('·').map((part) => part.trim()).filter(Boolean)
  if (split.length <= 1) return event.subtitle
  return split.slice(0, split.length - 1).join(' • ')
}

function getEventColorKey(event: CalendarEvent) {
  if (event.kind === 'addon') return `addon:${event.id}`
  if (event.kind !== 'fleet') return `tour:${event.id}`
  /* Keyed on the vehicle so one vehicle keeps one colour across the month.
     Keying on the label would now colour by CUSTOMER, and the legend below
     names vehicles. */
  return `fleet:${event.title.toLowerCase()}`
}

function getEventColor(event: CalendarEvent): EventColor {
  if (event.kind === 'addon') return ADDON_EVENT_COLOR
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
    <div style={{ borderRadius: 12, border: `1px solid ${theme.border}`, background: theme.surfaceMuted, padding: '12px 12px 10px' }}>
      <div style={{ color: theme.textMuted, fontSize: 11, marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: theme.headingFont, fontWeight: 900, fontSize: 26, lineHeight: 1, color: accent }}>{value}</div>
    </div>
  )
}

const navButton = {
  width: 38,
  height: 38,
  borderRadius: 999,
  border: `1px solid ${theme.border}`,
  background: theme.surface,
  color: theme.text,
  cursor: 'pointer',
  fontSize: 16,
}

const subtleText = {
  color: theme.textMuted,
  fontSize: 13,
}
