'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { addDays, format, isAfter, parseISO, startOfDay } from 'date-fns'
import { toast } from 'sonner'
import {
  fullCustomerName,
  isFleetVehicle,
  parseFleetBookingNotes,
  vehicleRegistration,
  vehicleSeats,
} from '@/lib/fleet'
import { uploadFleetVehicleImage } from '@/components/fleet/vehicle-image-upload'
import { VehicleCard } from '@/components/fleet/vehicle-card'
import { BookVehicleDialog } from '@/components/fleet/book-vehicle-dialog'
import { VehicleEditorDialog, type VehicleFormValues } from '@/components/fleet/vehicle-editor-dialog'
import { VehicleImageThumb } from '@/components/fleet/vehicle-image-upload'
import {
  cardStyle,
  fieldLabel,
  inputStyle,
  pageTitle,
  primaryButton,
  secondaryButton,
  sectionTitle,
  theme,
} from '@/lib/theme'

const FleetRevenueChart = dynamic(
  () => import('@/components/fleet/fleet-revenue-chart').then((m) => ({ default: m.FleetRevenueChart })),
  {
    loading: () => <div style={{ color: theme.textFaint, paddingTop: 40, textAlign: 'center' }}>Loading chart…</div>,
    ssr: false,
  },
)

type VehicleRow = {
  id: string
  title: string
  family: string
  summary?: string | null
  duration_label?: string | null
  pickup_notes?: string | null
  base_price?: number | null
  active?: boolean | null
  image_url?: string | null
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


function money(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export function FleetPanel({ onNavigate }: { onNavigate: (panel: string) => void }) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [bookings, setBookings] = useState<BookingRow[]>([])
  const [invoiceLinks, setInvoiceLinks] = useState<Record<string, InvoiceLink>>({})
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  const [editorOpen, setEditorOpen] = useState(false)
  const [editorMode, setEditorMode] = useState<'add' | 'edit'>('add')
  const [editingVehicle, setEditingVehicle] = useState<VehicleRow | null>(null)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [deletingVehicle, setDeletingVehicle] = useState(false)

  const [bookOpen, setBookOpen] = useState(false)
  const [bookVehicleId, setBookVehicleId] = useState<string | undefined>()
  const [savingBooking, setSavingBooking] = useState(false)

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

      if (!vehiclesResponse.ok) throw new Error(vehiclesResult.error || 'Failed to load vehicles')
      if (!bookingsResponse.ok) throw new Error(bookingsResult.error || 'Failed to load bookings')

      setVehicles(((vehiclesResult.vehicles || []) as VehicleRow[]).filter(isFleetVehicle))
      setBookings((bookingsResult.bookings || []) as BookingRow[])
      setInvoiceLinks(Object.fromEntries(((bookingsResult.invoiceLinks || []) as InvoiceLink[]).map((link) => [link.booking_id, link])))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load fleet dashboard')
    } finally {
      setLoading(false)
    }
  }

  const vehicleImageById = useMemo(
    () => Object.fromEntries(vehicles.map((vehicle) => [vehicle.id, vehicle.image_url || null])),
    [vehicles],
  )

  const bookingDetails = useMemo(() => {
    return bookings
      .map((booking) => {
        const notes = parseFleetBookingNotes(booking.notes)
        if (!notes) return null
        if ((booking.status || '').toLowerCase() === 'cancelled') return null
        return {
          booking,
          notes,
          invoice: invoiceLinks[booking.id],
          vehicleId: notes.vehicle.id,
          vehicleName: notes.vehicle.title,
          startDate: notes.rental.startDate,
          endDate: notes.rental.endDate,
          days: notes.rental.days,
          totalAmount: Number(booking.amount || notes.rental.totalAmount || 0),
          customerName: fullCustomerName(notes),
          vehicleImageUrl: notes.vehicle.imageUrl || vehicleImageById[notes.vehicle.id] || null,
        }
      })
      .filter((item): item is NonNullable<typeof item> => Boolean(item))
  }, [bookings, invoiceLinks, vehicleImageById])

  const filteredVehicles = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return vehicles
    return vehicles.filter((vehicle) => {
      const haystack = `${vehicle.title} ${vehicleRegistration(vehicle)} ${vehicle.pickup_notes || ''}`.toLowerCase()
      return haystack.includes(query)
    })
  }, [search, vehicles])

  const stats = useMemo(() => {
    const today = startOfDay(new Date())
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
    return { vehicles: vehicles.length, activeRentals, upcomingDays, totalRevenue }
  }, [bookingDetails, vehicles.length])

  const revenueByVehicle = useMemo(() => {
    return vehicles
      .map((vehicle) => {
        const vehicleBookings = bookingDetails.filter((item) => item.vehicleId === vehicle.id)
        return {
          id: vehicle.id,
          name: vehicle.title,
          revenue: vehicleBookings.reduce((sum, item) => sum + item.totalAmount, 0),
          bookedDays: vehicleBookings.reduce((sum, item) => sum + item.days, 0),
          bookingCount: vehicleBookings.length,
          registrationNumber: vehicleRegistration(vehicle),
        }
      })
      .filter((item) => item.revenue > 0 || item.bookingCount > 0)
  }, [bookingDetails, vehicles])

  function getConflicts(vehicleId: string, startDate: string, endDate: string) {
    const start = parseISO(startDate)
    const end = parseISO(endDate)
    return bookingDetails
      .filter((item) => {
        if (item.vehicleId !== vehicleId) return false
        const existingStart = parseISO(item.startDate)
        const existingEnd = parseISO(item.endDate)
        return start <= existingEnd && end >= existingStart
      })
      .map((item) => ({ customerName: item.customerName, startDate: item.startDate, endDate: item.endDate }))
  }

  function openAddVehicle() {
    setEditorMode('add')
    setEditingVehicle(null)
    setEditorOpen(true)
  }

  function openEditVehicle(vehicle: VehicleRow) {
    setEditorMode('edit')
    setEditingVehicle(vehicle)
    setEditorOpen(true)
  }

  function openBookVehicle(vehicleId?: string) {
    setBookVehicleId(vehicleId)
    setBookOpen(true)
  }

  async function handleSaveVehicle(values: VehicleFormValues, imageFile: File | null) {
    if (!values.title.trim() || !values.registrationNumber.trim() || !values.seats.trim()) {
      toast.error('Add the vehicle name, registration number, and seats')
      return
    }

    setSavingVehicle(true)
    try {
      const payload = {
        ...values,
        seats: Number(values.seats),
        defaultRate: values.defaultRate ? Number(values.defaultRate) : null,
      }

      if (editorMode === 'add') {
        const response = await fetch('/api/fleet/vehicles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to save vehicle')

        if (imageFile && result.vehicle?.id) {
          try {
            await uploadFleetVehicleImage(result.vehicle.id, imageFile)
          } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Vehicle saved but photo upload failed')
          }
        }
        toast.success('Vehicle added')
      } else if (editingVehicle) {
        const response = await fetch('/api/fleet/vehicles', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: editingVehicle.id, ...payload }),
        })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || 'Failed to update vehicle')
        toast.success('Vehicle updated')
      }

      setEditorOpen(false)
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save vehicle')
    } finally {
      setSavingVehicle(false)
    }
  }

  async function handleDeleteVehicle() {
    if (!editingVehicle) return
    if (!confirm(`Delete ${editingVehicle.title}? This cannot be undone.`)) return

    setDeletingVehicle(true)
    try {
      const response = await fetch('/api/fleet/vehicles', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: editingVehicle.id }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to delete vehicle')
      toast.success('Vehicle removed')
      setEditorOpen(false)
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete vehicle')
    } finally {
      setDeletingVehicle(false)
    }
  }

  async function handleBookSubmit(payload: {
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
  }) {
    if (!payload.vehicleId || !payload.firstName.trim() || !payload.surname.trim() || !payload.email.trim()) {
      toast.error('Complete the vehicle and customer details')
      return
    }
    if (!payload.amount || Number(payload.amount) <= 0) {
      toast.error('Enter the rental amount')
      return
    }
    if (getConflicts(payload.vehicleId, payload.startDate, payload.endDate).length > 0) {
      toast.error('Those dates clash with an existing booking')
      return
    }

    setSavingBooking(true)
    try {
      const vehicle = vehicles.find((v) => v.id === payload.vehicleId)
      const response = await fetch('/api/fleet/bookings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          amount: Number(payload.amount),
          seatsBooked: payload.seatsBooked ? Number(payload.seatsBooked) : vehicleSeats(vehicle || { duration_label: '1 seat' }) || 1,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to create booking')
      toast.success(result.xeroConnected ? 'Vehicle booked and invoice created in Xero' : 'Vehicle booked. Connect Xero to create the invoice.')
      setBookOpen(false)
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setSavingBooking(false)
    }
  }

  const card = cardStyle

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Fleet Manager</h1>
          <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 2 }}>
            Manage your vehicles, book rentals, and track fleet revenue.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => openBookVehicle()} disabled={vehicles.length === 0} style={primaryButton}>
            Book out vehicle
          </button>
          <button type="button" onClick={openAddVehicle} style={secondaryButton}>
            + Add vehicle
          </button>
          <button type="button" onClick={() => onNavigate('calendar')} style={secondaryButton}>
            Calendar
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 16 }} className="admin-grid-4">
        {[
          { label: 'Vehicles', value: stats.vehicles, sub: 'Active fleet' },
          { label: 'On the road', value: stats.activeRentals, sub: 'Rentals today' },
          { label: 'Booked days', value: stats.upcomingDays, sub: 'Next 30 days' },
          { label: 'Fleet revenue', value: money(stats.totalRevenue), sub: 'All rentals' },
        ].map((item) => (
          <div key={item.label} style={card}>
            <div style={{ ...fieldLabel, marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 26, color: theme.text }}>{loading ? '—' : item.value}</div>
            <div style={{ color: theme.textFaint, fontSize: 12, marginTop: 6 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
          <div style={sectionTitle}>Your fleet</div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or registration…"
            style={{ ...inputStyle, maxWidth: 280, padding: '8px 12px', fontSize: 13 }}
            className="admin-search-input"
          />
        </div>

        {loading ? (
          <div style={{ color: theme.textFaint, padding: 24 }}>Loading vehicles…</div>
        ) : filteredVehicles.length === 0 ? (
          <div style={{ ...card, textAlign: 'center', padding: '48px 24px' }}>
            <div style={{ fontSize: 32, marginBottom: 12, opacity: 0.4 }}>🚐</div>
            <div style={{ ...sectionTitle, marginBottom: 8 }}>{vehicles.length === 0 ? 'No vehicles yet' : 'No matches'}</div>
            <p style={{ color: theme.textMuted, fontSize: 14, margin: '0 0 20px' }}>
              {vehicles.length === 0 ? 'Add your first vehicle to start booking rentals.' : 'Try a different search term.'}
            </p>
            {vehicles.length === 0 && (
              <button type="button" onClick={openAddVehicle} style={primaryButton}>
                Add your first vehicle
              </button>
            )}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {filteredVehicles.map((vehicle) => {
              const vehicleBookings = bookingDetails.filter((item) => item.vehicleId === vehicle.id)
              const revenue = vehicleBookings.reduce((sum, item) => sum + item.totalAmount, 0)
              return (
                <VehicleCard
                  key={vehicle.id}
                  vehicle={vehicle}
                  bookingCount={vehicleBookings.length}
                  revenue={revenue}
                  onEdit={() => openEditVehicle(vehicle)}
                  onBook={() => openBookVehicle(vehicle.id)}
                />
              )
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.05fr 0.95fr', gap: 20, alignItems: 'start' }} className="admin-grid-2col">
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <div style={sectionTitle}>Recent bookings</div>
              <div style={{ color: theme.textMuted, fontSize: 13, marginTop: 4 }}>{bookingDetails.length} active rentals</div>
            </div>
            <button type="button" onClick={() => onNavigate('bookings')} style={secondaryButton}>
              View all →
            </button>
          </div>
          {bookingDetails.length === 0 ? (
            <div style={{ color: theme.textFaint, padding: 24, textAlign: 'center' }}>No fleet rentals yet. Book a vehicle to get started.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {bookingDetails.slice(0, 5).map((item) => (
                <div key={item.booking.id} style={{ padding: '12px 14px', borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.surfaceMuted, display: 'flex', gap: 12, alignItems: 'center' }}>
                  <VehicleImageThumb imageUrl={item.vehicleImageUrl} title={item.vehicleName} size={52} />
                  <div>
                    <div style={{ fontWeight: 700, color: theme.text }}>{item.vehicleName}</div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 2 }}>
                      {item.customerName} · {format(parseISO(item.startDate), 'd MMM')} → {format(parseISO(item.endDate), 'd MMM yyyy')}
                    </div>
                    <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 4 }}>
                      {money(item.totalAmount)} · {item.invoice?.status || 'Pending invoice'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...card, minHeight: 360 }}>
          <div style={{ ...sectionTitle, marginBottom: 6 }}>Revenue by vehicle</div>
          <div style={{ color: theme.textMuted, fontSize: 13, marginBottom: 18 }}>Based on saved fleet bookings.</div>
          {revenueByVehicle.length === 0 ? (
            <div style={{ color: theme.textFaint, paddingTop: 40, textAlign: 'center' }}>Revenue chart appears after your first booking.</div>
          ) : (
            <FleetRevenueChart data={revenueByVehicle} />
          )}
        </div>
      </div>

      <VehicleEditorDialog
        open={editorOpen}
        mode={editorMode}
        vehicle={editingVehicle}
        saving={savingVehicle}
        deleting={deletingVehicle}
        onClose={() => setEditorOpen(false)}
        onSave={handleSaveVehicle}
        onDelete={editorMode === 'edit' ? handleDeleteVehicle : undefined}
      />

      <BookVehicleDialog
        open={bookOpen}
        vehicles={vehicles}
        initialVehicleId={bookVehicleId}
        conflictsForVehicle={getConflicts}
        saving={savingBooking}
        onClose={() => setBookOpen(false)}
        onSubmit={handleBookSubmit}
      />
    </div>
  )
}
