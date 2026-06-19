'use client'

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { theme } from '@/lib/theme'

const CHART_COLORS = ['#b8956a', '#4caf84', '#6495ed', '#ef5350', '#f4c542', '#8e6ad8']

type RevenueItem = {
  id: string
  name: string
  revenue: number
  bookedDays: number
  bookingCount: number
  registrationNumber: string | null
}

function money(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function FleetRevenueChart({ data }: { data: RevenueItem[] }) {
  if (data.length === 0) {
    return (
      <div style={{ color: theme.textFaint, paddingTop: 40, textAlign: 'center' }}>
        Revenue chart appears after your first booking.
      </div>
    )
  }

  return (
    <>
      <div style={{ width: '100%', height: 220 }}>
        <ResponsiveContainer>
          <PieChart>
            <Pie data={data} dataKey="revenue" nameKey="name" innerRadius={50} outerRadius={85} paddingAngle={2}>
              {data.map((item, index) => (
                <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => money(Number(value || 0))} />
          </PieChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
        {data.map((item, index) => (
          <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '12px 1fr auto', gap: 10, alignItems: 'center' }}>
            <div style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[index % CHART_COLORS.length] }} />
            <div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{item.name}</div>
              <div style={{ fontSize: 11, color: theme.textMuted }}>
                {item.registrationNumber || 'No reg'} · {item.bookedDays} days
              </div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 13 }}>{money(item.revenue)}</div>
          </div>
        ))}
      </div>
    </>
  )
}
