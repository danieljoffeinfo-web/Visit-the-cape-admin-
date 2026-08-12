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
  addon: 'Add-On',
  internal: 'Internal',
  fleet: 'Fleet',
  website: 'Website',
  private: 'Private',
}

type BookingsTableProps = {
  bookings: UnifiedBooking[]
  loading: boolean
  xeroConnected?: boolean
  invoiceLinks?: Record<string, BookingInvoiceLink>
  onCancel?: (booking: UnifiedBooking) => void
  onDelete?: (booking: UnifiedBooking) => void
  onRaiseInvoice?: (booking: UnifiedBooking) => void
  onViewInvoice?: (booking: UnifiedBooking) => void
  onEdit?: (booking: UnifiedBooking) => void
  raisingId?: string | null
  deletingId?: string | null
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
  onDelete,
  onRaiseInvoice,
  onViewInvoice,
  onEdit,
  raisingId,
  deletingId,
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
            /* Only until the invoice exists in Xero — after that the link is the
               record, and a second press would raise a duplicate. */
            const canRaiseInvoice =
              Boolean(onRaiseInvoice) &&
              Boolean(xeroConnected) &&
              !link?.xero_invoice_id &&
              (b.kind === 'tour' || b.kind === 'private' || b.kind === 'addon')
            const canCancel = b.kind !== 'private' && b.status !== 'cancelled' && (b.kind !== 'tour' || b.source !== 'website')

            return (
              <tr
                key={b.id}
                style={{
                  borderBottom: `1px solid ${theme.border}`,
                  cursor: onEdit ? 'pointer' : 'default',
                }}
                /* Opens the booking, not its invoice. Clicking a row used to
                   jump straight to a PDF, which is the one part of a booking
                   you cannot change — so the obvious gesture led away from the
                   thing people wanted. The invoice has its own button. */
                onClick={() => onEdit?.(b)}
                title={onEdit ? 'Open this booking' : undefined}
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                    {canViewInvoice && (
                      <InvoiceBadge
                        label={invoiceLabel}
                        colors={sc}
                        onClick={onViewInvoice ? () => onViewInvoice(b) : undefined}
                      />
                    )}
                    {/* An add-on booking already has an invoice PDF the moment it
                        is created, so the badge alone would leave no way to push
                        it to Xero. Both are offered until a Xero link exists. */}
                    {canRaiseInvoice && (
                      <button
                        disabled={raisingId === b.raw_id}
                        onClick={() => onRaiseInvoice?.(b)}
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
                        {raisingId === b.raw_id ? '…' : canViewInvoice ? 'Create in Xero' : 'Raise Invoice'}
                      </button>
                    )}
                    {!canViewInvoice && !canRaiseInvoice && (
                      <span style={{ color: theme.textMuted, fontSize: 12 }}>—</span>
                    )}
                  </div>
                </td>
                <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }} onClick={(event) => event.stopPropagation()}>
                  {canCancel && onCancel && (
                    <button
                      onClick={() => onCancel(b)}
                      style={{ fontSize: 11, color: theme.textMuted, background: 'none', border: 'none', cursor: 'pointer', fontFamily: theme.bodyFont, marginRight: 10 }}
                    >
                      Cancel
                    </button>
                  )}
                  {onDelete && (
                    <button
                      onClick={() => onDelete(b)}
                      disabled={deletingId === b.raw_id}
                      title="Permanently remove this row"
                      style={{
                        fontSize: 11,
                        color: theme.danger,
                        background: 'none',
                        border: 'none',
                        cursor: deletingId === b.raw_id ? 'not-allowed' : 'pointer',
                        fontFamily: theme.bodyFont,
                        opacity: deletingId === b.raw_id ? 0.5 : 1,
                      }}
                    >
                      {deletingId === b.raw_id ? 'Deleting…' : 'Delete'}
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
