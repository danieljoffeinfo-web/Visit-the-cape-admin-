'use client'

import { useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import type { ActivityLogEntry } from '@/lib/auth-types'
import { UserColorBadge } from '@/components/user-badge'

const card = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }
const muted = 'rgba(240,236,228,0.45)'

export function ActivityLogsPanel() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [userFilter, setUserFilter] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')

  useEffect(() => { loadLogs() }, [userFilter, entityFilter, actionFilter, fromDate, toDate])

  async function loadLogs() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (userFilter) params.set('user_id', userFilter)
      if (entityFilter) params.set('entity_type', entityFilter)
      if (actionFilter) params.set('action', actionFilter)
      if (fromDate) params.set('from', fromDate)
      if (toDate) params.set('to', toDate)

      const res = await fetch(`/api/activity-logs?${params}`, { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load')
      setLogs(data.logs || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load activity logs')
    } finally {
      setLoading(false)
    }
  }

  const users = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>()
    for (const log of logs) {
      if (log.user_id) map.set(log.user_id, { id: log.user_id, name: log.user_name, color: log.user_color })
    }
    return Array.from(map.values())
  }, [logs])

  const entityTypes = useMemo(() => [...new Set(logs.map((l) => l.entity_type))].sort(), [logs])
  const actions = useMemo(() => [...new Set(logs.map((l) => l.action))].sort(), [logs])

  const inputStyle = {
    padding: '7px 10px',
    borderRadius: 5,
    border: '1px solid rgba(240,236,228,0.12)',
    background: 'rgba(240,236,228,0.04)',
    color: '#f0ece4',
    fontSize: 12,
    fontFamily: "'Barlow', sans-serif",
  } as const

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Activity Logs
        </h1>
        <div style={{ fontSize: 13, color: muted }}>{logs.length} entries</div>
      </div>

      <div style={{ ...card, marginBottom: 20, display: 'flex', flexWrap: 'wrap', gap: 10 }}>
        <select value={userFilter} onChange={(e) => setUserFilter(e.target.value)} style={inputStyle}>
          <option value="">All users</option>
          {users.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
        </select>
        <select value={entityFilter} onChange={(e) => setEntityFilter(e.target.value)} style={inputStyle}>
          <option value="">All entity types</option>
          {entityTypes.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={actionFilter} onChange={(e) => setActionFilter(e.target.value)} style={inputStyle}>
          <option value="">All actions</option>
          {actions.map((a) => <option key={a} value={a}>{a}</option>)}
        </select>
        <input type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} style={inputStyle} />
        <input type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} style={inputStyle} />
      </div>

      <div style={card}>
        {loading ? (
          <div style={{ color: muted, padding: 12 }}>Loading activity logs...</div>
        ) : logs.length === 0 ? (
          <div style={{ color: muted, padding: 24, textAlign: 'center' }}>No activity logged yet</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {logs.map((log) => (
              <div
                key={log.id}
                style={{
                  display: 'flex',
                  gap: 14,
                  padding: '14px 0',
                  borderBottom: '1px solid rgba(240,236,228,0.06)',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ minWidth: 140, flexShrink: 0 }}>
                  <UserColorBadge name={log.user_name} color={log.user_color} />
                  <div style={{ fontSize: 11, color: 'rgba(240,236,228,0.35)', marginTop: 4 }}>
                    {format(new Date(log.created_at), 'd MMM yyyy · HH:mm')}
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontWeight: 600, fontSize: 14 }}>{log.action}</div>
                  <div style={{ fontSize: 12, color: muted, marginTop: 3 }}>
                    {log.entity_type}
                    {log.entity_label ? ` · ${log.entity_label}` : ''}
                  </div>
                  {(log.old_value || log.new_value) && (
                    <div style={{ fontSize: 11, color: 'rgba(240,236,228,0.35)', marginTop: 6, lineHeight: 1.5 }}>
                      {log.old_value && log.new_value ? 'Updated record' : log.new_value ? 'New record' : 'Previous record removed'}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
