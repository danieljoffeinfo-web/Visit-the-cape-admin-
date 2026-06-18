'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabase'
import type { BookingTab, UnifiedBooking } from '@/lib/bookings'
import { filterBookingsByTab } from '@/lib/bookings'
import { cardStyle, pageTitle, primaryButton, secondaryButton } from '@/lib/theme'
import { BookingsTabBar } from '@/components/bookings/bookings-tab-bar'
import { BookingsTable } from '@/components/bookings/bookings-table'
import { CreateTourForm, emptyTourForm } from '@/components/bookings/create-tour-form'
import { CreateInternalForm, emptyInternalForm } from '@/components/bookings/create-internal-form'
import { CreateFleetForm } from '@/components/bookings/create-fleet-form'

type InvoiceLink = {
  booking_id: string
  xero_invoice_id: string
  xero_invoice_number?: string
  status: string
}

const TAB_CREATE_LABEL: Partial<Record<BookingTab, string>> = {
  tours: '+ New Tour Booking',
  internal: '+ New Internal Booking',
  fleet: '+ New Fleet Booking',
}

function parseTab(value: string | null): BookingTab {
  if (value === 'tours' || value === 'internal' || value === 'fleet' || value === 'private' || value === 'all') {
    return value
  }
  return 'all'
}

export function BookingsPanel({
  initialTab,
  initialAction,
}: {
  initialTab?: BookingTab
  initialAction?: string | null
}) {
  const [activeTab, setActiveTab] = useState<BookingTab>(initialTab || 'all')
  const [bookings, setBookings] = useState<UnifiedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showCreate, setShowCreate] = useState(initialAction === 'create')
  const [tourForm, setTourForm] = useState(emptyTourForm)
  const [internalForm, setInternalForm] = useState(emptyInternalForm)
  const [invoiceLinks, setInvoiceLinks] = useState<Record<string, InvoiceLink>>({})
  const [xeroConnected, setXeroConnected] = useState(false)
  const [raising, setRaising] = useState<string | null>(null)

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab)
    if (initialAction === 'create') setShowCreate(true)
  }, [initialTab, initialAction])

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
          .filter((b: UnifiedBooking) => b.kind === 'tour' || b.kind === 'private')
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
      setInternalForm(emptyInternalForm)
      loadBookings()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create booking')
    } finally {
      setSaving(false)
    }
  }

  async function cancelBooking(booking: UnifiedBooking) {
    if (!confirm('Cancel this booking?')) return
    try {
      if (booking.kind === 'fleet') {
        const res = await fetch('/api/fleet/bookings', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: booking.raw_id }),
        })
        if (!res.ok) throw new Error('Failed to cancel')
      } else {
        const res = await fetch('/api/bookings', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: booking.raw_id, kind: booking.kind, status: 'cancelled' }),
        })
        if (!res.ok) throw new Error('Failed to cancel')
      }
      toast.success('Booking cancelled')
      loadBookings()
    } catch {
      toast.error('Failed to cancel booking')
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
          description:
            booking.kind === 'private'
              ? `Private Enquiry — ${booking.tour_or_vehicle}`
              : `Tag-Along Tour — ${booking.tour_or_vehicle}${booking.date ? ` (${format(new Date(booking.date), 'd MMM yyyy')})` : ''}`,
          amount: booking.amount || 0,
          dueDate: new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0],
          bookingId: booking.raw_id,
          bookingType: booking.kind === 'private' ? 'private' : 'tagalong',
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

  const createLabel = TAB_CREATE_LABEL[activeTab]

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={pageTitle}>Bookings</h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {!xeroConnected && (
            <a href="/api/xero/connect" style={{ ...secondaryButton, textDecoration: 'none', fontSize: 12, display: 'inline-block' }}>
              Connect Xero
            </a>
          )}
          {createLabel && (
            <button onClick={() => setShowCreate((v) => !v)} style={primaryButton}>
              {createLabel}
            </button>
          )}
        </div>
      </div>

      <BookingsTabBar active={activeTab} onChange={(tab) => { setActiveTab(tab); setShowCreate(false) }} />

      {showCreate && activeTab === 'tours' && (
        <CreateTourForm form={tourForm} setForm={setTourForm} saving={saving} onSubmit={createTour} onCancel={() => setShowCreate(false)} />
      )}
      {showCreate && activeTab === 'internal' && (
        <CreateInternalForm form={internalForm} setForm={setInternalForm} saving={saving} onSubmit={createInternal} onCancel={() => setShowCreate(false)} />
      )}
      {showCreate && activeTab === 'fleet' && (
        <CreateFleetForm saving={saving} onSaved={() => { setShowCreate(false); loadBookings() }} onCancel={() => setShowCreate(false)} />
      )}

      <div style={cardStyle}>
        <BookingsTable
          bookings={visibleBookings}
          loading={loading}
          xeroConnected={xeroConnected}
          invoiceLinks={invoiceLinks}
          onCancel={cancelBooking}
          onRaiseInvoice={raiseInvoice}
          raisingId={raising}
          emptyMessage={
            activeTab === 'private'
              ? 'No private enquiries yet'
              : activeTab === 'fleet'
                ? 'No fleet bookings yet'
                : 'No bookings in this view yet'
          }
        />
      </div>
    </div>
  )
}

export { parseTab as parseBookingsTab }
