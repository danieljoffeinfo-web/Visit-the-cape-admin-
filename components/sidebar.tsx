'use client'

import type { AdminUser } from '@/lib/auth-types'
import { UserColorDot } from '@/components/user-badge'
import { theme } from '@/lib/theme'

type Panel =
  | 'dashboard' | 'bookings' | 'calendar' | 'enquiries'
  | 'tours' | 'fleet' | 'accounting' | 'crm' | 'settings'
  | 'activity-logs' | 'content-library' | 'jarvis'

interface SidebarProps {
  active: Panel
  onChange: (p: Panel) => void
  admin?: AdminUser | null
  onSignOut?: () => void
  mobileOpen?: boolean
  onClose?: () => void
}

const navItems = [
  {
    section: 'Main',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: <GridIcon /> },
      { id: 'jarvis', label: 'Jarvis', icon: <SparkIcon /> },
      { id: 'bookings', label: 'Bookings', icon: <BookIcon /> },
      { id: 'calendar', label: 'Calendar', icon: <CalIcon /> },
      { id: 'enquiries', label: 'Enquiries', icon: <MailIcon /> },
    ],
  },
  {
    section: 'Operations',
    items: [
      { id: 'tours', label: 'Tours & Pricing', icon: <MapIcon /> },
      { id: 'fleet', label: 'Fleet Manager', icon: <CarIcon /> },
      { id: 'content-library', label: 'Content Library', icon: <MediaIcon /> },
      { id: 'accounting', label: 'Accounting', icon: <ChartIcon /> },
    ],
  },
  {
    section: null,
    items: [
      { id: 'crm', label: 'CRM', icon: <UsersIcon /> },
      { id: 'activity-logs', label: 'Activity Logs', icon: <LogIcon /> },
    ],
  },
  {
    section: 'Config',
    items: [
      { id: 'settings', label: 'Settings', icon: <GearIcon /> },
    ],
  },
] as const

export function Sidebar({ active, onChange, admin, onSignOut, mobileOpen, onClose }: SidebarProps) {
  function selectPanel(id: Panel) {
    onChange(id)
    onClose?.()
  }

  return (
    <aside
      className={`admin-sidebar${mobileOpen ? ' admin-sidebar--open' : ''}`}
      aria-hidden={mobileOpen === false ? undefined : mobileOpen ? false : undefined}
    >
      <div style={{ padding: '24px 20px 20px', borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
        <div>
          <div style={{ fontFamily: theme.headingFont, fontWeight: 900, fontSize: 22, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.bronze, lineHeight: 1 }}>
            Visit The Cape
          </div>
          <div style={{ fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.textFaint, marginTop: 4 }}>
            Admin Console
          </div>
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close menu"
            style={{
              display: 'none',
              width: 36,
              height: 36,
              borderRadius: 8,
              border: `1px solid ${theme.border}`,
              background: theme.surface,
              color: theme.textMuted,
              cursor: 'pointer',
              flexShrink: 0,
            }}
            className="admin-sidebar__close"
          >
            ✕
          </button>
        )}
      </div>

      <nav style={{ flex: 1, padding: '12px 0', overflowY: 'auto' }}>
        {navItems.map((group, gi) => (
          <div key={gi}>
            {group.section && (
              <div style={{ padding: '8px 16px 4px', fontSize: 9, letterSpacing: '0.2em', textTransform: 'uppercase', color: theme.textFaint, fontWeight: 500 }}>
                {group.section}
              </div>
            )}
            {group.items.map((item) => {
              const isActive = active === item.id
              return (
                <button
                  key={item.id}
                  onClick={() => selectPanel(item.id as Panel)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    padding: '10px 20px',
                    width: '100%',
                    cursor: 'pointer',
                    color: isActive ? theme.bronzeDark : theme.textMuted,
                    background: isActive ? theme.bronzeBg : 'transparent',
                    border: 'none',
                    borderLeftWidth: 3,
                    borderLeftStyle: 'solid',
                    borderLeftColor: isActive ? theme.bronze : 'transparent',
                    fontSize: 13.5,
                    fontWeight: isActive ? 600 : 400,
                    fontFamily: theme.bodyFont,
                    transition: 'background 0.15s, color 0.15s',
                    textAlign: 'left',
                  }}
                >
                  <span style={{ width: 16, height: 16, opacity: isActive ? 1 : 0.75, flexShrink: 0 }}>{item.icon}</span>
                  <span style={{ flex: 1 }}>{item.label}</span>
                </button>
              )
            })}
          </div>
        ))}
      </nav>

      <div style={{ padding: '16px 20px', borderTop: `1px solid ${theme.border}` }}>
        {admin && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
            <UserColorDot color={admin.color} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: theme.text }}>{admin.full_name}</div>
              <div style={{ fontSize: 10, color: theme.textFaint, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{admin.role}</div>
            </div>
          </div>
        )}
        {onSignOut && (
          <button
            onClick={onSignOut}
            style={{ width: '100%', padding: '6px 0', background: 'none', border: 'none', color: theme.textFaint, cursor: 'pointer', fontSize: 11, fontFamily: theme.bodyFont, textAlign: 'left' }}
          >
            Sign out
          </button>
        )}
      </div>
    </aside>
  )
}

