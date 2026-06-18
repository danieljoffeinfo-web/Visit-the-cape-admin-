'use client'

import { useEffect, useState } from 'react'
import { RevenuePayments } from '@/components/accounting/revenue-payments'
import { AnalyticsReports } from '@/components/accounting/analytics-reports'
import { AdvancedSync } from '@/components/accounting/advanced-sync'
import { pageTitle, primaryButton, theme } from '@/lib/theme'

type AccountingSection = 'revenue' | 'analytics' | 'advanced'

export function AccountingPanel() {
  const [section, setSection] = useState<AccountingSection>('revenue')
  const [connected, setConnected] = useState(false)
  const [orgName, setOrgName] = useState('')
  const [checkingConnection, setCheckingConnection] = useState(true)

  useEffect(() => {
    checkXeroConnection()
  }, [])

  async function checkXeroConnection() {
    try {
      const res = await fetch('/api/xero/status')
      const data = await res.json()

      if (data.connected) {
        setConnected(true)
        setOrgName(data.org_name || 'Xero')
      }
    } catch {
      setConnected(false)
    } finally {
      setCheckingConnection(false)
    }
  }

  const sections: { id: AccountingSection; label: string }[] = [
    { id: 'revenue', label: 'Revenue & Payments' },
    { id: 'analytics', label: 'Analytics & Reports' },
    { id: 'advanced', label: 'Advanced Sync' },
  ]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={pageTitle}>Accounting</h1>
          <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 6 }}>Powered by Xero</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {checkingConnection ? null : connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(61, 139, 99, 0.12)', border: '1px solid rgba(61, 139, 99, 0.25)', color: theme.success, fontSize: 13 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: theme.success }} />
              {orgName} Connected
            </div>
          ) : (
            <a href="/api/xero/connect" style={{ ...primaryButton, textDecoration: 'none', display: 'inline-block', fontSize: 13 }}>
              Connect Xero
            </a>
          )}
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          gap: 4,
          marginBottom: 28,
          background: theme.surfaceMuted,
          borderRadius: 8,
          padding: 4,
          border: `1px solid ${theme.border}`,
        }}
      >
        {sections.map((s) => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            style={{
              flex: 1,
              padding: '10px 16px',
              borderRadius: 6,
              border: section === s.id ? `1px solid ${theme.bronzeBorder}` : '1px solid transparent',
              cursor: 'pointer',
              background: section === s.id ? theme.bronzeBg : 'transparent',
              color: section === s.id ? theme.bronzeDark : theme.text,
              fontFamily: theme.headingFont,
              fontWeight: section === s.id ? 800 : 700,
              fontSize: 15,
              letterSpacing: '0.04em',
              textTransform: 'uppercase' as const,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {section === 'revenue' && <RevenuePayments connected={connected} />}
      {section === 'analytics' && <AnalyticsReports connected={connected} />}
      {section === 'advanced' && <AdvancedSync connected={connected} />}
    </div>
  )
}
