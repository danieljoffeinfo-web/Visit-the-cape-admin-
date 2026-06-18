'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { cardStyle, dangerButton, pageTitle, sectionTitle, theme } from '@/lib/theme'

type XeroToken = { tenant_id: string; org_name: string; expires_at: string; updated_at: string } | null

export function SettingsPanel() {
  const [xeroToken, setXeroToken] = useState<XeroToken>(null)
  const [loadingXero, setLoadingXero] = useState(true)
  const [wiping, setWiping] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    loadXeroStatus()
    // Handle OAuth callback result
    const xeroParam = searchParams?.get('xero')
    if (xeroParam === 'connected') {
      toast.success('Xero connected successfully!')
      window.history.replaceState({}, '', '/?panel=settings')
    } else if (xeroParam === 'error') {
      toast.error('Failed to connect Xero. Please try again.')
      window.history.replaceState({}, '', '/?panel=settings')
    }
  }, [])

  async function loadXeroStatus() {
    setLoadingXero(true)
    try {
      const res = await fetch('/api/xero/status')
      const data = await res.json()
      setXeroToken(data.connected ? data : null)
    } catch {
      setXeroToken(null)
    } finally {
      setLoadingXero(false)
    }
  }

  async function disconnectXero() {
    if (!confirm('Disconnect Xero? All accounting data will stop syncing.')) return
    setDisconnecting(true)
    try {
      const res = await fetch('/api/xero/status', { method: 'DELETE' })
      if (!res.ok) throw new Error()
      setXeroToken(null)
      toast.success('Xero disconnected')
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  async function clearRevenueData() {
    if (!confirm('Clear all bookings, customers, invoice links, and revenue stats? Fleet vehicles will be kept.')) return
    setWiping(true)
    try {
      const res = await fetch('/api/admin/wipe-revenue', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Wipe failed')
      toast.success(`Revenue data cleared. ${data.fleetPreserved ?? 0} fleet vehicles kept.`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear data')
    } finally {
      setWiping(false)
    }
  }

  const card = cardStyle

  return (
    <div>
      <h1 style={pageTitle}>Settings</h1>

      <div style={{ ...card, marginBottom: 20 }}>
        <h2 style={{ ...sectionTitle, marginBottom: 16 }}>Xero Integration</h2>
        <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 20 }}>
          Connect your Xero account to sync invoices, payments, and reports with the Accounting tab.
        </p>

        {loadingXero ? (
          <div style={{ color: 'rgba(240,236,228,0.4)', fontSize: 13 }}>Checking connection...</div>
        ) : xeroToken ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(76,175,132,0.08)', border: '1px solid rgba(76,175,132,0.2)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#4caf84', boxShadow: '0 0 6px rgba(76,175,132,0.7)', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: '#f0ece4' }}>{xeroToken.org_name || 'Connected Organisation'}</div>
                <div style={{ fontSize: 12, color: 'rgba(240,236,228,0.45)', marginTop: 2 }}>
                  Last synced: {new Date(xeroToken.updated_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button onClick={disconnectXero} disabled={disconnecting} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 5, border: '1px solid rgba(239,83,80,0.35)', background: 'transparent', color: '#ef5350', cursor: 'pointer', fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/api/xero/connect" style={{ display: 'inline-block', padding: '7px 16px', borderRadius: 5, border: '1px solid rgba(184,149,106,0.35)', background: 'transparent', color: '#b8956a', textDecoration: 'none', fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>
                Re-authorise
              </a>
              <button onClick={() => { fetch('/api/xero/refresh', { method: 'POST' }).then(() => { toast.success('Token refreshed'); loadXeroStatus() }).catch(() => toast.error('Refresh failed')) }} style={{ padding: '7px 16px', borderRadius: 5, border: '1px solid rgba(240,236,228,0.12)', background: 'transparent', color: 'rgba(240,236,228,0.55)', cursor: 'pointer', fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>
                Refresh Token
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.1)', borderRadius: 8, marginBottom: 16, color: 'rgba(240,236,228,0.5)', fontSize: 13 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: 'rgba(240,236,228,0.2)', flexShrink: 0 }} />
              Not connected
            </div>
            <a href="/api/xero/connect" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 6, background: '#b8956a', color: '#0c0b09', textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}>
              Connect Xero Account
            </a>
            <p style={{ color: 'rgba(240,236,228,0.35)', fontSize: 12, marginTop: 10 }}>
              You&apos;ll be redirected to Xero to authorise access. Your credentials are stored securely.
            </p>
          </div>
        )}
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <h2 style={{ ...sectionTitle, marginBottom: 16 }}>Data</h2>
        <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
          Remove all bookings, customers, invoice links, and dashboard revenue stats. Fleet vehicles are not deleted.
        </p>
        <button onClick={clearRevenueData} disabled={wiping} style={dangerButton}>
          {wiping ? 'Clearing…' : 'Clear revenue & booking data'}
        </button>
      </div>

      <div style={{ ...card, marginBottom: 20 }}>
        <h2 style={{ ...sectionTitle, marginBottom: 16 }}>Supabase Database</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: theme.textMuted, fontSize: 13 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf84' }} />
          Connected — ufcawaywfgzrhfbzxtgz.supabase.co
        </div>
      </div>

      <div style={card}>
        <h2 style={{ ...sectionTitle, marginBottom: 16 }}>About</h2>
        <div style={{ color: theme.textMuted, fontSize: 13, lineHeight: 1.8 }}>
          <div>Visit The Cape Admin Console</div>
          <div style={{ color: theme.textFaint, marginTop: 4, fontSize: 12 }}>Cape Town Tour Operator Management System</div>
        </div>
      </div>
    </div>
  )
}
