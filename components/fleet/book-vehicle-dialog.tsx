'use client'

import { addDays, differenceInCalendarDays, format, isBefore, parseISO } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { clientPrefill, type Client } from '@/lib/clients'
import { buildSeatsLabel, fleetInvoiceDescription, FLEET_USAGE_TYPES, usageTypeLabel, vehicleRegistration, vehicleSeats } from '@/lib/fleet'
import { VehiclePreviewCard } from '@/components/fleet/vehicle-preview-card'
import type { FleetVehicleCardData } from '@/components/fleet/vehicle-card'
import { ClientPicker } from '@/components/ui/client-picker'
import { DateField } from '@/components/ui/date-field'
import { SelectMenu } from '@/components/ui/select-menu'
import { fieldLabel, inputStyle, primaryButton, secondaryButton, sectionTitle, theme } from '@/lib/theme'

type BookingConflict = {
  customerName: string
  startDate: string
  endDate: string
}

type BookVehicleDialogProps = {
  open: boolean
  vehicles: FleetVehicleCardData[]
  initialVehicleId?: string
  conflictsForVehicle: (vehicleId: string, startDate: string, endDate: string) => BookingConflict[]
  saving?: boolean
  onClose: () => void
  onSubmit: (payload: {
    vehicleId: string
    usageType: string
    bookingDays: string
    startDate: string
    endDate: string
    /** Agreed rate per day. The total is this multiplied by the rental days. */
    dailyRate: string
    /** The total the rate works out to, for callers that display it. */
    amount: string
    invoiceDescription: string
    depositRequired: boolean
    depositAmount: string
    seatsBooked: string
    sendInvoiceToXero: boolean
    firstName: string
    surname: string
    accountNumber: string
    phone: string
    email: string
    notes: string
  }) => Promise<void>
}

const STEPS = ['Vehicle', 'Dates & price', 'Customer'] as const

function computeRentalDays(startDate: string, endDate: string) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || isBefore(end, start)) return 0
  return differenceInCalendarDays(end, start) + 1
}

