'use client'

import type { BookingTab } from '@/lib/bookings'
import { BOOKING_TABS } from '@/lib/bookings'
import { theme } from '@/lib/theme'

export function BookingsTabBar({
  active,
  onChange,
}: {
  active: BookingTab
  onChange: (tab: BookingTab) => void
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        marginBottom: 20,
        background: theme.surfaceMuted,
        borderRadius: 8,
        padding: 4,
        flexWrap: 'wrap',
        border: `1px solid ${theme.border}`,
      }}
    >
      {BOOKING_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: '1 1 auto',
            minWidth: 90,
            padding: '9px 16px',
            borderRadius: 6,
            border: active === tab.id ? `1px solid ${theme.bronzeBorder}` : '1px solid transparent',
            cursor: 'pointer',
            background: active === tab.id ? theme.bronzeBg : 'transparent',
            color: active === tab.id ? theme.bronzeDark : theme.text,
            fontFamily: theme.headingFont,
            fontWeight: active === tab.id ? 800 : 700,
            fontSize: 15,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
