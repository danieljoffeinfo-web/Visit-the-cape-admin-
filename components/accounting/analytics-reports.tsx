'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'

function formatZAR(amount: number) {
  return `R ${(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const TOUR_COLORS = ['#b8956a', '#6495ed', '#4caf84', '#ef5350', '#ffb74d']
const TOUR_TYPES = ["Table Mountain", "Chapman's Peak", "Stellenbosch", "Devil's Peak", "Bespoke Cape"]

type PnLMonth = {
  month: string
  revenue: number
  expenses: number
  profit: number
}

type TourRevenue = {
  name: string
  value: number
}

type KPIs = {
  netProfit: number
  totalIncome: number
  totalExpenses: number
  outstanding: number
}

export function AnalyticsReports({ connected }: { connected: boolean }) {
  const [range, setRange] = useState('6m')
  const [pnlData, setPnlData] = useState<PnLMonth[]>([])
  const [tourRevenue, setTourRevenue] = useState<TourRevenue[]>([])
  const [cashflow, setCashflow] = useState<{ month: string; in: number; out: number }[]>([])
  const [kpis, setKpis] = useState<KPIs>({ netProfit: 0, totalIncome: 0, totalExpenses: 0, outstanding: 0 })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!connected) return
    loadData()
  }, [connected, range])

  async function loadData() {
    setLoading(true)
    try {
      const [pnlRes, execRes] = await Promise.all([
        fetch(`/api/xero/reports?type=pnl&range=${range}`),
        fetch('/api/xero/reports?type=executive'),
      ])
      const pnlRaw = await pnlRes.json()
      const execRaw = await execRes.json()

      // Parse P&L
      const parsed: PnLMonth[] = (Array.isArray(pnlRaw) ? pnlRaw : []).map((m: { month: string; reports: unknown[] }) => {
        let revenue = 0, expenses = 0
        try {
          const report = m.reports?.[0] as { rows?: { rows?: { cells?: { value?: string }[] }[] }[] }
          const rows = report?.rows || []
          for (const section of rows) {
            for (const row of (section.rows || [])) {
              const cells = row.cells || []
              const label = cells[0]?.value?.toLowerCase() || ''
              const val = parseFloat(cells[1]?.value || '0')
              if (label.includes('income') || label.includes('revenue')) revenue += val
              if (label.includes('expense') || label.includes('cost')) expenses += val
            }
          }
        } catch { /* use zero */ }
        return { month: m.month, revenue: Math.abs(revenue), expenses: Math.abs(expenses), profit: Math.abs(revenue) - Math.abs(expenses) }
      })
      setPnlData(parsed)

      // Mock tour revenue breakdown until tracking categories are configured
      const totalRev = parsed.reduce((s, m) => s + m.revenue, 0)
      const splits = [0.35, 0.22, 0.18, 0.15, 0.10]
      setTourRevenue(TOUR_TYPES.map((name, i) => ({ name, value: Math.round(totalRev * splits[i]) })))

      // Cashflow from P&L
      setCashflow(parsed.map(m => ({ month: m.month, in: m.revenue, out: m.expenses })))

      // KPIs from executive summary
      try {
        const reports = Array.isArray(execRaw) ? execRaw : []
        const report = reports[0] as { rows?: { rows?: { cells?: { value?: string }[] }[] }[] }
        let totalIncome = 0, totalExpenses = 0, outstanding = 0
        for (const section of (report?.rows || [])) {
          for (const row of (section?.rows || [])) {
            const cells = row.cells || []
            const label = (cells[0]?.value || '').toLowerCase()
            const val = Math.abs(parseFloat(cells[1]?.value || '0'))
            if (label.includes('income')) totalIncome = val
            if (label.includes('expense')) totalExpenses = val
            if (label.includes('receivable') || label.includes('outstanding')) outstanding = val
          }
        }
        setKpis({ netProfit: totalIncome - totalExpenses, totalIncome, totalExpenses, outstanding })
      } catch { /* keep zeros */ }
    } catch {
      toast.error('Failed to load analytics data')
    } finally {
      setLoading(false)
    }
  }

  if (!connected) return (
    <div style={{ background: '#1a1815', border: '1px solid rgba(184,149,106,0.25)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, textTransform: 'uppercase', marginBottom: 8 }}>Connect Xero to Unlock Analytics</h3>
      <a href="/api/xero/connect" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', textDecoration: 'none', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>Connect Xero</a>
    </div>
  )

  const cardStyle = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }
  const ranges = [{ v: '1m', l: 'This Month' }, { v: '3m', l: 'Last 3M' }, { v: '6m', l: 'Last 6M' }, { v: '1y', l: 'This Year' }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Date range picker */}
      <div style={{ display: 'flex', gap: 8 }}>
        {ranges.map(r => (
          <button key={r.v} onClick={() => setRange(r.v)} style={{ padding: '6px 14px', borderRadius: 4, border: '1px solid rgba(240,236,228,0.12)', background: range === r.v ? 'rgba(184,149,106,0.15)' : 'transparent', color: range === r.v ? '#b8956a' : 'rgba(240,236,228,0.55)', cursor: 'pointer', fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>
            {r.l}
          </button>
        ))}
      </div>

      {/* KPIs row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
        {[
          { label: 'Net Profit', value: formatZAR(kpis.netProfit), color: kpis.netProfit >= 0 ? '#4caf84' : '#ef5350' },
          { label: 'Total Income', value: formatZAR(kpis.totalIncome), color: '#b8956a' },
          { label: 'Total Expenses', value: formatZAR(kpis.totalExpenses), color: '#ef5350' },
          { label: 'Outstanding Receivables', value: formatZAR(kpis.outstanding), color: '#6495ed' },
        ].map(k => (
          <div key={k.label} style={cardStyle}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.45)', marginBottom: 8 }}>{k.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24, color: k.color }}>{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      {/* P&L Chart */}
      <div style={cardStyle}>
        <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20 }}>Revenue vs Expenses</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={pnlData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,236,228,0.08)" />
            <XAxis dataKey="month" stroke="rgba(240,236,228,0.35)" tick={{ fontSize: 12, fill: 'rgba(240,236,228,0.55)' }} />
            <YAxis stroke="rgba(240,236,228,0.35)" tick={{ fontSize: 11, fill: 'rgba(240,236,228,0.55)' }} tickFormatter={v => `R${(v/1000).toFixed(0)}k`} />
            <Tooltip contentStyle={{ background: '#1a1815', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 6, color: '#f0ece4' }} formatter={(v: unknown) => formatZAR(Number(v))} />
            <Legend wrapperStyle={{ color: 'rgba(240,236,228,0.55)', fontSize: 12 }} />
            <Bar dataKey="revenue" name="Revenue" fill="#b8956a" radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="rgba(239,83,80,0.6)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        {/* Revenue by Tour Type */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20 }}>Revenue by Tour Type</h3>
          {tourRevenue.every(t => t.value === 0) ? (
            <div style={{ color: 'rgba(240,236,228,0.4)', textAlign: 'center', padding: '40px 0' }}>No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={tourRevenue} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value">
                  {tourRevenue.map((_, i) => <Cell key={i} fill={TOUR_COLORS[i % TOUR_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: '#1a1815', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 6, color: '#f0ece4' }} formatter={(v: unknown) => formatZAR(Number(v))} />
                <Legend wrapperStyle={{ color: 'rgba(240,236,228,0.55)', fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Cashflow */}
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20 }}>Cashflow Summary</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cashflow} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(240,236,228,0.08)" />
              <XAxis dataKey="month" stroke="rgba(240,236,228,0.35)" tick={{ fontSize: 11, fill: 'rgba(240,236,228,0.55)' }} />
              <YAxis stroke="rgba(240,236,228,0.35)" tick={{ fontSize: 11, fill: 'rgba(240,236,228,0.55)' }} tickFormatter={v => `R${(v/1000).toFixed(0)}k`} />
              <Tooltip contentStyle={{ background: '#1a1815', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 6, color: '#f0ece4' }} formatter={(v: unknown) => formatZAR(Number(v))} />
              <Legend wrapperStyle={{ color: 'rgba(240,236,228,0.55)', fontSize: 12 }} />
              <Line type="monotone" dataKey="in" name="Money In" stroke="#4caf84" strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="out" name="Money Out" stroke="#ef5350" strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
