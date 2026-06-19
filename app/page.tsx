'use client'

import { useState, Suspense, useEffect, useCallback } from 'react'
import { Sidebar } from '@/components/sidebar'
import { AuthProvider, useAuth } from '@/components/auth-provider'
import { UserColorBadge } from '@/components/user-badge'
import { DashboardPanel } from '@/components/panels/dashboard-panel'
import { BookingsPanel, parseBookingsTab } from '@/components/panels/bookings-panel'
import { EnquiriesPanel } from '@/components/panels/enquiries-panel'
import { ToursPanel } from '@/components/panels/tours-panel'
import { AccountingPanel } from '@/components/panels/accounting-panel'
import { CrmPanel } from '@/components/panels/crm-panel'
import { SettingsPanel } from '@/components/panels/settings-panel'
import { FleetPanel } from '@/components/panels/fleet-panel'
import { CalendarPanel } from '@/components/panels/calendar-panel'
import { ActivityLogsPanel } from '@/components/panels/activity-logs-panel'
import { useSearchParams, useRouter } from 'next/navigation'
import type { BookingTab } from '@/lib/bookings'
import { theme } from '@/lib/theme'

type Panel =
  | 'dashboard' | 'bookings' | 'calendar' | 'enquiries'
  | 'tours' | 'fleet' | 'accounting' | 'crm' | 'settings'
  | 'activity-logs'

const PANEL_STORAGE_KEY = 'vtc_active_panel'

const PANEL_TITLES: Record<Panel, string> = {
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  calendar: 'Calendar',
  enquiries: 'Enquiries',
  tours: 'Tours & Pricing',
  fleet: 'Fleet Manager',
  accounting: 'Accounting',
  crm: 'CRM',
  settings: 'Settings',
  'activity-logs': 'Activity Logs',
}

function resolveInitialPanel(raw: string | null): Panel {
  if (raw === 'tour-bookings' || raw === 'internal-bookings') return 'bookings'
  if (raw && raw in PANEL_TITLES) return raw as Panel
  return 'dashboard'
}

function readStoredPanel(): Panel | null {
  if (typeof window === 'undefined') return null
  const saved = sessionStorage.getItem(PANEL_STORAGE_KEY)
  if (saved && saved in PANEL_TITLES) return saved as Panel
  return null
}

