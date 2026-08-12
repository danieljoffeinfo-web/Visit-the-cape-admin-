'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { format, isAfter, startOfDay } from 'date-fns'
import { toast } from 'sonner'
import type { AddOn } from '@/lib/add-ons'
import type { UnifiedBooking } from '@/lib/bookings'
import { CreateAddOnForm } from '@/components/bookings/create-addon-form'
import { cardStyle, pageTitle, primaryButton, secondaryButton, theme } from '@/lib/theme'

/**
 * Experiences — the add-on adventures, and booking them out.
 *
 * The catalogue was only reachable as a list of checkboxes inside a booking
 * form, which meant there was nowhere to simply look at what is on offer or
 * how often any of it sells. This is the same relationship Fleet Manager has
 * with vehicles: the thing itself, with a Book out on it.
 *
 * Bookings still go through the add-on booking route, so an experience booked
 * here lands in the same table, on the same invoice template, with the same
 * Xero link as one booked from the bookings hub. Nothing forks.
 */

function money(amount: number) {
  return `R ${amount.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function ExperiencesPanel() {
  const [catalogue, setCatalogue] = useState<AddOn[]>([])
  const [bookings, setBookings] = useState<UnifiedBooking[]>([])
  const [loading, setLoading] = useState(true)
  const [booking, setBooking] = useState<{ slug?: string; name?: string } | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [addOnsRes, bookingsRes] = await Promise.all([
        fetch('/api/add-ons', { cache: 'no-store' }).then((r) => r.json()),
        fetch('/api/bookings?type=all', { cache: 'no-store' })
          .then((r) => r.json())
          .catch(() => ({ bookings: [] })),
      ])
      if (addOnsRes.error) throw new Error(addOnsRes.error)
      setCatalogue(addOnsRes.addOns || [])
      setBookings(
        ((bookingsRes.bookings || []) as UnifiedBooking[]).filter((b) => b.kind === 'addon'),
      )
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not load experiences')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  /* How many guests each experience has sold, and what it has taken, read off
     the booking lines rather than stored on the add-on — so correcting a
     booking corrects these too. */
  const stats = useMemo(() => {
    const byslug: Record<string, { bookings: number; guests: number; revenue: number }> = {}
    for (const b of bookings) {
      if (b.status === 'cancelled') continue
      for (const line of b.addOnLines || []) {
        const entry = (byslug[line.slug] ||= { bookings: 0, guests: 0, revenue: 0 })
        entry.bookings += 1
        entry.guests += line.quantity
        entry.revenue += line.quantity * line.unitAmount
      }
    }
    return byslug
  }, [bookings])

  const upcoming = useMemo(() => {
    const today = startOfDay(new Date())
    return bookings
      .filter((b) => b.status !== 'cancelled' && b.date && isAfter(new Date(b.date), today))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 8)
  }, [bookings])

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 24,
          gap: 12,
          flexWrap: 'wrap',
        }}
      >
        <h1 style={pageTitle}>Experiences</h1>
        <button onClick={() => setBooking({})} style={primaryButton}>
          Book an experience
        </button>
      </div>

      {booking && (
        <CreateAddOnForm
          initialSlug={booking.slug}
          heading={booking.name ? `Book ${booking.name}` : 'Book an experience'}
          onSaved={() => {
            setBooking(null)
            load()
          }}
          onCancel={() => setBooking(null)}
        />
      )}

      {loading ? (
        <div style={{ ...cardStyle, color: theme.textFaint }}>Loading experiences…</div>
      ) : catalogue.length === 0 ? (
        <div style={{ ...cardStyle, color: theme.textMuted }}>
          No experiences found. Check that the content project is reachable.
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            marginBottom: 24,
          }}
        >
          {catalogue.map((addOn) => {
            const stat = stats[addOn.slug]
            return (
              <div key={addOn.slug} style={{ ...cardStyle, display: 'flex', flexDirection: 'column', gap: 12 }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                    <span aria-hidden style={{ fontSize: 20 }}>
                      {addOn.emoji || '🎟'}
                    </span>
                    <h2
                      style={{
                        fontFamily: theme.headingFont,
                        fontWeight: 800,
                        fontSize: 19,
                        color: theme.text,
                        margin: 0,
                        lineHeight: 1.15,
                      }}
                    >
                      {addOn.name}
                    </h2>
                  </div>
                  <p style={{ fontSize: 12, color: theme.textMuted, margin: '6px 0 0' }}>
                    {addOn.price != null
                      ? `${money(Number(addOn.price))}${addOn.price_note ? ` ${addOn.price_note}` : ''}`
                      : 'Quote on request'}
                    {addOn.location ? ` · ${addOn.location}` : ''}
                    {addOn.is_published ? '' : ' · not on the website'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Stat label="Bookings" value={stat ? String(stat.bookings) : '0'} />
                  <Stat label="Guests" value={stat ? String(stat.guests) : '0'} />
                  <Stat label="Revenue" value={stat ? money(stat.revenue) : 'R 0'} />
                </div>

                <button
                  onClick={() => setBooking({ slug: addOn.slug, name: addOn.name })}
                  style={{ ...primaryButton, width: '100%' }}
                >
                  Book out
                </button>
              </div>
            )
          })}
        </div>
      )}

      {!loading && upcoming.length > 0 && (
        <div style={cardStyle}>
          <h2
            style={{
              fontFamily: theme.headingFont,
              fontWeight: 800,
              fontSize: 17,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: theme.text,
              margin: '0 0 12px',
            }}
          >
            Coming up
          </h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {upcoming.map((b) => (
              <div
                key={b.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  flexWrap: 'wrap',
                  padding: '9px 11px',
                  borderRadius: 6,
                  border: `1px solid ${theme.border}`,
                  background: theme.surfaceMuted,
                }}
              >
                <span style={{ fontSize: 13, color: theme.text, fontWeight: 600 }}>
                  {b.customer_name}
                  <span style={{ fontWeight: 400, color: theme.textMuted }}>
                    {' · '}
                    {(b.addOnLines || []).map((line) => line.name).join(', ') || b.tour_or_vehicle}
                  </span>
                </span>
                <span style={{ fontSize: 13, color: theme.bronzeDark, fontWeight: 600 }}>
                  {format(new Date(b.date), 'd MMM yyyy')}
                </span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 12, color: theme.textMuted, margin: '10px 0 0' }}>
            Every experience booking also shows under Bookings → Add-Ons, and on the Calendar.
          </p>
        </div>
      )}

      {!loading && catalogue.length > 0 && upcoming.length === 0 && (
        <div style={{ ...cardStyle, color: theme.textMuted, fontSize: 13 }}>
          Nothing booked yet. Use Book out on an experience above, or{' '}
          <button
            onClick={() => setBooking({})}
            style={{ ...secondaryButton, padding: '3px 9px', fontSize: 12 }}
          >
            book an experience
          </button>
          .
        </div>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        padding: '7px 9px',
        borderRadius: 6,
        background: theme.surfaceMuted,
        border: `1px solid ${theme.border}`,
      }}
    >
      <div
        style={{
          fontSize: 10,
          letterSpacing: '0.1em',
          textTransform: 'uppercase',
          color: theme.textMuted,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: theme.headingFont,
          fontWeight: 800,
          fontSize: 16,
          color: theme.text,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {value}
      </div>
    </div>
  )
}
