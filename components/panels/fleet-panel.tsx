'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, isAfter, isBefore, parseISO } from 'date-fns'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { toast } from 'sonner'
import {
  buildSeatsLabel,
  fullCustomerName,
  isFleetVehicle,
  parseFleetBookingNotes,
  usageTypeLabel,
  vehicleNotes,
  vehicleRegistration,
  vehicleSeats,
} from '@/lib/fleet'
import {
  cardStyle,
  fieldLabel as themeFieldLabel,
  inputStyle,
  pageTitle,
  primaryButton,
  secondaryButton,
  sectionTitle,
  statLabel,
  theme,
} from '@/lib/theme'

type VehicleRow = {
  id: string
  title: string
  family: string
  summary?: string | null
  duration_label?: string | null
  pickup_notes?: string | null
  base_price?: number | null
  active?: boolean | null
}

type BookingRow = {
  id: string
  product_id?: string | null
  status?: string | null
  amount?: number | null
  notes?: string | null
  created_at: string
}

type InvoiceLink = {
  booking_id: string
  xero_invoice_id?: string | null
  xero_invoice_number?: string | null
  status?: string | null
}

const CHART_COLORS = ['#b8956a', '#4caf84', '#6495ed', '#ef5350', '#f4c542', '#8e6ad8']

function money(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function computeRentalDays(startDate: string, endDate: string) {
  const start = parseISO(startDate)
  const end = parseISO(endDate)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || isBefore(end, start)) return 0
  return differenceInCalendarDays(end, start) + 1
}

