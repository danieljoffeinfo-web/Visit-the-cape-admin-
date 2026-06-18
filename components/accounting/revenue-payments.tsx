'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cardStyle, fieldLabel, inputStyle, primaryButton, secondaryButton, sectionTitle, theme } from '@/lib/theme'

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
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ contact: '', description: '', amount: '', dueDate: '' })
  const [stats, setStats] = useState({ totalRevenue: 0, outstanding: 0, paymentsWeek: 0, overdue: 0 })

  useEffect(() => {
    if (!connected) return
    loadData()
  }, [connected, filter])

  async function loadData() {
    setLoading(true)
    try {
      const [invRes, payRes] = await Promise.all([
        fetch(`/api/xero/invoices?status=${filter}`),
        fetch('/api/xero/payments'),
      ])
      const invData: XeroInvoice[] = await invRes.json()
      const payData: XeroPayment[] = await payRes.json()
      setInvoices(Array.isArray(invData) ? invData : [])
      setPayments(Array.isArray(payData) ? payData : [])

      const arr = Array.isArray(invData) ? invData : []
      const totalRevenue = arr.filter(i => i.status === 'PAID').reduce((s, i) => s + (i.total || 0), 0)
      const outstanding = arr.filter(i => i.status === 'AUTHORISED').reduce((s, i) => s + (i.amountDue || 0), 0)
      const paymentsWeek = Array.isArray(payData) ? payData.reduce((s, p) => s + (p.amount || 0), 0) : 0
      const overdue = arr.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + (i.amountDue || 0), 0)
      setStats({ totalRevenue, outstanding, paymentsWeek, overdue })
    } catch {
      toast.error('Failed to load invoice data')
    } finally {
      setLoading(false)
    }
  }

  async function createInvoice() {
    if (!form.contact || !form.amount || !form.dueDate) {
      toast.error('Please fill all fields')
      return
    }
    try {
      const res = await fetch('/api/xero/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: form.contact,
          contactEmail: '',
          description: form.description,
          amount: form.amount,
          dueDate: form.dueDate,
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Invoice created in Xero')
      setShowModal(false)
      setForm({ contact: '', description: '', amount: '', dueDate: '' })
      loadData()
    } catch {
      toast.error('Failed to create invoice')
    }
  }

  if (!connected) return <XeroConnectBanner />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[
          { label: 'Total Revenue MTD', value: formatZAR(stats.totalRevenue), color: theme.success },
          { label: 'Outstanding Invoices', value: formatZAR(stats.outstanding), color: '#4a7fd4' },
          { label: 'Payments This Week', value: formatZAR(stats.paymentsWeek), color: theme.bronzeDark },
          { label: 'Overdue Amount', value: formatZAR(stats.overdue), color: theme.danger },
        ].map((s) => (
          <div key={s.label} style={cardStyle}>
            <div style={{ ...fieldLabel, marginBottom: 8, fontWeight: 700 }}>{s.label}</div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 26, color: s.color }}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
          <h3 style={sectionTitle}>Invoices</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            {(['ALL', 'PAID', 'AUTHORISED', 'OVERDUE', 'DRAFT'] as const).map((s) => (
              <FilterChip key={s} active={filter === s} onClick={() => setFilter(s)}>
                {s === 'AUTHORISED' ? 'Outstanding' : s.charAt(0) + s.slice(1).toLowerCase()}
              </FilterChip>
            ))}
            <button onClick={() => setShowModal(true)} style={{ ...primaryButton, fontSize: 13, padding: '6px 14px' }}>
              + Create Invoice
            </button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
              {['Contact', 'Invoice #', 'Amount', 'Due Date', 'Status'].map((h) => (
                <th key={h} style={tableHead}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: theme.textMuted }}>Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: theme.textMuted }}>No invoices found</td></tr>
            ) : invoices.slice(0, 50).map((inv) => {
              const sc = STATUS_COLORS[inv.status || 'DRAFT'] || STATUS_COLORS.DRAFT
              return (
                <tr key={inv.invoiceID} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{inv.contact?.name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: theme.bronzeDark, fontWeight: 600 }}>{inv.invoiceNumber || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{formatZAR(inv.total || 0)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{inv.dueDate ? format(new Date(inv.dueDate), 'd MMM yyyy') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', ...sc }}>{inv.status}</span>
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

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(44, 38, 32, 0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ ...cardStyle, width: 420, maxWidth: '92vw' }}>
            <h2 style={{ ...sectionTitle, marginBottom: 20 }}>Create Invoice</h2>
            {[
              { label: 'Contact Name', key: 'contact', type: 'text', placeholder: 'John Smith' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Table Mountain Tour — 15 Jun' },
              { label: 'Amount (ZAR)', key: 'amount', type: 'number', placeholder: '2500.00' },
              { label: 'Due Date', key: 'dueDate', type: 'date', placeholder: '' },
            ].map((f) => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', ...fieldLabel, marginBottom: 5 }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                  style={inputStyle}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ ...secondaryButton, flex: 1 }}>Cancel</button>
              <button onClick={createInvoice} style={{ ...primaryButton, flex: 1 }}>Create</button>
            </div>
          </div>
        </div>
      )}
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
