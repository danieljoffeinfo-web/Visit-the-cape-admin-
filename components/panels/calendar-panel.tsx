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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Calendar</h1>
          <p style={{ color: 'rgba(240,236,228,0.55)', fontSize: 13, marginTop: 2 }}>Fleet rentals and service departures now appear in one live planning calendar.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={() => setCurrentMonth((current) => subMonths(current, 1))} style={navButton}>←</button>
          <div style={{ minWidth: 170, textAlign: 'center', fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22 }}>{format(currentMonth, 'MMMM yyyy')}</div>
          <button onClick={() => setCurrentMonth((current) => addMonths(current, 1))} style={navButton}>→</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.9fr', gap: 20, alignItems: 'start' }}>
        <div style={cardStyle}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8, marginBottom: 8 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
              <div key={day} style={{ textAlign: 'center', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.38)', paddingBottom: 4 }}>{day}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 8 }}>
            {calendarDays.map((day) => {
              const dayEvents = parsedEvents.filter((event) => isWithinInterval(day, { start: event.startDate, end: event.endDate }))
              const isToday = isSameDay(day, new Date())
              return (
                <div key={day.toISOString()} style={{
                  minHeight: 130,
                  borderRadius: 8,
                  border: `1px solid ${isToday ? 'rgba(184,149,106,0.5)' : 'rgba(240,236,228,0.08)'}`,
                  background: isSameMonth(day, currentMonth) ? 'rgba(240,236,228,0.02)' : 'rgba(240,236,228,0.01)',
                  padding: 10,
                  opacity: isSameMonth(day, currentMonth) ? 1 : 0.45,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18 }}>{format(day, 'd')}</span>
                    {dayEvents.length > 0 && <span style={{ fontSize: 11, color: 'rgba(240,236,228,0.45)' }}>{dayEvents.length}</span>}
                  </div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {dayEvents.length === 0 ? (
                      <div style={{ color: 'rgba(240,236,228,0.18)', fontSize: 12 }}>No bookings</div>
                    ) : dayEvents.slice(0, 3).map((event) => (
                      <div key={`${day.toISOString()}-${event.id}`} style={{
                        padding: '7px 8px',
                        borderRadius: 6,
                        background: event.kind === 'fleet' ? 'rgba(184,149,106,0.18)' : 'rgba(100,149,237,0.16)',
                        border: `1px solid ${event.kind === 'fleet' ? 'rgba(184,149,106,0.28)' : 'rgba(100,149,237,0.24)'}`,
                      }}>
                        <div style={{ fontWeight: 700, fontSize: 12 }}>{event.title}</div>
                        <div style={{ color: 'rgba(240,236,228,0.5)', fontSize: 11, marginTop: 2 }}>{event.subtitle}</div>
                      </div>
                    ))}
                    {dayEvents.length > 3 && <div style={{ color: 'rgba(240,236,228,0.45)', fontSize: 11 }}>+ {dayEvents.length - 3} more</div>}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <div style={cardStyle}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Month Overview</div>
            <div style={{ color: 'rgba(240,236,228,0.45)', fontSize: 13, marginBottom: 16 }}>Quick count of what is happening in {format(currentMonth, 'MMMM')}.</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <StatLine label="Fleet rentals" value={String(monthEvents.filter((event) => event.kind === 'fleet').length)} />
              <StatLine label="Service departures" value={String(monthEvents.filter((event) => event.kind === 'tour').length)} />
              <StatLine label="Total calendar items" value={String(monthEvents.length)} />
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 10 }}>Agenda</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {loading ? (
                <div style={{ color: 'rgba(240,236,228,0.4)' }}>Loading calendar…</div>
              ) : monthEvents.length === 0 ? (
                <div style={{ color: 'rgba(240,236,228,0.4)' }}>Nothing booked this month yet</div>
              ) : monthEvents
                .sort((a, b) => a.startDate.getTime() - b.startDate.getTime())
                .map((event) => (
                  <div key={event.id} style={{ borderRadius: 8, border: '1px solid rgba(240,236,228,0.08)', padding: 12, background: 'rgba(240,236,228,0.02)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                      <div>
                        <div style={{ fontWeight: 700 }}>{event.title}</div>
                        <div style={{ color: 'rgba(240,236,228,0.45)', fontSize: 12, marginTop: 3 }}>{event.subtitle}</div>
                      </div>
                      <span style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: event.kind === 'fleet' ? '#d7bc94' : '#8ab2ff' }}>
                        {event.kind === 'fleet' ? 'Fleet' : 'Service'}
                      </span>
                    </div>
                    <div style={{ color: 'rgba(240,236,228,0.55)', fontSize: 12, marginTop: 8 }}>
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

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', borderRadius: 8, background: 'rgba(240,236,228,0.04)' }}>
      <span style={{ color: 'rgba(240,236,228,0.55)', fontSize: 13 }}>{label}</span>
      <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20 }}>{value}</span>
    </div>
  )
}

const cardStyle = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }
const navButton = { width: 36, height: 36, borderRadius: 6, border: '1px solid rgba(240,236,228,0.12)', background: 'transparent', color: '#f0ece4', cursor: 'pointer', fontSize: 16 }