export function FleetPanel({ onNavigate }: { onNavigate: (panel: string) => void }) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [invoiceLinks, setInvoiceLinks] = useState<Record<string, InvoiceLink>>({})
  const [loading, setLoading] = useState(true)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [savingBooking, setSavingBooking] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [showBookingForm, setShowBookingForm] = useState(false)
  const [vehiclePickerOpen, setVehiclePickerOpen] = useState(false)
  const [vehicleSearch, setVehicleSearch] = useState('')
  const [vehicleForm, setVehicleForm] = useState({
    title: '',
    registrationNumber: '',
    seats: '7',
    defaultRate: '',
    notes: '',
  })
  const [bookingForm, setBookingForm] = useState({
    vehicleId: '',
    usageType: 'tour',
    bookingDays: '2',
    startDate: format(new Date(), 'yyyy-MM-dd'),
    endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
    amount: '',
    seatsBooked: '',
    firstName: '',
    surname: '',
    accountNumber: '',
    phone: '',
    email: '',
    notes: '',
  })
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [editingVehicleForm, setEditingVehicleForm] = useState({
    title: '',
    registrationNumber: '',
    seats: '1',
    defaultRate: '',
    notes: '',
  })
  const [savingVehicleEdit, setSavingVehicleEdit] = useState(false)

  useEffect(() => {
    loadFleet()
  }, [])

  async function loadFleet() {
    setLoading(true)
    try {
      const [vehiclesResponse, bookingsResponse] = await Promise.all([
        fetch('/api/fleet/vehicles', { cache: 'no-store' }),
        fetch('/api/fleet/bookings', { cache: 'no-store' }),
      ])

      const vehiclesResult = await vehiclesResponse.json()
      const bookingsResult = await bookingsResponse.json()

      if (!vehiclesResponse.ok) {
        throw new Error(vehiclesResult.error || 'Failed to load vehicles')
      }

      if (!bookingsResponse.ok) {
        throw new Error(bookingsResult.error || 'Failed to load bookings')
      }

      const nextVehicles = ((vehiclesResult.vehicles || []) as VehicleRow[]).filter(isFleetVehicle)
      const nextBookings = (bookingsResult.bookings || []) as BookingRow[]
      const linkMap = Object.fromEntries(((bookingsResult.invoiceLinks || []) as InvoiceLink[]).map((link) => [link.booking_id, link]))

      setVehicles(nextVehicles)
      setBookings(nextBookings)
      setInvoiceLinks(linkMap)
      setSelectedVehicleId((current) => current || nextVehicles[0]?.id || '')
      setBookingForm((current) => ({
        ...current,
        vehicleId: current.vehicleId || nextVehicles[0]?.id || '',
        seatsBooked: current.seatsBooked || String(vehicleSeats(nextVehicles[0] || { duration_label: '1 seat' })),
        bookingDays: current.bookingDays || '2',
      }))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load fleet dashboard')
    } finally {
      setLoading(false)
    }
  }

  const bookingDetails = useMemo(() => {
    return bookings
      .map((booking) => {
        const notes = parseFleetBookingNotes(booking.notes)
        if (!notes) return null
        if ((booking.status || '').toLowerCase() === 'cancelled') return null
        const invoice = invoiceLinks[booking.id]
        const paymentReceived = (invoice?.status || '').toUpperCase() === 'PAID' || Boolean(notes.rental.paymentReceived)
        return {
          booking,
          notes,
          invoice,
          vehicleId: notes.vehicle.id,
          vehicleName: notes.vehicle.title,
          registrationNumber: notes.vehicle.registrationNumber,
          seats: notes.vehicle.seats,
          days: notes.rental.days,
          startDate: notes.rental.startDate,
          endDate: notes.rental.endDate,
          seatsBooked: notes.rental.seatsBooked,
          usageType: notes.rental.usageType || 'tour',
          paymentReceived,
          totalAmount: Number(booking.amount || notes.rental.totalAmount || 0),
          customerName: fullCustomerName(notes),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [bookings, invoiceLinks])

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === (bookingForm.vehicleId || selectedVehicleId)) || vehicles[0] || null
  const selectedVehicleSeats = selectedVehicle ? vehicleSeats(selectedVehicle) : 0
  const rentalDays = useMemo(() => computeRentalDays(bookingForm.startDate, bookingForm.endDate), [bookingForm.startDate, bookingForm.endDate])

  const selectedVehicleConflicts = useMemo(() => {
    if (!selectedVehicle || rentalDays <= 0) return []
    const start = parseISO(bookingForm.startDate)
    const end = parseISO(bookingForm.endDate)
    return bookingDetails.filter((item) => {
      if (item.vehicleId !== selectedVehicle.id) return false
      if ((item.booking.status || '').toLowerCase() === 'cancelled') return false
      const existingStart = parseISO(item.startDate)
      const existingEnd = parseISO(item.endDate)
      return start <= existingEnd && end >= existingStart
    })
  }, [bookingDetails, bookingForm.endDate, bookingForm.startDate, rentalDays, selectedVehicle])

  const filteredVehicles = useMemo(() => {
    const query = vehicleSearch.trim().toLowerCase()
    if (!query) return vehicles
    return vehicles.filter((vehicle) => {
      const haystack = `${vehicle.title} ${vehicleRegistration(vehicle)} ${vehicleNotes(vehicle)}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [vehicleSearch, vehicles])

  const stats = useMemo(() => {
    const today = new Date()
    const monthFromNow = addDays(today, 30)
    const activeRentals = bookingDetails.filter((item) => {
      const start = parseISO(item.startDate)
      const end = parseISO(item.endDate)
      return start <= today && end >= today
    }).length

    const upcomingDays = bookingDetails.reduce((sum, item) => {
      const start = parseISO(item.startDate)
      if (isAfter(start, monthFromNow)) return sum
      return sum + item.days
    }, 0)

    const totalRevenue = bookingDetails.reduce((sum, item) => sum + item.totalAmount, 0)

    return {
      vehicles: vehicles.length,
      activeRentals,
      upcomingDays,
      totalRevenue,
    }
  }, [bookingDetails, vehicles.length])

  const revenueByVehicle = useMemo(() => {
    return vehicles
      .map((vehicle) => {
        const vehicleBookings = bookingDetails.filter((item) => item.vehicleId === vehicle.id)
        const revenue = vehicleBookings.reduce((sum, item) => sum + item.totalAmount, 0)
        const bookedDays = vehicleBookings.reduce((sum, item) => sum + item.days, 0)
        return {
          id: vehicle.id,
          name: vehicle.title,
          revenue,
          bookedDays,
          bookingCount: vehicleBookings.length,
          registrationNumber: vehicleRegistration(vehicle),
          seats: vehicleSeats(vehicle),
        }
      })
      .filter((item) => item.revenue > 0 || item.bookingCount > 0)
  }, [bookingDetails, vehicles])

  const suggestedAmount = selectedVehicle?.base_price ? Number(selectedVehicle.base_price) * Math.max(1, Number.parseInt(bookingForm.bookingDays, 10) || rentalDays || 1) : 0

  function handleVehicleSelection(value: string) {
    const nextVehicle = vehicles.find((vehicle) => vehicle.id === value)
    setBookingForm((current) => ({
      ...current,
      vehicleId: value,
      seatsBooked: nextVehicle ? String(vehicleSeats(nextVehicle)) : current.seatsBooked,
      amount: !current.amount && nextVehicle?.base_price ? String(Number(nextVehicle.base_price) * Math.max(1, Number.parseInt(current.bookingDays, 10) || rentalDays || 1)) : current.amount,
    }))
    setSelectedVehicleId(value)
    setVehiclePickerOpen(false)
    setVehicleSearch('')
  }

  function handleStartDateChange(value: string) {
    setBookingForm((current) => {
      const activeDays = Math.max(1, Number.parseInt(current.bookingDays, 10) || computeRentalDays(current.startDate, current.endDate) || 1)
      const start = parseISO(value)
      return {
        ...current,
        startDate: value,
        endDate: Number.isNaN(start.getTime()) ? current.endDate : format(addDays(start, activeDays - 1), 'yyyy-MM-dd'),
      }
    })
  }

  function handleEndDateChange(value: string) {
    setBookingForm((current) => {
      const nextDays = computeRentalDays(current.startDate, value)
      return {
        ...current,
        endDate: value,
        bookingDays: nextDays > 0 ? String(nextDays) : current.bookingDays,
      }
    })
  }

  function handleBookingDaysChange(value: string) {
    const cleanValue = value.replace(/[^\d]/g, '')
    setBookingForm((current) => {
      const nextDays = Math.max(1, Number.parseInt(cleanValue || '1', 10))
      const start = parseISO(current.startDate)
      return {
        ...current,
        bookingDays: cleanValue,
        endDate: Number.isNaN(start.getTime()) ? current.endDate : format(addDays(start, nextDays - 1), 'yyyy-MM-dd'),
      }
    })
  }

  function startVehicleEdit(vehicle: VehicleRow) {
    setEditingVehicleId(vehicle.id)
    setEditingVehicleForm({
      title: vehicle.title,
      registrationNumber: vehicleRegistration(vehicle),
      seats: String(vehicleSeats(vehicle) || 1),
      defaultRate: vehicle.base_price === null || vehicle.base_price === undefined ? '' : String(Number(vehicle.base_price)),
      notes: vehicleNotes(vehicle),
    })
  }

  function cancelVehicleEdit() {
    setEditingVehicleId(null)
    setEditingVehicleForm({ title: '', registrationNumber: '', seats: '1', defaultRate: '', notes: '' })
  }

  async function saveVehicleEdit() {
    if (!editingVehicleId) return

    setSavingVehicleEdit(true)
    try {
      const response = await fetch('/api/fleet/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVehicleId,
          ...editingVehicleForm,
          seats: Number(editingVehicleForm.seats),
          defaultRate: editingVehicleForm.defaultRate ? Number(editingVehicleForm.defaultRate) : null,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to update vehicle')
      }

      toast.success('Vehicle updated')
      cancelVehicleEdit()
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update vehicle')
    } finally {
      setSavingVehicleEdit(false)
    }
  }

  async function saveVehicle() {
    if (!vehicleForm.title.trim() || !vehicleForm.registrationNumber.trim() || !vehicleForm.seats.trim()) {
      toast.error('Add the vehicle name, registration number, and seats')
      return
    }

    setSavingVehicle(true)
    try {
      const response = await fetch('/api/fleet/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...vehicleForm,
          seats: Number(vehicleForm.seats),
          defaultRate: vehicleForm.defaultRate ? Number(vehicleForm.defaultRate) : null,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to save vehicle')
      }

      toast.success('Vehicle added to fleet manager')
      setVehicleForm({ title: '', registrationNumber: '', seats: '7', defaultRate: '', notes: '' })
      setShowVehicleForm(false)
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save vehicle')
    } finally {
      setSavingVehicle(false)
    }
  }

  async function saveBooking() {
    if (!bookingForm.vehicleId || !bookingForm.firstName.trim() || !bookingForm.surname.trim() || !bookingForm.email.trim()) {
      toast.error('Complete the vehicle and customer details first')
      return
    }

    if (rentalDays <= 0) {
      toast.error('Choose a valid rental date range')
      return
    }

    if (!bookingForm.amount || Number(bookingForm.amount) <= 0) {
      toast.error('Enter the rental amount')
      return
    }

    if (selectedVehicleConflicts.length > 0) {
      toast.error('Those dates clash with an existing booking')
      return
    }

    setSavingBooking(true)
    try {
      const response = await fetch('/api/fleet/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...bookingForm,
          amount: Number(bookingForm.amount),
          seatsBooked: bookingForm.seatsBooked ? Number(bookingForm.seatsBooked) : selectedVehicleSeats || 1,
        }),
      })

      const result = await response.json()
      if (!response.ok) {
        throw new Error(result.error || 'Failed to create booking')
      }

      toast.success(result.xeroConnected ? 'Vehicle booked and invoice created in Xero' : 'Vehicle booked. Connect Xero to create the invoice.')
      setBookingForm({
        vehicleId: bookingForm.vehicleId,
        usageType: bookingForm.usageType,
        bookingDays: '2',
        startDate: format(new Date(), 'yyyy-MM-dd'),
        endDate: format(addDays(new Date(), 1), 'yyyy-MM-dd'),
        amount: '',
        seatsBooked: selectedVehicleSeats ? String(selectedVehicleSeats) : '',
        firstName: '',
        surname: '',
        accountNumber: '',
        phone: '',
        email: '',
        notes: '',
      })
      setShowBookingForm(false)
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setSavingBooking(false)
    }
  }

  const card = cardStyle
  const hasVehicles = vehicles.length > 0
  const vehicleButtonLabel = selectedVehicle ? `${selectedVehicle.title} · ${vehicleRegistration(selectedVehicle) || 'No reg'}` : hasVehicles ? 'Select vehicle' : 'Add a vehicle first'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h1 style={pageTitle}>Fleet Manager</h1>
          <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 6 }}>Manage vehicles, lock in rental dates, and push each booking into Xero.</p>
        </div>
        <button type="button" onClick={() => onNavigate('calendar')} style={secondaryButton}>
          Open Calendar
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }}>
        {[
          { label: 'Vehicles', value: stats.vehicles, sub: 'Live fleet records' },
          { label: 'On The Road', value: stats.activeRentals, sub: 'Active rentals today' },
          { label: 'Booked Days', value: stats.upcomingDays, sub: 'Next 30 days' },
          { label: 'Fleet Revenue', value: money(stats.totalRevenue), sub: 'All saved rentals' },
        ].map((item) => (
          <div key={item.label} style={card}>
            <div style={{ ...statLabel, marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 26, color: theme.text }}>{loading ? '—' : item.value}</div>
            <div style={{ color: theme.textFaint, fontSize: 12, marginTop: 6 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.35fr', gap: 20, alignItems: 'start' }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={sectionTitle}>Add Vehicle</div>
              <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>Keep this hidden until you need it, then click the plus to open the full vehicle form.</div>
            </div>
            <TogglePlusButton open={showVehicleForm} onClick={() => setShowVehicleForm((current) => !current)} />
          </div>

          {showVehicleForm ? (
            <>
              <Input label="Vehicle name" value={vehicleForm.title} onChange={(value) => setVehicleForm((current) => ({ ...current, title: value }))} placeholder="Mercedes V-Class" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <Input label="Registration number" value={vehicleForm.registrationNumber} onChange={(value) => setVehicleForm((current) => ({ ...current, registrationNumber: value }))} placeholder="CA 123 456" />
                <Input label="Seats" type="number" value={vehicleForm.seats} onChange={(value) => setVehicleForm((current) => ({ ...current, seats: value }))} placeholder="7" />
              </div>
              <Input label="Default day rate" type="number" value={vehicleForm.defaultRate} onChange={(value) => setVehicleForm((current) => ({ ...current, defaultRate: value }))} placeholder="2500" />
              <TextArea label="Vehicle notes" value={vehicleForm.notes} onChange={(value) => setVehicleForm((current) => ({ ...current, notes: value }))} placeholder="Driver notes, colour, or vehicle class" />
              <button onClick={saveVehicle} disabled={savingVehicle} style={primaryButton}>
                {savingVehicle ? 'Saving vehicle…' : 'Save Vehicle'}
              </button>
            </>
          ) : (
            <div style={collapsedHint}>Click the plus to show the add-vehicle fields.</div>
          )}
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={sectionTitle}>Book Out Vehicle</div>
              <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>Create the rental, store the customer details, and raise the Xero invoice automatically.</div>
            </div>
            <TogglePlusButton open={showBookingForm} onClick={() => setShowBookingForm((current) => !current)} />
          </div>

          {showBookingForm ? (
            <>
              <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={fieldLabel}>Vehicle</span>
                <button type="button" onClick={() => hasVehicles && setVehiclePickerOpen((current) => !current)} style={{ ...selectorButton, opacity: hasVehicles ? 1 : 0.65, cursor: hasVehicles ? 'pointer' : 'not-allowed' }}>
                  <span>{vehicleButtonLabel}</span>
                  <span style={{ color: theme.textFaint }}>{hasVehicles ? (vehiclePickerOpen ? '▴' : '▾') : '+'}</span>
                </button>
              </label>

              {!hasVehicles ? (
                <div style={{ ...collapsedHint, borderStyle: 'solid', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                  <span>No fleet vehicles have been added yet. Add a vehicle first, then come back here to book it out.</span>
                  <button
                    type="button"
                    onClick={() => {
                      setShowVehicleForm(true)
                      setShowBookingForm(false)
                    }}
                    style={{ ...primaryButton, padding: '8px 12px', whiteSpace: 'nowrap' }}
                  >
                    Add Vehicle
                  </button>
                </div>
              ) : vehiclePickerOpen && (
                <div style={pickerCard}>
                  <Input label="Find vehicle" value={vehicleSearch} onChange={setVehicleSearch} placeholder="Search by name or registration" />
                  <div style={{ display: 'grid', gap: 8, maxHeight: 230, overflowY: 'auto' }}>
                    {filteredVehicles.length === 0 ? (
                      <div style={collapsedHint}>No vehicles match that search.</div>
                    ) : filteredVehicles.map((vehicle) => {
                      const active = bookingForm.vehicleId === vehicle.id
                      return (
                        <button
                          key={vehicle.id}
                          type="button"
                          onClick={() => handleVehicleSelection(vehicle.id)}
                          style={{
                            textAlign: 'left',
                            borderRadius: 8,
                            border: `1px solid ${active ? theme.bronzeBorder : theme.border}`,
                            background: active ? theme.bronzeBg : theme.surfaceMuted,
                            padding: '12px 14px',
                            color: theme.text,
                            cursor: 'pointer',
                          }}
                        >
                          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 700 }}>{vehicle.title}</div>
                              <div style={mutedSmall}>{vehicleRegistration(vehicle) || 'No registration'} · {buildSeatsLabel(vehicleSeats(vehicle) || 0)}</div>
                            </div>
                            <div style={{ fontWeight: 700, color: theme.bronzeDark }}>{vehicle.base_price ? money(Number(vehicle.base_price)) : 'No rate'}</div>
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <SelectField
                  label="Use type"
                  value={bookingForm.usageType}
                  onChange={(value) => setBookingForm((current) => ({ ...current, usageType: value }))}
                  options={[
                    { value: 'tour', label: 'Tour use' },
                    { value: 'internal', label: 'Internal use' },
                  ]}
                />
                <Input label="Days booked" type="number" value={bookingForm.bookingDays} onChange={handleBookingDaysChange} placeholder="2" />
                <Input label="Amount rented out for" type="number" value={bookingForm.amount} onChange={(value) => setBookingForm((current) => ({ ...current, amount: value }))} placeholder={suggestedAmount ? String(suggestedAmount) : '4500'} />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Input label="Start date" type="date" value={bookingForm.startDate} onChange={handleStartDateChange} />
                <Input label="End date" type="date" value={bookingForm.endDate} onChange={handleEndDateChange} />
                <Input label="Seats booked" type="number" value={bookingForm.seatsBooked} onChange={(value) => setBookingForm((current) => ({ ...current, seatsBooked: value }))} placeholder={selectedVehicleSeats ? String(selectedVehicleSeats) : '1'} />
              </div>

              {selectedVehicle && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
                  <MiniInfo label="Registration" value={vehicleRegistration(selectedVehicle) || '—'} />
                  <MiniInfo label="Seats" value={buildSeatsLabel(selectedVehicleSeats || 0)} />
                  <MiniInfo label="Default rate" value={selectedVehicle.base_price ? money(Number(selectedVehicle.base_price)) : 'Set later'} />
                  <MiniInfo label="Use type" value={usageTypeLabel(bookingForm.usageType)} />
                </div>
              )}

              {suggestedAmount > 0 && !bookingForm.amount && (
                <div style={{ padding: '10px 12px', borderRadius: 8, background: theme.bronzeBg, border: `1px solid ${theme.bronzeBorder}`, color: theme.bronzeDark, fontSize: 13 }}>
                  Suggested amount from the saved day rate: {money(suggestedAmount)}.
                </div>
              )}

              {selectedVehicleConflicts.length > 0 && (
                <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(196, 92, 74, 0.08)', border: '1px solid rgba(196, 92, 74, 0.22)', color: theme.danger, fontSize: 13 }}>
                  That date range clashes with {selectedVehicleConflicts[0].customerName}'s booking from {format(parseISO(selectedVehicleConflicts[0].startDate), 'd MMM yyyy')} to {format(parseISO(selectedVehicleConflicts[0].endDate), 'd MMM yyyy')}.
                </div>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Input label="Customer name" value={bookingForm.firstName} onChange={(value) => setBookingForm((current) => ({ ...current, firstName: value }))} placeholder="John" />
                <Input label="Customer surname" value={bookingForm.surname} onChange={(value) => setBookingForm((current) => ({ ...current, surname: value }))} placeholder="Smith" />
                <Input label="Account number" value={bookingForm.accountNumber} onChange={(value) => setBookingForm((current) => ({ ...current, accountNumber: value }))} placeholder="ACC-1024" />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
                <Input label="Phone" value={bookingForm.phone} onChange={(value) => setBookingForm((current) => ({ ...current, phone: value }))} placeholder="+27 ..." />
                <Input label="Email" type="email" value={bookingForm.email} onChange={(value) => setBookingForm((current) => ({ ...current, email: value }))} placeholder="customer@email.com" />
                <Input label="Vehicle notes" value={bookingForm.notes} onChange={(value) => setBookingForm((current) => ({ ...current, notes: value }))} placeholder="Airport collection" />
              </div>

              <button onClick={saveBooking} disabled={savingBooking || loading} style={primaryButton}>
                {savingBooking ? 'Creating booking…' : 'Book Vehicle & Create Invoice'}
              </button>
            </>
          ) : (
            <div style={collapsedHint}>Click the plus to show the full booking form.</div>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 20, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={sectionTitle}>Fleet Bookings</div>
              <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>{bookingDetails.length} active rentals tracked in Bookings.</div>
            </div>
            <button type="button" onClick={() => onNavigate('bookings')} style={secondaryButton}>
              View in Bookings →
            </button>
          </div>
          {loading ? (
            <div style={emptyCell}>Loading fleet bookings…</div>
          ) : bookingDetails.length === 0 ? (
            <div style={emptyCell}>No fleet rentals saved yet. Create one from Bookings → Fleet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {bookingDetails.slice(0, 5).map((item) => (
                <div key={item.booking.id} style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surfaceMuted }}>
                  <div style={{ fontWeight: 700 }}>{item.vehicleName}</div>
                  <div style={mutedSmall}>{item.customerName} · {format(parseISO(item.startDate), 'd MMM')} → {format(parseISO(item.endDate), 'd MMM yyyy')}</div>
                  <div style={{ ...mutedSmall, marginTop: 4 }}>{money(item.totalAmount)} · {item.invoice?.status || 'Pending invoice'}</div>
                </div>
              ))}
              {bookingDetails.length > 5 && (
                <div style={{ fontSize: 12, color: theme.textFaint }}>+ {bookingDetails.length - 5} more in Bookings → Fleet</div>
              )}
            </div>
          )}
        </div>

        <div style={{ ...card, minHeight: 420 }}>
          <div style={{ ...sectionTitle, marginBottom: 6 }}>Revenue Per Vehicle</div>
          <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 18 }}>Pie chart based on every saved fleet booking amount.</div>
          {revenueByVehicle.length === 0 ? (
            <div style={{ color: theme.textFaint, paddingTop: 40 }}>Create your first fleet booking to start the revenue chart.</div>
          ) : (
            <>
              <div style={{ width: '100%', height: 260 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={revenueByVehicle} dataKey="revenue" nameKey="name" innerRadius={60} outerRadius={95} paddingAngle={2}>
                      {revenueByVehicle.map((item, index) => (
                        <Cell key={item.id} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => money(Number(value || 0))} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div style={{ display: 'grid', gap: 10, marginTop: 6 }}>
                {revenueByVehicle.map((item, index) => (
                  <div key={item.id} style={{ display: 'grid', gridTemplateColumns: '14px 1fr auto', gap: 10, alignItems: 'center' }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: CHART_COLORS[index % CHART_COLORS.length] }} />
                    <div>
                      <div style={{ fontWeight: 700 }}>{item.name}</div>
                      <div style={mutedSmall}>{item.registrationNumber || 'No reg'} · {item.bookedDays} booked days</div>
                    </div>
                    <div style={{ fontWeight: 700 }}>{money(item.revenue)}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <div style={card}>
        <div style={{ ...sectionTitle, marginBottom: 16 }}>Fleet Vehicles</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {loading ? (
            <div style={{ color: theme.textFaint }}>Loading vehicles…</div>
          ) : vehicles.length === 0 ? (
            <div style={{ color: theme.textFaint }}>No vehicles added yet</div>
          ) : vehicles.map((vehicle) => {
            const vehicleBookings = bookingDetails.filter((item) => item.vehicleId === vehicle.id)
            const revenue = vehicleBookings.reduce((sum, item) => sum + item.totalAmount, 0)
            const isEditingVehicle = editingVehicleId === vehicle.id
            return (
              <div key={vehicle.id} style={{ borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surfaceMuted, padding: 16 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
                  <div>
                    <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 20, color: theme.text }}>{vehicle.title}</div>
                    <div style={mutedSmall}>{vehicleRegistration(vehicle) || 'Registration pending'}</div>
                  </div>
                  <button type="button" onClick={() => isEditingVehicle ? cancelVehicleEdit() : startVehicleEdit(vehicle)} style={secondaryButton}>
                    {isEditingVehicle ? 'Close' : 'Edit'}
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  <MiniInfo label="Seats" value={buildSeatsLabel(vehicleSeats(vehicle) || 0)} />
                  <MiniInfo label="Default rate" value={vehicle.base_price ? money(Number(vehicle.base_price)) : 'Not set'} />
                  <MiniInfo label="Bookings" value={String(vehicleBookings.length)} />
                  <MiniInfo label="Revenue" value={money(revenue)} />
                </div>
                {vehicleNotes(vehicle) && <div style={{ ...mutedSmall, marginTop: 14 }}>{vehicleNotes(vehicle)}</div>}
                {isEditingVehicle && (
                  <div style={{ ...pickerCard, marginTop: 16 }}>
                    <Input label="Vehicle name" value={editingVehicleForm.title} onChange={(value) => setEditingVehicleForm((current) => ({ ...current, title: value }))} placeholder="Toyota Quantum" />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <Input label="Registration number" value={editingVehicleForm.registrationNumber} onChange={(value) => setEditingVehicleForm((current) => ({ ...current, registrationNumber: value }))} placeholder="CAA691013" />
                      <Input label="Seats" type="number" value={editingVehicleForm.seats} onChange={(value) => setEditingVehicleForm((current) => ({ ...current, seats: value }))} placeholder="12" />
                    </div>
                    <Input label="Default rate" type="number" value={editingVehicleForm.defaultRate} onChange={(value) => setEditingVehicleForm((current) => ({ ...current, defaultRate: value }))} placeholder="2500" />
                    <TextArea label="Vehicle notes" value={editingVehicleForm.notes} onChange={(value) => setEditingVehicleForm((current) => ({ ...current, notes: value }))} placeholder="Driver notes, colour, or vehicle class" />
                    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                      <button type="button" onClick={saveVehicleEdit} disabled={savingVehicleEdit} style={primaryButton}>
                        {savingVehicleEdit ? 'Saving…' : 'Save changes'}
                      </button>
                      <button type="button" onClick={cancelVehicleEdit} style={secondaryButton}>
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={fieldInput} />
    </label>
  )
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} style={{ ...fieldInput, resize: 'vertical', minHeight: 86 }} />
    </label>
  )
}

function SelectField({ label, value, onChange, options }: { label: string; value: string; onChange: (value: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} style={fieldInput}>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: theme.surface, border: `1px solid ${theme.border}` }}>
      <div style={{ ...statLabel, marginBottom: 6 }}>{label}</div>
      <div style={{ fontWeight: 700, color: theme.text }}>{value}</div>
    </div>
  )
}

function TogglePlusButton({ open, onClick }: { open: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} style={{ width: 42, height: 42, borderRadius: 999, border: `1px solid ${theme.bronzeBorder}`, background: theme.bronzeBg, color: theme.bronzeDark, cursor: 'pointer', fontSize: 24, lineHeight: 1, fontWeight: 700 }}>
      {open ? '−' : '+'}
    </button>
  )
}

const fieldLabel = themeFieldLabel
const fieldInput = inputStyle
const emptyCell = { padding: 24, textAlign: 'center' as const, color: theme.textFaint }
const mutedSmall = { fontSize: 12, color: theme.textMuted, marginTop: 4 }
const collapsedHint = { padding: '12px 14px', borderRadius: 8, background: theme.surfaceMuted, border: `1px dashed ${theme.borderStrong}`, color: theme.textMuted, fontSize: 13 }
const selectorButton = { ...inputStyle, display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', textAlign: 'left' as const, cursor: 'pointer' }
const pickerCard = { display: 'grid', gap: 10, borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surface, padding: 12 }
