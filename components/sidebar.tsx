'use client'

import { cn } from '@/lib/utils'

type Panel =
  | 'dashboard' | 'bookings' | 'calendar' | 'enquiries'
  | 'tours' | 'fleet' | 'accounting' | 'socials' | 'crm' | 'settings'

interface SidebarProps {
  active: Panel
  onChange: (p: Panel) => void
}

const navItems = [
  {
    section: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <GridIcon />, badge: null },
      { id: 'bookings', label: 'Bookings', icon: <BookIcon />, badge: 'Live' },
      { id: 'calendar', label: 'Calendar', icon: <CalIcon />, badge: null },
      { id: 'enquiries', label: 'Enquiries', icon: <MailIcon />, badge: null },
    ],
  },
  {
    section: 'Operations',
    items: [
      { id: 'tours', label: 'Tours & Pricing', icon: <MapIcon />, badge: null },
      { id: 'fleet', label: 'Fleet Manager', icon: <CarIcon />, badge: null },
      { id: 'accounting', label: 'Accounting', icon: <ChartIcon />, badge: null },
    ],
  },
  {
    section: null,
    items: [
      { id: 'socials', label: 'Socials', icon: <ShareIcon />, badge: null },
      { id: 'crm', label: 'CRM', icon: <UsersIcon />, badge: null },
    ],
  },
  {
    section: 'Config',
    items: [
      { id: 'settings', label: 'Settings', icon: <GearIcon />, badge: null },
    ],
  },
] as const

export function Sidebar({ active, onChange }: SidebarProps) {
  return (
    <aside style={{
      width: 240,
      minHeight: '100vh',
      background: '#1a1815',
      borderRight: '1px solid rgba(240,236,228,0.12)',
      display: 'flex',
      flexDirection: 'column',
      position: 'fixed',
      top: 0, left: 0, bottom: 0,
      zIndex: 100,
    }}>
      {/* Logo */}
      <div style={{ padding: '24px 20px 20px', borderBottom: '1px solid rgba(240,236,228,0.12)' }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#b8956a', lineHeight: 1 }}>
          DFT Admin
        </div>
        <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.35)', marginTop: 4 }}>
          DF Travel Console
        </div>
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {navItems.map((group, gi) => (
          <div key={gi}>
            {group.section && (
              <div style={{ padding: '8px 16px 4px', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.3)', fontWeight: 500 }}>
                {group.section}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => onChange(item.id as Panel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 20px',
                    width: '100%',
                    cursor: 'pointer',
                    color: isActive ? '#b8956a' : 'rgba(240,236,228,0.55)',
                    background: isActive ? 'rgba(184,149,106,0.1)' : 'transparent',
                    borderLeft: `3px solid ${isActive ? '#b8956a' : 'transparent'}`,
                    border: 'none',
                    borderRight: 'none',
                    borderTop: 'none',
                    borderBottom: 'none',
                    borderLeftWidth: 3,
                    borderLeftStyle: 'solid',
                    borderLeftColor: isActive ? '#b8956a' : 'transparent',
                    fontSize: 13.5,
                    fontWeight: 400,
                    fontFamily: "'Barlow', sans-serif",
                    transition: 'background 0.15s, color 0.15s',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 16, height: 16, opacity: isActive ? 1 : 0.7, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                  {item.badge && (
                    <span style={{ fontSize: 9, letterSpacing: '0.1em', textTransform: 'uppercase', background: 'rgba(184,149,106,0.2)', color: '#b8956a', padding: '2px 6px', borderRadius: 20, fontWeight: 500 }}>
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div style={{ padding: '16px 20px', borderTop: '1px solid rgba(240,236,228,0.12)', fontSize: 12, color: 'rgba(240,236,228,0.35)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf84', boxShadow: '0 0 6px rgba(76,175,132,0.7)', flexShrink: 0 }} />
          System Online
        </div>
      </div>
    </aside>
  )
}

function GridIcon() { return <svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> }
function BookIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/></svg> }
function CalIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5" y1="1.5" x2="5" y2="4.5"/><line x1="11" y1="1.5" x2="11" y2="4.5"/></svg> }
function MailIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><polyline points="2,3 8,9 14,3"/></svg> }
function MapIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="2,2 6,4 10,2 14,4 14,14 10,12 6,14 2,12"/><line x1="6" y1="4" x2="6" y2="14"/><line x1="10" y1="2" x2="10" y2="12"/></svg> }
function CarIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 9l1.5-4h9L14 9"/><rect x="1" y="9" width="14" height="4" rx="1.5"/><circle cx="4.5" cy="13" r="1.5"/><circle cx="11.5" cy="13" r="1.5"/></svg> }
function ChartIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="14" x2="14" y2="14"/><rect x="3" y="8" width="3" height="6"/><rect x="7" y="5" width="3" height="9"/><rect x="11" y="2" width="3" height="12"/></svg> }
function ShareIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="3" r="2"/><circle cx="4" cy="8" r="2"/><circle cx="12" cy="13" r="2"/><line x1="6" y1="7" x2="10" y2="4"/><line x1="6" y1="9" x2="10" y2="12"/></svg> }
function UsersIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-3 2.2-5 5-5s5 2 5 5"/><circle cx="12" cy="5" r="2"/><path d="M10 14c0-2 1-3.5 3-4"/></svg> }
function GearIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></svg> }
