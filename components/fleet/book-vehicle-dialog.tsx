'use client'

import { addDays, differenceInCalendarDays, format, isBefore, parseISO } from 'date-fns'
import { useEffect, useMemo, useState } from 'react'
import { buildSeatsLabel, usageTypeLabel, vehicleRegistration, vehicleSeats } from '@/lib/fleet'
import { VehicleImageHero } from '@/components/fleet/vehicle-image-hero'
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

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: 'rgba(44, 38, 32, 0.45)',
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
          maxWidth: 640,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          boxShadow: '0 20px 60px rgba(44, 38, 32, 0.18)',
          padding: 24,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={sectionTitle}>Book out vehicle</div>
            <p style={{ color: theme.textMuted, fontSize: 13, margin: '4px 0 0' }}>Create a rental and raise the Xero invoice.</p>
          </div>
          <button type="button" onClick={onClose} style={{ ...secondaryButton, padding: '6px 10px' }} aria-label="Close">
            ✕
          </button>
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault()
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
            <VehicleImageHero imageUrl={selectedVehicle.image_url} title={selectedVehicle.title} height={140} />
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <SelectField label="Use type" value={usageType} onChange={setUsageType} options={[
              { value: 'tour', label: 'Tour use' },
              { value: 'internal', label: 'Internal use' },
            ]} />
            <Field label="Days" type="number" value={bookingDays} onChange={handleBookingDaysChange} />
            <Field label="Amount (R)" type="number" value={amount} onChange={setAmount} placeholder={suggestedAmount ? String(suggestedAmount) : ''} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Start date" type="date" value={startDate} onChange={handleStartDateChange} />
            <Field label="End date" type="date" value={endDate} onChange={handleEndDateChange} />
            <Field label="Seats booked" type="number" value={seatsBooked} onChange={setSeatsBooked} />
          </div>

          {selectedVehicle && (
            <div style={{ fontSize: 12, color: theme.textMuted, padding: '10px 12px', background: theme.surfaceMuted, borderRadius: 8, border: `1px solid ${theme.border}` }}>
              {buildSeatsLabel(vehicleSeats(selectedVehicle) || 0)} · {selectedVehicle.base_price ? `${money(Number(selectedVehicle.base_price))}/day` : 'No day rate'} · {usageTypeLabel(usageType)}
            </div>
          )}

          {suggestedAmount > 0 && !amount && (
            <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(100,149,237,0.08)', border: '1px solid rgba(100,149,237,0.2)', color: '#3a5f9e', fontSize: 13 }}>
              Suggested from day rate: {money(suggestedAmount)}
            </div>
          )}

          {conflicts.length > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(196,92,74,0.08)', border: '1px solid rgba(196,92,74,0.22)', color: theme.danger, fontSize: 13 }}>
              Clashes with {conflicts[0].customerName}&apos;s booking ({format(parseISO(conflicts[0].startDate), 'd MMM')} → {format(parseISO(conflicts[0].endDate), 'd MMM yyyy')}).
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Customer first name" value={firstName} onChange={setFirstName} />
            <Field label="Customer surname" value={surname} onChange={setSurname} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Field label="Email" type="email" value={email} onChange={setEmail} />
            <Field label="Phone" value={phone} onChange={setPhone} />
            <Field label="Account number" value={accountNumber} onChange={setAccountNumber} />
          </div>
          <Field label="Booking notes" value={notes} onChange={setNotes} placeholder="Airport collection, etc." />

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="submit" disabled={saving || vehicles.length === 0} style={primaryButton}>
              {saving ? 'Creating booking…' : 'Book & create invoice'}
            </button>
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
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} required={label.includes('Email') || label.includes('first name') || label.includes('surname')} />
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
