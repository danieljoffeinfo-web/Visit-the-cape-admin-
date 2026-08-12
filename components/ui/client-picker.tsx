'use client'

import { useMemo, useState } from 'react'
import { searchClients, type Client } from '@/lib/clients'
import { fieldLabel, inputStyle, theme } from '@/lib/theme'

/**
 * Choose an existing client, or say this is a new one.
 *
 * The first version put a search box above a list of eight lookalike rows and
 * marked the chosen one with a tick, which is easy to lose track of: the tick
 * scrolls out of view, and nothing at rest tells you whether a client is
 * attached to this booking or not. Whoever is booking then re-reads the whole
 * list to check.
 *
 * So a choice is answered rather than merely recorded. Once someone is picked
 * the list collapses to a single confirmation of who it is, and the way back
 * is an explicit Change. Nothing to scroll, nothing to re-check.
 *
 * Shared by the vehicle and experience booking flows so both read identically.
 */
export function ClientPicker({
  clients,
  mode,
  onModeChange,
  selectedId,
  onChoose,
  onClear,
}: {
  clients: Client[]
  mode: 'no' | 'yes'
  onModeChange: (mode: 'no' | 'yes') => void
  selectedId: string
  onChoose: (client: Client) => void
  onClear: () => void
}) {
  const [query, setQuery] = useState('')
  const matching = useMemo(() => searchClients(clients, query).slice(0, 8), [clients, query])
  const selected = clients.find((client) => client.id === selectedId) || null

  return (
    <fieldset
      style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: '12px 14px', margin: 0 }}
    >
      <legend style={{ ...fieldLabel, padding: '0 6px' }}>Is this an existing client?</legend>

      <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
        {(['no', 'yes'] as const).map((option) => (
          <label
            key={option}
            style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: theme.text, cursor: 'pointer' }}
          >
            <input
              type="radio"
              name="existingClient"
              checked={mode === option}
              onChange={() => {
                onModeChange(option)
                /* Switching back to a new client drops the link but leaves the
                   typed details alone — they may already be half-corrected, and
                   blanking them is the more annoying of the two guesses. */
                if (option === 'no') onClear()
              }}
              style={{ accentColor: theme.bronze, cursor: 'pointer' }}
            />
            {option === 'no' ? 'New client' : 'Existing client'}
          </label>
        ))}
      </div>

      {mode === 'yes' && selected && (
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '12px 14px',
            borderRadius: 8,
            background: theme.bronzeBg,
            border: `1px solid ${theme.bronzeBorder}`,
          }}
        >
          <span
            aria-hidden
            style={{
              flexShrink: 0,
              width: 34,
              height: 34,
              borderRadius: '50%',
              background: theme.bronze,
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: theme.headingFont,
              fontWeight: 800,
              fontSize: 15,
            }}
          >
            {selected.name.trim().charAt(0).toUpperCase() || '?'}
          </span>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ ...fieldLabel, color: theme.bronzeDark, marginBottom: 2 }}>
              Booking for
            </div>
            <div style={{ fontWeight: 700, fontSize: 15, color: theme.text }}>
              {selected.business_name || selected.name}
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted }}>
              {selected.business_name ? `${selected.name} · ` : ''}
              {[selected.email, selected.phone].filter(Boolean).join(' · ') || 'No contact details'}
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              onClear()
              setQuery('')
            }}
            style={{
              flexShrink: 0,
              padding: '6px 12px',
              borderRadius: 6,
              border: `1px solid ${theme.bronzeBorder}`,
              background: theme.surface,
              color: theme.bronzeDark,
              cursor: 'pointer',
              fontFamily: theme.bodyFont,
              fontWeight: 600,
              fontSize: 12,
            }}
          >
            Change
          </button>
        </div>
      )}

      {mode === 'yes' && !selected && (
        <div style={{ marginTop: 10 }}>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, business, email, phone or account number"
            style={{ ...inputStyle, width: '100%' }}
          />
          <div style={{ marginTop: 8, display: 'grid', gap: 6, maxHeight: 210, overflowY: 'auto' }}>
            {clients.length === 0 && (
              <p style={{ fontSize: 12, color: theme.textMuted, margin: 0 }}>
                No clients on file yet. They are added automatically as bookings are taken, or you
                can add one under Clients.
              </p>
            )}
            {clients.length > 0 && matching.length === 0 && (
              <p style={{ fontSize: 12, color: theme.textMuted, margin: 0 }}>
                Nobody matches that search.
              </p>
            )}
            {matching.map((client) => (
              <button
                key={client.id}
                type="button"
                onClick={() => onChoose(client)}
                style={{
                  textAlign: 'left',
                  padding: '9px 11px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  border: `1px solid ${theme.border}`,
                  background: theme.surface,
                  fontFamily: theme.bodyFont,
                }}
              >
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: theme.text }}>
                  {client.business_name ? `${client.business_name} — ${client.name}` : client.name}
                </span>
                <span style={{ display: 'block', fontSize: 12, color: theme.textMuted }}>
                  {[client.email, client.phone, client.account_number].filter(Boolean).join(' · ')}
                  {client.total_bookings
                    ? ` · ${client.total_bookings} booking${client.total_bookings === 1 ? '' : 's'}`
                    : ''}
                </span>
              </button>
            ))}
          </div>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: '8px 0 0' }}>
            Picking someone fills in the fields below. You can still change any of them for this
            booking without altering their client record.
          </p>
        </div>
      )}
    </fieldset>
  )
}
