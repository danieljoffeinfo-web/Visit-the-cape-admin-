'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
  subMonths,
} from 'date-fns'
import { toast } from 'sonner'
import {
  CONTENT_PLACEMENTS,
  CONTENT_PLATFORMS,
  type ContentAllocation,
  type ContentMedia,
  type ContentPlacement,
  type ContentPlatform,
  placementLabel,
  platformLabel,
} from '@/lib/content-library'
import { cardStyle, fieldLabel, inputStyle, pageTitle, primaryButton, secondaryButton, sectionTitle, theme } from '@/lib/theme'

type AllocationRow = ContentAllocation & {
  media?: (ContentMedia & { url?: string }) | null
}

const platformColor: Record<ContentPlatform, string> = {
  instagram: theme.bronze,
  tiktok: '#2f9d8d',
  facebook: '#4a7fd4',
}

export function ContentLibraryPanel() {
  const [month, setMonth] = useState(() => startOfMonth(new Date()))
  const [platform, setPlatform] = useState<ContentPlatform>('instagram')
  const [selectedDate, setSelectedDate] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [media, setMedia] = useState<(ContentMedia & { url?: string })[]>([])
  const [allocations, setAllocations] = useState<AllocationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null)
  const [placement, setPlacement] = useState<ContentPlacement>('post')
  const [caption, setCaption] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const monthKey = format(month, 'yyyy-MM')

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [mediaRes, allocationsRes] = await Promise.all([
        fetch('/api/content/library', { cache: 'no-store' }),
        fetch(`/api/content/allocations?month=${monthKey}`, { cache: 'no-store' }),
      ])
      const mediaData = await mediaRes.json()
      const allocationData = await allocationsRes.json()
      if (!mediaRes.ok) throw new Error(mediaData.error || 'Failed to load media')
      if (!allocationsRes.ok) throw new Error(allocationData.error || 'Failed to load allocations')
      setMedia(mediaData.media || [])
      setAllocations(allocationData.allocations || [])
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load content library')
    } finally {
      setLoading(false)
    }
  }, [monthKey])

  useEffect(() => {
    loadData()
  }, [loadData])

  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 0 })
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 0 })
    return eachDayOfInterval({ start, end })
  }, [month])

  const selectedEntries = useMemo(
    () => allocations.filter((entry) => entry.scheduled_date === selectedDate && entry.platform === platform),
    [allocations, selectedDate, platform],
  )

  const entriesByDate = useMemo(() => {
    const map = new Map<string, AllocationRow[]>()
    for (const entry of allocations.filter((item) => item.platform === platform)) {
      const list = map.get(entry.scheduled_date) || []
      list.push(entry)
      map.set(entry.scheduled_date, list)
    }
    return map
  }, [allocations, platform])

  async function uploadFiles(files: FileList | null) {
    if (!files?.length) return
    setUploading(true)
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData()
        formData.append('file', file)
        const response = await fetch('/api/content/library/upload', { method: 'POST', body: formData })
        const result = await response.json()
        if (!response.ok) throw new Error(result.error || `Failed to upload ${file.name}`)
      }
      toast.success(files.length === 1 ? 'Media uploaded' : `${files.length} files uploaded`)
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Upload failed')
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  async function createAllocation() {
    if (!selectedMediaId) {
      toast.error('Choose media from the library first')
      return
    }
    setSaving(true)
    try {
      const response = await fetch('/api/content/allocations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mediaId: selectedMediaId,
          scheduledDate: selectedDate,
          platform,
          placement,
          caption,
          status: 'draft',
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to save allocation')
      toast.success('Content scheduled')
      setCaption('')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save allocation')
    } finally {
      setSaving(false)
    }
  }

  async function updateAllocation(entry: AllocationRow, updates: Partial<AllocationRow>) {
    try {
      const response = await fetch('/api/content/allocations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: entry.id,
          ...updates,
          mediaId: updates.media_id,
          scheduledDate: updates.scheduled_date,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to update')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update allocation')
    }
  }

  async function deleteAllocation(id: string) {
    if (!confirm('Remove this scheduled content?')) return
    try {
      const response = await fetch(`/api/content/allocations?id=${encodeURIComponent(id)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to delete')
      await loadData()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete allocation')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 24, flexWrap: 'wrap' }}>
        <div>
          <h1 style={pageTitle}>Content Library</h1>
          <p style={{ color: theme.textMuted, fontSize: 13, marginTop: 6 }}>
            Upload media once, then allocate it to Instagram, TikTok, and Facebook posts or stories by date.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            style={{ display: 'none' }}
            onChange={(event) => void uploadFiles(event.target.files)}
          />
          <button type="button" style={secondaryButton} disabled={uploading} onClick={() => fileInputRef.current?.click()}>
            {uploading ? 'Uploading…' : 'Upload media'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(320px, 0.8fr)', gap: 20 }} className="admin-grid-2col">
        <div style={{ display: 'grid', gap: 20 }}>
          <div style={cardStyle}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <div style={sectionTitle}>Planner</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {CONTENT_PLATFORMS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setPlatform(item.id)}
                    style={{
                      ...secondaryButton,
                      padding: '6px 12px',
                      fontSize: 12,
                      background: platform === item.id ? theme.bronzeBg : theme.surface,
                      borderColor: platform === item.id ? theme.bronzeBorder : theme.border,
                      color: platform === item.id ? theme.bronzeDark : theme.textMuted,
                    }}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <button type="button" onClick={() => setMonth((current) => subMonths(current, 1))} style={secondaryButton}>‹</button>
              <div style={{ fontFamily: theme.headingFont, fontWeight: 800, fontSize: 18 }}>{format(month, 'MMMM yyyy')}</div>
              <button type="button" onClick={() => setMonth((current) => addMonths(current, 1))} style={secondaryButton}>›</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 6 }}>
              {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map((label) => (
                <div key={label} style={{ textAlign: 'center', fontSize: 11, color: theme.textMuted, fontWeight: 700 }}>{label}</div>
              ))}
              {calendarDays.map((day) => {
                const key = format(day, 'yyyy-MM-dd')
                const entries = entriesByDate.get(key) || []
                const selected = selectedDate === key
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setSelectedDate(key)}
                    style={{
                      minHeight: 72,
                      borderRadius: 8,
                      border: `1px solid ${selected ? theme.bronzeBorder : theme.border}`,
                      background: selected ? theme.bronzeBg : isSameMonth(day, month) ? theme.surface : theme.surfaceMuted,
                      padding: 8,
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ fontSize: 12, fontWeight: 700, color: theme.text }}>{format(day, 'd')}</div>
                    <div style={{ display: 'grid', gap: 4, marginTop: 6 }}>
                      {entries.slice(0, 2).map((entry) => (
                        <div
                          key={entry.id}
                          style={{
                            fontSize: 10,
                            padding: '2px 6px',
                            borderRadius: 999,
                            background: 'rgba(255,255,255,0.7)',
                            color: platformColor[entry.platform],
                            fontWeight: 700,
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {placementLabel(entry.placement)}
                        </div>
                      ))}
                      {entries.length > 2 && (
                        <div style={{ fontSize: 10, color: theme.textMuted }}>+{entries.length - 2} more</div>
                      )}
                    </div>
                  </button>
                )
              })}
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>
              {format(parseISO(selectedDate), 'd MMMM yyyy')} · {platformLabel(platform)}
            </div>

            {loading ? (
              <div style={{ color: theme.textMuted }}>Loading…</div>
            ) : selectedEntries.length === 0 ? (
              <div style={{ color: theme.textMuted, fontSize: 13 }}>No content scheduled for this day yet.</div>
            ) : (
              <div style={{ display: 'grid', gap: 12 }}>
                {selectedEntries.map((entry) => (
                  <article key={entry.id} style={{ border: `1px solid ${theme.border}`, borderRadius: 10, overflow: 'hidden', background: theme.surfaceMuted }}>
                    {entry.media?.url && (
                      <div style={{ aspectRatio: '16 / 9', background: theme.surface }}>
                        {entry.media.media_kind === 'video' ? (
                          <video src={entry.media.url} controls style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={entry.media.url} alt={entry.media.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                    )}
                    <div style={{ padding: 14 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginBottom: 10 }}>
                        <div style={{ fontWeight: 700, fontSize: 13 }}>{placementLabel(entry.placement)}</div>
                        <button
                          type="button"
                          onClick={() => void updateAllocation(entry, { status: entry.status === 'posted' ? 'draft' : 'posted' })}
                          style={{ ...secondaryButton, padding: '4px 10px', fontSize: 11 }}
                        >
                          {entry.status === 'posted' ? 'Posted' : 'Mark posted'}
                        </button>
                      </div>
                      <textarea
                        value={entry.caption}
                        onChange={(event) => setAllocations((rows) => rows.map((row) => row.id === entry.id ? { ...row, caption: event.target.value } : row))}
                        onBlur={(event) => void updateAllocation(entry, { caption: event.target.value })}
                        rows={3}
                        style={{ ...inputStyle, resize: 'vertical', marginBottom: 10 }}
                      />
                      <button type="button" onClick={() => void deleteAllocation(entry.id)} style={{ ...secondaryButton, color: theme.danger, fontSize: 12 }}>
                        Remove
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </div>

        <div style={{ display: 'grid', gap: 20, alignContent: 'start' }}>
          <div style={cardStyle}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>Schedule content</div>
            <div style={{ display: 'grid', gap: 12 }}>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={fieldLabel}>Date</span>
                <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} style={inputStyle} />
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={fieldLabel}>Placement</span>
                <select value={placement} onChange={(event) => setPlacement(event.target.value as ContentPlacement)} style={inputStyle}>
                  {CONTENT_PLACEMENTS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>
              <label style={{ display: 'grid', gap: 6 }}>
                <span style={fieldLabel}>Caption</span>
                <textarea value={caption} onChange={(event) => setCaption(event.target.value)} rows={4} style={{ ...inputStyle, resize: 'vertical' }} placeholder="Write the caption for this post or story" />
              </label>
              <button type="button" onClick={() => void createAllocation()} disabled={saving || !selectedMediaId} style={primaryButton}>
                {saving ? 'Saving…' : 'Add to calendar'}
              </button>
            </div>
          </div>

          <div style={cardStyle}>
            <div style={{ ...sectionTitle, marginBottom: 12 }}>Media library</div>
            {media.length === 0 ? (
              <div style={{ color: theme.textMuted, fontSize: 13 }}>Upload photos or videos to start scheduling.</div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 10, maxHeight: 520, overflowY: 'auto' }}>
                {media.map((item) => {
                  const selected = selectedMediaId === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedMediaId(item.id)}
                      style={{
                        border: `2px solid ${selected ? theme.bronze : theme.border}`,
                        borderRadius: 10,
                        overflow: 'hidden',
                        background: theme.surfaceMuted,
                        padding: 0,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <div style={{ aspectRatio: '1 / 1', background: theme.surface }}>
                        {item.media_kind === 'video' ? (
                          <video src={item.url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted />
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={item.url} alt={item.filename} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        )}
                      </div>
                      <div style={{ padding: '8px 10px' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: theme.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.filename}</div>
                        <div style={{ fontSize: 10, color: theme.textMuted, marginTop: 2 }}>{Math.max(1, Math.round(item.size_bytes / 1024))} KB</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
