'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'

type XeroToken = { tenant_id: string; org_name: string; expires_at: string; updated_at: string } | null

export function SettingsPanel() {
  const [xeroToken, setXeroToken] = useState<XeroToken>(null)
  const [loadingXero, setLoadingXero] = useState(true)
  const [disconnecting, setDisconnecting] = useState(false)
  const searchParams = useSearchParams()

  useEffect(() => {
    loadXeroStatus()
    // Handle OAuth callback result
    const xeroParam = searchParams?.get('xero')
    if (xeroParam === 'connected') {
      toast.success('Xero connected successfully!')
      window.history.replaceState({}, '', '/settings')
    } else if (xeroParam === 'error') {
      toast.error('Failed to connect Xero. Please try again.')
      window.history.replaceState({}, '', '/settings')
    }
  }, [])

  async function loadXeroStatus() {
    setLoadingXero(true)
    try {
      const { data } = await supabase
        .from('xero_tokens')
        .select('tenant_id, org_name, expires_at, updated_at')
        .order('updated_at', { ascending: false })
        .limit(1)
        .single()
      setXeroToken(data)
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
      await supabase.from('xero_tokens').delete().neq('id', '00000000-0000-0000-0000-000000000000')
      setXeroToken(null)
      toast.success('Xero disconnected')
    } catch {
      toast.error('Failed to disconnect')
    } finally {
      setDisconnecting(false)
    }
  }

  const cardStyle = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px', marginBottom: 20 }
  const sectionHead = { fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' as const, marginBottom: 16 }

  return (
    <div>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 24 }}>Settings</h1>

      {/* Xero Integration */}
      <div style={cardStyle}>
        <h2 style={sectionHead}>Xero Integration</h2>
        <p style={{ color: 'rgba(240,236,228,0.55)', fontSize: 13, marginBottom: 20 }}>
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

      {/* Supabase Connection Info */}
      <div style={cardStyle}>
        <h2 style={sectionHead}>Supabase Database</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'rgba(240,236,228,0.55)', fontSize: 13 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#4caf84' }} />
          Connected — ufcawaywfgzrhfbzxtgz.supabase.co
        </div>
      </div>

      {/* About */}
      <div style={cardStyle}>
        <h2 style={sectionHead}>About</h2>
        <div style={{ color: 'rgba(240,236,228,0.55)', fontSize: 13, lineHeight: 1.8 }}>
          <div>DF Travel Admin Console</div>
          <div style={{ color: 'rgba(240,236,228,0.3)', marginTop: 4, fontSize: 12 }}>Cape Town Tour Operator Management System</div>
        </div>
      </div>
    </div>
  )
}
