'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'

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
  PAID: { bg: 'rgba(76,175,132,0.2)', color: '#4caf84' },
  AUTHORISED: { bg: 'rgba(100,149,237,0.2)', color: '#6495ed' },
  OVERDUE: { bg: 'rgba(239,83,80,0.2)', color: '#ef5350' },
  DRAFT: { bg: 'rgba(240,236,228,0.1)', color: 'rgba(240,236,228,0.55)' },
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

  const cardStyle = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Total Revenue MTD', value: formatZAR(stats.totalRevenue), color: '#4caf84' },
          { label: 'Outstanding Invoices', value: formatZAR(stats.outstanding), color: '#6495ed' },
          { label: 'Payments This Week', value: formatZAR(stats.paymentsWeek), color: '#b8956a' },
          { label: 'Overdue Amount', value: formatZAR(stats.overdue), color: '#ef5350' },
        ].map((s) => (
          <div key={s.label} style={cardStyle}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.45)', marginBottom: 8 }}>{s.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, color: s.color }}>{loading ? '—' : s.value}</div>
          </div>
        ))}
      </div>

      {/* Invoices table */}
      <div style={cardStyle}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Invoices</h3>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {(['ALL', 'PAID', 'AUTHORISED', 'OVERDUE', 'DRAFT'] as const).map(s => (
              <button key={s} onClick={() => setFilter(s)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(240,236,228,0.12)', background: filter === s ? 'rgba(184,149,106,0.15)' : 'transparent', color: filter === s ? '#b8956a' : 'rgba(240,236,228,0.55)', cursor: 'pointer', fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>
                {s === 'AUTHORISED' ? 'Outstanding' : s.charAt(0) + s.slice(1).toLowerCase()}
              </button>
            ))}
            <button onClick={() => setShowModal(true)} style={{ padding: '6px 14px', borderRadius: 4, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
              + Create Invoice
            </button>
          </div>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
              {['Contact', 'Invoice #', 'Amount', 'Due Date', 'Status'].map(h => (
                <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,236,228,0.4)' }}>Loading...</td></tr>
            ) : invoices.length === 0 ? (
              <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,236,228,0.4)' }}>No invoices found</td></tr>
            ) : invoices.slice(0, 50).map((inv) => {
              const sc = STATUS_COLORS[inv.status || 'DRAFT'] || STATUS_COLORS.DRAFT
              return (
                <tr key={inv.invoiceID} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{inv.contact?.name || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.7)' }}>{inv.invoiceNumber || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{formatZAR(inv.total || 0)}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.7)' }}>{inv.dueDate ? format(new Date(inv.dueDate), 'd MMM yyyy') : '—'}</td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', ...sc }}>{inv.status}</span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Recent payments */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>Recent Payments</h3>
        {loading ? (
          <div style={{ color: 'rgba(240,236,228,0.4)', padding: 12 }}>Loading...</div>
        ) : payments.length === 0 ? (
          <div style={{ color: 'rgba(240,236,228,0.4)', padding: 12 }}>No recent payments</div>
        ) : payments.slice(0, 10).map((p) => (
          <div key={p.paymentID} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{p.invoice?.contact?.name || '—'}</div>
              <div style={{ fontSize: 11, color: 'rgba(240,236,228,0.45)', marginTop: 2 }}>{p.invoice?.invoiceNumber} · {p.date ? format(new Date(p.date), 'd MMM yyyy') : '—'}</div>
            </div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 18, color: '#4caf84' }}>{formatZAR(p.amount || 0)}</div>
          </div>
        ))}
      </div>

      {/* Create Invoice Modal */}
      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1815', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 10, padding: 32, width: 420 }}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20 }}>Create Invoice</h2>
            {[
              { label: 'Contact Name', key: 'contact', type: 'text', placeholder: 'John Smith' },
              { label: 'Description', key: 'description', type: 'text', placeholder: 'Table Mountain Tour — 15 Jun' },
              { label: 'Amount (ZAR)', key: 'amount', type: 'number', placeholder: '2500.00' },
              { label: 'Due Date', key: 'dueDate', type: 'date', placeholder: '' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.5)', marginBottom: 5 }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(prev => ({ ...prev, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(240,236,228,0.05)', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 5, color: '#f0ece4', fontSize: 14, fontFamily: "'Barlow', sans-serif", colorScheme: 'dark' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 5, border: '1px solid rgba(240,236,228,0.15)', background: 'transparent', color: 'rgba(240,236,228,0.6)', cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>Cancel</button>
              <button onClick={createInvoice} style={{ flex: 1, padding: '9px 0', borderRadius: 5, border: 'none', background: '#b8956a', color: '#0c0b09', cursor: 'pointer', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function XeroConnectBanner() {
  return (
    <div style={{ background: '#1a1815', border: '1px solid rgba(184,149,106,0.25)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
      <div style={{ fontSize: 36, marginBottom: 12 }}>🔗</div>
      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 8 }}>Connect Xero to Unlock This Section</h3>
      <p style={{ color: 'rgba(240,236,228,0.55)', fontSize: 14, marginBottom: 20 }}>Link your Xero account in Settings to view invoices, payments and reports.</p>
      <a href="/api/xero/connect" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', textDecoration: 'none', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
        Connect Xero
      </a>
    </div>
  )
}
