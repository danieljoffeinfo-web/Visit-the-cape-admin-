'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { searchClients, type Client } from '@/lib/clients'
import {
  cardStyle,
  fieldLabel,
  inputStyle,
  pageTitle,
  primaryButton,
  secondaryButton,
  theme,
} from '@/lib/theme'

/**
 * Clients — everyone bookings have been made for.
 *
 * This was the CRM panel, which read the same table but had no way to add or
 * correct anyone: the only path into it was a fleet booking that happened to
 * raise a Xero invoice. Every other booking left no client behind, so the list
 * sat empty and the same person's details were retyped each time they came
 * back.
 */

type Draft = {
  id?: string
  name: string
  email: string
  phone: string
  accountNumber: string
  businessName: string
  vatNumber: string
  address: string
  notes: string
}

const EMPTY: Draft = {
  name: '',
  email: '',
  phone: '',
  accountNumber: '',
  businessName: '',
  vatNumber: '',
  address: '',
  notes: '',
}

export function ClientsPanel() {
  const [clients, setClients] = useState<Client[]>([])
  const [xeroConnected, setXeroConnected] = useState(false)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState<Draft | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [clientsRes, xeroRes] = await Promise.all([
        fetch('/api/clients', { cache: 'no-store' }),
        fetch('/api/xero/status').then((r) => r.json()).catch(() => ({ connected: false })),
      ])
      const data = await clientsRes.json()
      if (!clientsRes.ok) throw new Error(data.error || 'Failed to load clients')
      setClients((data.clients || []) as Client[])
      setXeroConnected(!!xeroRes.connected)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load clients')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const visible = useMemo(() => searchClients(clients, query), [clients, query])

  async function save() {
    if (!draft) return
    if (!draft.name.trim() || !draft.email.trim()) {
      toast.error('Name and email are required')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/clients', {
        method: draft.id ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draft),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save client')
      toast.success(draft.id ? 'Client updated' : 'Client added')
      setDraft(null)
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save client')
    } finally {
      setSaving(false)
    }
  }

  async function addToXero(client: Client) {
    try {
      const res = await fetch('/api/xero/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: client.name, email: client.email }),
      })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'Failed to create Xero contact')
      toast.success(`${client.name} added to Xero`)
      load()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create Xero contact')
    }
  }

  const th = {
    padding: '8px 12px',
    textAlign: 'left' as const,
    fontSize: 11,
    letterSpacing: '0.1em',
    textTransform: 'uppercase' as const,
    color: theme.textMuted,
    fontWeight: 600,
  }
  const td = { padding: '10px 12px', fontSize: 13, color: theme.text }
  const tdMuted = { ...td, color: theme.textMuted }

  /* Only name and email are required — everything else is there for the
     clients who need it. A form that demands a VAT number from a family
     booking a day out is worse than one that does not ask. */
  const fields: { key: keyof Draft; label: string; type?: string }[] = [
    { key: 'name', label: 'Name *' },
    { key: 'email', label: 'Email *', type: 'email' },
    { key: 'phone', label: 'Phone' , type: 'tel' },
    { key: 'accountNumber', label: 'Account Number' },
    { key: 'businessName', label: 'Business Name' },
    { key: 'vatNumber', label: 'VAT Number' },
  ]

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={pageTitle}>Clients</h1>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, business, email, phone, VAT"
            style={{ ...inputStyle, width: 260 }}
          />
          <button onClick={() => setDraft({ ...EMPTY })} style={primaryButton}>
            + New Client
          </button>
        </div>
      </div>

      {draft && (
        <div style={{ ...cardStyle, marginBottom: 20 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 14, color: theme.text }}>
            {draft.id ? 'Edit client' : 'New client'}
          </h3>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
              gap: 12,
              marginBottom: 12,
            }}
          >
            {fields.map((f) => (
              <div key={f.key}>
                <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>{f.label}</label>
                <input
                  type={f.type || 'text'}
                  value={draft[f.key] as string}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  style={inputStyle}
                />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Address</label>
            <textarea
              value={draft.address}
              onChange={(e) => setDraft({ ...draft, address: e.target.value })}
              rows={2}
              style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
              placeholder="Street, suburb, city, postal code"
            />
          </div>

          <div style={{ marginBottom: 14 }}>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Notes</label>
            <textarea
              value={draft.notes}
              onChange={(e) => setDraft({ ...draft, notes: e.target.value })}
              rows={2}
              style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
              placeholder="Anything worth remembering next time they book"
            />
          </div>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: '0 0 14px' }}>
            Saving only adds them here. Nothing goes to Xero unless you press Add to Xero on
            their row, and you never have to.
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={save} disabled={saving} style={primaryButton}>
              {saving ? 'Saving…' : draft.id ? 'Save changes' : 'Add client'}
            </button>
            <button onClick={() => setDraft(null)} style={secondaryButton}>
              Cancel
            </button>
          </div>
        </div>
      )}

      <div style={cardStyle}>
        {loading ? (
          <div style={{ color: theme.textFaint, padding: 12 }}>Loading…</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 820 }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
                  {['Name', 'Business', 'Email', 'Phone', 'Account', 'Bookings', 'Added', xeroConnected ? 'Xero' : null, '']
                    .filter((h) => h !== null)
                    .map((h, i) => (
                      <th key={`${h}-${i}`} style={th}>
                        {h}
                      </th>
                    ))}
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={9} style={{ padding: 24, textAlign: 'center', color: theme.textFaint }}>
                      {clients.length === 0
                        ? 'No clients yet. They are added automatically as bookings are taken, or you can add one now.'
                        : 'Nobody matches that search.'}
                    </td>
                  </tr>
                )}
                {visible.map((c) => (
                  <tr key={c.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ ...td, fontWeight: 600 }}>{c.name}</td>
                    <td style={tdMuted}>
                      {c.business_name || '—'}
                      {c.vat_number ? (
                        <span style={{ display: 'block', fontSize: 11 }}>VAT {c.vat_number}</span>
                      ) : null}
                    </td>
                    <td style={tdMuted}>{c.email}</td>
                    <td style={tdMuted}>{c.phone || '—'}</td>
                    <td style={tdMuted}>{c.account_number || '—'}</td>
                    <td style={td}>{c.total_bookings || 0}</td>
                    <td style={tdMuted}>{format(new Date(c.created_at), 'd MMM yyyy')}</td>
                    {xeroConnected && (
                      <td style={{ padding: '10px 12px' }}>
                        {c.xero_contact_id ? (
                          <span style={{ fontSize: 12, color: theme.success }}>✓ In Xero</span>
                        ) : (
                          <button
                            onClick={() => addToXero(c)}
                            style={{ ...secondaryButton, padding: '4px 10px', fontSize: 11 }}
                          >
                            Add to Xero
                          </button>
                        )}
                      </td>
                    )}
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      <button
                        onClick={() =>
                          setDraft({
                            id: c.id,
                            name: c.name,
                            email: c.email,
                            phone: c.phone || '',
                            accountNumber: c.account_number || '',
                            businessName: c.business_name || '',
                            vatNumber: c.vat_number || '',
                            address: c.address || '',
                            notes: c.notes || '',
                          })
                        }
                        style={{ ...secondaryButton, padding: '4px 10px', fontSize: 11 }}
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
