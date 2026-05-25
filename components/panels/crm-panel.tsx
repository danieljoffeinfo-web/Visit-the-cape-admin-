'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'

type Customer = {
  id: string
  name: string
  email: string
  phone?: string
  total_bookings?: number
  created_at: string
  xero_contact_id?: string
  xero_total_invoiced?: number
  xero_last_status?: string
}

export function CrmPanel() {
  const [customers, setCustomers] = useState<Customer[]>([])
  const [xeroConnected, setXeroConnected] = useState(false)
  const [xeroContacts, setXeroContacts] = useState<Record<string, { total: number; status: string }>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    setLoading(true)
    try {
      // Build customer list from bookings + enquiries
      const [bookRes, enqRes, xeroRes] = await Promise.all([
        supabase.from('tag_along_bookings').select('name, email, created_at').order('created_at', { ascending: false }),
        supabase.from('enquiries').select('name, email, created_at').order('created_at', { ascending: false }),
        fetch('/api/xero/status').then((res) => res.json()),
      ])

      const allContacts = new Map<string, Customer>()
      for (const b of (bookRes.data || [])) {
        if (!allContacts.has(b.email)) allContacts.set(b.email, { id: b.email, name: b.name, email: b.email, created_at: b.created_at, total_bookings: 1 })
        else allContacts.get(b.email)!.total_bookings! += 1
      }
      for (const e of (enqRes.data || [])) {
        if (!allContacts.has(e.email)) allContacts.set(e.email, { id: e.email, name: e.name, email: e.email, created_at: e.created_at, total_bookings: 0 })
      }
      setCustomers(Array.from(allContacts.values()))
      setXeroConnected(!!xeroRes.connected)

      if (xeroRes.connected) {
        const res = await fetch('/api/xero/contacts')
        const contacts = await res.json()
        const map: Record<string, { total: number; status: string }> = {}
        for (const c of (Array.isArray(contacts) ? contacts : [])) {
          if (c.emailAddress) map[c.emailAddress.toLowerCase()] = { total: c.totalInvoiced || 0, status: c.hasAttachments ? 'Active' : '—' }
        }
        setXeroContacts(map)
      }
    } catch {
      toast.error('Failed to load CRM data')
    } finally {
      setLoading(false)
    }
  }

  async function createXeroContact(c: Customer) {
    try {
      const auth = await fetch('/api/xero/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: c.name, email: c.email }),
      })
      if (!auth.ok) throw new Error()
      toast.success(`${c.name} added to Xero`)
      loadAll()
    } catch {
      toast.error('Failed to create Xero contact')
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
                {['Name', 'Email', 'Bookings', 'First Seen', xeroConnected ? 'Xero Invoiced' : null, xeroConnected ? 'Xero' : null].filter(Boolean).map(h => (
                  <th key={h!} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {customers.length === 0 && <tr><td colSpan={6} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,236,228,0.4)' }}>No customers yet</td></tr>}
              {customers.map(c => {
                const xeroData = xeroContacts[c.email.toLowerCase()]
                return (
                  <tr key={c.id} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>{c.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{c.email}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{c.total_bookings || 0}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{format(new Date(c.created_at), 'd MMM yyyy')}</td>
                    {xeroConnected && (
                      <>
                        <td style={{ padding: '10px 12px', fontSize: 13 }}>
                          {xeroData ? `R ${(xeroData.total || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          {xeroData ? (
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
                )
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
