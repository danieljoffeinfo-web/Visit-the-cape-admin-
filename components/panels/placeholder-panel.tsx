'use client'

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
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 24 }}>
        {PANEL_LABELS[id] || id}
      </h1>
      <div style={{ background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '48px 32px', textAlign: 'center' }}>
        <div style={{ fontSize: 11, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)', marginBottom: 12 }}>Coming Soon</div>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24, marginBottom: 8 }}>{PANEL_LABELS[id] || id}</div>
        <div style={{ color: 'rgba(240,236,228,0.45)', fontSize: 14 }}>This panel is under construction.</div>
      </div>
    </div>
  )
}
