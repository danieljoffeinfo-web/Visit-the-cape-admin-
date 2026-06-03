'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, differenceInCalendarDays, format, isAfter, isBefore, parseISO } from 'date-fns'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import {
  buildSeatsLabel,
  fullCustomerName,
  isFleetVehicle,
  parseFleetBookingNotes,
  vehicleNotes,
  vehicleRegistration,
  vehicleSeats,
} from '@/lib/fleet'

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
  xero_invoice_number?: string | null
  status?: string | null
}

const CHART_COLORS = ['#b8956a', '#4caf84', '#6495ed', '#ef5350', '#f4c542', '#8e6ad8']

function money(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function FleetPanel({ onNavigate }: { onNavigate: (panel: string) => void }) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [invoiceLinks, setInvoiceLinks] = useState<Record<string, InvoiceLink>>({})
  const [loading, setLoading] = useState(true)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [savingBooking, setSavingBooking] = useState(false)
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [vehicleForm, setVehicleForm] = useState({
    title: '',
    registrationNumber: '',
    seats: '7',
    defaultRate: '',
    notes: '',
  })
  const [bookingForm, setBookingForm] = useState({
    vehicleId: '',
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

  useEffect(() => {
    loadFleet()
  }, [])

  async function loadFleet() {
    setLoading(true)
    try {
      const [vehiclesRes, bookingsRes] = await Promise.all([
        supabase.from('tour_products').select('id,title,family,summary,duration_label,pickup_notes,base_price,active').eq('family', 'fleet').order('title', { ascending: true }),
        supabase.from('tour_bookings').select('id,product_id,status,amount,notes,created_at').eq('booking_type', 'fleet').order('created_at', { ascending: false }),
      ])

      const nextVehicles = ((vehiclesRes.data || []) as VehicleRow[]).filter(isFleetVehicle)
      const nextBookings = (bookingsRes.data || []) as BookingRow[]

      setVehicles(nextVehicles)
      setBookings(nextBookings)
      setSelectedVehicleId((current) => current || nextVehicles[0]?.id || '')
      setBookingForm((current) => ({
        ...current,
        vehicleId: current.vehicleId || nextVehicles[0]?.id || '',
        seatsBooked: current.seatsBooked || String(vehicleSeats(nextVehicles[0] || { duration_label: '1 seat' })),
      }))

      if (nextBookings.length > 0) {
        const invoiceRes = await supabase.from('xero_invoice_links').select('booking_id,xero_invoice_number,status').in('booking_id', nextBookings.map((booking) => booking.id))
        const linkMap = Object.fromEntries(((invoiceRes.data || []) as InvoiceLink[]).map((link) => [link.booking_id, link]))
        setInvoiceLinks(linkMap)
      } else {
        setInvoiceLinks({})
      }
    } catch {
      toast.error('Failed to load fleet dashboard')
    } finally {
      setLoading(false)
    }
  }

  const bookingDetails = useMemo(() => {
    return bookings
      .map((booking) => {
        const notes = parseFleetBookingNotes(booking.notes)
        if (!notes) return null
        return {
          booking,
          notes,
          invoice: invoiceLinks[booking.id],
          vehicleId: notes.vehicle.id,
          vehicleName: notes.vehicle.title,
          registrationNumber: notes.vehicle.registrationNumber,
          seats: notes.vehicle.seats,
          days: notes.rental.days,
          startDate: notes.rental.startDate,
          endDate: notes.rental.endDate,
          seatsBooked: notes.rental.seatsBooked,
          totalAmount: Number(booking.amount || notes.rental.totalAmount || 0),
          customerName: fullCustomerName(notes),
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [bookings, invoiceLinks])

  const selectedVehicle = vehicles.find((vehicle) => vehicle.id === (bookingForm.vehicleId || selectedVehicleId)) || vehicles[0] || null
  const selectedVehicleSeats = selectedVehicle ? vehicleSeats(selectedVehicle) : 0
  const rentalDays = useMemo(() => {
    const start = parseISO(bookingForm.startDate)
    const end = parseISO(bookingForm.endDate)
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || isBefore(end, start)) return 0
    return differenceInCalendarDays(end, start) + 1
  }, [bookingForm.startDate, bookingForm.endDate])

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

  async function saveVehicle() {
    if (!vehicleForm.title.trim() || !vehicleForm.registrationNumber.trim() || !vehicleForm.seats.trim()) {
      toast.error('Add the vehicle name, registration number, and seats')
      return
    }

    setSavingVehicle(true)
    const seats = Math.max(1, parseInt(vehicleForm.seats || '1', 10))
    const { error } = await supabase.from('tour_products').insert({
      slug: `fleet-${vehicleForm.registrationNumber.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')}`,
      title: vehicleForm.title.trim(),
      family: 'fleet',
      experience_type: 'vehicle-rental',
      booking_mode: 'fleet',
      pricing_model: 'daily-rental',
      summary: vehicleForm.registrationNumber.trim(),
      duration_label: buildSeatsLabel(seats),
      pickup_notes: vehicleForm.notes.trim() || null,
      base_price: vehicleForm.defaultRate ? Number(vehicleForm.defaultRate) : null,
      active: true,
    })
    setSavingVehicle(false)

    if (error) {
      toast.error(error.message.includes('duplicate') ? 'That registration number already exists' : 'Failed to save vehicle')
      return
    }

    toast.success('Vehicle added to fleet manager')
    setVehicleForm({ title: '', registrationNumber: '', seats: '7', defaultRate: '', notes: '' })
    loadFleet()
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
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setSavingBooking(false)
    }
  }

  const card = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Fleet Manager</h1>
          <p style={{ color: 'rgba(240,236,228,0.55)', fontSize: 13, marginTop: 2 }}>Manage vehicles, lock in rental dates, and push each booking into Xero.</p>
        </div>
        <button onClick={() => onNavigate('calendar')} style={{ padding: '8px 16px', borderRadius: 6, background: 'transparent', color: '#b8956a', border: '1px solid rgba(184,149,106,0.35)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: "'Barlow', sans-serif" }}>
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
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.45)', marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, color: '#f0ece4' }}>{loading ? '—' : item.value}</div>
            <div style={{ color: 'rgba(240,236,228,0.4)', fontSize: 12, marginTop: 6 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.95fr 1.35fr', gap: 20, alignItems: 'start' }}>
        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Add Vehicle</div>
            <div style={{ color: 'rgba(240,236,228,0.45)', fontSize: 13, marginTop: 4 }}>Save the vehicle registration, number of seats, and the default day rate.</div>
          </div>
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
        </div>

        <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Book Out Vehicle</div>
              <div style={{ color: 'rgba(240,236,228,0.45)', fontSize: 13, marginTop: 4 }}>Create the rental, store the customer details, and raise the Xero invoice automatically.</div>
            </div>
            <div style={{ padding: '8px 12px', borderRadius: 8, background: 'rgba(240,236,228,0.04)', minWidth: 140 }}>
              <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.38)' }}>Rental days</div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 24 }}>{rentalDays || '—'}</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <SelectField
              label="Vehicle"
              value={bookingForm.vehicleId}
              onChange={(value) => {
                const nextVehicle = vehicles.find((vehicle) => vehicle.id === value)
                setBookingForm((current) => ({
                  ...current,
                  vehicleId: value,
                  seatsBooked: nextVehicle ? String(vehicleSeats(nextVehicle)) : current.seatsBooked,
                  amount: !current.amount && nextVehicle?.base_price ? String(nextVehicle.base_price) : current.amount,
                }))
                setSelectedVehicleId(value)
              }}
              options={vehicles.map((vehicle) => ({ value: vehicle.id, label: `${vehicle.title} · ${vehicleRegistration(vehicle)}` }))}
            />
            <Input label="Start date" type="date" value={bookingForm.startDate} onChange={(value) => setBookingForm((current) => ({ ...current, startDate: value }))} />
            <Input label="End date" type="date" value={bookingForm.endDate} onChange={(value) => setBookingForm((current) => ({ ...current, endDate: value }))} />
          </div>

          {selectedVehicle && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
              <MiniInfo label="Registration" value={vehicleRegistration(selectedVehicle) || '—'} />
              <MiniInfo label="Seats" value={buildSeatsLabel(selectedVehicleSeats || 0)} />
              <MiniInfo label="Default rate" value={selectedVehicle.base_price ? money(Number(selectedVehicle.base_price)) : 'Set later'} />
            </div>
          )}

          {selectedVehicleConflicts.length > 0 && (
            <div style={{ padding: '12px 14px', borderRadius: 8, background: 'rgba(239,83,80,0.08)', border: '1px solid rgba(239,83,80,0.22)', color: '#f2b5b3', fontSize: 13 }}>
              That date range clashes with {selectedVehicleConflicts[0].customerName}'s booking from {format(parseISO(selectedVehicleConflicts[0].startDate), 'd MMM yyyy')} to {format(parseISO(selectedVehicleConflicts[0].endDate), 'd MMM yyyy')}.
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Amount rented out for" type="number" value={bookingForm.amount} onChange={(value) => setBookingForm((current) => ({ ...current, amount: value }))} placeholder="4500" />
            <Input label="Seats booked" type="number" value={bookingForm.seatsBooked} onChange={(value) => setBookingForm((current) => ({ ...current, seatsBooked: value }))} placeholder={selectedVehicleSeats ? String(selectedVehicleSeats) : '1'} />
            <Input label="Account number" value={bookingForm.accountNumber} onChange={(value) => setBookingForm((current) => ({ ...current, accountNumber: value }))} placeholder="ACC-1024" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Customer name" value={bookingForm.firstName} onChange={(value) => setBookingForm((current) => ({ ...current, firstName: value }))} placeholder="John" />
            <Input label="Customer surname" value={bookingForm.surname} onChange={(value) => setBookingForm((current) => ({ ...current, surname: value }))} placeholder="Smith" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12 }}>
            <Input label="Phone" value={bookingForm.phone} onChange={(value) => setBookingForm((current) => ({ ...current, phone: value }))} placeholder="+27 ..." />
            <Input label="Email" type="email" value={bookingForm.email} onChange={(value) => setBookingForm((current) => ({ ...current, email: value }))} placeholder="customer@email.com" />
            <Input label="Vehicle notes" value={bookingForm.notes} onChange={(value) => setBookingForm((current) => ({ ...current, notes: value }))} placeholder="Airport collection" />
          </div>

          <button onClick={saveBooking} disabled={savingBooking || loading} style={primaryButton}>
            {savingBooking ? 'Creating booking…' : 'Book Vehicle & Create Invoice'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 20, alignItems: 'start' }}>
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Vehicles On The Road</div>
              <div style={{ color: 'rgba(240,236,228,0.45)', fontSize: 13, marginTop: 4 }}>Every booked vehicle and its current invoice state.</div>
            </div>
            <div style={{ fontSize: 12, color: 'rgba(240,236,228,0.4)' }}>{bookingDetails.length} rentals</div>
          </div>

          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                {['Vehicle', 'Customer', 'Dates', 'Revenue', 'Invoice'].map((header) => (
                  <th key={header} style={tableHead}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} style={emptyCell}>Loading fleet bookings…</td></tr>
              ) : bookingDetails.length === 0 ? (
                <tr><td colSpan={5} style={emptyCell}>No fleet rentals saved yet</td></tr>
              ) : bookingDetails.map((item) => (
                <tr key={item.booking.id} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
                  <td style={tableCell}>
                    <div style={{ fontWeight: 700 }}>{item.vehicleName}</div>
                    <div style={mutedSmall}>{item.registrationNumber || 'No registration saved'}</div>
                  </td>
                  <td style={tableCell}>
                    <div>{item.customerName}</div>
                    <div style={mutedSmall}>{item.notes.customer.email}</div>
                  </td>
                  <td style={tableCell}>
                    <div>{format(parseISO(item.startDate), 'd MMM yyyy')} → {format(parseISO(item.endDate), 'd MMM yyyy')}</div>
                    <div style={mutedSmall}>{item.days} day{item.days === 1 ? '' : 's'} · {item.seatsBooked} seat{item.seatsBooked === 1 ? '' : 's'}</div>
                  </td>
                  <td style={tableCell}>{money(item.totalAmount)}</td>
                  <td style={tableCell}>
                    {item.invoice ? (
                      <div>
                        <div style={{ fontWeight: 700 }}>{item.invoice.xero_invoice_number || 'Xero invoice'}</div>
                        <div style={mutedSmall}>{item.invoice.status || 'Created'}</div>
                      </div>
                    ) : (
                      <span style={mutedSmall}>Pending Xero</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ ...card, minHeight: 420 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 6 }}>Revenue Per Vehicle</div>
          <div style={{ color: 'rgba(240,236,228,0.45)', fontSize: 13, marginBottom: 18 }}>Pie chart based on every saved fleet booking amount.</div>
          {revenueByVehicle.length === 0 ? (
            <div style={{ color: 'rgba(240,236,228,0.4)', paddingTop: 40 }}>Create your first fleet booking to start the revenue chart.</div>
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
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>Fleet Vehicles</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
          {loading ? (
            <div style={{ color: 'rgba(240,236,228,0.4)' }}>Loading vehicles…</div>
          ) : vehicles.length === 0 ? (
            <div style={{ color: 'rgba(240,236,228,0.4)' }}>No vehicles added yet</div>
          ) : vehicles.map((vehicle) => {
            const vehicleBookings = bookingDetails.filter((item) => item.vehicleId === vehicle.id)
            const revenue = vehicleBookings.reduce((sum, item) => sum + item.totalAmount, 0)
            return (
              <div key={vehicle.id} style={{ borderRadius: 8, border: '1px solid rgba(240,236,228,0.08)', background: 'rgba(240,236,228,0.02)', padding: 16 }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20 }}>{vehicle.title}</div>
                <div style={mutedSmall}>{vehicleRegistration(vehicle) || 'Registration pending'}</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
                  <MiniInfo label="Seats" value={buildSeatsLabel(vehicleSeats(vehicle) || 0)} />
                  <MiniInfo label="Default rate" value={vehicle.base_price ? money(Number(vehicle.base_price)) : 'Not set'} />
                  <MiniInfo label="Bookings" value={String(vehicleBookings.length)} />
                  <MiniInfo label="Revenue" value={money(revenue)} />
                </div>
                {vehicleNotes(vehicle) && <div style={{ ...mutedSmall, marginTop: 14 }}>{vehicleNotes(vehicle)}</div>}
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
        <option value="">Select vehicle</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  )
}

function MiniInfo({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ padding: '10px 12px', borderRadius: 8, background: 'rgba(240,236,228,0.04)' }}>
      <div style={{ fontSize: 10, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.38)', marginBottom: 6 }}>{label}</div>
      <div style={{ fontWeight: 700 }}>{value}</div>
    </div>
  )
}

const fieldLabel = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(240,236,228,0.45)' }
const fieldInput = { background: '#100f0d', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, color: '#f0ece4', padding: '10px 12px', fontSize: 14, outline: 'none' }
const primaryButton = { padding: '10px 16px', borderRadius: 6, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }
const tableHead = { padding: '8px 12px', textAlign: 'left' as const, fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase' as const, color: 'rgba(240,236,228,0.4)', fontWeight: 500 }
const tableCell = { padding: '12px', verticalAlign: 'top' as const }
const emptyCell = { padding: 24, textAlign: 'center' as const, color: 'rgba(240,236,228,0.4)' }
const mutedSmall = { fontSize: 12, color: 'rgba(240,236,228,0.45)', marginTop: 4 }
