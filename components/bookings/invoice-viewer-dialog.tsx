'use client'

import type { UnifiedBooking } from '@/lib/bookings'
import { secondaryButton, theme } from '@/lib/theme'

type InvoiceViewerDialogProps = {
  open: boolean
  booking: UnifiedBooking | null
  invoiceNumber?: string | null
  onClose: () => void
}

export function InvoiceViewerDialog({ open, booking, invoiceNumber, onClose }: InvoiceViewerDialogProps) {
  if (!open || !booking) return null

  const src = `/api/xero/invoice-pdf?booking_id=${encodeURIComponent(booking.raw_id)}&kind=${encodeURIComponent(booking.kind)}&inline=1`
  const title = invoiceNumber ? `Invoice ${invoiceNumber}` : 'Invoice'

  return (
    <div
      className="admin-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 220,
        background: theme.modalOverlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="admin-modal"
        style={{
          width: 'min(920px, 100%)',
          height: 'min(88vh, 900px)',
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.modalShadow,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            padding: '14px 18px',
            borderBottom: `1px solid ${theme.border}`,
            background: theme.surfaceMuted,
          }}
        >
          <div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 18, color: theme.text }}>
              {title}
            </div>
            <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
              {booking.customer_name} · {booking.tour_or_vehicle}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <a
              href={src.replace('inline=1', 'inline=0')}
              target="_blank"
              rel="noreferrer"
              style={{ ...secondaryButton, textDecoration: 'none', fontSize: 12 }}
            >
              Download
            </a>
            <button type="button" onClick={onClose} style={{ ...secondaryButton, padding: '6px 10px' }} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <iframe
          title={title}
          src={src}
          style={{ flex: 1, width: '100%', border: 'none', background: theme.surface }}
        />
      </div>
    </div>
  )
}
