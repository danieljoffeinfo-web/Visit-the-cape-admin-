'use client'

import { format } from 'date-fns'
import type { BookingInvoiceLink, UnifiedBooking } from '@/lib/bookings'
import { bookingHasViewableInvoice, invoiceLabelForBooking } from '@/lib/bookings'
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

type BookingsTableProps = {
  bookings: UnifiedBooking[]
  loading: boolean
  xeroConnected?: boolean
  invoiceLinks?: Record<string, BookingInvoiceLink>
  onCancel?: (booking: UnifiedBooking) => void
  onRaiseInvoice?: (booking: UnifiedBooking) => void
  onViewInvoice?: (booking: UnifiedBooking) => void
  raisingId?: string | null
  emptyMessage?: string
}

function InvoiceBadge({
  label,
  colors,
  onClick,
}: {
  label: string
  colors: { bg: string; color: string }
  onClick?: () => void
}) {
  const style = {
    padding: '3px 8px',
    borderRadius: 12,
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase' as const,
    background: colors.bg,
    color: colors.color,
    border: 'none',
    cursor: onClick ? 'pointer' : 'default',
    fontFamily: theme.bodyFont,
  }

  if (!onClick) {
    return <span style={style}>{label}</span>
  }

  return (
    <button type="button" onClick={onClick} style={style} title="View invoice">
      {label}
    </button>
  )
}

export function BookingsTable({
  bookings,
  loading,
  xeroConnected,
  invoiceLinks = {},
  onCancel,
  onRaiseInvoice,
  onViewInvoice,
  raisingId,
  emptyMessage = 'No bookings yet',
}: BookingsTableProps) {
  if (loading) {
    return <div style={{ color: theme.textMuted, padding: 12 }}>Loading bookings…</div>
  }

  if (bookings.length === 0) {
    return <div style={{ color: theme.textMuted, padding: 24, textAlign: 'center' }}>{emptyMessage}</div>
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
                  color: theme.textMuted,
                  fontWeight: 700,
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
            const invoiceLabel = invoiceLabelForBooking(b, link)
            const sc = STATUS_COLORS[invoiceLabel.toUpperCase()] || STATUS_COLORS.DRAFT
            const canViewInvoice = bookingHasViewableInvoice(b, link)
            const canCancel = b.kind !== 'private' && b.status !== 'cancelled' && (b.kind !== 'tour' || b.source !== 'website')

            return (
              <tr
                key={b.id}
                style={{
                  borderBottom: `1px solid ${theme.border}`,
                  cursor: canViewInvoice && onViewInvoice ? 'pointer' : 'default',
                }}
                onClick={() => {
                  if (canViewInvoice && onViewInvoice) onViewInvoice(b)
                }}
              >
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
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{b.tour_or_vehicle}</td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>
                  {b.date ? format(new Date(b.date), 'd MMM yyyy') : format(new Date(b.created_at), 'd MMM yyyy')}
                </td>
                <td style={{ padding: '10px 12px', fontSize: 13, color: theme.text }}>{b.guests || '—'}</td>
                <td style={{ padding: '10px 12px' }}>
                  {b.created_by_name ? (
                    <UserColorBadge name={b.created_by_name} color={b.created_by_color} />
                  ) : b.kind === 'private' || b.source === 'website' ? (
                    <span style={{ fontSize: 11, color: theme.textMuted }}>Website</span>
                  ) : (
                    <span style={{ color: theme.textMuted, fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }}>
                  <StatusBadge status={b.status} />
                </td>
                <td style={{ padding: '10px 12px' }} onClick={(event) => event.stopPropagation()}>
                  {canViewInvoice ? (
                    <InvoiceBadge
                      label={invoiceLabel}
                      colors={sc}
                      onClick={onViewInvoice ? () => onViewInvoice(b) : undefined}
                    />
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
                  ) : (
                    <span style={{ color: theme.textMuted, fontSize: 12 }}>—</span>
                  )}
                </td>
                <td style={{ padding: '10px 12px' }} onClick={(event) => event.stopPropagation()}>
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
