'use client'

import { addDays, differenceInCalendarDays, format, isBefore, parseISO } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { buildSeatsLabel, FLEET_USAGE_TYPES, rentalTotal, usageTypeLabel, vehicleRegistration, vehicleSeats } from '@/lib/fleet'
import { VehiclePreviewCard } from '@/components/fleet/vehicle-preview-card'
import type { FleetVehicleCardData } from '@/components/fleet/vehicle-card'
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
    dailyRate: string
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
  const [seatsBooked, setSeatsBooked] = useState('')
  const [sendInvoiceToXero, setSendInvoiceToXero] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [surname, setSurname] = useState('')
  const [accountNumber, setAccountNumber] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [notes, setNotes] = useState('')

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
    setSeatsBooked(vehicle ? String(vehicleSeats(vehicle) || 1) : '')
    setSendInvoiceToXero(true)
    setFirstName('')
    setSurname('')
    setAccountNumber('')
    setPhone('')
    setEmail('')
    setNotes('')
  }, [open, initialVehicleId, vehicles])

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) || null
  const rentalDays = useMemo(() => computeRentalDays(startDate, endDate), [startDate, endDate])
  const totalAmount = rentalTotal(dailyRate, rentalDays)
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
    if (step === 1 && (conflicts.length > 0 || totalAmount <= 0)) return
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
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={fieldLabel}>Vehicle</span>
                <select value={vehicleId} onChange={(e) => handleVehicleChange(e.target.value)} style={inputStyle}>
                  {vehicles.map((vehicle) => (
                    <option key={vehicle.id} value={vehicle.id}>
                      {vehicle.title} · {vehicleRegistration(vehicle) || 'No reg'}
                    </option>
                  ))}
                </select>
              </label>

              {selectedVehicle && <VehiclePreviewCard vehicle={selectedVehicle} />}
            </>
          )}

          {step === 1 && (
            <>
              {selectedVehicle && <VehiclePreviewCard vehicle={selectedVehicle} compact />}

              <div style={{ display: 'grid', gap: 12 }} className="admin-form-grid-2">
                <SelectField label="Vehicle use" value={usageType} onChange={setUsageType} options={FLEET_USAGE_TYPES.map((o) => ({ value: o.value, label: o.label }))} />
                <Field label="Seats booked" type="number" value={seatsBooked} onChange={setSeatsBooked} />
              </div>

              <div style={{ display: 'grid', gap: 12 }} className="admin-form-grid-3">
                <Field label="Start date" type="date" value={startDate} onChange={handleStartDateChange} />
                <Field label="End date" type="date" value={endDate} onChange={handleEndDateChange} />
                <Field label="Days" type="number" value={bookingDays} onChange={handleBookingDaysChange} />
              </div>

              <Field label="Rate per day (R)" type="number" value={dailyRate} onChange={setDailyRate} placeholder="2500" />

              <div style={{ padding: '12px 14px', borderRadius: 8, background: theme.bronzeBg, border: `1px solid ${theme.bronzeBorder}` }}>
                <div style={{ ...fieldLabel, marginBottom: 4 }}>Booking total</div>
                <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 24, color: theme.text }}>
                  {totalAmount > 0 ? money(totalAmount) : '—'}
                </div>
                <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                  {totalAmount > 0
                    ? `${money(Number(dailyRate))} × ${rentalDays} day${rentalDays === 1 ? '' : 's'}`
                    : 'Enter a rate per day to work out the total.'}
                </div>
              </div>

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

              <div style={{ display: 'grid', gap: 12 }} className="admin-form-grid-2">
                <Field label="Customer first name" value={firstName} onChange={setFirstName} />
                <Field label="Customer surname" value={surname} onChange={setSurname} />
              </div>
              <Field label="Email" type="email" value={email} onChange={setEmail} />
              <div style={{ display: 'grid', gap: 12 }} className="admin-form-grid-2">
                <Field label="Phone" value={phone} onChange={setPhone} />
                <Field label="Account number" value={accountNumber} onChange={setAccountNumber} />
              </div>
              <Field label="Booking notes" value={notes} onChange={setNotes} placeholder="Collection point, driver notes, etc." />

              <fieldset style={{ border: `1px solid ${theme.border}`, borderRadius: 8, padding: '12px 14px', margin: 0 }}>
                <legend style={{ ...fieldLabel, padding: '0 6px' }}>Send invoice to Xero?</legend>
                <div style={{ display: 'flex', gap: 18, marginTop: 4 }}>
                  {[
                    { value: true, label: 'Yes' },
                    { value: false, label: 'No' },
                  ].map((option) => (
                    <label key={option.label} style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 14, color: theme.text, cursor: 'pointer' }}>
                      <input
                        type="radio"
                        name="sendInvoiceToXero"
                        checked={sendInvoiceToXero === option.value}
                        onChange={() => setSendInvoiceToXero(option.value)}
                        style={{ accentColor: theme.bronze, cursor: 'pointer' }}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <p style={{ fontSize: 12, color: theme.textMuted, margin: '8px 0 0' }}>
                  {sendInvoiceToXero
                    ? 'An invoice will be raised in Xero for this booking.'
                    : 'The booking is saved without creating a Xero invoice.'}
                </p>
              </fieldset>

              <div style={{ padding: '12px 14px', borderRadius: 8, background: theme.bronzeBg, border: `1px solid ${theme.bronzeBorder}`, fontSize: 13, color: theme.textMuted }}>
                <strong style={{ color: theme.text }}>{selectedVehicle?.title}</strong>
                {' · '}
                {format(parseISO(startDate), 'd MMM')} → {format(parseISO(endDate), 'd MMM yyyy')}
                {totalAmount > 0 ? ` · ${money(totalAmount)}` : ''}
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
                disabled={(step === 0 && !vehicleId) || (step === 1 && totalAmount <= 0)}
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

function Field({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  const required = label.includes('Email') || label.includes('first name') || label.includes('surname')
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} required={required} />
    </label>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={inputStyle}>
        {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </label>
  )
}
