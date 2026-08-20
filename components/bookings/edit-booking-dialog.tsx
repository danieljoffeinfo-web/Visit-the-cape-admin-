'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { BookingInvoiceLink, UnifiedBooking } from '@/lib/bookings'
import { fleetInvoiceDescription, FLEET_USAGE_TYPES, formatRands } from '@/lib/fleet'
import {
  fieldLabel,
  inputStyle,
  primaryButton,
  secondaryButton,
  theme,
} from '@/lib/theme'

/**
 * Edit a booking.
 *
 * Clicking a row used to open the invoice, which is the one thing about a
 * booking you cannot change from there. This is what a row click gets you now;
 * the invoice moved to its own button.
 *
 * Fleet and tag-along bookings live in different tables with different shapes,
 * so the fields on offer follow the booking rather than being a lowest common
 * denominator of both.
 */

type Draft = {
  customerName: string
  customerEmail: string
  customerPhone: string
  tourName: string
  tourDate: string
  guests: string
  amount: string
  notes: string
  // Fleet only
  firstName: string
  surname: string
  accountNumber: string
  startDate: string
  endDate: string
  usageType: string
  dailyRate: string
  invoiceDescription: string
}

function draftFrom(booking: UnifiedBooking): Draft {
  const [firstName, ...rest] = (booking.customer_name || '').trim().split(/\s+/)
  /* The rental detail off the booking itself. Everything below used to be a
     guess — end date copied from the start, hire type hardcoded to 'tour',
     phone and account number blank — and saving wrote those guesses back. */
  const fleet = booking.fleet
  return {
    customerName: booking.customer_name || '',
    customerEmail: booking.customer_email || '',
    customerPhone: fleet?.phone || '',
    tourName: booking.tour_or_vehicle || '',
    tourDate: booking.date || '',
    guests: String(booking.guests || ''),
    amount: booking.amount != null ? String(booking.amount) : '',
    notes: fleet?.notes || '',
    firstName: firstName || '',
    surname: rest.join(' '),
    accountNumber: fleet?.accountNumber || '',
    startDate: booking.date || '',
    endDate: fleet?.endDate || booking.date || '',
    usageType: fleet?.usageType || 'tour',
    dailyRate: fleet?.dailyRate != null ? String(round2(fleet.dailyRate)) : '',
    invoiceDescription: fleet?.invoiceDescription || '',
  }
}

/** Day rates divide out of totals, so they need rounding before display. */
function round2(value: number) {
  return Math.round(value * 100) / 100
}

