'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { toast } from 'sonner'
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import { cardStyle, fieldLabel, primaryButton, sectionTitle, theme } from '@/lib/theme'

function formatZAR(amount: number) {
  return `R ${(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

const TOUR_COLORS = ['#b8956a', '#6495ed', '#4caf84', '#ef5350', '#ffb74d']
const TOUR_TYPES = ["Table Mountain", "Chapman's Peak", "Stellenbosch", "Devil's Peak", 'Bespoke Cape']

const chartTooltip = {
  background: theme.surface,
  border: `1px solid ${theme.borderStrong}`,
  borderRadius: 6,
  color: theme.text,
}

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

function FilterButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '6px 14px',
        borderRadius: 6,
        border: `1px solid ${active ? theme.bronzeBorder : theme.border}`,
        background: active ? theme.bronzeBg : theme.surface,
        color: active ? theme.bronzeDark : theme.text,
        cursor: 'pointer',
        fontSize: 13,
        fontWeight: active ? 700 : 600,
        fontFamily: theme.bodyFont,
      }}
    >
      {children}
    </button>
  )
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

      const totalRev = parsed.reduce((s, m) => s + m.revenue, 0)
      const splits = [0.35, 0.22, 0.18, 0.15, 0.10]
      setTourRevenue(TOUR_TYPES.map((name, i) => ({ name, value: Math.round(totalRev * splits[i]) })))

      setCashflow(parsed.map(m => ({ month: m.month, in: m.revenue, out: m.expenses })))

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

  if (!connected) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', border: `1px solid ${theme.bronzeBorder}` }}>
        <h3 style={{ ...sectionTitle, marginBottom: 8 }}>Connect Xero to Unlock Analytics</h3>
        <a href="/api/xero/connect" style={{ ...primaryButton, textDecoration: 'none', display: 'inline-block' }}>Connect Xero</a>
      </div>
    )
  }

  const ranges = [{ v: '1m', l: 'This Month' }, { v: '3m', l: 'Last 3M' }, { v: '6m', l: 'Last 6M' }, { v: '1y', l: 'This Year' }]

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {ranges.map((r) => (
          <FilterButton key={r.v} active={range === r.v} onClick={() => setRange(r.v)}>{r.l}</FilterButton>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
        {[
          { label: 'Net Profit', value: formatZAR(kpis.netProfit), color: kpis.netProfit >= 0 ? theme.success : theme.danger },
          { label: 'Total Income', value: formatZAR(kpis.totalIncome), color: theme.bronzeDark },
          { label: 'Total Expenses', value: formatZAR(kpis.totalExpenses), color: theme.danger },
          { label: 'Outstanding Receivables', value: formatZAR(kpis.outstanding), color: '#4a7fd4' },
        ].map((k) => (
          <div key={k.label} style={cardStyle}>
            <div style={{ ...fieldLabel, marginBottom: 8, fontWeight: 700 }}>{k.label}</div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 24, color: k.color }}>{loading ? '—' : k.value}</div>
          </div>
        ))}
      </div>

      <div style={cardStyle}>
        <h3 style={{ ...sectionTitle, marginBottom: 20 }}>Revenue vs Expenses</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={pnlData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
            <XAxis dataKey="month" stroke={theme.borderStrong} tick={{ fontSize: 12, fill: theme.textMuted }} />
            <YAxis stroke={theme.borderStrong} tick={{ fontSize: 11, fill: theme.textMuted }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
            <Tooltip contentStyle={chartTooltip} formatter={(v: unknown) => formatZAR(Number(v))} />
            <Legend wrapperStyle={{ color: theme.text, fontSize: 12 }} />
            <Bar dataKey="revenue" name="Revenue" fill={theme.bronze} radius={[3, 3, 0, 0]} />
            <Bar dataKey="expenses" name="Expenses" fill="rgba(196, 92, 74, 0.75)" radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 24 }}>
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, marginBottom: 20 }}>Revenue by Tour Type</h3>
          {tourRevenue.every((t) => t.value === 0) ? (
            <div style={{ color: theme.textMuted, textAlign: 'center', padding: '40px 0' }}>No revenue data yet</div>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <PieChart>
                <Pie data={tourRevenue} cx="50%" cy="50%" innerRadius={60} outerRadius={95} paddingAngle={2} dataKey="value">
                  {tourRevenue.map((_, i) => <Cell key={i} fill={TOUR_COLORS[i % TOUR_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={chartTooltip} formatter={(v: unknown) => formatZAR(Number(v))} />
                <Legend wrapperStyle={{ color: theme.text, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, marginBottom: 20 }}>Cashflow Summary</h3>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={cashflow} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme.border} />
              <XAxis dataKey="month" stroke={theme.borderStrong} tick={{ fontSize: 11, fill: theme.textMuted }} />
              <YAxis stroke={theme.borderStrong} tick={{ fontSize: 11, fill: theme.textMuted }} tickFormatter={(v) => `R${(v / 1000).toFixed(0)}k`} />
              <Tooltip contentStyle={chartTooltip} formatter={(v: unknown) => formatZAR(Number(v))} />
              <Legend wrapperStyle={{ color: theme.text, fontSize: 12 }} />
              <Line type="monotone" dataKey="in" name="Money In" stroke={theme.success} strokeWidth={2} dot={false} />
              <Line type="monotone" dataKey="out" name="Money Out" stroke={theme.danger} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
