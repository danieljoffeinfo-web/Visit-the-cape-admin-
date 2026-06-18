'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { cardStyle, fieldLabel, primaryButton, secondaryButton, sectionTitle, theme } from '@/lib/theme'

function formatZAR(amount: number) {
  return `R ${(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const TOUR_TYPES = ["Table Mountain", "Chapman's Peak", "Stellenbosch", "Devil's Peak", 'Bespoke Cape']

const tableHead = {
  padding: '8px 12px',
  textAlign: 'left' as const,
  fontSize: 11,
  letterSpacing: '0.1em',
  textTransform: 'uppercase' as const,
  color: theme.textMuted,
  fontWeight: 700,
}

const selectStyle = {
  padding: '5px 8px',
  background: theme.surface,
  border: `1px solid ${theme.border}`,
  borderRadius: 6,
  color: theme.text,
  fontSize: 12,
  fontFamily: theme.bodyFont,
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

export function AdvancedSync({ connected }: { connected: boolean }) {
  const [activeTab, setActiveTab] = useState<'contacts' | 'accounts' | 'tracking' | 'bank'>('contacts')
  const [contacts, setContacts] = useState<XeroContact[]>([])
  const [accounts, setAccounts] = useState<XeroAccount[]>([])
  const [tracking, setTracking] = useState<{ categories: XeroCategory[]; mappings: XeroMapping[] }>({ categories: [], mappings: [] })
  const [bankTxns, setBankTxns] = useState<XeroBankTxn[]>([])
  const [bankFilter, setBankFilter] = useState('all')
  const [loading, setLoading] = useState(false)
  const [pendingMap, setPendingMap] = useState<Record<string, { cat: string; opt: string }>>({})

  useEffect(() => {
    if (!connected) return
    loadTab(activeTab)
  }, [connected, activeTab, bankFilter])

  async function loadTab(tab: string) {
    setLoading(true)
    try {
      if (tab === 'contacts') {
        const res = await fetch('/api/xero/contacts')
        setContacts(await res.json())
      } else if (tab === 'accounts') {
        const res = await fetch('/api/xero/accounts')
        setAccounts(await res.json())
      } else if (tab === 'tracking') {
        const res = await fetch('/api/xero/tracking')
        setTracking(await res.json())
      } else if (tab === 'bank') {
        const q = bankFilter === 'reconciled' ? '?reconciled=true' : bankFilter === 'unreconciled' ? '?reconciled=false' : ''
        const res = await fetch(`/api/xero/bank${q}`)
        setBankTxns(await res.json())
      }
    } catch {
      toast.error(`Failed to load ${tab} data`)
    } finally {
      setLoading(false)
    }
  }

  async function syncContact(c: XeroContact) {
    try {
      await fetch('/api/xero/contacts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId: c.contactID, name: c.name, email: c.emailAddress }),
      })
      toast.success(`${c.name} synced to CRM`)
    } catch {
      toast.error('Sync failed')
    }
  }

  async function syncAllContacts() {
    for (const c of contacts) {
      await syncContact(c)
    }
    toast.success(`All ${contacts.length} contacts synced`)
  }

  async function saveMapping(tourType: string) {
    const m = pendingMap[tourType]
    if (!m?.cat) { toast.error('Select a category first'); return }
    try {
      await fetch('/api/xero/tracking', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tour_type: tourType, xero_category_id: m.cat, xero_option_id: m.opt }),
      })
      toast.success('Mapping saved')
      loadTab('tracking')
    } catch {
      toast.error('Save failed')
    }
  }

  if (!connected) {
    return (
      <div style={{ ...cardStyle, textAlign: 'center', border: `1px solid ${theme.bronzeBorder}` }}>
        <h3 style={{ ...sectionTitle, marginBottom: 8 }}>Connect Xero to Unlock Sync</h3>
        <a href="/api/xero/connect" style={{ ...primaryButton, textDecoration: 'none', display: 'inline-block' }}>Connect Xero</a>
      </div>
    )
  }

  const tabs = ['contacts', 'accounts', 'tracking', 'bank'] as const
  const tabLabels: Record<string, string> = { contacts: 'Contacts Sync', accounts: 'Chart of Accounts', tracking: 'Tracking Categories', bank: 'Bank Transactions' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', gap: 4, borderBottom: `1px solid ${theme.borderStrong}`, paddingBottom: 0, flexWrap: 'wrap' }}>
        {tabs.map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              color: activeTab === t ? theme.bronzeDark : theme.text,
              cursor: 'pointer',
              fontSize: 13,
              fontWeight: activeTab === t ? 700 : 600,
              fontFamily: theme.bodyFont,
              borderBottom: `2px solid ${activeTab === t ? theme.bronze : 'transparent'}`,
              marginBottom: -1,
            }}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {activeTab === 'contacts' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={sectionTitle}>Xero Contacts</h3>
            <button onClick={syncAllContacts} style={{ ...primaryButton, fontSize: 13, padding: '6px 14px' }}>
              Sync All to CRM
            </button>
          </div>
          {loading ? <div style={{ color: theme.textMuted }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
                  {['Name', 'Email', 'Total Invoiced', 'Last Invoice', ''].map((h) => (
                    <th key={h} style={tableHead}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(contacts) ? contacts : []).slice(0, 30).map((c) => (
                  <tr key={c.contactID} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{c.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{c.emailAddress || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{formatZAR(c.totalInvoiced || 0)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{c.updatedDateUTC ? new Date(c.updatedDateUTC).toLocaleDateString('en-ZA') : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => syncContact(c)} style={{ ...secondaryButton, fontSize: 12, padding: '4px 10px' }}>
                        Sync to CRM
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'accounts' && (
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, marginBottom: 16 }}>Chart of Accounts</h3>
          {loading ? <div style={{ color: theme.textMuted }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
                  {['Code', 'Name', 'Type', 'YTD Balance'].map((h) => (
                    <th key={h} style={tableHead}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(accounts) ? accounts : []).map((a) => (
                  <tr key={a.accountID} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted, fontFamily: 'monospace' }}>{a.code}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{a.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{a.type}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{a.currentBalance !== undefined ? formatZAR(a.currentBalance) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'tracking' && (
        <div style={cardStyle}>
          <h3 style={{ ...sectionTitle, marginBottom: 16 }}>Map Tours to Tracking Categories</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
                {['DF Travel Tour', 'Xero Category', 'Option', ''].map((h) => (
                  <th key={h} style={tableHead}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOUR_TYPES.map((tour) => {
                const saved = tracking.mappings?.find((m) => m.tour_type === tour)
                const pm = pendingMap[tour] || { cat: saved?.xero_category_id || '', opt: saved?.xero_option_id || '' }
                const cats = tracking.categories || []
                const selectedCat = cats.find((c) => c.trackingCategoryID === pm.cat)

                return (
                  <tr key={tour} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{tour}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={pm.cat}
                        onChange={(e) => setPendingMap((p) => ({ ...p, [tour]: { ...pm, cat: e.target.value, opt: '' } }))}
                        style={selectStyle}
                      >
                        <option value="">— Select —</option>
                        {cats.map((c) => <option key={c.trackingCategoryID} value={c.trackingCategoryID}>{c.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={pm.opt}
                        onChange={(e) => setPendingMap((p) => ({ ...p, [tour]: { ...pm, opt: e.target.value } }))}
                        style={selectStyle}
                      >
                        <option value="">— Option —</option>
                        {(selectedCat?.options || []).map((o: XeroCategoryOption) => <option key={o.trackingOptionID} value={o.trackingOptionID}>{o.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => saveMapping(tour)} style={{ ...primaryButton, fontSize: 12, padding: '4px 10px' }}>
                        {saved ? 'Update' : 'Save'}
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'bank' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h3 style={sectionTitle}>Bank Transactions</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'reconciled', 'unreconciled'].map((f) => (
                <FilterChip key={f} active={bankFilter === f} onClick={() => setBankFilter(f)}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </FilterChip>
              ))}
            </div>
          </div>
          {loading ? <div style={{ color: theme.textMuted }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
                  {['Date', 'Description', 'Amount', 'Reconciled', 'Account'].map((h) => (
                    <th key={h} style={tableHead}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(bankTxns) ? bankTxns : []).slice(0, 50).map((t, i) => (
                  <tr key={i} style={{ borderBottom: `1px solid ${theme.border}` }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{t.date ? new Date(t.date).toLocaleDateString('en-ZA') : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{t.reference || t.narration || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: (t.total || 0) >= 0 ? theme.success : theme.danger }}>{formatZAR(Math.abs(t.total || 0))}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 7px', borderRadius: 10, fontSize: 11, background: t.isReconciled ? 'rgba(61, 139, 99, 0.12)' : theme.surfaceMuted, color: t.isReconciled ? theme.success : theme.textMuted }}>
                        {t.isReconciled ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{t.bankAccount?.name || '—'}</td>
                  </tr>
                ))}
                {(Array.isArray(bankTxns) ? bankTxns : []).length === 0 && !loading && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: theme.textMuted }}>No transactions found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

type XeroContact = { contactID?: string; name?: string; emailAddress?: string; totalInvoiced?: number; updatedDateUTC?: string }
type XeroAccount = { accountID?: string; code?: string; name?: string; type?: string; currentBalance?: number }
type XeroCategory = { trackingCategoryID?: string; name?: string; options?: XeroCategoryOption[] }
type XeroCategoryOption = { trackingOptionID?: string; name?: string }
type XeroMapping = { tour_type: string; xero_category_id?: string; xero_option_id?: string }
type XeroBankTxn = { date?: string; reference?: string; narration?: string; total?: number; isReconciled?: boolean; bankAccount?: { name?: string } }
