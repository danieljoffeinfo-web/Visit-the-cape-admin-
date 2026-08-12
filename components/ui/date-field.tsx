'use client'

import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { panelStyle, useAnchoredPopover } from '@/components/ui/popover'
import { fieldLabel, inputStyle, theme } from '@/lib/theme'

const WEEKDAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su']
const ISO = 'yyyy-MM-dd'

function parseValue(value: string): Date | null {
  if (!value) return null
  const parsed = parseISO(value)
  return isValid(parsed) ? parsed : null
}

/**
 * The console's date picker.
 *
 * `<input type="date">` renders whatever calendar the browser ships — on
 * Safari a segmented dd/mm/yyyy field with a system popover that ignores the
 * console's palette entirely.
 *
 * Weeks start on Monday, which is how a tour operator reads a week; the native
 * control starts on Sunday and offers no say in it. Dates are still held as
 * ISO `yyyy-MM-dd` strings so every caller and API is untouched.
 */
export function DateField({
  label,
  value,
  onChange,
  min,
  disabled,
}: {
  label?: string
  value: string
  onChange: (value: string) => void
  /** Earliest selectable day, ISO. Days before it are shown but not clickable. */
  min?: string
  disabled?: boolean
}) {
  const { open, setOpen, mounted, position, triggerRef, panelRef } =
    useAnchoredPopover<HTMLButtonElement>(330)
  const selected = parseValue(value)
  const minDate = min ? parseValue(min) : null
  const [month, setMonth] = useState(() => startOfMonth(selected || new Date()))

  /* Reopening on a date set elsewhere — Days changing the end date, say —
     should show the month that date is in, not the one last browsed to. */
  useEffect(() => {
    if (open) setMonth(startOfMonth(parseValue(value) || new Date()))
  }, [open, value])

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
    end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
  })

  function pick(day: Date) {
    onChange(format(day, ISO))
    setOpen(false)
    triggerRef.current?.focus()
  }

  const control = (
    <button
      type="button"
      ref={triggerRef}
      disabled={disabled}
      onClick={() => !disabled && setOpen(!open)}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && open) {
          event.preventDefault()
          setOpen(false)
        }
      }}
      aria-haspopup="dialog"
      aria-expanded={open}
      style={{
        ...inputStyle,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 10,
        textAlign: 'left',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        borderColor: open ? theme.bronzeBorder : theme.border,
      }}
    >
      <span style={{ color: selected ? theme.text : theme.textFaint }}>
        {selected ? format(selected, 'd MMM yyyy') : 'Pick a date'}
      </span>
      <span aria-hidden style={{ flexShrink: 0, color: theme.bronzeDark, fontSize: 13 }}>
        ▦
      </span>
    </button>
  )

  const panel =
    open && mounted
      ? createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Choose a date"
            style={{
              ...panelStyle,
              top: position.top,
              left: position.left,
              width: 268,
              background: theme.surface,
              border: `1px solid ${theme.borderStrong}`,
              boxShadow: theme.modalShadow,
              padding: 12,
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: 10,
              }}
            >
              <MonthButton label="‹" onClick={() => setMonth(addMonths(month, -1))} title="Previous month" />
              <span
                style={{
                  fontFamily: theme.headingFont,
                  fontWeight: 800,
                  fontSize: 15,
                  letterSpacing: '0.04em',
                  textTransform: 'uppercase',
                  color: theme.text,
                }}
              >
                {format(month, 'MMMM yyyy')}
              </span>
              <MonthButton label="›" onClick={() => setMonth(addMonths(month, 1))} title="Next month" />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
              {WEEKDAYS.map((day) => (
                <div
                  key={day}
                  style={{
                    textAlign: 'center',
                    fontSize: 10,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: theme.textFaint,
                    padding: '2px 0 4px',
                  }}
                >
                  {day}
                </div>
              ))}

              {days.map((day) => {
                const outside = !isSameMonth(day, month)
                const isSelected = selected ? isSameDay(day, selected) : false
                const isToday = isSameDay(day, startOfDay(new Date()))
                const blocked = minDate ? startOfDay(day) < startOfDay(minDate) : false
                return (
                  <button
                    key={day.toISOString()}
                    type="button"
                    disabled={blocked}
                    onClick={() => pick(day)}
                    aria-current={isToday ? 'date' : undefined}
                    style={{
                      padding: '7px 0',
                      borderRadius: 6,
                      fontSize: 13,
                      fontFamily: theme.bodyFont,
                      fontWeight: isSelected ? 800 : isToday ? 700 : 500,
                      cursor: blocked ? 'not-allowed' : 'pointer',
                      background: isSelected ? theme.bronze : 'transparent',
                      color: blocked
                        ? theme.textFaint
                        : isSelected
                          ? '#ffffff'
                          : outside
                            ? theme.textFaint
                            : theme.text,
                      border: isSelected
                        ? `1px solid ${theme.bronze}`
                        : isToday
                          ? `1px solid ${theme.bronzeBorder}`
                          : '1px solid transparent',
                      opacity: blocked ? 0.4 : 1,
                    }}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>

            <button
              type="button"
              onClick={() => pick(new Date())}
              style={{
                marginTop: 10,
                width: '100%',
                padding: '7px 0',
                borderRadius: 6,
                border: `1px solid ${theme.bronzeBorder}`,
                background: theme.surface,
                color: theme.bronzeDark,
                fontFamily: theme.bodyFont,
                fontWeight: 600,
                fontSize: 12,
                cursor: 'pointer',
              }}
            >
              Today
            </button>
          </div>,
          document.body,
        )
      : null

  if (!label) {
    return (
      <>
        {control}
        {panel}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      {control}
      {panel}
    </div>
  )
}

function MonthButton({ label, onClick, title }: { label: string; onClick: () => void; title: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={title}
      style={{
        width: 26,
        height: 26,
        borderRadius: 6,
        border: `1px solid ${theme.border}`,
        background: theme.surface,
        color: theme.bronzeDark,
        cursor: 'pointer',
        fontSize: 15,
        lineHeight: 1,
        fontFamily: theme.bodyFont,
      }}
    >
      {label}
    </button>
  )
}
