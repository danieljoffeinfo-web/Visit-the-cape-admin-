'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { format } from 'date-fns'

type Tour = { id: string; name: string; date: string; seats_total: number; booked_seats: number; price_per_person: number }
type Enquiry = { id: string; name: string; created_at: string; tour_type?: string }

export function DashboardPanel({ onNavigate }: { onNavigate: (p: string) => void }) {
  const [stats, setStats] = useState({ enquiries: 0, bookings: 0, tours: 0, week: 0 })
  const [schedule, setSchedule] = useState<Tour[]>([])
  const [departures, setDepartures] = useState<Tour[]>([])
  const [kn, setKn] = useState({ seatsBooked: 0, seatsAvail: 0, private: 0, tagalong: 0 })

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const today = format(new Date(), 'yyyy-MM-dd')
    const weekAgo = format(new Date(Date.now() - 7 * 86400000), 'yyyy-MM-dd')
    const in30 = format(new Date(Date.now() + 30 * 86400000), 'yyyy-MM-dd')

    const [enqRes, bookRes, toursRes, weekEnqRes, todayRes] = await Promise.all([
      supabase.from('enquiries').select('id', { count: 'exact', head: true }),
      supabase.from('tag_along_bookings').select('id', { count: 'exact', head: true }),
      supabase.from('tag_along_tours').select('*').gte('date', today).lte('date', in30).order('date'),
      supabase.from('enquiries').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
      supabase.from('tag_along_tours').select('*').eq('date', today),
    ])

    setStats({
      enquiries: enqRes.count || 0,
      bookings: bookRes.count || 0,
      tours: (toursRes.data || []).length,
      week: weekEnqRes.count || 0,
    })
    setSchedule((todayRes.data || []) as Tour[])
    setDepartures(((toursRes.data || []).slice(0, 5)) as Tour[])

    const allTours = (toursRes.data || []) as Tour[]
    setKn({
      seatsBooked: allTours.reduce((s, t) => s + (t.booked_seats || 0), 0),
      seatsAvail: allTours.reduce((s, t) => s + ((t.seats_total || 0) - (t.booked_seats || 0)), 0),
      private: enqRes.count || 0,
      tagalong: bookRes.count || 0,
    })
  }

  const card = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }

  return (
    <div>
      <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 24 }}>Dashboard</h1>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {[
          { label: 'Total Enquiries', value: stats.enquiries, sub: 'All time' },
          { label: 'Tag-Along Bookings', value: stats.bookings, sub: 'All time' },
          { label: 'Upcoming Tours', value: stats.tours, sub: 'Next 30 days' },
          { label: 'New This Week', value: stats.week, sub: 'Enquiries + bookings' },
        ].map(s => (
          <div key={s.label} style={card}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.45)', marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 36, color: '#b8956a', lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 12, color: 'rgba(240,236,228,0.35)', marginTop: 4 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Today's Schedule */}
        <div style={card}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Today&apos;s Schedule</h3>
            <button onClick={() => onNavigate('tours')} style={{ padding: '5px 12px', borderRadius: 4, border: '1px solid rgba(184,149,106,0.35)', background: 'transparent', color: '#b8956a', cursor: 'pointer', fontSize: 12, fontFamily: "'Barlow', sans-serif" }}>Add Tour</button>
          </div>
          {schedule.length === 0 ? (
            <div style={{ color: 'rgba(240,236,228,0.35)', fontSize: 13, padding: '12px 0' }}>No tours scheduled for today</div>
          ) : schedule.map(t => (
            <div key={t.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
              <div style={{ fontWeight: 600, fontSize: 14 }}>{t.name}</div>
              <div style={{ fontSize: 12, color: 'rgba(240,236,228,0.5)', marginTop: 3 }}>{t.booked_seats}/{t.seats_total} seats booked</div>
            </div>
          ))}
        </div>

        {/* Key Numbers */}
        <div style={card}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>Key Numbers</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
            {[
              { v: kn.seatsBooked, l: 'Seats Booked' },
              { v: kn.seatsAvail, l: 'Seats Available' },
              { v: kn.private, l: 'Private Enquiries' },
              { v: kn.tagalong, l: 'Tag-Along Bookings' },
            ].map(k => (
              <div key={k.l} style={{ background: 'rgba(240,236,228,0.04)', borderRadius: 6, padding: '12px 14px' }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 28, color: '#b8956a' }}>{k.v}</div>
                <div style={{ fontSize: 12, color: 'rgba(240,236,228,0.45)', marginTop: 2 }}>{k.l}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming Departures */}
        <div style={card}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>Upcoming Departures</h3>
          {departures.length === 0 ? (
            <div style={{ color: 'rgba(240,236,228,0.35)', fontSize: 13 }}>No upcoming tours</div>
          ) : departures.map(t => (
            <div key={t.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid rgba(240,236,228,0.06)' }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 500 }}>{t.name}</div>
                <div style={{ fontSize: 12, color: 'rgba(240,236,228,0.45)', marginTop: 2 }}>{format(new Date(t.date), 'EEE, d MMM')}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 13, color: '#b8956a', fontWeight: 600 }}>{t.booked_seats}/{t.seats_total}</div>
                <div style={{ fontSize: 11, color: 'rgba(240,236,228,0.35)' }}>seats</div>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div style={card}>
          <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 17, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 14 }}>Quick Actions</h3>
          {[
            { icon: '＋', label: 'Schedule a Tag-Along Tour', desc: 'Add a new departure date with seats', to: 'tours' },
            { icon: '✉', label: 'View Enquiries', desc: 'Check latest customer messages', to: 'enquiries' },
            { icon: '✓', label: 'Manage Bookings', desc: 'View tag-along booking details', to: 'bookings' },
            { icon: '₤', label: 'Accounting', desc: 'Invoices, payments and reports', to: 'accounting' },
          ].map(a => (
            <div key={a.label} onClick={() => onNavigate(a.to)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid rgba(240,236,228,0.06)', cursor: 'pointer' }}>
              <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(184,149,106,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#b8956a', fontSize: 16, flexShrink: 0 }}>{a.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{a.label}</div>
                <div style={{ fontSize: 12, color: 'rgba(240,236,228,0.45)', marginTop: 1 }}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
