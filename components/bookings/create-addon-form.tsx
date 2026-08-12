'use client'

import { useEffect, useMemo, useState } from 'react'
import { toast } from 'sonner'
import type { AddOn, AddOnLine } from '@/lib/add-ons'
import { addOnBookingTotal } from '@/lib/add-ons'
import type { Client } from '@/lib/clients'
import { ClientPicker } from '@/components/ui/client-picker'
import { DateField } from '@/components/ui/date-field'
import {
  cardStyle,
  fieldLabel,
  inputStyle,
  primaryButton,
  secondaryButton,
  sectionTitle,
  theme,
} from '@/lib/theme'

/**
 * Book add-on adventures for a customer.
 *
 * Same shape as the tour form — type a name, type an email, pick a date — with
 * one addition: which experiences, how many of each, and at what price. Four of
 * the five add-ons are quoted per enquiry rather than listed, so the price field
 * starts blank for those and pre-fills for the one that has a set rate. Whatever
 * is typed here is what the invoice says.
 */

function money(amount: number) {
  return `R${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export type AddOnFormState = {
  customerName: string
  customerEmail: string
  customerPhone: string
  tourDate: string
  notes: string
}

export const emptyAddOnForm: AddOnFormState = {
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  tourDate: '',
  notes: '',
}

type Selection = { quantity: string; unitAmount: string }

export function CreateAddOnForm({
  saving,
  onSaved,
  onCancel,
  /** Slug to arrive with already ticked, when opened from an experience card. */
  initialSlug,
  heading = 'New Add-On Booking',
}: {
  saving?: boolean
  onSaved: () => void
  onCancel: () => void
  initialSlug?: string
  heading?: string
}) {
  const [form, setForm] = useState(emptyAddOnForm)
  const [catalogue, setCatalogue] = useState<AddOn[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Record<string, Selection>>({})
  const [submitting, setSubmitting] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [existingClient, setExistingClient] = useState<'no' | 'yes'>('no')
  const [clientId, setClientId] = useState('')

  useEffect(() => {
    let cancelled = false
    fetch('/api/add-ons', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return
        if (data.error) throw new Error(data.error)
        const addOns: AddOn[] = data.addOns || []
        setCatalogue(addOns)
        /* Opened from a card, so that experience is the reason we are here.
           Priced ones pre-fill; quote-on-request starts blank rather than at
           zero, so a forgotten price reads as empty and not as free. */
        const opened = initialSlug ? addOns.find((addOn) => addOn.slug === initialSlug) : null
        if (opened) {
          setSelected({
            [opened.slug]: {
              quantity: '1',
              unitAmount: opened.price != null ? String(opened.price) : '',
            },
          })
        }
      })
      .catch(() => {
        if (!cancelled) toast.error('Could not load the add-on catalogue')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [initialSlug])

  /* Loaded up front rather than when Existing is picked, so choosing someone
     costs no wait. A booking does not need this to succeed — the details can
     always be typed. */
  useEffect(() => {
    let cancelled = false
    fetch('/api/clients', { cache: 'no-store' })
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled && !data.error) setClients((data.clients || []) as Client[])
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  function chooseClient(client: Client) {
    setClientId(client.id)
    setForm((prev) => ({
      ...prev,
      customerName: client.name || prev.customerName,
      customerEmail: client.email || prev.customerEmail,
      customerPhone: client.phone || prev.customerPhone,
    }))
  }

  const lines: AddOnLine[] = useMemo(
    () =>
      catalogue
        .filter((addOn) => selected[addOn.slug])
        .map((addOn) => ({
          slug: addOn.slug,
          name: addOn.name,
          quantity: Math.max(1, parseInt(selected[addOn.slug].quantity, 10) || 1),
          unitAmount: Math.max(0, parseFloat(selected[addOn.slug].unitAmount) || 0),
        })),
    [catalogue, selected],
  )

  const total = addOnBookingTotal(lines)

  /* The party size, taken from the experiences rather than asked for again.
     The largest pax count, not the sum: a family of four doing two
     experiences is four people twice over, not eight. */
  const guests = lines.reduce((most, line) => Math.max(most, line.quantity), 0)

  function toggle(addOn: AddOn) {
    setSelected((prev) => {
      if (prev[addOn.slug]) {
        const next = { ...prev }
        delete next[addOn.slug]
        return next
      }
      return {
        ...prev,
        // Priced add-ons pre-fill; quote-on-request ones start blank rather
        // than at zero, so a forgotten price reads as empty, not as free.
        [addOn.slug]: { quantity: '1', unitAmount: addOn.price != null ? String(addOn.price) : '' },
      }
    })
  }

  function updateSelection(slug: string, patch: Partial<Selection>) {
    setSelected((prev) => (prev[slug] ? { ...prev, [slug]: { ...prev[slug], ...patch } } : prev))
  }

  async function submit() {
    if (!form.customerName || !form.customerEmail || !form.tourDate) {
      toast.error('Name, email and date are required')
      return
    }
    if (lines.length === 0) {
      toast.error('Choose at least one add-on')
      return
    }
    if (lines.some((line) => line.unitAmount <= 0)) {
      toast.error('Every chosen add-on needs a price')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/bookings?type=addon', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, guestsCount: String(guests), lines }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      toast.success('Add-on booking created')
      setForm(emptyAddOnForm)
      setSelected({})
      onSaved()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setSubmitting(false)
    }
  }

  /* Neither date nor guests are in this list. The date uses the console's own
     picker; guests are counted once, on the experience itself, rather than
     asked for twice and left to disagree. */
  const fields = [
    { key: 'customerName', label: 'Customer Name *', type: 'text' },
    { key: 'customerEmail', label: 'Email *', type: 'email' },
    { key: 'customerPhone', label: 'Phone', type: 'tel' },
  ] as const

  const busy = submitting || saving

  return (
    <div style={{ ...cardStyle, marginBottom: 20 }}>
      <h3 style={{ ...sectionTitle, marginBottom: 16 }}>{heading}</h3>

      <div style={{ marginBottom: 16 }}>
        <ClientPicker
          clients={clients}
          mode={existingClient}
          onModeChange={setExistingClient}
          selectedId={clientId}
          onChoose={chooseClient}
          onClear={() => setClientId('')}
        />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        {fields.map((f) => (
          <div key={f.key}>
            <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>{f.label}</label>
            <input
              type={f.type}
              value={form[f.key]}
              onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
              style={inputStyle}
            />
          </div>
        ))}
        <DateField
          label="Date *"
          value={form.tourDate}
          onChange={(value) => setForm({ ...form, tourDate: value })}
        />
      </div>

      <label style={{ display: 'block', ...fieldLabel, marginBottom: 8 }}>Add-On Adventures *</label>

      {loading ? (
        <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>Loading catalogue…</p>
      ) : catalogue.length === 0 ? (
        <p style={{ color: theme.textMuted, fontSize: 13, marginBottom: 16 }}>
          No add-ons found. Check that the content project is reachable.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: 8, marginBottom: 18 }}>
          {catalogue.map((addOn) => {
            const active = Boolean(selected[addOn.slug])
            return (
              <div
                key={addOn.slug}
                style={{
                  border: `1px solid ${active ? theme.bronzeBorder : theme.border}`,
                  background: active ? theme.bronzeBg : 'transparent',
                  borderRadius: 8,
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    flex: '1 1 240px',
                    cursor: 'pointer',
                  }}
                >
                  <input type="checkbox" checked={active} onChange={() => toggle(addOn)} />
                  <span>
                    <span style={{ fontWeight: 600, color: theme.text }}>
                      {addOn.emoji} {addOn.name}
                    </span>
                    <span style={{ display: 'block', fontSize: 12, color: theme.textMuted }}>
                      {addOn.price != null
                        ? `Listed at R${Number(addOn.price).toLocaleString('en-ZA')}${addOn.price_note ? ` ${addOn.price_note}` : ''}`
                        : 'Quote on request'}
                      {addOn.is_published ? '' : ' · not on the website'}
                    </span>
                  </span>
                </label>

                {active && (
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <div>
                      <label style={{ display: 'block', ...fieldLabel, marginBottom: 2 }}>
                        Pax guests
                      </label>
                      <input
                        type="number"
                        min={1}
                        value={selected[addOn.slug].quantity}
                        onChange={(e) => updateSelection(addOn.slug, { quantity: e.target.value })}
                        style={{ ...inputStyle, width: 74 }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', ...fieldLabel, marginBottom: 2 }}>
                        Unit (ZAR)
                      </label>
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={selected[addOn.slug].unitAmount}
                        onChange={(e) => updateSelection(addOn.slug, { unitAmount: e.target.value })}
                        style={{ ...inputStyle, width: 120 }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Notes</label>
        <textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          rows={2}
          style={{ ...inputStyle, width: '100%', resize: 'vertical' }}
          placeholder="Pick-up, dietary requirements, anything the invoice should mention"
        />
      </div>

      {lines.length > 0 && (
        <div
          style={{
            border: `1px solid ${theme.border}`,
            borderRadius: 8,
            padding: '10px 12px',
            marginBottom: 16,
            background: theme.surfaceMuted,
          }}
        >
          {lines.map((line) => (
            <div
              key={line.slug}
              style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, padding: '2px 0' }}
            >
              <span style={{ color: theme.textMuted }}>
                {line.name} × {line.quantity}
              </span>
              <span style={{ color: theme.text }}>{money(line.unitAmount * line.quantity)}</span>
            </div>
          ))}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              fontWeight: 700,
              borderTop: `1px solid ${theme.border}`,
              marginTop: 6,
              paddingTop: 6,
              color: theme.text,
            }}
          >
            <span>Total</span>
            <span>{money(total)}</span>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={submit} disabled={busy} style={primaryButton}>
          {busy ? 'Saving…' : 'Create Booking'}
        </button>
        <button onClick={onCancel} style={secondaryButton}>
          Cancel
        </button>
      </div>
    </div>
  )
}
