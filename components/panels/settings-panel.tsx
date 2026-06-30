'use client'

import { useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { ClearDataDialog, useClearAdminData } from '@/components/admin/clear-data-dialog'
import { cardStyle, dangerButton, pageTitle, secondaryButton, sectionTitle, theme } from '@/lib/theme'

type XeroToken = { tenant_id: string; org_name: string; expires_at: string; updated_at: string } | null

export function SettingsPanel() {
  const [xeroToken, setXeroToken] = useState<XeroToken>(null)
  const [loadingXero, setLoadingXero] = useState(true)
  const [showClearDialog, setShowClearDialog] = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const { clearing, clearAllData } = useClearAdminData()
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

  async function handleClearAllData() {
    try {
      const data = await clearAllData()
      toast.success(`All admin data cleared. ${data.fleetPreserved ?? 0} fleet vehicles kept.`)
      setShowClearDialog(false)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to clear data')
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
          <div style={{ color: theme.textFaint, fontSize: 13 }}>Checking connection...</div>
        ) : xeroToken ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', background: 'rgba(61,139,99,0.08)', border: '1px solid rgba(61,139,99,0.2)', borderRadius: 8, marginBottom: 16 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: theme.success, flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: 15, color: theme.text }}>{xeroToken.org_name || 'Connected Organisation'}</div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                  Last synced: {new Date(xeroToken.updated_at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
              <button onClick={disconnectXero} disabled={disconnecting} style={{ marginLeft: 'auto', padding: '6px 14px', borderRadius: 5, border: '1px solid rgba(196,92,74,0.35)', background: 'transparent', color: theme.danger, cursor: 'pointer', fontSize: 13, fontFamily: theme.bodyFont }}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect'}
              </button>
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <a href="/api/xero/connect" style={{ ...secondaryButton, display: 'inline-block', padding: '7px 16px', textDecoration: 'none', fontSize: 13 }}>
                Re-authorise
              </a>
              <button onClick={() => { fetch('/api/xero/refresh', { method: 'POST' }).then(() => { toast.success('Token refreshed'); loadXeroStatus() }).catch(() => toast.error('Refresh failed')) }} style={{ padding: '7px 16px', borderRadius: 5, border: `1px solid ${theme.border}`, background: theme.surface, color: theme.textMuted, cursor: 'pointer', fontSize: 13, fontFamily: theme.bodyFont }}>
                Refresh Token
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', background: theme.surfaceMuted, border: `1px solid ${theme.border}`, borderRadius: 8, marginBottom: 16, color: theme.textMuted, fontSize: 13 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: theme.textFaint, flexShrink: 0 }} />
              Not connected
            </div>
            <a href="/api/xero/connect" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 20px', borderRadius: 6, background: theme.bronze, color: '#ffffff', textDecoration: 'none', fontWeight: 700, fontSize: 14, fontFamily: theme.bodyFont }}>
              Connect Xero Account
            </a>
            <p style={{ color: theme.textFaint, fontSize: 12, marginTop: 10 }}>
              You&apos;ll be redirected to Xero to authorise access. Your credentials are stored securely.
            </p>
          </div>
        )}
      </div>

      <div style={{ ...card, marginBottom: 20, border: '1px solid rgba(196, 92, 74, 0.2)' }}>
        <h2 style={{ ...sectionTitle, marginBottom: 16, color: theme.danger }}>Danger zone</h2>
        <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16, lineHeight: 1.6 }}>
          Permanently clear all bookings, enquiries, customers, invoice links, activity logs, content library, and Jarvis chats.
          Fleet vehicles, admin users, and your Xero connection are kept.
        </p>
        <p style={{ color: theme.textFaint, fontSize: 12, marginBottom: 16 }}>
          Owner account only. You must type a confirmation phrase before anything is deleted.
        </p>
        <button type="button" onClick={() => setShowClearDialog(true)} disabled={clearing} style={dangerButton}>
          Clear all admin data…
        </button>
      </div>

      <ClearDataDialog
        open={showClearDialog}
        onClose={() => setShowClearDialog(false)}
        onConfirm={handleClearAllData}
        loading={clearing}
      />

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
