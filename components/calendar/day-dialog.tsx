'use client'

import { format, isSameDay } from 'date-fns'
import { useEffect } from 'react'
import { secondaryButton, theme } from '@/lib/theme'

export type DayDialogEvent = {
  id: string
  kind: 'fleet' | 'tour' | 'addon'
  label: string
  meta: string
  startDate: Date
  endDate: Date
  palette: { bg: string; border: string; text: string; accent: string; soft: string }
}

const KIND_LABEL: Record<DayDialogEvent['kind'], string> = {
  fleet: 'Vehicle',
  addon: 'Experience',
  tour: 'Departure',
}

/**
 * Everything happening on one day.
 *
 * A day cell is a fixed box in a seven-column grid, so it can only ever show
 * two or three bookings however the numbers fall — and a busy Saturday is
 * exactly the day someone needs to read in full. The cell shows what fits and
 * this shows the rest, scrolling rather than truncating, so the number of
 * bookings a day can hold stops being a function of how tall a cell is.
 */
export function DayDialog({
  date,
  events,
  onClose,
}: {
  date: Date | null
  events: DayDialogEvent[]
  onClose: () => void
}) {
  useEffect(() => {
    if (!date) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [date, onClose])

  if (!date) return null

  return (
    <div
      className="admin-modal-overlay cal-day-dialog"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 300,
        background: theme.modalOverlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Bookings on ${format(date, 'd MMMM yyyy')}`}
        className="admin-modal"
        style={{
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.modalShadow,
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3
              style={{
                fontFamily: theme.headingFont,
                fontWeight: 800,
                fontSize: 22,
                letterSpacing: '0.03em',
                textTransform: 'uppercase',
                color: theme.text,
                margin: 0,
              }}
            >
              {format(date, 'EEEE d MMMM yyyy')}
            </h3>
            <p style={{ fontSize: 13, color: theme.textMuted, margin: '4px 0 0' }}>
              {events.length === 0
                ? 'Nothing booked on this day.'
                : `${events.length} booking${events.length === 1 ? '' : 's'} on this day.`}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ ...secondaryButton, padding: '6px 10px' }}
          >
            ✕
          </button>
        </div>

        {events.length > 0 && (
          <div style={{ display: 'grid', gap: 10, marginTop: 18, overflowY: 'auto' }}>
            {events.map((event) => (
              <div
                key={event.id}
                style={{
                  borderRadius: 10,
                  border: `1px solid ${event.palette.border}`,
                  background: event.palette.soft,
                  padding: '14px 16px',
                  boxShadow: `inset 3px 0 0 ${event.palette.accent}`,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'flex-start' }}>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 15.5, color: theme.text }}>{event.label}</div>
                    <div style={{ fontSize: 13, color: event.palette.text, marginTop: 3 }}>{event.meta}</div>
                  </div>
                  <span
                    style={{
                      flexShrink: 0,
                      fontSize: 10,
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      color: event.palette.text,
                      background: event.palette.bg,
                      border: `1px solid ${event.palette.border}`,
                      borderRadius: 999,
                      padding: '4px 9px',
                    }}
                  >
                    {KIND_LABEL[event.kind]}
                  </span>
                </div>
                {/* Only worth saying on a booking that spans days — on a
                    single-day one it would just repeat the heading. */}
                {!isSameDay(event.startDate, event.endDate) && (
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 9 }}>
                    {format(event.startDate, 'd MMM yyyy')} → {format(event.endDate, 'd MMM yyyy')}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