/** Inclusive of both ends, matching how the booking route counts them. */
function rentalDays(startDate: string, endDate: string) {
  const start = new Date(startDate)
  const end = new Date(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0
  return Math.round((end.getTime() - start.getTime()) / 86400000) + 1
}

export function EditBookingDialog({
  booking,
  invoiceLink,
  onClose,
  onSaved,
  onViewInvoice,
}: {
  booking: UnifiedBooking | null
  invoiceLink?: BookingInvoiceLink | null
  onClose: () => void
  onSaved: () => void
  onViewInvoice?: (booking: UnifiedBooking) => void
}) {
  const [draft, setDraft] = useState<Draft | null>(null)
  const [draftFor, setDraftFor] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)

  /* Adjusted during render rather than in an effect. Syncing this from a
     useEffect renders the dialog once with the previous booking's values
     before correcting itself, which on a fast reopen is briefly the wrong
     customer's details on screen. */
  if (booking && draftFor !== booking.id) {
    setDraftFor(booking.id)
    setDraft(draftFrom(booking))
  }
  if (!booking && draftFor !== null) {
    setDraftFor(null)
    setDraft(null)
  }

  const isFleet = booking?.kind === 'fleet'
  const readOnly = booking?.kind === 'private' || booking?.kind === 'website'

  /* An invoice already exists for this booking, so a change here changes a
     document the client may already be holding. */
  const invoiced = useMemo(
    () => Boolean(invoiceLink?.xero_invoice_number || booking?.invoice_status),
    [invoiceLink, booking],
  )

  if (!booking || !draft) return null

  /* Plain consts, not hooks — everything above this point has already run and
     these are cheap. The day rate is what gets typed; the total is what the
     office reads back to the customer, so both are on screen. */
  const fleetDays = rentalDays(draft.startDate, draft.endDate)
  const fleetTotal = (Number(draft.dailyRate) || 0) * fleetDays
  const defaultInvoiceDescription = fleetInvoiceDescription({
    vehicleName: booking.tour_or_vehicle || 'Vehicle',
    usageType: draft.usageType,
    dailyRate: Number(draft.dailyRate) || 0,
    days: fleetDays,
  })

  async function save() {
    if (!booking || !draft) return
    setSaving(true)
    try {
      const res = isFleet
        ? await fetch('/api/fleet/bookings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: booking.raw_id,
              firstName: draft.firstName,
              surname: draft.surname,
              email: draft.customerEmail,
              phone: draft.customerPhone,
              accountNumber: draft.accountNumber,
              startDate: draft.startDate,
              endDate: draft.endDate,
              seatsBooked: draft.guests,
              usageType: draft.usageType,
              invoiceDescription: draft.invoiceDescription,
              notes: draft.notes,
              /* The rate, not the total. The server re-multiplies it against
                 whatever dates this same save is setting, so changing the end
                 date re-prices the hire instead of leaving a stale total. */
              ...(draft.dailyRate
                ? { dailyRate: Number(draft.dailyRate) }
                : draft.amount
                  ? { amount: Number(draft.amount) }
                  : {}),
            }),
          })
        : await fetch('/api/bookings', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              id: booking.raw_id,
              kind: booking.kind,
              customerName: draft.customerName,
              customerEmail: draft.customerEmail,
              customerPhone: draft.customerPhone,
              tourName: draft.tourName,
              tourDate: draft.tourDate,
              guestsCount: draft.guests,
              ...(draft.amount ? { amount: Number(draft.amount) } : {}),
            }),
          })

      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to save changes')
      toast.success(
        invoiced
          ? 'Booking updated — the invoice now reflects the change'
          : 'Booking updated',
      )
      onSaved()
      onClose()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  /* Sending is always a press, never a save side effect, and it names the
     recipient before it goes — an invoice landing in the wrong inbox is not
     something you can take back. */
  async function sendToClient() {
    if (!booking || !draft) return
    const to = draft.customerEmail.trim()
    if (!to) {
      toast.error('Add an email address to this booking first')
      return
    }
    if (!confirm(`Email invoice to ${to}?`)) return

    setSending(true)
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookingId: booking.raw_id,
          kind: booking.kind,
          to,
          clientName: draft.customerName || `${draft.firstName} ${draft.surname}`.trim(),
          total: Number(draft.amount) || booking.amount || 0,
          summaryLines: [
            `Booking: ${draft.tourName || booking.tour_or_vehicle}`,
            booking.kind === 'fleet' && draft.startDate
              ? `Dates: ${draft.startDate} to ${draft.endDate}`
              : draft.tourDate
                ? `Date: ${draft.tourDate}`
                : '',
            draft.guests ? `Guests: ${draft.guests}` : '',
          ].filter(Boolean),
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Failed to send')
      toast.success(`Invoice ${data.invoiceNumber} sent to ${data.to}`)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to send the invoice')
    } finally {
      setSending(false)
    }
  }

  const set = (key: keyof Draft) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setDraft({ ...draft, [key]: e.target.value })

  const field = (label: string, key: keyof Draft, type = 'text') => (
    <div>
      <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>{label}</label>
      <input type={type} value={draft[key]} onChange={set(key)} style={inputStyle} disabled={readOnly} />
    </div>
  )

  return (
    <div
      className="admin-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 240,
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
          width: 'min(680px, 100%)',
          maxHeight: '88vh',
          overflowY: 'auto',
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.modalShadow,
          padding: 22,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <h3 style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 19, color: theme.text, margin: 0 }}>
              {readOnly ? 'Booking details' : 'Edit booking'}
            </h3>
            <p style={{ fontSize: 12, color: theme.textMuted, margin: '4px 0 0' }}>
              {booking.booking_reference || booking.raw_id.slice(0, 8).toUpperCase()} ·{' '}
              {booking.customer_name}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ ...secondaryButton, padding: '6px 10px' }} aria-label="Close">
            ✕
          </button>
        </div>

        {invoiced && !readOnly && (
          <div
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 8,
              background: theme.bronzeBg,
              border: `1px solid ${theme.bronzeBorder}`,
              fontSize: 13,
              color: theme.text,
            }}
          >
            <strong>
              Invoice {invoiceLink?.xero_invoice_number || booking.booking_reference || ''} has already
              been issued.
            </strong>{' '}
            Saving reissues a corrected copy under the same number. Nothing is emailed to the client —
            send it yourself when you are ready.
            {invoiceLink?.xero_invoice_number && ' This invoice is also in Xero and will need updating there.'}
          </div>
        )}

        {readOnly && (
          <div style={{ marginTop: 14, fontSize: 13, color: theme.textMuted }}>
            This came from the website and is kept as a record of what the customer submitted, so it
            is not editable here.
          </div>
        )}

        <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', marginTop: 16 }}>
          {isFleet ? (
            <>
              {field('First name', 'firstName')}
              {field('Surname', 'surname')}
              {field('Email', 'customerEmail', 'email')}
              {field('Phone', 'customerPhone', 'tel')}
              {field('Account number', 'accountNumber')}
              {field('Start date', 'startDate', 'date')}
              {field('End date', 'endDate', 'date')}
              {field('Seats booked', 'guests', 'number')}
              <div>
                <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Usage</label>
                <select value={draft.usageType} onChange={set('usageType')} style={inputStyle}>
                  {FLEET_USAGE_TYPES.map((u) => (
                    <option key={u.value} value={u.value}>
                      {u.label}
                    </option>
                  ))}
                </select>
              </div>
              {field('Amount per day (R)', 'dailyRate', 'number')}
              <div>
                <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Total</label>
                <div style={{ ...inputStyle, display: 'flex', alignItems: 'center', background: theme.bronzeBg, borderColor: theme.bronzeBorder, fontWeight: 700 }}>
                  {fleetTotal > 0 ? formatRands(fleetTotal) : '—'}
                  {fleetDays > 0 && (
                    <span style={{ fontWeight: 400, color: theme.textMuted, marginLeft: 8, fontSize: 12 }}>
                      {fleetDays} day{fleetDays === 1 ? '' : 's'}
                    </span>
                  )}
                </div>
              </div>
            </>
          ) : (
            <>
              {field('Customer name', 'customerName')}
              {field('Email', 'customerEmail', 'email')}
              {field('Phone', 'customerPhone', 'tel')}
              {field(booking.kind === 'addon' ? 'Add-ons' : 'Tour', 'tourName')}
              {field('Date', 'tourDate', 'date')}
              {field('Guests', 'guests', 'number')}
              {field('Amount (ZAR)', 'amount', 'number')}
            </>
          )}
        </div>

        {isFleet && (
          <div style={{ marginTop: 12 }}>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>
              Invoice description (optional)
            </label>
            <input
              type="text"
              value={draft.invoiceDescription}
              onChange={set('invoiceDescription')}
              placeholder={defaultInvoiceDescription}
              style={inputStyle}
            />
            <p style={{ fontSize: 12, color: theme.textMuted, margin: '6px 0 0' }}>
              {draft.invoiceDescription.trim()
                ? 'This is what the invoice will say.'
                : `Leave blank and the invoice says: ${defaultInvoiceDescription}`}
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 10, marginTop: 20, flexWrap: 'wrap' }}>
          {!readOnly && (
            <button onClick={save} disabled={saving} style={primaryButton}>
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          )}
          <button
            type="button"
            onClick={sendToClient}
            disabled={sending || !draft.customerEmail.trim()}
            title={
              draft.customerEmail.trim()
                ? `Email the invoice to ${draft.customerEmail.trim()}`
                : 'This booking has no email address'
            }
            style={{ ...secondaryButton, opacity: draft.customerEmail.trim() ? 1 : 0.5 }}
          >
            {sending ? 'Sending…' : 'Send invoice to client'}
          </button>
          {onViewInvoice && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onViewInvoice(booking)
              }}
              style={secondaryButton}
            >
              View invoice
            </button>
          )}
          <button type="button" onClick={onClose} style={secondaryButton}>
            {readOnly ? 'Close' : 'Cancel'}
          </button>
        </div>
      </div>
    </div>
  )
}