function money(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function BookVehicleDialog({
  open,
  vehicles,
  initialVehicleId,
  conflictsForVehicle,
  saving,
  onClose,
  onSubmit,
}: BookVehicleDialogProps) {
  const [step, setStep] = useState(0)
  const [vehicleId, setVehicleId] = useState('')
  const [usageType, setUsageType] = useState('tour')
  const [bookingDays, setBookingDays] = useState('2')
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
  const [dailyRate, setDailyRate] = useState('')
  const [invoiceDescription, setInvoiceDescription] = useState('')
  const [depositRequired, setDepositRequired] = useState(false)
  const [depositAmount, setDepositAmount] = useState('')
  const [seatsBooked, setSeatsBooked] = useState('')
  const [sendInvoiceToXero, setSendInvoiceToXero] = useState(false)
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')
  /* Existing client, or a new one. Kept as a string rather than a boolean so
     the radio pair reads the same as the Xero one below it. */
  const [existingClient, setExistingClient] = useState<'no' | 'yes'>('no')
  const [clients, setClients] = useState<Client[]>([])
  const [clientId, setClientId] = useState('')

  /* Loaded once when the dialog opens rather than when Yes is picked, so the
     list is already there and choosing a client costs no wait. */
  useEffect(() => {
    if (!open) return
    let cancelled = false
    fetch('/api/clients', { cache: 'no-store' })
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled && !d.error) setClients((d.clients || []) as Client[])
      })
      .catch(() => {
        /* The booking does not need this to succeed — the form still takes a
           name and email typed in by hand. */
      })
    return () => {
      cancelled = true
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const nextId = initialVehicleId || vehicles[0]?.id || ''
    const vehicle = vehicles.find((v) => v.id === nextId)
    setStep(0)
    setVehicleId(nextId)
    setUsageType('tour')
    setBookingDays('2')
    setStartDate(format(new Date(), 'yyyy-MM-dd'))
    setEndDate(format(addDays(new Date(), 1), 'yyyy-MM-dd'))
    setDailyRate('')
    setInvoiceDescription('')
    setDepositRequired(false)
    setDepositAmount('')
    setSeatsBooked(vehicle ? String(vehicleSeats(vehicle) || 1) : '')
    setSendInvoiceToXero(false)
    setFirstName('')
    setSurname('')
    setAccountNumber('')
    setPhone('')
    setEmail('')
    setNotes('')
    setExistingClient('no')
    setClientId('')
  }, [open, initialVehicleId, vehicles])

  function chooseClient(client: Client) {
    const prefill = clientPrefill(client)
    setClientId(client.id)
    setFirstName(prefill.firstName)
    setSurname(prefill.surname)
    setEmail(prefill.email)
    setPhone(prefill.phone)
    setAccountNumber(prefill.accountNumber)
  }

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) || null
  const rentalDays = useMemo(() => computeRentalDays(startDate, endDate), [startDate, endDate])
  /* Priced per day now, not per booking. The office types one number it has
     actually agreed with the customer, and the length of the hire does the
     rest — so a date change re-prices the booking instead of silently leaving
     a total that no longer matches the days it covers. */
  const perDayRate = Math.max(0, Number(dailyRate) || 0)
  const totalAmount = perDayRate * rentalDays
  const deposit = depositRequired ? Math.max(0, Number(depositAmount) || 0) : 0
  const balance = Math.max(0, totalAmount - deposit)
  const depositTooBig = depositRequired && deposit > totalAmount && totalAmount > 0
  const stepOneReady =
    perDayRate > 0 && rentalDays > 0 && !depositTooBig && (!depositRequired || deposit > 0)

  /* What the invoice will say if nothing is typed below it. Rebuilt as the
     vehicle, hire type, rate and dates change, so the operator is reading the
     real line rather than a description of one. */
  const defaultInvoiceDescription = fleetInvoiceDescription({
    vehicleName: selectedVehicle?.title || 'Vehicle',
    usageType,
    dailyRate: perDayRate,
    days: rentalDays,
  })
  const conflicts = vehicleId ? conflictsForVehicle(vehicleId, startDate, endDate) : []

  if (!open) return null

  function handleVehicleChange(nextId: string) {
    const vehicle = vehicles.find((v) => v.id === nextId)
    setVehicleId(nextId)
    if (vehicle) setSeatsBooked(String(vehicleSeats(vehicle) || 1))
  }

  function handleStartDateChange(value: string) {
    const activeDays = Math.max(1, Number.parseInt(bookingDays, 10) || computeRentalDays(value, endDate) || 1)
    const start = parseISO(value)
    setStartDate(value)
    if (!Number.isNaN(start.getTime())) setEndDate(format(addDays(start, activeDays - 1), 'yyyy-MM-dd'))
  }

  function handleEndDateChange(value: string) {
    const nextDays = computeRentalDays(startDate, value)
    setEndDate(value)
    if (nextDays > 0) setBookingDays(String(nextDays))
  }

  function handleBookingDaysChange(value: string) {
    const cleanValue = value.replace(/[^\d]/g, '')
    const nextDays = Math.max(1, Number.parseInt(cleanValue || '1', 10))
    const start = parseISO(startDate)
    setBookingDays(cleanValue)
    if (!Number.isNaN(start.getTime())) setEndDate(format(addDays(start, nextDays - 1), 'yyyy-MM-dd'))
  }

  function goNext() {
    if (step === 0 && !vehicleId) return
    if (step === 1 && (conflicts.length > 0 || !stepOneReady)) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <div
      className="admin-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
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
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.modalShadow,
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div>
            <div style={sectionTitle}>Book out vehicle</div>
            <p style={{ color: theme.textMuted, fontSize: 13, margin: '4px 0 0' }}>
              Step {step + 1} of {STEPS.length} · {STEPS[step]}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ ...secondaryButton, padding: '6px 10px' }} aria-label="Close">
            ✕
          </button>
        </div>

        <div style={{ display: 'flex', gap: 6, marginBottom: 20 }}>
          {STEPS.map((label, index) => (
            <div
              key={label}
              style={{
                flex: 1,
                height: 4,
                borderRadius: 2,
                background: index <= step ? theme.bronze : theme.surfaceMuted,
                transition: 'background 0.2s ease',
              }}
              title={label}
            />
          ))}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (step < STEPS.length - 1) {
              goNext()
              return
            }
            void onSubmit({
              vehicleId,
              usageType,
              bookingDays,
              startDate,
              endDate,
              dailyRate,
              amount: String(totalAmount),
              invoiceDescription,
              depositRequired,
              depositAmount,
              seatsBooked,
              sendInvoiceToXero,
              firstName,
              surname,
              accountNumber,
              phone,
              email,
              notes,
            })
          }}
          style={{ display: 'grid', gap: 14 }}
        >
          {step === 0 && (
            <>
              <SelectMenu
                label="Vehicle"
                value={vehicleId}
                onChange={handleVehicleChange}
                options={vehicles.map((vehicle) => ({
                  value: vehicle.id,
                  label: vehicle.title,
                  hint: vehicleRegistration(vehicle) || 'No reg',
                }))}
              />

              {selectedVehicle && <VehiclePreviewCard vehicle={selectedVehicle} />}
            </>
          )}

          {step === 1 && (
            <>
              {selectedVehicle && <VehiclePreviewCard vehicle={selectedVehicle} compact />}

              <div style={{ display: 'grid', gap: 12 }} className="admin-form-grid-2">
                <SelectMenu
                  label="Vehicle use"
                  value={usageType}
                  onChange={setUsageType}
                  options={FLEET_USAGE_TYPES.map((o) => ({ value: o.value, label: o.label }))}
                />
                <Field label="Seats booked" type="number" value={seatsBooked} onChange={setSeatsBooked} />
              </div>

              <div style={{ display: 'grid', gap: 12 }} className="admin-form-grid-3">
                <DateField label="Start date" value={startDate} onChange={handleStartDateChange} />
                {/* A rental cannot end before it starts, so those days are not offered. */}
                <DateField label="End date" value={endDate} onChange={handleEndDateChange} min={startDate} />
                <Field label="Days" type="number" value={bookingDays} onChange={handleBookingDaysChange} />
              </div>

              <Field label="Amount per day (R)" type="number" value={dailyRate} onChange={setDailyRate} placeholder="800" />

              <fieldset style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: '12px 14px', margin: 0 }}>
                <legend style={{ ...fieldLabel, padding: '0 6px' }}>Upfront deposit required?</legend>
                <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
                  {[
                    { value: true, label: 'Yes' },
                    { value: false, label: 'No' },
                  ].map((option) => (
                    <label key={option.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: theme.text, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="depositRequired"
                        checked={depositRequired === option.value}
                        onChange={() => {
                          setDepositRequired(option.value)
                          if (!option.value) setDepositAmount('')
                        }}
                        style={{ accentColor: theme.bronze, cursor: 'pointer' }}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>

                {depositRequired && (
                  <div style={{ marginTop: 12 }}>
                    <Field label="Deposit amount (R)" type="number" value={depositAmount} onChange={setDepositAmount} placeholder="10000" />
                  </div>
                )}
              </fieldset>

              <div style={{ padding: '12px 14px', borderRadius: 8, background: theme.bronzeBg, border: `1px solid ${theme.bronzeBorder}` }}>
                {/* The arithmetic, spelled out. The operator typed a rate, not
                    a total, so the total has to show its working or there is
                    nothing on screen to check it against. */}
                {perDayRate > 0 && rentalDays > 0 && (
                  <div style={{ fontSize: 13, color: theme.textMuted, paddingBottom: 6 }}>
                    {money(perDayRate)} per day × {rentalDays} day{rentalDays === 1 ? '' : 's'}
                  </div>
                )}
                <Totals label="Total (VAT inclusive)" value={totalAmount > 0 ? money(totalAmount) : '—'} strong />
                {deposit > 0 && (
                  <>
                    <Totals label="Upfront payment" value={money(deposit)} accent />
                    <Totals label="Balance" value={money(balance)} strong />
                  </>
                )}
                {totalAmount <= 0 && (
                  <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 6 }}>
                    Type the agreed rate per day for this booking.
                  </div>
                )}
              </div>

              {/* Optional, and shown with the line it replaces. Most hires are
                  described perfectly well by the vehicle and what the hire
                  includes; this is for the one that is not. */}
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={fieldLabel}>Invoice description (optional)</span>
                <input
                  type="text"
                  value={invoiceDescription}
                  onChange={(e) => setInvoiceDescription(e.target.value)}
                  placeholder={defaultInvoiceDescription}
                  style={inputStyle}
                />
                <span style={{ fontSize: 12, color: theme.textMuted }}>
                  {invoiceDescription.trim()
                    ? 'This is what the invoice will say.'
                    : `Leave blank and the invoice says: ${defaultInvoiceDescription}`}
                </span>
              </label>

              {depositTooBig && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(196,92,74,0.08)', border: '1px solid rgba(196,92,74,0.22)', color: theme.danger, fontSize: 13 }}>
                  The deposit cannot be more than the total amount.
                </div>
              )}

              {selectedVehicle && (
                <div style={{ fontSize: 12, color: theme.textMuted, padding: '10px 12px', background: theme.surfaceMuted, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                  {buildSeatsLabel(vehicleSeats(selectedVehicle) || 0)} · {usageTypeLabel(usageType)}
                  {rentalDays > 0 ? ` · ${rentalDays} day${rentalDays === 1 ? '' : 's'}` : ''}
                </div>
              )}

              {conflicts.length > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(196,92,74,0.08)', border: '1px solid rgba(196,92,74,0.22)', color: theme.danger, fontSize: 13 }}>
                  Clashes with {conflicts[0].customerName}&apos;s booking ({format(parseISO(conflicts[0].startDate), 'd MMM')} → {format(parseISO(conflicts[0].endDate), 'd MMM yyyy')}).
                </div>
              )}
            </>
          )}

          {step === 2 && (
            <>
              {selectedVehicle && <VehiclePreviewCard vehicle={selectedVehicle} compact />}

              <ClientPicker
                clients={clients}
                mode={existingClient}
                onModeChange={setExistingClient}
                selectedId={clientId}
                onChoose={chooseClient}
                onClear={() => setClientId('')}
              />

              <div style={{ display: 'grid', gap: 12 }} className="admin-form-grid-2">
                <Field label="Customer first name" value={firstName} onChange={setFirstName} />
                <Field label="Customer surname" value={surname} onChange={setSurname} />
              </div>
              <Field label="Email (optional)" type="email" value={email} onChange={setEmail} />
              <div style={{ display: 'grid', gap: 12 }} className="admin-form-grid-2">
                <Field label="Phone (optional)" value={phone} onChange={setPhone} />
                <Field label="Account number (optional)" value={accountNumber} onChange={setAccountNumber} />
              </div>
              <Field label="Booking notes" value={notes} onChange={setNotes} placeholder="Collection point, driver notes, etc." />

              {/* Two targets rather than two radio dots. This is the last
                  decision before the booking is saved and the one with a
                  consequence outside the console, so it is sized like a choice
                  instead of a checkbox someone scrolls past. */}
              <div role="radiogroup" aria-label="Also create this invoice in Xero?">
                <div style={{ ...fieldLabel, marginBottom: 8 }}>Also create this invoice in Xero?</div>
                <div style={{ display: 'grid', gap: 10 }} className="admin-form-grid-2">
                  <ChoiceButton
                    selected={!sendInvoiceToXero}
                    onSelect={() => setSendInvoiceToXero(false)}
                    label="No"
                    hint="Created here only — nothing is sent to Xero"
                  />
                  <ChoiceButton
                    selected={sendInvoiceToXero}
                    onSelect={() => setSendInvoiceToXero(true)}
                    label="Yes"
                    hint="Also raised in Xero as an approved invoice"
                  />
                </div>
              </div>

              <div style={{ padding: '12px 14px', borderRadius: 8, background: theme.bronzeBg, border: `1px solid ${theme.bronzeBorder}`, fontSize: 13, color: theme.textMuted }}>
                <strong style={{ color: theme.text }}>{selectedVehicle?.title}</strong>
                {' · '}
                {format(parseISO(startDate), 'd MMM')} → {format(parseISO(endDate), 'd MMM yyyy')}
                {totalAmount > 0 ? ` · ${money(totalAmount)}` : ''}
                {deposit > 0 ? ` · ${money(deposit)} upfront, ${money(balance)} balance` : ''}
                <div style={{ marginTop: 6 }}>
                  The invoice is generated on save. You can download it, and a copy is emailed to you.
                </div>
              </div>
            </>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            {step > 0 && (
              <button type="button" onClick={goBack} style={secondaryButton}>
                Back
              </button>
            )}
            {step < STEPS.length - 1 ? (
              <button
                type="submit"
                disabled={(step === 0 && !vehicleId) || (step === 1 && !stepOneReady)}
                style={primaryButton}
              >
                Continue
              </button>
            ) : (
              <button type="submit" disabled={saving || vehicles.length === 0} style={primaryButton}>
                {saving ? 'Creating booking…' : sendInvoiceToXero ? 'Book & create invoice' : 'Book vehicle'}
              </button>
            )}
            <button type="button" onClick={onClose} style={secondaryButton}>
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

function Totals({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 12, padding: '3px 0' }}>
      <span style={{ fontSize: 13, fontWeight: strong ? 700 : 600, color: accent ? theme.bronzeDark : theme.text }}>{label}</span>
      <span style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: strong ? 20 : 17, color: accent ? theme.bronzeDark : theme.text }}>{value}</span>
    </div>
  )
}

