'use client'

import { theme } from '@/lib/theme'

export function PanelLoader() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: '8px 0' }}>
      <div style={{ height: 28, width: 180, borderRadius: 6, background: theme.surfaceMuted, opacity: 0.7 }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            style={{
              minHeight: 100,
              borderRadius: 10,
              border: `1px solid ${theme.border}`,
              background: theme.surface,
              padding: 20,
              opacity: 0.6,
            }}
          >
            <div style={{ height: 10, width: '50%', background: theme.surfaceMuted, borderRadius: 4, marginBottom: 12 }} />
            <div style={{ height: 32, width: '35%', background: theme.bronzeBg, borderRadius: 4 }} />
          </div>
        ))}
      </div>
      <div style={{ color: theme.textFaint, fontSize: 13 }}>Loading…</div>
    </div>
  )
}
