'use client'

import { useCallback, useEffect, useState } from 'react'
import { toast } from 'sonner'
import type { WebsiteTour } from '@/lib/content-supabase-admin'
import { cardStyle, fieldLabel, inputStyle, pageTitle, primaryButton, secondaryButton, sectionTitle, theme } from '@/lib/theme'

function linesToArray(text: string): string[] {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
}

function arrayToLines(value?: string[] | null): string {
  return (value || []).join('\n')
}

function formatPrice(amount?: number | null) {
  return `R ${(amount || 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
}

export function ToursPanel() {
  const [tours, setTours] = useState<WebsiteTour[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [form, setForm] = useState<Partial<WebsiteTour> & { itineraryText?: string; highlightsText?: string }>({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  const loadTours = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/tours', { cache: 'no-store' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load tours')
      const list = (data.tours || []) as WebsiteTour[]
      setTours(list)
      if (list.length > 0 && !selectedId) {
        selectTour(list[0])
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load tours')
    } finally {
      setLoading(false)
    }
  }, [selectedId])

  useEffect(() => {
    loadTours()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function selectTour(tour: WebsiteTour) {
    setSelectedId(tour.id)
    setForm({
      ...tour,
      itineraryText: arrayToLines(tour.itinerary),
      highlightsText: arrayToLines(tour.highlights),
    })
  }

  async function saveTour() {
    if (!selectedId) return
    setSaving(true)
    try {
      const res = await fetch('/api/tours', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedId,
          name: form.name,
          tagline: form.tagline,
          category: form.category,
          duration: form.duration,
          price_pax: Number(form.price_pax),
          price_note: form.price_note,
          price_private: form.price_private ? Number(form.price_private) : null,
          summary: form.summary,
          experience_intro: form.experience_intro,
          included: form.included,
          excluded: form.excluded,
          what_to_wear: form.what_to_wear,
          region: form.region,
          is_published: form.is_published,
          is_featured: form.is_featured,
          itinerary: linesToArray(form.itineraryText || ''),
          highlights: linesToArray(form.highlightsText || ''),
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save')
      toast.success('Tour updated on website')
      setTours((prev) => prev.map((t) => (t.id === selectedId ? data.tour : t)))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save tour')
    } finally {
      setSaving(false)
    }
  }

  const selected = tours.find((t) => t.id === selectedId)

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20, gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Tours & Pricing</h1>
          <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 6, maxWidth: 560 }}>
            Edit tours live on visitthecape.co.za — description, itinerary, and price per person. Bookings are managed in the Bookings tab.
          </p>
        </div>
        <a
          href="https://visitthecape.co.za/tours"
          target="_blank"
          rel="noopener noreferrer"
          style={{ ...secondaryButton, textDecoration: 'none', fontSize: 13 }}
        >
          View live site ↗
        </a>
      </div>

      {loading ? (
        <div style={{ color: theme.textMuted, padding: 24 }}>Loading website tours…</div>
      ) : tours.length === 0 ? (
        <div style={{ ...cardStyle, color: theme.textMuted }}>No tours found on the website database.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(240px, 320px) 1fr', gap: 20, alignItems: 'start' }} className="admin-grid-tours">
          <div style={{ ...cardStyle, padding: 0, overflow: 'hidden' }}>
            <div style={{ padding: '14px 16px', borderBottom: `1px solid ${theme.border}`, fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: theme.textMuted, fontWeight: 700 }}>
              Website tours ({tours.length})
            </div>
            <div style={{ maxHeight: '70vh', overflowY: 'auto' }}>
              {tours.map((tour) => {
                const active = tour.id === selectedId
                return (
                  <button
                    key={tour.id}
                    onClick={() => selectTour(tour)}
                    style={{
                      display: 'block',
                      width: '100%',
                      textAlign: 'left',
                      padding: '12px 16px',
                      border: 'none',
                      borderBottom: `1px solid ${theme.border}`,
                      cursor: 'pointer',
                      background: active ? theme.bronzeBg : theme.surface,
                      borderLeft: active ? `3px solid ${theme.bronze}` : '3px solid transparent',
                    }}
                  >
                    <div style={{ fontSize: 13, fontWeight: 600, color: theme.text }}>{tour.name}</div>
                    <div style={{ fontSize: 12, color: theme.bronzeDark, marginTop: 4, fontWeight: 600 }}>{formatPrice(tour.price_pax)} / pax</div>
                    {!tour.is_published && (
                      <div style={{ fontSize: 10, color: theme.danger, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.08em' }}>Unpublished</div>
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {selected && (
            <div style={cardStyle}>
              <h2 style={{ ...sectionTitle, marginBottom: 4 }}>{selected.name}</h2>
              <div style={{ fontSize: 12, color: theme.textFaint, marginBottom: 20 }}>/{selected.slug}</div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Tour name</label>
                  <input value={form.name || ''} onChange={(e) => setForm({ ...form, name: e.target.value })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Price per person (ZAR)</label>
                  <input type="number" value={form.price_pax ?? ''} onChange={(e) => setForm({ ...form, price_pax: Number(e.target.value) })} style={inputStyle} />
                </div>
                <div>
                  <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Duration</label>
                  <input value={form.duration || ''} onChange={(e) => setForm({ ...form, duration: e.target.value })} style={inputStyle} placeholder="Full day" />
                </div>
                <div>
                  <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Price note</label>
                  <input value={form.price_note || ''} onChange={(e) => setForm({ ...form, price_note: e.target.value })} style={inputStyle} placeholder="Per person, min 2" />
                </div>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Description (summary)</label>
                <textarea
                  value={form.summary || ''}
                  onChange={(e) => setForm({ ...form, summary: e.target.value })}
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Itinerary (one stop per line)</label>
                <textarea
                  value={form.itineraryText || ''}
                  onChange={(e) => setForm({ ...form, itineraryText: e.target.value })}
                  rows={8}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5, fontFamily: theme.bodyFont }}
                  placeholder={'Bo-Kaap cultural walk\nTable Mountain cable car\n...'}
                />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', ...fieldLabel, marginBottom: 4 }}>Highlights (one per line)</label>
                <textarea
                  value={form.highlightsText || ''}
                  onChange={(e) => setForm({ ...form, highlightsText: e.target.value })}
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.text, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!form.is_published}
                    onChange={(e) => setForm({ ...form, is_published: e.target.checked })}
                  />
                  Published on website
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: theme.text, cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={!!form.is_featured}
                    onChange={(e) => setForm({ ...form, is_featured: e.target.checked })}
                  />
                  Featured
                </label>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={saveTour} disabled={saving} style={primaryButton}>
                  {saving ? 'Saving…' : 'Save to website'}
                </button>
                <button
                  type="button"
                  onClick={() => selected && selectTour(selected)}
                  style={secondaryButton}
                >
                  Reset
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