function NotApprovedScreen() {
  const { signOut } = useAuth()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: theme.bg }}>
      <div style={{ maxWidth: 420, textAlign: 'center', background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '40px 36px', boxShadow: '0 8px 32px rgba(44,38,32,0.08)' }}>
        <h1 style={{ fontFamily: theme.headingFont, fontWeight: 900, fontSize: 24, letterSpacing: '0.04em', textTransform: 'uppercase', color: theme.danger, marginBottom: 12 }}>
          Access Denied
        </h1>
        <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Your account has not been approved for admin access.
        </p>
        <button
          onClick={signOut}
          style={{ padding: '10px 20px', borderRadius: 6, background: theme.bronze, color: '#ffffff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: theme.bodyFont }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

function PanelSlot({ active, name, children }: { active: boolean; name: Panel; children: React.ReactNode }) {
  return (
    <div hidden={!active} aria-hidden={!active} style={{ display: active ? 'block' : 'none' }}>
      {children}
    </div>
  )
}

function AdminApp() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { admin, loading, notApproved, signOut } = useAuth()

  const legacyPanel = searchParams?.get('panel')
  const [panel, setPanel] = useState<Panel>(() => {
    if (searchParams?.get('xero')) return 'settings'
    return readStoredPanel() || resolveInitialPanel(legacyPanel)
  })
  const [visited, setVisited] = useState<Set<Panel>>(() => new Set([panel]))
  const [bookingsTab, setBookingsTab] = useState<BookingTab>(() => {
    if (legacyPanel === 'tour-bookings') return 'tours'
    if (legacyPanel === 'internal-bookings') return 'internal'
    return parseBookingsTab(searchParams?.get('tab') || null)
  })
  const [bookingsAction, setBookingsAction] = useState<string | null>(
    () => searchParams?.get('action') || null,
  )

  useEffect(() => {
    setVisited((prev) => new Set(prev).add(panel))
    sessionStorage.setItem(PANEL_STORAGE_KEY, panel)
  }, [panel])

  useEffect(() => {
    if (!loading && !admin && !notApproved) {
      router.replace('/login')
    }
  }, [loading, admin, notApproved, router])

  const changePanel = useCallback((next: Panel) => {
    setPanel(next)
  }, [])

  function navigate(target: string, opts?: { tab?: BookingTab; action?: string }) {
    const nextPanel = resolveInitialPanel(target)
    setPanel(nextPanel)
    if (opts?.tab) setBookingsTab(opts.tab)
    if (opts?.action) setBookingsAction(opts.action)
    if (nextPanel !== 'bookings') {
      setBookingsAction(null)
    }
  }

  if (loading && !admin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textFaint, background: theme.bg }}>
        Loading…
      </div>
    )
  }

  if (notApproved) return <NotApprovedScreen />
  if (!admin) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: theme.textFaint, background: theme.bg }}>
        Redirecting…
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: theme.bg }}>
      <Sidebar active={panel} onChange={changePanel} admin={admin} onSignOut={signOut} />
      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ height: 60, background: theme.surface, borderBottom: `1px solid ${theme.border}`, display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 20, letterSpacing: '0.05em', textTransform: 'uppercase', flex: 1, color: theme.text }}>
            {PANEL_TITLES[panel]}
          </div>
          <UserColorBadge name={admin.full_name} color={admin.color} />
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', background: theme.bronzeBg, color: theme.bronzeDark, padding: '4px 10px', borderRadius: 20, border: `1px solid ${theme.bronzeBorder}` }}>
            Cape Town
          </div>
          <button
            onClick={signOut}
            style={{ padding: '5px 12px', borderRadius: 4, border: `1px solid ${theme.border}`, background: 'transparent', color: theme.textMuted, cursor: 'pointer', fontSize: 12, fontFamily: theme.bodyFont }}
          >
            Logout
          </button>
        </div>

        <div style={{ padding: 28, flex: 1 }}>
          {visited.has('dashboard') && (
            <PanelSlot active={panel === 'dashboard'} name="dashboard">
              <DashboardPanel onNavigate={navigate} />
            </PanelSlot>
          )}
          {visited.has('bookings') && (
            <PanelSlot active={panel === 'bookings'} name="bookings">
              <BookingsPanel initialTab={bookingsTab} initialAction={bookingsAction} />
            </PanelSlot>
          )}
          {visited.has('calendar') && (
            <PanelSlot active={panel === 'calendar'} name="calendar">
              <CalendarPanel />
            </PanelSlot>
          )}
          {visited.has('enquiries') && (
            <PanelSlot active={panel === 'enquiries'} name="enquiries">
              <EnquiriesPanel />
            </PanelSlot>
          )}
          {visited.has('tours') && (
            <PanelSlot active={panel === 'tours'} name="tours">
              <ToursPanel />
            </PanelSlot>
          )}
          {visited.has('fleet') && (
            <PanelSlot active={panel === 'fleet'} name="fleet">
              <FleetPanel onNavigate={navigate} />
            </PanelSlot>
          )}
          {visited.has('accounting') && (
            <PanelSlot active={panel === 'accounting'} name="accounting">
              <AccountingPanel />
            </PanelSlot>
          )}
          {visited.has('crm') && (
            <PanelSlot active={panel === 'crm'} name="crm">
              <CrmPanel />
            </PanelSlot>
          )}
          {visited.has('settings') && (
            <PanelSlot active={panel === 'settings'} name="settings">
              <SettingsPanel />
            </PanelSlot>
          )}
          {visited.has('activity-logs') && (
            <PanelSlot active={panel === 'activity-logs'} name="activity-logs">
              <ActivityLogsPanel />
            </PanelSlot>
          )}
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <AuthProvider>
      <Suspense>
        <AdminApp />
      </Suspense>
    </AuthProvider>
  )
}