function GridIcon() { return <svg viewBox="0 0 16 16" fill="currentColor"><rect x="1" y="1" width="6" height="6" rx="1"/><rect x="9" y="1" width="6" height="6" rx="1"/><rect x="1" y="9" width="6" height="6" rx="1"/><rect x="9" y="9" width="6" height="6" rx="1"/></svg> }
function SparkIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M8 1.5l1.2 3.8L13 6.5l-3.8 1.2L8 11.5 6.8 7.7 3 6.5l3.8-1.2L8 1.5z"/><path d="M12.5 10.5l.6 1.9 1.9.6-1.9.6-.6 1.9-.6-1.9-1.9-.6 1.9-.6.6-1.9z"/></svg> }
function BookIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="2" width="12" height="12" rx="1.5"/><line x1="5" y1="6" x2="11" y2="6"/><line x1="5" y1="9" x2="9" y2="9"/></svg> }
function CalIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="11" rx="1.5"/><line x1="2" y1="7" x2="14" y2="7"/><line x1="5" y1="1.5" x2="5" y2="4.5"/><line x1="11" y1="1.5" x2="11" y2="4.5"/></svg> }
function MailIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><polyline points="2,3 8,9 14,3"/></svg> }
function MapIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><polygon points="2,2 6,4 10,2 14,4 14,14 10,12 6,14 2,12"/><line x1="6" y1="4" x2="6" y2="14"/><line x1="10" y1="2" x2="10" y2="12"/></svg> }
function CarIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M2 9l1.5-4h9L14 9"/><rect x="1" y="9" width="14" height="4" rx="1.5"/><circle cx="4.5" cy="13" r="1.5"/><circle cx="11.5" cy="13" r="1.5"/></svg> }
function MediaIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><rect x="2" y="3" width="12" height="10" rx="1.5"/><circle cx="6" cy="7" r="1.5"/><path d="M14 10l-3-2.5-3 2.5-2-1.5-2 1.5"/></svg> }
function ChartIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="2" y1="14" x2="14" y2="14"/><rect x="3" y="8" width="3" height="6"/><rect x="7" y="5" width="3" height="9"/><rect x="11" y="2" width="3" height="12"/></svg> }
function UsersIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="6" cy="5" r="2.5"/><path d="M1 14c0-3 2.2-5 5-5s5 2 5 5"/><circle cx="12" cy="5" r="2"/><path d="M10 14c0-2 1-3.5 3-4"/></svg> }
function LogIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M3 2h7l3 3v9H3V2z"/><line x1="6" y1="7" x2="10" y2="7"/><line x1="6" y1="10" x2="10" y2="10"/></svg> }
function GearIcon() { return <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="8" cy="8" r="2.5"/><path d="M8 1v2M8 13v2M1 8h2M13 8h2M3.1 3.1l1.4 1.4M11.5 11.5l1.4 1.4M3.1 12.9l1.4-1.4M11.5 4.5l1.4-1.4"/></svg> }
