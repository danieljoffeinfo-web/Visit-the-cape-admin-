'use client'

import { addDays, differenceInCalendarDays, format, isBefore, parseISO } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { buildSeatsLabel, usageTypeLabel, vehicleRegistration, vehicleSeats } from '@/lib/fleet'
import { VehicleImageThumb } from '@/components/fleet/vehicle-image-upload'
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
    amount: string
    seatsBooked: string
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
  const [amount, setAmount] = useState('')
  const [seatsBooked, setSeatsBooked] = useState('')
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
    setAmount('')
    setSeatsBooked(vehicle ? String(vehicleSeats(vehicle) || 1) : '')
    setFirstName('')
    setSurname('')
    setAccountNumber('')
    setPhone('')
    setEmail('')
    setNotes('')
  }, [open, initialVehicleId, vehicles])

  const selectedVehicle = vehicles.find((v) => v.id === vehicleId) || null
  const rentalDays = useMemo(() => computeRentalDays(startDate, endDate), [startDate, endDate])
  const suggestedAmount = selectedVehicle?.base_price
    ? Number(selectedVehicle.base_price) * Math.max(1, Number.parseInt(bookingDays, 10) || rentalDays || 1)
    : 0
  const conflicts = vehicleId ? conflictsForVehicle(vehicleId, startDate, endDate) : []

  if (!open) return null

  function handleVehicleChange(nextId: string) {
    const vehicle = vehicles.find((v) => v.id === nextId)
    setVehicleId(nextId)
    if (vehicle) setSeatsBooked(String(vehicleSeats(vehicle) || 1))
    if (!amount && vehicle?.base_price) {
      const days = Math.max(1, Number.parseInt(bookingDays, 10) || rentalDays || 1)
      setAmount(String(Number(vehicle.base_price) * days))
    }
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

  function applySuggestedAmount() {
    if (suggestedAmount > 0) setAmount(String(suggestedAmount))
  }

  function goNext() {
    if (step === 0 && !vehicleId) return
    if (step === 1 && conflicts.length > 0) return
    setStep((s) => Math.min(s + 1, STEPS.length - 1))
  }

  function goBack() {
    setStep((s) => Math.max(s - 1, 0))
  }

  return (
    <div
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
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
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
              amount,
              seatsBooked,
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

              {selectedVehicle && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: theme.surfaceMuted, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                  <VehicleImageThumb imageUrl={selectedVehicle.image_url} title={selectedVehicle.title} size={56} />
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{selectedVehicle.title}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                      {buildSeatsLabel(vehicleSeats(selectedVehicle) || 0)}
                      {selectedVehicle.base_price ? ` · ${money(Number(selectedVehicle.base_price))}/day` : ''}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}

          {step === 1 && (
            <>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <SelectField label="Use type" value={usageType} onChange={setUsageType} options={[
                  { value: 'tour', label: 'Tour use' },
                  { value: 'internal', label: 'Internal use' },
                ]} />
                <Field label="Seats booked" type="number" value={seatsBooked} onChange={setSeatsBooked} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Field label="Start date" type="date" value={startDate} onChange={handleStartDateChange} />
                <Field label="End date" type="date" value={endDate} onChange={handleEndDateChange} />
                <Field label="Days" type="number" value={bookingDays} onChange={handleBookingDaysChange} />
              </div>

              <Field label="Amount (R)" type="number" value={amount} onChange={setAmount} placeholder={suggestedAmount ? String(suggestedAmount) : ''} />

              {selectedVehicle && (
                <div style={{ fontSize: 12, color: theme.textMuted, padding: '10px 12px', background: theme.surfaceMuted, borderRadius: 8, border: `1px solid ${theme.border}` }}>
                  {buildSeatsLabel(vehicleSeats(selectedVehicle) || 0)} · {usageTypeLabel(usageType)}
                  {rentalDays > 0 ? ` · ${rentalDays} day${rentalDays === 1 ? '' : 's'}` : ''}
                </div>
              )}

              {suggestedAmount > 0 && !amount && (
                <button type="button" onClick={applySuggestedAmount} style={{ ...secondaryButton, textAlign: 'left' }}>
                  Use suggested amount: {money(suggestedAmount)}
                </button>
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Customer first name" value={firstName} onChange={setFirstName} />
                <Field label="Customer surname" value={surname} onChange={setSurname} />
              </div>
              <Field label="Email" type="email" value={email} onChange={setEmail} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Field label="Phone" value={phone} onChange={setPhone} />
                <Field label="Account number" value={accountNumber} onChange={setAccountNumber} />
              </div>
              <Field label="Booking notes" value={notes} onChange={setNotes} placeholder="Airport collection, etc." />

              <div style={{ padding: '12px 14px', borderRadius: 8, background: theme.bronzeBg, border: `1px solid ${theme.bronzeBorder}`, fontSize: 13, color: theme.textMuted }}>
                <strong style={{ color: theme.text }}>{selectedVehicle?.title}</strong>
                {' · '}
                {format(parseISO(startDate), 'd MMM')} → {format(parseISO(endDate), 'd MMM yyyy')}
                {amount ? ` · ${money(Number(amount))}` : ''}
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
                disabled={step === 0 && !vehicleId}
                style={primaryButton}
              >
                Continue
              </button>
            ) : (
              <button type="submit" disabled={saving || vehicles.length === 0} style={primaryButton}>
                {saving ? 'Creating booking…' : 'Book & create invoice'}
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
