'use client'

import { useState } from 'react'
import { cardStyle, dangerButton, inputStyle, secondaryButton, sectionTitle, theme } from '@/lib/theme'

const CONFIRM_PHRASE = 'DELETE ALL DATA'

type ClearDataDialogProps = {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  loading?: boolean
}

export function ClearDataDialog({ open, onClose, onConfirm, loading }: ClearDataDialogProps) {
  const [confirmText, setConfirmText] = useState('')

  if (!open) return null

  const canConfirm = confirmText.trim().toUpperCase() === CONFIRM_PHRASE

  function handleClose() {
    if (loading) return
    setConfirmText('')
    onClose()
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(44, 38, 32, 0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 2000,
        padding: 16,
      }}
      onClick={handleClose}
    >
      <div
        style={{
          ...cardStyle,
          width: 480,
          maxWidth: '100%',
          border: `1px solid rgba(196, 92, 74, 0.35)`,
          boxShadow: theme.modalShadow,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ ...sectionTitle, color: theme.danger, marginBottom: 12 }}>Clear all admin data?</h2>
        <p style={{ color: theme.textMuted, fontSize: 14, lineHeight: 1.6, marginBottom: 16 }}>
          This permanently removes bookings, enquiries, customers, tour departures, invoice links, activity logs,
          content library schedules, and Jarvis chat history from the admin database.
        </p>
        <div
          style={{
            padding: '12px 14px',
            borderRadius: 8,
            background: 'rgba(196, 92, 74, 0.08)',
            border: '1px solid rgba(196, 92, 74, 0.2)',
            marginBottom: 16,
            fontSize: 13,
            color: theme.text,
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: theme.danger }}>Kept:</strong> fleet vehicles, admin users, Xero connection, and website tour content.
          <br />
          <strong style={{ color: theme.danger }}>Not reversible.</strong> Export anything you need from Xero or bookings first.
        </div>
        <label style={{ display: 'block', marginBottom: 18 }}>
          <span style={{ display: 'block', fontSize: 12, color: theme.textMuted, marginBottom: 6 }}>
            Type <strong>{CONFIRM_PHRASE}</strong> to confirm
          </span>
          <input
            type="text"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            placeholder={CONFIRM_PHRASE}
            disabled={loading}
            style={inputStyle}
            autoComplete="off"
          />
        </label>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={handleClose} disabled={loading} style={{ ...secondaryButton, flex: 1 }}>
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void onConfirm()}
            disabled={!canConfirm || loading}
            style={{
              ...dangerButton,
              flex: 1,
              opacity: !canConfirm || loading ? 0.55 : 1,
            }}
          >
            {loading ? 'Clearing…' : 'Clear all data'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function useClearAdminData() {
  const [clearing, setClearing] = useState(false)

  async function clearAllData() {
    setClearing(true)
    try {
      const res = await fetch('/api/admin/wipe-revenue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ confirm: 'DELETE ALL DATA' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Clear failed')
      return data as { fleetPreserved?: number }
    } finally {
      setClearing(false)
    }
  }

  return { clearing, clearAllData }
}
