'use client'

import { useEffect, useState } from 'react'
import { RevenuePayments } from '@/components/accounting/revenue-payments'
import { AnalyticsReports } from '@/components/accounting/analytics-reports'
import { AdvancedSync } from '@/components/accounting/advanced-sync'
import { supabase } from '@/lib/supabase'

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
      const { data } = await supabase
        .from('xero_tokens')
        .select('org_name, expires_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
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
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Accounting</h1>
          <p style={{ color: 'rgba(240,236,228,0.55)', fontSize: 13, marginTop: 2 }}>Powered by Xero</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {checkingConnection ? null : connected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 14px', borderRadius: 20, background: 'rgba(76,175,132,0.12)', border: '1px solid rgba(76,175,132,0.25)', color: '#4caf84', fontSize: 13 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#4caf84' }} />
              {orgName} Connected
            </div>
          ) : (
            <a href="/api/xero/connect" style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 16px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', textDecoration: 'none', fontWeight: 700, fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>
              Connect Xero
            </a>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, background: 'rgba(240,236,228,0.04)', borderRadius: 8, padding: 4 }}>
        {sections.map(s => (
          <button key={s.id} onClick={() => setSection(s.id)} style={{
            flex: 1, padding: '10px 16px', borderRadius: 6, border: 'none', cursor: 'pointer',
            background: section === s.id ? '#1a1815' : 'transparent',
            color: section === s.id ? '#b8956a' : 'rgba(240,236,228,0.55)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: section === s.id ? 800 : 400,
            fontSize: 15,
            letterSpacing: '0.04em',
            textTransform: 'uppercase' as const,
            transition: 'all 0.15s',
            boxShadow: section === s.id ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
          }}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Content */}
      {section === 'revenue' && <RevenuePayments connected={connected} />}
      {section === 'analytics' && <AnalyticsReports connected={connected} />}
      {section === 'advanced' && <AdvancedSync connected={connected} />}
    </div>
  )
}
