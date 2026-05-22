'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'

function formatZAR(amount: number) {
  return `R ${(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const TOUR_TYPES = ["Table Mountain", "Chapman's Peak", "Stellenbosch", "Devil's Peak", "Bespoke Cape"]

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

  if (!connected) return (
    <div style={{ background: '#1a1815', border: '1px solid rgba(184,149,106,0.25)', borderRadius: 8, padding: 32, textAlign: 'center' }}>
      <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, textTransform: 'uppercase', marginBottom: 8 }}>Connect Xero to Unlock Sync</h3>
      <a href="/api/xero/connect" style={{ display: 'inline-block', padding: '10px 24px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', textDecoration: 'none', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>Connect Xero</a>
    </div>
  )

  const cardStyle = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }
  const tabs = ['contacts', 'accounts', 'tracking', 'bank'] as const
  const tabLabels: Record<string, string> = { contacts: 'Contacts Sync', accounts: 'Chart of Accounts', tracking: 'Tracking Categories', bank: 'Bank Transactions' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      {/* Sub-tabs */}
      <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid rgba(240,236,228,0.12)', paddingBottom: 0 }}>
        {tabs.map(t => (
          <button key={t} onClick={() => setActiveTab(t)} style={{ padding: '8px 16px', border: 'none', background: 'transparent', color: activeTab === t ? '#b8956a' : 'rgba(240,236,228,0.5)', cursor: 'pointer', fontSize: 13, fontFamily: "'Barlow', sans-serif", borderBottom: `2px solid ${activeTab === t ? '#b8956a' : 'transparent'}`, marginBottom: -1 }}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {/* Contacts */}
      {activeTab === 'contacts' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Xero Contacts</h3>
            <button onClick={syncAllContacts} style={{ padding: '6px 14px', borderRadius: 4, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>
              Sync All to CRM
            </button>
          </div>
          {loading ? <div style={{ color: 'rgba(240,236,228,0.4)' }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                  {['Name', 'Email', 'Total Invoiced', 'Last Invoice', ''].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(contacts) ? contacts : []).slice(0, 30).map(c => (
                  <tr key={c.contactID} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{c.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{c.emailAddress || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{formatZAR(c.totalInvoiced || 0)}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{c.updatedDateUTC ? new Date(c.updatedDateUTC).toLocaleDateString('en-ZA') : '—'}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => syncContact(c)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, border: '1px solid rgba(184,149,106,0.3)', background: 'transparent', color: '#b8956a', cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>
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

      {/* Accounts */}
      {activeTab === 'accounts' && (
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>Chart of Accounts</h3>
          {loading ? <div style={{ color: 'rgba(240,236,228,0.4)' }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                  {['Code', 'Name', 'Type', 'YTD Balance'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(accounts) ? accounts : []).map(a => (
                  <tr key={a.accountID} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)', fontFamily: 'monospace' }}>{a.code}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{a.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{a.type}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{a.currentBalance !== undefined ? formatZAR(a.currentBalance) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tracking Categories */}
      {activeTab === 'tracking' && (
        <div style={cardStyle}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>Map Tours to Tracking Categories</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                {['DF Travel Tour', 'Xero Category', 'Option', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TOUR_TYPES.map(tour => {
                const saved = tracking.mappings?.find(m => m.tour_type === tour)
                const pm = pendingMap[tour] || { cat: saved?.xero_category_id || '', opt: saved?.xero_option_id || '' }
                const cats = tracking.categories || []
                const selectedCat = cats.find(c => c.trackingCategoryID === pm.cat)

                return (
                  <tr key={tour} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{tour}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={pm.cat}
                        onChange={e => setPendingMap(p => ({ ...p, [tour]: { ...pm, cat: e.target.value, opt: '' } }))}
                        style={{ padding: '5px 8px', background: 'rgba(240,236,228,0.05)', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 4, color: '#f0ece4', fontSize: 12, fontFamily: "'Barlow', sans-serif" }}
                      >
                        <option value="">— Select —</option>
                        {cats.map(c => <option key={c.trackingCategoryID} value={c.trackingCategoryID}>{c.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <select
                        value={pm.opt}
                        onChange={e => setPendingMap(p => ({ ...p, [tour]: { ...pm, opt: e.target.value } }))}
                        style={{ padding: '5px 8px', background: 'rgba(240,236,228,0.05)', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 4, color: '#f0ece4', fontSize: 12, fontFamily: "'Barlow', sans-serif" }}
                      >
                        <option value="">— Option —</option>
                        {(selectedCat?.options || []).map((o: XeroCategoryOption) => <option key={o.trackingOptionID} value={o.trackingOptionID}>{o.name}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => saveMapping(tour)} style={{ padding: '4px 10px', fontSize: 12, borderRadius: 4, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 600, fontFamily: "'Barlow', sans-serif" }}>
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

      {/* Bank Transactions */}
      {activeTab === 'bank' && (
        <div style={cardStyle}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Bank Transactions</h3>
            <div style={{ display: 'flex', gap: 6 }}>
              {['all', 'reconciled', 'unreconciled'].map(f => (
                <button key={f} onClick={() => setBankFilter(f)} style={{ padding: '4px 10px', borderRadius: 4, border: '1px solid rgba(240,236,228,0.12)', background: bankFilter === f ? 'rgba(184,149,106,0.15)' : 'transparent', color: bankFilter === f ? '#b8956a' : 'rgba(240,236,228,0.55)', cursor: 'pointer', fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>
          {loading ? <div style={{ color: 'rgba(240,236,228,0.4)' }}>Loading...</div> : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                  {['Date', 'Description', 'Amount', 'Reconciled', 'Account'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(Array.isArray(bankTxns) ? bankTxns : []).slice(0, 50).map((t, i) => (
                  <tr key={i} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{t.date ? new Date(t.date).toLocaleDateString('en-ZA') : '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{t.reference || t.narration || '—'}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: (t.total || 0) >= 0 ? '#4caf84' : '#ef5350' }}>{formatZAR(Math.abs(t.total || 0))}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 7px', borderRadius: 10, fontSize: 11, background: t.isReconciled ? 'rgba(76,175,132,0.2)' : 'rgba(240,236,228,0.08)', color: t.isReconciled ? '#4caf84' : 'rgba(240,236,228,0.5)' }}>
                        {t.isReconciled ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13, color: 'rgba(240,236,228,0.6)' }}>{t.bankAccount?.name || '—'}</td>
                  </tr>
                ))}
                {(Array.isArray(bankTxns) ? bankTxns : []).length === 0 && !loading && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,236,228,0.4)' }}>No transactions found</td></tr>
                )}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

// Types
type XeroContact = { contactID?: string; name?: string; emailAddress?: string; totalInvoiced?: number; updatedDateUTC?: string }
type XeroAccount = { accountID?: string; code?: string; name?: string; type?: string; currentBalance?: number }
type XeroCategory = { trackingCategoryID?: string; name?: string; options?: XeroCategoryOption[] }
type XeroCategoryOption = { trackingOptionID?: string; name?: string }
type XeroMapping = { tour_type: string; xero_category_id?: string; xero_option_id?: string }
type XeroBankTxn = { date?: string; reference?: string; narration?: string; total?: number; isReconciled?: boolean; bankAccount?: { name?: string } }
