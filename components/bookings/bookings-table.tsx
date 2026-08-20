'use client'

import { format } from 'date-fns'
import type { BookingInvoiceLink, UnifiedBooking } from '@/lib/bookings'
import { bookingHasViewableInvoice, invoiceLabelForBooking, isStaffCreated } from '@/lib/bookings'
import { SourceBadge } from '@/components/user-badge'
import { RowMenu } from '@/components/ui/row-menu'
import { SelectMenu } from '@/components/ui/select-menu'
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
  onSendInvoice?: (booking: UnifiedBooking) => void
  onEdit?: (booking: UnifiedBooking) => void
  onPaymentStatusChange?: (booking: UnifiedBooking, status: 'pending' | 'paid' | 'cancelled') => void
  raisingId?: string | null
  sendingId?: string | null
  deletingId?: string | null
  statusUpdatingId?: string | null
  emptyMessage?: string
}

function money(amount: number | null | undefined) {
  if (amount == null) return '—'
  return `R ${Number(amount).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

/* One scale for the table, so a change of mind is a change in one place. */
const CELL = { padding: '14px 12px', fontSize: 14, color: theme.text } as const
const HEAD = {
  padding: '12px 12px',
  textAlign: 'left' as const,
  fontSize: 11.5,
  letterSpacing: '0.12em',
  textTransform: 'uppercase' as const,
  color: theme.textMuted,
  fontWeight: 700,
  whiteSpace: 'nowrap' as const,
}

function RowButton({
  children,
  onClick,
  disabled,
  primary,
  danger,
  title,
}: {
  children: React.ReactNode
  onClick?: () => void
  disabled?: boolean
  primary?: boolean
  /** Outlined in red rather than filled: visible, but never the eye's first stop. */
  danger?: boolean
  title?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: '7px 14px',
        borderRadius: 6,
        fontSize: 13,
        fontWeight: 600,
        fontFamily: theme.bodyFont,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        whiteSpace: 'nowrap',
        border: primary
          ? '1px solid transparent'
          : `1px solid ${danger ? 'rgba(196, 92, 74, 0.4)' : theme.bronzeBorder}`,
        background: primary ? theme.bronze : theme.surface,
        color: primary ? '#ffffff' : danger ? theme.danger : theme.bronzeDark,
      }}
    >
      {children}
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
  onSendInvoice,
  onEdit,
  onPaymentStatusChange,
  raisingId,
  sendingId,
  deletingId,
  statusUpdatingId,
  emptyMessage = 'No bookings yet',
}: BookingsTableProps) {
  if (loading) {
    return <div style={{ color: theme.textMuted, padding: 20, fontSize: 14 }}>Loading bookings…</div>
  }

  if (bookings.length === 0) {
    return (
      <div style={{ color: theme.textMuted, padding: 40, textAlign: 'center', fontSize: 14 }}>
        {emptyMessage}
      </div>
    )
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
        <thead>
          <tr style={{ borderBottom: `1px solid ${theme.borderStrong}` }}>
            {['Type', 'Reference', 'Source', 'Customer', 'Tour / Vehicle', 'Date', 'Guests', 'Amount', 'Payment', ''].map(
              (h, i) => (
                <th key={`${h}-${i}`} style={HEAD}>
                  {h}
                </th>
              ),
            )}
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
            const canCancel =
              b.kind !== 'private' && b.status !== 'cancelled' && (b.kind !== 'tour' || b.source !== 'website')
            /* Nothing to send without both an invoice and somewhere to send it. */
            const canSend = Boolean(onSendInvoice) && canViewInvoice && Boolean(b.customer_email)
            const busy = sendingId === b.raw_id || deletingId === b.raw_id
            const xeroPaid = String(link?.status || b.invoice_status || '').toUpperCase() === 'PAID'
            const operationalStatus: 'pending' | 'paid' | 'cancelled' =
              xeroPaid
                ? 'paid'
                : b.status === 'cancelled' || b.payment_status === 'cancelled'
                  ? 'cancelled'
                  : b.payment_status === 'paid'
                    ? 'paid'
                    : 'pending'
            /* Only a booking the office took itself, and only while Xero has
               not already called it paid.
               `kind !== 'website'` was not enough: a tour paid for on the site
               normalises to kind 'tour' with source 'website', so it passed
               that test and staff could have marked a PayGate payment as
               pending. isStaffCreated is the predicate that already answers
               "did we take this booking or did the website", and the row's own
               Cancel action was already using the same rule — the two now
               agree instead of contradicting each other. */
            const canChangePayment = Boolean(onPaymentStatusChange) && isStaffCreated(b) && !xeroPaid
            /* Where the money was taken, for the read-only rows. A website
               booking says so rather than showing a bare status that looks
               like something staff simply have not got round to changing. */
            const paidOnWebsite = !isStaffCreated(b) && operationalStatus === 'paid'

            return (
              <tr
                key={b.id}
                style={{ borderBottom: `1px solid ${theme.border}`, cursor: onEdit ? 'pointer' : 'default' }}
                onClick={() => onEdit?.(b)}
                title={onEdit ? 'Open this booking' : undefined}
              >
                <td
                  style={{
                    ...CELL,
                    fontSize: 11.5,
                    letterSpacing: '0.08em',
                    textTransform: 'uppercase',
                    color: theme.bronzeDark,
                    fontWeight: 700,
                    whiteSpace: 'nowrap',
                  }}
                >
                  {kindLabel[b.kind]}
                </td>
                <td style={{ ...CELL, fontSize: 13, color: theme.bronzeDark, fontWeight: 600 }}>
                  {b.booking_reference || '—'}
                </td>
                <td style={{ padding: '14px 12px' }}>
                  <SourceBadge source={b.kind === 'private' ? 'website' : b.source} />
                </td>
                <td style={{ ...CELL, fontWeight: 600 }}>{b.customer_name}</td>
                <td style={CELL}>{b.tour_or_vehicle}</td>
                <td style={{ ...CELL, whiteSpace: 'nowrap' }}>
                  {b.date ? format(new Date(b.date), 'd MMM yyyy') : format(new Date(b.created_at), 'd MMM yyyy')}
                </td>
                <td style={CELL}>{b.guests || '—'}</td>
                {/* Replaces Created By, which named a colleague you already work
                    beside on a screen whose whole subject is money. */}
                <td style={{ ...CELL, fontWeight: 700, whiteSpace: 'nowrap' }}>{money(b.amount)}</td>
                <td style={{ padding: '14px 12px' }}>
                  {canChangePayment ? (
                    /* The console's own dropdown, not the browser's. Every
                       other select in the admin was replaced for the same
                       reason and one native menu here would stand out as
                       plainly as it did there. The accessible name carries the
                       customer, because "Pending" read aloud on its own does
                       not say which booking it belongs to. */
                    <SelectMenu
                      compact
                      ariaLabel={`Payment status for ${b.customer_name}`}
                      value={operationalStatus}
                      disabled={statusUpdatingId === b.raw_id}
                      onChange={(value) =>
                        onPaymentStatusChange?.(b, value as 'pending' | 'paid' | 'cancelled')
                      }
                      tone={
                        operationalStatus === 'paid'
                          ? theme.success
                          : operationalStatus === 'cancelled'
                            ? theme.danger
                            : theme.bronzeDark
                      }
                      options={[
                        { value: 'pending', label: 'Pending', hint: 'Not yet received' },
                        { value: 'paid', label: 'Paid', hint: 'Payment confirmed here' },
                        { value: 'cancelled', label: 'Cancelled', hint: 'Kept as a record' },
                      ]}
                    />
                  ) : (
                    <span
                      style={{
                        display: 'inline-block',
                        padding: '3px 9px',
                        borderRadius: 12,
                        fontSize: 11,
                        fontWeight: 600,
                        letterSpacing: '0.06em',
                        textTransform: 'uppercase',
                        background: operationalStatus === 'paid' ? STATUS_COLORS.PAID.bg : operationalStatus === 'cancelled' ? STATUS_COLORS.OVERDUE.bg : sc.bg,
                        color: operationalStatus === 'paid' ? STATUS_COLORS.PAID.color : operationalStatus === 'cancelled' ? STATUS_COLORS.OVERDUE.color : sc.color,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {b.kind === 'private'
                        ? 'Enquiry'
                        : xeroPaid
                          ? 'Paid in Xero'
                          : paidOnWebsite
                            ? 'Paid on website'
                            : !isStaffCreated(b)
                              ? 'Awaiting website payment'
                              : operationalStatus}
                    </span>
                  )}
                </td>

                {/* Keep one obvious booking action on the row. Invoice and
                    destructive actions are grouped under a plain-language
                    menu so the table stays calm and scan-friendly. */}
                <td
                  style={{ padding: '12px 12px', whiteSpace: 'nowrap', textAlign: 'right' }}
                  onClick={(event) => event.stopPropagation()}
                >
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                    {/* Emailing an invoice is a daily job and was asked for as a
                        button, so it stays on the row rather than behind the
                        menu. Everything rarer, and everything irreversible,
                        sits one press further away. */}
                    {canSend && (
                      <RowButton
                        primary
                        onClick={() => onSendInvoice?.(b)}
                        disabled={busy}
                        title={`Email the invoice to ${b.customer_email}`}
                      >
                        {sendingId === b.raw_id ? 'Sending…' : 'Send invoice'}
                      </RowButton>
                    )}
                    {onEdit && <RowButton onClick={() => onEdit(b)}>Open booking</RowButton>}

                    {/* Asked for on the row rather than behind the menu: the
                        office clears out test and cancelled bookings often
                        enough that hunting for it was the complaint. It still
                        confirms, and it still names what is about to go. */}
                    {onDelete && (
                      <RowButton
                        danger
                        onClick={() => onDelete(b)}
                        disabled={busy}
                        title={`Permanently delete ${b.customer_name}'s booking`}
                      >
                        {deletingId === b.raw_id ? 'Deleting…' : 'Delete'}
                      </RowButton>
                    )}

                    <RowMenu
                      items={[
                        {
                          label: 'View invoice',
                          onSelect: () => onViewInvoice?.(b),
                          disabled: !canViewInvoice || !onViewInvoice,
                        },
                        {
                          label: raisingId === b.raw_id ? 'Creating invoice…' : 'Create invoice in Xero',
                          onSelect: () => onRaiseInvoice?.(b),
                          disabled: !canRaiseInvoice,
                        },
                        {
                          label: 'Cancel booking',
                          onSelect: () => onCancel?.(b),
                          disabled: !canCancel || !onCancel,
                        },
                      ]}
                    />
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
