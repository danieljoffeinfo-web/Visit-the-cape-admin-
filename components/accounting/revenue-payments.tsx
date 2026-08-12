'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cardStyle, fieldLabel, primaryButton, secondaryButton, sectionTitle, theme } from '@/lib/theme'

function formatZAR(amount: number) {
  return `R ${(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

type XeroInvoice = {
  invoiceID?: string
  invoiceNumber?: string
  contact?: { name?: string }
  total?: number
  amountDue?: number
  dueDate?: string
  status?: string
}

type XeroPayment = {
  paymentID?: string
  invoice?: { contact?: { name?: string }; invoiceNumber?: string }
  amount?: number
  date?: string
}

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PAID: { bg: 'rgba(61, 139, 99, 0.12)', color: theme.success },
  AUTHORISED: { bg: 'rgba(100, 149, 237, 0.12)', color: '#4a7fd4' },
  OVERDUE: { bg: 'rgba(196, 92, 74, 0.12)', color: theme.danger },
  DRAFT: { bg: theme.surfaceMuted, color: theme.textMuted },
  VOIDED: { bg: theme.surfaceMuted, color: theme.text },
  DELETED: { bg: theme.surfaceMuted, color: theme.textFaint },
}

const tableHead = {
  padding: '8px 12px',
  textAlign: 'left' as const,
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: theme.textMuted,
  fontWeight: 700,
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: string }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '4px 10px',
        borderRadius: 6,
        border: `1px solid ${active ? theme.bronzeBorder : theme.border}`,
        background: active ? theme.bronzeBg : theme.surface,
        color: active ? theme.bronzeDark : theme.text,
        cursor: 'pointer',
        fontSize: 12,
        fontWeight: active ? 700 : 600,
        fontFamily: theme.bodyFont,
      }}
    >
      {children}
    </button>
  )
}

export function RevenuePayments({ connected }: { connected: boolean }) {
  const [invoices, setInvoices] = useState<XeroInvoice[]>([])
  const [payments, setPayments] = useState<XeroPayment[]>([])
  const [filter, setFilter] = useState('ALL')
  const [loading, setLoading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [showHidden, setShowHidden] = useState(false)
  const [hiddenCount, setHiddenCount] = useState(0)
  const [stats, setStats] = useState({ totalRevenue: 0, outstanding: 0, paymentsWeek: 0, overdue: 0 })

  useEffect(() => {
    if (!connected) return
    loadData()
  }, [connected, filter, showHidden])

  async function loadData() {
    setLoading(true)
    try {
      const [invRes, payRes] = await Promise.all([
        fetch(`/api/xero/invoices?status=${filter}${showHidden ? '&hidden=true' : ''}`),
        fetch('/api/xero/payments'),
      ])
      const invPayload = await invRes.json()
      const payData: XeroPayment[] = await payRes.json()
      const invData: XeroInvoice[] = Array.isArray(invPayload?.invoices) ? invPayload.invoices : []
      setInvoices(invData)
      setPayments(Array.isArray(payData) ? payData : [])
      setHiddenCount(Number(invPayload?.hiddenCount) || 0)
      if (invPayload?.setupRequired) {
        toast.error('Run supabase/xero_hidden_invoices.sql to enable hiding invoices')
      }

      const paymentsWeek = Array.isArray(payData) ? payData.reduce((s, p) => s + (p.amount || 0), 0) : 0
      setStats({
        totalRevenue: Number(invPayload?.summary?.paid) || 0,
        outstanding: Number(invPayload?.summary?.outstanding) || 0,
        paymentsWeek,
        overdue: Number(invPayload?.summary?.overdue) || 0,
      })
    } catch {
      toast.error('Failed to load invoice data')
    } finally {
      setLoading(false)
    }
  }

  async function restoreInvoice(inv: XeroInvoice) {
    if (!inv.invoiceID) return

    const label = inv.invoiceNumber || inv.invoiceID
    setDeletingId(inv.invoiceID)
    try {
      const res = await fetch(`/api/xero/invoices/${inv.invoiceID}`, { method: 'PATCH' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to restore invoice')
      toast.success(`Invoice ${label} restored`)
      loadData()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to restore invoice')
    } finally {
      setDeletingId(null)
    }
  }

  if (!connected) return <XeroConnectBanner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[
          { label: 'Paid invoices', value: formatZAR(stats.totalRevenue), color: theme.success },
          { label: 'Waiting for payment', value: formatZAR(stats.outstanding), color: '#4a7fd4' },
          { label: 'Recent payments', value: formatZAR(stats.paymentsWeek), color: theme.bronzeDark },
          { label: 'Overdue', value: formatZAR(stats.overdue), color: theme.danger },
        ].map((s) => (
          <div key={s.label} style={cardStyle}>
            <div style={{ ...fieldLabel, marginBottom: 8, fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 26, color: s.color }}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={sectionTitle}>{showHidden ? 'Hidden from this dashboard' : 'Invoices'}</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {(['ALL', 'PAID', 'AUTHORISED', 'OVERDUE', 'DRAFT'] as const).map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {s === 'AUTHORISED' ? 'Outstanding' : s.charAt(0) + s.slice(1).toLowerCase()}
              </FilterChip>
            ))}
            {(hiddenCount > 0 || showHidden) && (
              <FilterChip active={showHidden} onClick={() => setShowHidden((v) => !v)}>
                {showHidden ? 'Back to invoices' : `Hidden (${hiddenCount})`}
              </FilterChip>
            )}
          </div>
        </div>

        {!showHidden && (
          <p style={{ color: theme.textMuted, fontSize: 12, margin: '-6px 0 14px' }}>
            Create customer invoices from a booking so each invoice stays linked to the correct tour, vehicle or experience.
          </p>
        )}

        {showHidden && (
          <p style={{ color: theme.textMuted, fontSize: 13, margin: '0 0 14px' }}>
            These invoices are still in Xero and still count toward the totals above. Restore an invoice to show it in the main list again.
          </p>
        )}
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
              {['Contact', 'Invoice #', 'Amount', 'Due Date', 'Status', ''].map((h) => (
                <th key={h || 'actions'} style={tableHead}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: theme.textMuted }}>Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: theme.textMuted }}>
                {showHidden ? 'No removed invoices' : 'No invoices found'}
              </td></tr>
            ) : invoices.slice(0, 50).map((inv) => {
              const sc = STATUS_COLORS[inv.status || 'DRAFT'] || STATUS_COLORS.DRAFT
              return (
                <tr key={inv.invoiceID} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{inv.contact?.name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: theme.bronzeDark, fontWeight: 600 }}>{inv.invoiceNumber || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{formatZAR(inv.total || 0)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{inv.dueDate ? format(new Date(inv.dueDate), 'd MMM yyyy') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', ...sc }}>
                      {inv.status === 'AUTHORISED' ? 'Waiting for payment' : inv.status}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {showHidden ? (
                      <button
                        type="button"
                        onClick={() => restoreInvoice(inv)}
                        disabled={deletingId === inv.invoiceID}
                        style={{
                          ...secondaryButton,
                          fontSize: 12,
                          padding: '5px 10px',
                          opacity: deletingId === inv.invoiceID ? 0.6 : 1,
                        }}
                      >
                        {deletingId === inv.invoiceID ? 'Restoring…' : 'Restore'}
                      </button>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={cardStyle}>
        <h3 style={{ ...sectionTitle, marginBottom: 16 }}>Recent Payments</h3>
        {loading ? (
          <div style={{ color: theme.textMuted, padding: 12 }}>Loading...</div>
        ) : payments.length === 0 ? (
          <div style={{ color: theme.textMuted, padding: 12 }}>No recent payments</div>
        ) : payments.slice(0, 10).map((p) => (
          <div key={p.paymentID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: `1px solid ${theme.border}` }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{p.invoice?.contact?.name || '—'}</div>
              <div style={{ fontSize: 11, color: theme.textMuted, marginTop: 2 }}>{p.invoice?.invoiceNumber} · {p.date ? format(new Date(p.date), 'd MMM yyyy') : '—'}</div>
            </div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 700, fontSize: 18, color: theme.success }}>{formatZAR(p.amount || 0)}</div>
          </div>
        ))}
      </div>

    </div>
  )
}

function XeroConnectBanner() {
  return (
    <div style={{ ...cardStyle, textAlign: 'center', border: `1px solid ${theme.bronzeBorder}` }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
      <h3 style={{ ...sectionTitle, marginBottom: 8 }}>Connect Xero to Unlock This Section</h3>
      <p style={{ color: theme.textMuted, fontSize: 14, marginBottom: 20 }}>Link your Xero account in Settings to view invoices, payments and reports.</p>
      <a href="/api/xero/connect" style={{ ...primaryButton, textDecoration: 'none', display: 'inline-block' }}>
        Connect Xero
      </a>
    </div>
  )
}