/**
 * A large, obvious either/or.
 *
 * Buttons rather than a radio pair because the answer changes what happens
 * outside this console: Yes raises a real document in the accounts. A 13px dot
 * is the wrong size for that decision.
 */
function ChoiceButton({
  selected,
  onSelect,
  label,
  hint,
}: {
  selected: boolean
  onSelect: () => void
  label: string
  hint: string
}) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '14px 16px',
        borderRadius: 10,
        cursor: 'pointer',
        fontFamily: theme.bodyFont,
        background: selected ? theme.bronzeBg : theme.surface,
        border: `2px solid ${selected ? theme.bronze : theme.border}`,
        color: selected ? theme.bronzeDark : theme.text,
        transition: 'background 0.15s ease, border-color 0.15s ease',
      }}
    >
      <span style={{ display: 'block', fontSize: 17, fontWeight: 700, fontFamily: theme.headingFont, letterSpacing: '0.02em' }}>
        {label}
      </span>
      <span style={{ display: 'block', fontSize: 12, marginTop: 3, color: selected ? theme.bronzeDark : theme.textMuted, lineHeight: 1.4 }}>
        {hint}
      </span>
    </button>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  // Only the customer's name is mandatory — email and account number are not.
  const required = label.includes('first name') || label.includes('surname')
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} required={required} />
    </label>
  )
}

