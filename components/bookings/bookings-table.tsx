'use client'

import { format } from 'date-fns'
import type { UnifiedBooking } from '@/lib/bookings'
import { SourceBadge, StatusBadge, UserColorBadge } from '@/components/user-badge'
import { theme } from '@/lib/theme'

const STATUS_COLORS: Record<string, { bg: string; color: string }> = {
  PAID: { bg: 'rgba(61, 139, 99, 0.12)', color: theme.success },
  AUTHORISED: { bg: 'rgba(100, 149, 237, 0.12)', color: '#4a7fd4' },
  OVERDUE: { bg: 'rgba(196, 92, 74, 0.12)', color: theme.danger },
  DRAFT: { bg: theme.surfaceMuted, color: theme.textMuted },
}

const kindLabel: Record<UnifiedBooking['kind'], string> = {
  tour: 'Tour',
  internal: 'Internal',
  fleet: 'Fleet',
  private: 'Private',
}

type InvoiceLink = {
  booking_id: string
  status: string
}

type BookingsTableProps = {
  bookings: UnifiedBooking[]
  loading: boolean
  xeroConnected?: boolean
  invoiceLinks?: Record<string, InvoiceLink>
  onCancel?: (booking: UnifiedBooking) => void
  onRaiseInvoice?: (booking: UnifiedBooking) => void
  raisingId?: string | null
  emptyMessage?: string
}

export function BookingsTable({
  bookings,
  loading,
  xeroConnected,
  invoiceLinks = {},
  onCancel,
  onRaiseInvoice,
  raisingId,
  emptyMessage = 'No bookings yet',
}: BookingsTableProps) {
  if (loading) {
    return <div style={{ color: theme.textFaint, padding: 12 }}>Loading bookings…</div>
  }

  if (bookings.length === 0) {
    return <div style={{ color: theme.textFaint, padding: 24, textAlign: 'center' }}>{emptyMessage}</div>
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
            {['Type', 'Reference', 'Source', 'Customer', 'Tour / Vehicle', 'Date', 'Guests', 'Created By', 'Status', 'Invoice', ''].map((h) => (
              <th
                key={h}
                style={{
                  padding: '8px 12px',
                  textAlign: 'left',
                  fontSize: 11,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                  color: theme.textFaint,
                  fontWeight: 600,
                }}
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {bookings.map((b) => {
            const link = invoiceLinks[b.raw_id]
            const sc = link ? STATUS_COLORS[link.status] || STATUS_COLORS.DRAFT : null
            const canCancel = b.kind !== 'private' && b.status !== 'cancelled' && (b.kind !== 'tour' || b.source !== 'website')

            return (
              <tr key={b.id} style={{ borderBottom: `1px solid ${theme.border}` }}>
                <td style={{ padding: '10px 12px', fontSize: 11, letterSpacing: '0.06em', textTransform: 'uppercase', color: theme.bronzeDark, fontWeight: 600 }}>
                  {kindLabel[b.kind]}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 12, color: theme.bronzeDark, fontWeight: 600 }}>
                  {b.booking_reference || '—'}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <SourceBadge source={b.kind === 'private' ? 'website' : b.source} />
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{b.customer_name}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>{b.tour_or_vehicle}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.textMuted }}>
                  {b.date ? format(new Date(b.date), 'd MMM yyyy') : format(new Date(b.created_at), 'd MMM yyyy')}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{b.guests || '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  {b.created_by_name ? (
                    <UserColorBadge name={b.created_by_name} color={b.created_by_color} />
                  ) : b.kind === 'private' || b.source === 'website' ? (
                    <span style={{ fontSize: 11, color: theme.textMuted }}>Website</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <StatusBadge status={b.status} />
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {link && sc ? (
                    <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', ...sc }}>
                      {link.status}
                    </span>
                  ) : onRaiseInvoice && xeroConnected && (b.kind === 'tour' || b.kind === 'private') ? (
                    <button
                      disabled={raisingId === b.raw_id}
                      onClick={() => onRaiseInvoice(b)}
                      style={{
                        padding: '4px 10px',
                        fontSize: 12,
                        borderRadius: 4,
                        border: `1px solid ${theme.bronzeBorder}`,
                        background: theme.surface,
                        color: theme.bronzeDark,
                        cursor: 'pointer',
                        fontFamily: theme.bodyFont,
                      }}
                    >
                      {raisingId === b.raw_id ? '…' : 'Raise Invoice'}
                    </button>
                  ) : b.invoice_status ? (
                    <StatusBadge status={b.invoice_status} />
                  ) : (
                    <span style={{ color: theme.textFaint, fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  {canCancel && onCancel && (
                    <button
                      onClick={() => onCancel(b)}
                      style={{ fontSize: 11, color: theme.danger, background: 'none', border: 'none', cursor: 'pointer', fontFamily: theme.bodyFont }}
                    >
                      Cancel
                    </button>
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
