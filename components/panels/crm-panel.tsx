'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { cardStyle, pageTitle, secondaryButton, theme } from '@/lib/theme'

type Customer = {
  id: string
  name: string
  email: string
  phone?: string | null
  total_bookings?: number | null
  created_at: string
  xero_contact_id?: string | null
  xero_total_invoiced?: number | null
  xero_last_status?: string | null
}

export function CrmPanel() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [xeroConnected, setXeroConnected] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      const [customersRes, xeroRes] = await Promise.all([
        fetch('/api/crm/customers', { cache: 'no-store' }),
        fetch('/api/xero/status').then((res) => res.json()),
      ])

      const customersJson = await customersRes.json()
      if (!customersRes.ok) {
        throw new Error(customersJson.error || 'Failed to load customers')
      }

      setCustomers((customersJson.customers || []) as Customer[])
      setXeroConnected(!!xeroRes.connected)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load CRM data')
    } finally {
      setLoading(false)
    }
  }

  async function createXeroContact(c: Customer) {
    try {
      const response = await fetch('/api/xero/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, email: c.email }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create Xero contact')
      toast.success(`${c.name} added to Xero`)
      loadAll()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create Xero contact')
    }
  }

  const thStyle = { padding: '8px 12px', textAlign: 'left' as const, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: theme.textMuted, fontWeight: 500 }
  const tdStyle = { padding: '10px 12px', fontSize: 13, color: theme.text }
  const tdMuted = { ...tdStyle, color: theme.textMuted }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={pageTitle}>CRM</h1>
        <div style={{ fontSize: 13, color: theme.textMuted }}>{customers.length} contacts</div>
      </div>

      <div style={cardStyle}>
        {loading ? <div style={{ color: theme.textFaint, padding: 12 }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
                {['Name', 'Email', 'Phone', 'Bookings', 'First Seen', xeroConnected ? 'Xero Invoiced' : null, xeroConnected ? 'Xero Status' : null, xeroConnected ? 'Xero' : null].filter(Boolean).map(h => (
                  <th key={h!} style={thStyle}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: theme.textFaint }}>No customers yet</td></tr>}
              {customers.map(c => (
                <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                  <td style={{ ...tdStyle, fontWeight: 500 }}>{c.name}</td>
                  <td style={tdMuted}>{c.email}</td>
                  <td style={tdMuted}>{c.phone || '—'}</td>
                  <td style={tdStyle}>{c.total_bookings || 0}</td>
                  <td style={tdMuted}>{format(new Date(c.created_at), 'd MMM yyyy')}</td>
                  {xeroConnected && (
                    <>
                      <td style={tdStyle}>
                        {typeof c.xero_total_invoiced === 'number' ? `R ${c.xero_total_invoiced.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ ...tdStyle, color: c.xero_contact_id ? theme.success : theme.textMuted }}>
                        {c.xero_last_status || (c.xero_contact_id ? 'In Xero' : '—')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {c.xero_contact_id ? (
                          <span style={{ fontSize: 12, color: theme.success }}>✓ In Xero</span>
                        ) : (
                          <button onClick={() => createXeroContact(c)} style={{ ...secondaryButton, padding: '4px 10px', fontSize: 11 }}>
                            Add to Xero
                          </button>
                        )}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
