'use client'

import { useState, Suspense } from 'react'
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
import { SocialsPanel } from '@/components/panels/socials-panel'
import { ActivityLogsPanel } from '@/components/panels/activity-logs-panel'
import { useSearchParams } from 'next/navigation'
import type { BookingTab } from '@/lib/bookings'

type Panel =
  | 'dashboard' | 'bookings' | 'calendar' | 'enquiries'
  | 'tours' | 'fleet' | 'accounting' | 'socials' | 'crm' | 'settings'
  | 'activity-logs'

const PANEL_TITLES: Record<Panel, string> = {
  dashboard: 'Dashboard',
  bookings: 'Bookings',
  calendar: 'Calendar',
  enquiries: 'Enquiries',
  tours: 'Tours & Pricing',
  fleet: 'Fleet Manager',
  accounting: 'Accounting',
  socials: 'Socials',
  crm: 'CRM',
  settings: 'Settings',
  'activity-logs': 'Activity Logs',
}

function resolveInitialPanel(raw: string | null): Panel {
  if (raw === 'tour-bookings' || raw === 'internal-bookings') return 'bookings'
  if (raw && raw in PANEL_TITLES) return raw as Panel
  return 'dashboard'
}

function NotApprovedScreen() {
  const { signOut } = useAuth()
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ maxWidth: 420, textAlign: 'center', background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 12, padding: '40px 36px' }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, letterSpacing: '0.04em', textTransform: 'uppercase', color: '#ef5350', marginBottom: 12 }}>
          Access Denied
        </h1>
        <p style={{ color: 'rgba(240,236,228,0.65)', fontSize: 14, lineHeight: 1.6, marginBottom: 24 }}>
          Your account has not been approved for admin access.
        </p>
        <button
          onClick={signOut}
          style={{ padding: '10px 20px', borderRadius: 6, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}
        >
          Sign Out
        </button>
      </div>
    </div>
  )
}

function AdminApp() {
  const searchParams = useSearchParams()
  const { admin, loading, notApproved, signOut } = useAuth()

  const legacyPanel = searchParams?.get('panel')
  const [panel, setPanel] = useState<Panel>(() => {
    if (searchParams?.get('xero')) return 'settings'
    return resolveInitialPanel(legacyPanel)
  })
  const [bookingsTab, setBookingsTab] = useState<BookingTab>(() => {
    if (legacyPanel === 'tour-bookings') return 'tours'
    if (legacyPanel === 'internal-bookings') return 'internal'
    return parseBookingsTab(searchParams?.get('tab') || null)
  })
  const [bookingsAction, setBookingsAction] = useState<string | null>(
    () => searchParams?.get('action') || null,
  )

  function navigate(target: string, opts?: { tab?: BookingTab; action?: string }) {
    const nextPanel = resolveInitialPanel(target)
    setPanel(nextPanel)
    if (opts?.tab) setBookingsTab(opts.tab)
    if (opts?.action) setBookingsAction(opts.action)
    if (nextPanel !== 'bookings') {
      setBookingsAction(null)
    }
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(240,236,228,0.4)' }}>
        Loading…
      </div>
    )
  }

  if (notApproved) return <NotApprovedScreen />
  if (!admin) return null

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={panel} onChange={setPanel} admin={admin} onSignOut={signOut} />
      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <div style={{ height: 60, background: '#1a1815', borderBottom: '1px solid rgba(240,236,228,0.12)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '0.05em', textTransform: 'uppercase', flex: 1 }}>
            {PANEL_TITLES[panel]}
          </div>
          <UserColorBadge name={admin.full_name} color={admin.color} />
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(184,149,106,0.15)', color: '#d4b896', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(184,149,106,0.3)' }}>
            Cape Town
          </div>
          <button
            onClick={signOut}
            style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid rgba(240,236,228,0.12)', background: 'transparent', color: 'rgba(240,236,228,0.55)', cursor: 'pointer', fontSize: 12, fontFamily: "'Barlow', sans-serif" }}
          >
            Logout
          </button>
        </div>

        <div style={{ padding: 28, flex: 1 }}>
          {panel === 'dashboard' && <DashboardPanel onNavigate={navigate} />}
          {panel === 'bookings' && (
            <BookingsPanel initialTab={bookingsTab} initialAction={bookingsAction} />
          )}
          {panel === 'calendar' && <CalendarPanel />}
          {panel === 'enquiries' && <EnquiriesPanel />}
          {panel === 'tours' && <ToursPanel />}
          {panel === 'fleet' && <FleetPanel onNavigate={navigate} />}
          {panel === 'accounting' && <AccountingPanel />}
          {panel === 'socials' && <SocialsPanel />}
          {panel === 'crm' && <CrmPanel />}
          {panel === 'settings' && <SettingsPanel />}
          {panel === 'activity-logs' && <ActivityLogsPanel />}
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
