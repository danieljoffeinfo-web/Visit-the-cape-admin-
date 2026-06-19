'use client'

import { cardStyle, pageTitle, sectionTitle, theme } from '@/lib/theme'

const PANEL_LABELS: Record<string, string> = {
  calendar: 'Calendar',
  fleet: 'Fleet Manager',
  socials: 'Socials',
  enquiries: 'Enquiries',
  tours: 'Tours & Pricing',
}

export function PlaceholderPanel({ id }: { id: string }) {
  return (
    <div>
      <h1 style={pageTitle}>{PANEL_LABELS[id] || id}</h1>
      <div style={{ ...cardStyle, padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.textFaint, marginBottom: 12 }}>Coming Soon</div>
        <div style={{ ...sectionTitle, fontSize: 24, marginBottom: 8 }}>{PANEL_LABELS[id] || id}</div>
        <div style={{ color: theme.textMuted, fontSize: 14 }}>This panel is under construction.</div>
      </div>
    </div>
  )
}
