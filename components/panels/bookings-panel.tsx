'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { BookingTab, UnifiedBooking } from '@/lib/bookings'
import { cardStyle, filterBookingsByTab } from '@/lib/bookings'
import { BookingsTabBar } from '@/components/bookings/bookings-tab-bar'
import { BookingsTable } from '@/components/bookings/bookings-table'
import { CreateTourForm, emptyTourForm } from '@/components/bookings/create-tour-form'
import { CreateInternalForm, emptyInternalForm } from '@/components/bookings/create-internal-form'
import { EditBookingForm, bookingToEditForm, type EditBookingFormState } from '@/components/bookings/edit-booking-form'

type InvoiceLink = {
  booking_id: string
  xero_invoice_id: string
  xero_invoice_number?: string
  status: string
}

type CreateMode = 'tour' | 'internal' | null

function parseTab(value: string | null): BookingTab {
  if (value === 'tours' || value === 'all') return value
  if (value === 'internal' || value === 'tour' || value === 'tour-bookings' || value === 'internal-bookings') return 'tours'
  return 'all'
}

export function BookingsPanel({
  initialTab,
  initialAction,
  initialCreateMode,
}: {
  initialTab?: BookingTab
  initialAction?: string | null
  initialCreateMode?: CreateMode
}) {
  const [activeTab, setActiveTab] = useState<BookingTab>(initialTab || 'all')
  const [bookings, setBookings] = useState<UnifiedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(initialAction === 'create')
  const [createMode, setCreateMode] = useState<CreateMode>(initialCreateMode || null)
  const [tourForm, setTourForm] = useState(emptyTourForm)
  const [internalForm, setInternalForm] = useState(emptyInternalForm)
  const [editingBooking, setEditingBooking] = useState<UnifiedBooking | null>(null)
  const [editForm, setEditForm] = useState<EditBookingFormState | null>(null)
  const [invoiceLinks, setInvoiceLinks] = useState<Record<string, InvoiceLink>>({})
  const [xeroConnected, setXeroConnected] = useState(false)
  const [raising, setRaising] = useState<string | null>(null)

  useEffect(() => {
    if (initialTab) setActiveTab(parseTab(initialTab))
    if (initialAction === 'create') {
      setShowCreate(true)
      if (initialCreateMode) setCreateMode(initialCreateMode)
    }
  }, [initialTab, initialAction, initialCreateMode])

  const loadBookings = useCallback(async () => {
    setLoading(true)
    try {
      const [bookingsRes, xeroRes] = await Promise.all([
        fetch('/api/bookings?type=all', { cache: 'no-store' }),
        fetch('/api/xero/status').then((res) => res.json()),
      ])
      const data = await bookingsRes.json()
      if (!bookingsRes.ok) throw new Error(data.error || 'Failed to load bookings')

      setBookings(data.bookings || [])
      setXeroConnected(!!xeroRes.connected)

      if (xeroRes.connected) {
        const tourIds = (data.bookings || [])
          .filter((b: UnifiedBooking) => b.kind === 'tour')
          .map((b: UnifiedBooking) => b.raw_id)
        if (tourIds.length > 0) {
          const { data: links } = await supabase.from('xero_invoice_links').select('*').in('booking_id', tourIds)
          const linkMap: Record<string, InvoiceLink> = {}
          for (const l of links || []) linkMap[l.booking_id] = l
          setInvoiceLinks(linkMap)
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load bookings')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadBookings()
  }, [loadBookings])

  const visibleBookings = useMemo(
    () => filterBookingsByTab(bookings, activeTab),
    [bookings, activeTab],
  )

  function openCreate(mode: CreateMode) {
    setCreateMode(mode)
    setShowCreate(true)
    setEditingBooking(null)
    setEditForm(null)
  }

  async function createTour() {
    if (!tourForm.customerName || !tourForm.customerEmail || !tourForm.tourName || !tourForm.tourDate) {
      toast.error('Fill all required fields')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/bookings?type=tour', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(tourForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      toast.success('Tour booking created')
      setShowCreate(false)
      setCreateMode(null)
      setTourForm(emptyTourForm)
      loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setSaving(false)
    }
  }

  async function createInternal() {
    if (!internalForm.customerName || !internalForm.customerEmail || !internalForm.tourName || !internalForm.tourDate) {
      toast.error('Fill all required fields')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/bookings?type=internal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(internalForm),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create')
      toast.success('Internal booking created')
      setShowCreate(false)
      setCreateMode(null)
      setInternalForm(emptyInternalForm)
      loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(booking: UnifiedBooking) {
    setEditingBooking(booking)
    setEditForm(bookingToEditForm(booking))
    setShowCreate(false)
    setCreateMode(null)
  }

  async function saveEdit() {
    if (!editingBooking || !editForm) return
    if (!editForm.customerName || !editForm.customerEmail || !editForm.tourName || !editForm.tourDate) {
      toast.error('Fill all required fields')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingBooking.raw_id,
          kind: editingBooking.kind,
          customerName: editForm.customerName,
          customerEmail: editForm.customerEmail,
          tourName: editForm.tourName,
          tourDate: editForm.tourDate,
          guestsCount: editForm.guestsCount,
          amount: editForm.amount,
          notes: editForm.notes,
          status: editForm.status,
          payment_status: editForm.paymentStatus,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update')
      toast.success('Booking updated')
      setEditingBooking(null)
      setEditForm(null)
      loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update booking')
    } finally {
      setSaving(false)
    }
  }

  async function cancelBooking(booking: UnifiedBooking) {
    if (!confirm('Cancel this booking?')) return
    try {
      const res = await fetch('/api/bookings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.raw_id, kind: booking.kind, status: 'cancelled' }),
      })
      if (!res.ok) throw new Error('Failed to cancel')
      toast.success('Booking cancelled')
      loadBookings()
    } catch {
      toast.error('Failed to cancel booking')
    }
  }

  async function deleteBooking(booking: UnifiedBooking) {
    if (!confirm('Permanently delete this booking? This cannot be undone.')) return
    try {
      const res = await fetch('/api/bookings', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: booking.raw_id, kind: booking.kind }),
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete')
      }
      toast.success('Booking deleted')
      if (editingBooking?.id === booking.id) {
        setEditingBooking(null)
        setEditForm(null)
      }
      loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete booking')
    }
  }

  async function raiseInvoice(booking: UnifiedBooking) {
    setRaising(booking.raw_id)
    try {
      const res = await fetch('/api/xero/create-invoice', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactName: booking.customer_name,
          contactEmail: booking.customer_email,
          description: `Tag-Along Tour — ${booking.tour_or_vehicle}${booking.date ? ` (${format(new Date(booking.date), 'd MMM yyyy')})` : ''}`,
          amount: booking.amount || 0,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          bookingId: booking.raw_id,
          bookingType: 'tagalong',
        }),
      })
      if (!res.ok) throw new Error()
      toast.success('Invoice raised in Xero')
      loadBookings()
    } catch {
      toast.error('Failed to raise invoice')
    } finally {
      setRaising(null)
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
          Bookings
        </h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          {!xeroConnected && (
            <a href="/api/xero/connect" style={{ fontSize: 12, color: '#b8956a', textDecoration: 'none', border: '1px solid rgba(184,149,106,0.3)', padding: '5px 12px', borderRadius: 4 }}>
              Connect Xero
            </a>
          )}
          {(activeTab === 'all' || activeTab === 'tours') && (
            <>
              <button
                onClick={() => openCreate('tour')}
                style={{ padding: '8px 18px', borderRadius: 5, background: 'transparent', color: '#b8956a', border: '1px solid rgba(184,149,106,0.35)', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}
              >
                + Tour Booking
              </button>
              <button
                onClick={() => openCreate('internal')}
                style={{ padding: '8px 18px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}
              >
                + Internal Booking
              </button>
            </>
          )}
        </div>
      </div>

      <BookingsTabBar active={activeTab} onChange={(tab) => { setActiveTab(tab); setShowCreate(false); setCreateMode(null) }} />

      {showCreate && createMode === 'tour' && (
        <CreateTourForm form={tourForm} setForm={setTourForm} saving={saving} onSubmit={createTour} onCancel={() => { setShowCreate(false); setCreateMode(null) }} />
      )}
      {showCreate && createMode === 'internal' && (
        <CreateInternalForm form={internalForm} setForm={setInternalForm} saving={saving} onSubmit={createInternal} onCancel={() => { setShowCreate(false); setCreateMode(null) }} />
      )}

      {editingBooking && editForm && (
        <EditBookingForm
          booking={editingBooking}
          form={editForm}
          setForm={setEditForm}
          saving={saving}
          onSubmit={saveEdit}
          onCancel={() => { setEditingBooking(null); setEditForm(null) }}
        />
      )}

      <div style={cardStyle}>
        <BookingsTable
          bookings={visibleBookings}
          loading={loading}
          xeroConnected={xeroConnected}
          invoiceLinks={invoiceLinks}
          onEdit={startEdit}
          onDelete={deleteBooking}
          onCancel={cancelBooking}
          onRaiseInvoice={raiseInvoice}
          raisingId={raising}
          showSections={activeTab === 'tours'}
          emptyMessage="No bookings in this view yet"
        />
      </div>
    </div>
  )
}

export { parseTab as parseBookingsTab }
