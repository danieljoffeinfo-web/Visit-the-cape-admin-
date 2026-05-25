'use client'

import { useState, useEffect, Suspense } from 'react'
import { Sidebar } from '@/components/sidebar'
import { DashboardPanel } from '@/components/panels/dashboard-panel'
import { BookingsPanel } from '@/components/panels/bookings-panel'
import { EnquiriesPanel } from '@/components/panels/enquiries-panel'
import { ToursPanel } from '@/components/panels/tours-panel'
import { AccountingPanel } from '@/components/panels/accounting-panel'
import { CrmPanel } from '@/components/panels/crm-panel'
import { SettingsPanel } from '@/components/panels/settings-panel'
import { SocialsPanel } from '@/components/panels/socials-panel'
import { PlaceholderPanel } from '@/components/panels/placeholder-panel'
import { useSearchParams } from 'next/navigation'

type Panel = 'dashboard' | 'bookings' | 'calendar' | 'enquiries' | 'tours' | 'fleet' | 'accounting' | 'socials' | 'crm' | 'settings'

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
}

function AdminApp() {
  const searchParams = useSearchParams()
  const [panel, setPanel] = useState<Panel>('dashboard')

  // Allow deep-linking via ?panel=settings
  useEffect(() => {
    const p = searchParams?.get('panel') as Panel
    if (p && PANEL_TITLES[p]) setPanel(p)
  }, [searchParams])

  // Handle Xero callback redirect to settings
  useEffect(() => {
    const xero = searchParams?.get('xero')
    if (xero) setPanel('settings')
  }, [searchParams])

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <Sidebar active={panel} onChange={setPanel} />
      <div style={{ marginLeft: 240, flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        {/* Topbar */}
        <div style={{ height: 60, background: '#1a1815', borderBottom: '1px solid rgba(240,236,228,0.12)', display: 'flex', alignItems: 'center', padding: '0 28px', gap: 16, position: 'sticky', top: 0, zIndex: 50 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '0.05em', textTransform: 'uppercase', flex: 1 }}>
            {PANEL_TITLES[panel]}
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', background: 'rgba(184,149,106,0.15)', color: '#d4b896', padding: '4px 10px', borderRadius: 20, border: '1px solid rgba(184,149,106,0.3)' }}>
            Cape Town
          </div>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf84', boxShadow: '0 0 6px rgba(76,175,132,0.7)', flexShrink: 0 }} />
        </div>

        {/* Content */}
        <div style={{ padding: 28, flex: 1 }}>
          {panel === 'dashboard' && <DashboardPanel onNavigate={(p) => setPanel(p as Panel)} />}
          {panel === 'bookings' && <BookingsPanel />}
          {panel === 'calendar' && <PlaceholderPanel id="calendar" />}
          {panel === 'enquiries' && <EnquiriesPanel />}
          {panel === 'tours' && <ToursPanel />}
          {panel === 'fleet' && <PlaceholderPanel id="fleet" />}
          {panel === 'accounting' && <AccountingPanel />}
          {panel === 'socials' && <SocialsPanel />}
          {panel === 'crm' && <CrmPanel />}
          {panel === 'settings' && <SettingsPanel />}
        </div>
      </div>
    </div>
  )
}

export default function Page() {
  return (
    <Suspense>
      <AdminApp />
    </Suspense>
  )
}
