'use client'

import { useState, Suspense, useEffect, useCallback } from 'react'
import dynamic from 'next/dynamic'
import { Sidebar } from '@/components/sidebar'
import { AuthProvider, useAuth } from '@/components/auth-provider'
import { UserColorBadge } from '@/components/user-badge'
import { PanelLoader } from '@/components/panel-loader'
import { parseBookingsTab } from '@/components/panels/bookings-panel'
import { useSearchParams, useRouter } from 'next/navigation'
import type { BookingTab } from '@/lib/bookings'
import { theme } from '@/lib/theme'

const DashboardPanel = dynamic(
  () => import('@/components/panels/dashboard-panel').then((m) => ({ default: m.DashboardPanel })),
  { loading: () => <PanelLoader /> },
)
const BookingsPanel = dynamic(
  () => import('@/components/panels/bookings-panel').then((m) => ({ default: m.BookingsPanel })),
  { loading: () => <PanelLoader /> },
)
const CalendarPanel = dynamic(
  () => import('@/components/panels/calendar-panel').then((m) => ({ default: m.CalendarPanel })),
  { loading: () => <PanelLoader /> },
)
const EnquiriesPanel = dynamic(
  () => import('@/components/panels/enquiries-panel').then((m) => ({ default: m.EnquiriesPanel })),
  { loading: () => <PanelLoader /> },
)
const ToursPanel = dynamic(
  () => import('@/components/panels/tours-panel').then((m) => ({ default: m.ToursPanel })),
  { loading: () => <PanelLoader /> },
)
const FleetPanel = dynamic(
  () => import('@/components/panels/fleet-panel').then((m) => ({ default: m.FleetPanel })),
  { loading: () => <PanelLoader /> },
)
const AccountingPanel = dynamic(
  () => import('@/components/panels/accounting-panel').then((m) => ({ default: m.AccountingPanel })),
  { loading: () => <PanelLoader /> },
)
const CrmPanel = dynamic(
  () => import('@/components/panels/crm-panel').then((m) => ({ default: m.CrmPanel })),
  { loading: () => <PanelLoader /> },
)
const SettingsPanel = dynamic(
  () => import('@/components/panels/settings-panel').then((m) => ({ default: m.SettingsPanel })),
  { loading: () => <PanelLoader /> },
)
const ActivityLogsPanel = dynamic(
  () => import('@/components/panels/activity-logs-panel').then((m) => ({ default: m.ActivityLogsPanel })),
  { loading: () => <PanelLoader /> },
)
const ContentLibraryPanel = dynamic(
  () => import('@/components/panels/content-library-panel').then((m) => ({ default: m.ContentLibraryPanel })),
  { loading: () => <PanelLoader /> },
)

type Panel =
  | 'dashboard' | 'bookings' | 'calendar' | 'enquiries'
  | 'tours' | 'fleet' | 'accounting' | 'crm' | 'settings'
  | 'activity-logs' | 'content-library'

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
  'content-library': 'Content Library',
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

function AdminApp() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const { admin, loading, notApproved, signOut } = useAuth()

  const legacyPanel = searchParams?.get('panel')
  const [panel, setPanel] = useState<Panel>(() => {
    if (searchParams?.get('xero')) return 'settings'
    return readStoredPanel() || resolveInitialPanel(legacyPanel)
  })
  const [bookingsTab, setBookingsTab] = useState<BookingTab>(() => {
    if (legacyPanel === 'tour-bookings') return 'tours'
    if (legacyPanel === 'internal-bookings') return 'internal'
    return parseBookingsTab(searchParams?.get('tab') || null)
  })
  const [bookingsAction, setBookingsAction] = useState<string | null>(
    () => searchParams?.get('action') || null,
  )
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  useEffect(() => {
    sessionStorage.setItem(PANEL_STORAGE_KEY, panel)
  }, [panel])

  useEffect(() => {
    if (!mobileNavOpen) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [mobileNavOpen])

  useEffect(() => {
    setMobileNavOpen(false)
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
    <div className="admin-shell">
      <button
        type="button"
        className={`admin-sidebar-backdrop${mobileNavOpen ? ' admin-sidebar-backdrop--visible' : ''}`}
        aria-label="Close menu"
        onClick={() => setMobileNavOpen(false)}
        tabIndex={mobileNavOpen ? 0 : -1}
      />
      <Sidebar
        active={panel}
        onChange={changePanel}
        admin={admin}
        onSignOut={signOut}
        mobileOpen={mobileNavOpen}
        onClose={() => setMobileNavOpen(false)}
      />
      <div className="admin-main">
        <div className="admin-header">
          <button
            type="button"
            className="admin-header__menu"
            aria-label="Open menu"
            onClick={() => setMobileNavOpen(true)}
          >
            <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden>
              <line x1="2" y1="4" x2="14" y2="4" />
              <line x1="2" y1="8" x2="14" y2="8" />
              <line x1="2" y1="12" x2="14" y2="12" />
            </svg>
          </button>
          <div className="admin-header__title">{PANEL_TITLES[panel]}</div>
          <div className="admin-header__meta">
            <span className="user-color-badge">
              <UserColorBadge name={admin.full_name} color={admin.color} />
            </span>
            <div className="admin-header__location">Cape Town</div>
            <button type="button" onClick={signOut} className="admin-header__logout">
              Logout
            </button>
          </div>
        </div>

        <div className="admin-content">
          {panel === 'dashboard' && <DashboardPanel onNavigate={navigate} />}
          {panel === 'bookings' && <BookingsPanel initialTab={bookingsTab} initialAction={bookingsAction} />}
          {panel === 'calendar' && <CalendarPanel />}
          {panel === 'enquiries' && <EnquiriesPanel />}
          {panel === 'tours' && <ToursPanel />}
          {panel === 'fleet' && <FleetPanel onNavigate={navigate} />}
          {panel === 'accounting' && <AccountingPanel />}
          {panel === 'crm' && <CrmPanel />}
          {panel === 'settings' && <SettingsPanel />}
          {panel === 'activity-logs' && <ActivityLogsPanel />}
          {panel === 'content-library' && <ContentLibraryPanel />}
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
