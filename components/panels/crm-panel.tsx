'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { format } from 'date-fns'

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

  const card = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>CRM</h1>
        <div style={{ fontSize: 13, color: 'rgba(240,236,228,0.5)' }}>{customers.length} contacts</div>
      </div>

      <div style={card}>
        {loading ? <div style={{ color: 'rgba(240,236,228,0.4)', padding: 12 }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                {['Name', 'Email', 'Phone', 'Bookings', 'First Seen', xeroConnected ? 'Xero Invoiced' : null, xeroConnected ? 'Xero Status' : null, xeroConnected ? 'Xero' : null].filter(Boolean).map(h => (
                  <th key={h!} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && <tr><td colSpan={8} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,236,228,0.4)' }}>No customers yet</td></tr>}
              {customers.map(c => (
                <tr key={c.id} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                  <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>{c.name}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{c.email}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{c.phone || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13 }}>{c.total_bookings || 0}</td>
                  <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{format(new Date(c.created_at), 'd MMM yyyy')}</td>
                  {xeroConnected && (
                    <>
                      <td style={{ padding: '10px 12px', fontSize: 13 }}>
                        {typeof c.xero_total_invoiced === 'number' ? `R ${c.xero_total_invoiced.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                      </td>
                      <td style={{ padding: '10px 12px', fontSize: 13, color: c.xero_contact_id ? '#4caf84' : 'rgba(240,236,228,0.5)' }}>
                        {c.xero_last_status || (c.xero_contact_id ? 'In Xero' : '—')}
                      </td>
                      <td style={{ padding: '10px 12px' }}>
                        {c.xero_contact_id ? (
                          <span style={{ fontSize: 12, color: '#4caf84' }}>✓ In Xero</span>
                        ) : (
                          <button onClick={() => createXeroContact(c)} style={{ padding: '4px 10px', fontSize: 11, borderRadius: 4, border: '1px solid rgba(184,149,106,0.3)', background: 'transparent', color: '#b8956a', cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>
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
