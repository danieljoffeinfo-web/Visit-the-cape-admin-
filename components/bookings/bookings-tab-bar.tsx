'use client'

import type { BookingTab } from '@/lib/bookings'
import { BOOKING_TABS } from '@/lib/bookings'

export function BookingsTabBar({
  active,
  onChange,
}: {
  active: BookingTab
  onChange: (tab: BookingTab) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'rgba(240,236,228,0.04)', borderRadius: 8, padding: 4, flexWrap: 'wrap' }}>
      {BOOKING_TABS.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          style={{
            flex: '1 1 auto',
            minWidth: 90,
            padding: '9px 16px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: active === tab.id ? '#1a1815' : 'transparent',
            color: active === tab.id ? '#b8956a' : 'rgba(240,236,228,0.55)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: active === tab.id ? 800 : 400,
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
