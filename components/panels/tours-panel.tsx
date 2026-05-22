'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { toast } from 'sonner'
import { format } from 'date-fns'

type Tour = {
  id: string
  name: string
  date: string
  seats_total: number
  booked_seats: number
  price_per_person: number
  description?: string
}

export function ToursPanel() {
  const [tours, setTours] = useState<Tour[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState({ name: '', date: '', seats_total: '8', price_per_person: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => { loadTours() }, [])

  async function loadTours() {
    const { data } = await supabase.from('tag_along_tours').select('*').order('date', { ascending: true })
    setTours((data || []) as Tour[])
    setLoading(false)
  }

  async function addTour() {
    if (!form.name || !form.date || !form.price_per_person) { toast.error('Fill all fields'); return }
    setSaving(true)
    const { error } = await supabase.from('tag_along_tours').insert({
      name: form.name,
      date: form.date,
      seats_total: parseInt(form.seats_total),
      booked_seats: 0,
      price_per_person: parseFloat(form.price_per_person),
    })
    setSaving(false)
    if (error) { toast.error('Failed to add tour'); return }
    toast.success('Tour scheduled')
    setShowModal(false)
    setForm({ name: '', date: '', seats_total: '8', price_per_person: '' })
    loadTours()
  }

  async function deleteTour(id: string) {
    if (!confirm('Delete this tour?')) return
    await supabase.from('tag_along_tours').delete().eq('id', id)
    toast.success('Tour deleted')
    loadTours()
  }

  const card = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }
  const today = format(new Date(), 'yyyy-MM-dd')

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Tours & Pricing</h1>
        <button onClick={() => setShowModal(true)} style={{ padding: '8px 18px', borderRadius: 5, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }}>
          + Schedule Tour
        </button>
      </div>

      <div style={card}>
        {loading ? <div style={{ color: 'rgba(240,236,228,0.4)' }}>Loading...</div> : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(240,236,228,0.1)' }}>
                {['Tour Name', 'Date', 'Seats', 'Booked', 'Price / Pax', 'Status', ''].map(h => (
                  <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.4)', fontWeight: 500 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {tours.length === 0 && <tr><td colSpan={7} style={{ padding: 24, textAlign: 'center', color: 'rgba(240,236,228,0.4)' }}>No tours scheduled</td></tr>}
              {tours.map(t => {
                const isPast = t.date < today
                const isFull = t.booked_seats >= t.seats_total
                return (
                  <tr key={t.id} style={{ borderBottom: '1px solid rgba(240,236,228,0.06)', opacity: isPast ? 0.5 : 1 }}>
                    <td style={{ padding: '10px 12px', fontSize: 13, fontWeight: 500 }}>{t.name}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{format(new Date(t.date), 'EEE, d MMM yyyy')}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>{t.seats_total}</td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>
                      <span style={{ color: isFull ? '#ef5350' : '#4caf84', fontWeight: 600 }}>{t.booked_seats}</span>
                    </td>
                    <td style={{ padding: '10px 12px', fontSize: 13 }}>R {(t.price_per_person || 0).toLocaleString('en-ZA')}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 11, background: isPast ? 'rgba(240,236,228,0.06)' : isFull ? 'rgba(239,83,80,0.15)' : 'rgba(76,175,132,0.15)', color: isPast ? 'rgba(240,236,228,0.35)' : isFull ? '#ef5350' : '#4caf84' }}>
                        {isPast ? 'Past' : isFull ? 'Full' : 'Open'}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <button onClick={() => deleteTour(t.id)} style={{ padding: '3px 8px', fontSize: 11, borderRadius: 4, border: '1px solid rgba(239,83,80,0.3)', background: 'transparent', color: 'rgba(239,83,80,0.7)', cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>
                        Delete
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#1a1815', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 10, padding: 32, width: 400 }}>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 20 }}>Schedule Tour</h2>
            {[
              { label: 'Tour Name', key: 'name', type: 'text', placeholder: 'Table Mountain Tag-Along' },
              { label: 'Date', key: 'date', type: 'date', placeholder: '' },
              { label: 'Total Seats', key: 'seats_total', type: 'number', placeholder: '8' },
              { label: 'Price per Person (ZAR)', key: 'price_per_person', type: 'number', placeholder: '1500' },
            ].map(f => (
              <div key={f.key} style={{ marginBottom: 14 }}>
                <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.5)', marginBottom: 5 }}>{f.label}</label>
                <input
                  type={f.type}
                  placeholder={f.placeholder}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  style={{ width: '100%', padding: '8px 12px', background: 'rgba(240,236,228,0.05)', border: '1px solid rgba(240,236,228,0.15)', borderRadius: 5, color: '#f0ece4', fontSize: 14, fontFamily: "'Barlow', sans-serif", colorScheme: 'dark' }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={() => setShowModal(false)} style={{ flex: 1, padding: '9px 0', borderRadius: 5, border: '1px solid rgba(240,236,228,0.15)', background: 'transparent', color: 'rgba(240,236,228,0.6)', cursor: 'pointer', fontFamily: "'Barlow', sans-serif" }}>Cancel</button>
              <button onClick={addTour} disabled={saving} style={{ flex: 1, padding: '9px 0', borderRadius: 5, border: 'none', background: '#b8956a', color: '#0c0b09', cursor: 'pointer', fontWeight: 700, fontFamily: "'Barlow', sans-serif" }}>
                {saving ? 'Saving...' : 'Schedule'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
