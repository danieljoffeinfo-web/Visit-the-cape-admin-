'use client'

import { useEffect, useMemo, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { Check, ChevronLeft, ChevronRight, Download, FileText, ImagePlus, Plus, Trash2 } from 'lucide-react'

type Platform = 'instagram' | 'tiktok' | 'facebook'
type PostKind = 'post' | 'story'
type PublishStatus = 'draft' | 'posted'
type BriefKind = 'In person video content briefs' | 'Content briefs'

type MediaAsset = {
  id: string
  name: string
  type: string
  size: number
  dataUrl: string
  addedAt: string
}

type SocialEntry = {
  id: string
  date: string
  platform: Platform
  kind: PostKind
  status: PublishStatus
  caption: string
  assets: MediaAsset[]
}

type ContentBrief = {
  id: string
  date: string
  time: string
  kind: BriefKind
  title: string
  notes: string
}

const STORAGE_KEY = 'dft-socials-planner-v1'
const BRIEFS_KEY = 'dft-socials-content-briefs-v1'

const platforms: { id: Platform; label: string }[] = [
  { id: 'instagram', label: 'Instagram' },
  { id: 'tiktok', label: 'Tik Tok' },
  { id: 'facebook', label: 'Facebook' },
]

const postKinds: { id: PostKind; label: string }[] = [
  { id: 'post', label: 'Post' },
  { id: 'story', label: 'Story' },
]

const briefKinds: BriefKind[] = ['In person video content briefs', 'Content briefs']

const platformColor: Record<Platform, string> = {
  instagram: '#d4b896',
  tiktok: '#69d2c6',
  facebook: '#8fb4f8',
}

const panel = {
  background: '#1a1815',
  border: '1px solid rgba(240,236,228,0.12)',
  borderRadius: 8,
}

const inputStyle = {
  width: '100%',
  background: 'rgba(12,11,9,0.45)',
  border: '1px solid rgba(240,236,228,0.14)',
  borderRadius: 6,
  color: '#f0ece4',
  fontSize: 13,
  padding: '10px 12px',
  fontFamily: "'Barlow', sans-serif",
}

function makeId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

function platformLabel(platform: Platform) {
  return platforms.find(p => p.id === platform)?.label || platform
}

function entryLabel(entry: SocialEntry) {
  return `${platformLabel(entry.platform)} ${entry.kind === 'post' ? 'Post' : 'Story'}`
}

function readStored<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback
  try {
    const stored = window.localStorage.getItem(key)
    return stored ? JSON.parse(stored) as T : fallback
  } catch {
    return fallback
  }
}

export function SocialsPanel() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [activePlatform, setActivePlatform] = useState<Platform>('instagram')
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(today)
  const [entries, setEntries] = useState<SocialEntry[]>(() => readStored<SocialEntry[]>(STORAGE_KEY, []))
  const [briefs, setBriefs] = useState<ContentBrief[]>(() => readStored<ContentBrief[]>(BRIEFS_KEY, []))

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(entries))
  }, [entries])

  useEffect(() => {
    window.localStorage.setItem(BRIEFS_KEY, JSON.stringify(briefs))
  }, [briefs])

  const calendarDays = useMemo(() => {
    return eachDayOfInterval({
      start: startOfWeek(startOfMonth(month), { weekStartsOn: 1 }),
      end: endOfWeek(endOfMonth(month), { weekStartsOn: 1 }),
    })
  }, [month])

  const filteredEntries = entries.filter(entry => entry.platform === activePlatform)
  const selectedEntries = filteredEntries.filter(entry => entry.date === selectedDate)
  const upcomingEntries = filteredEntries
    .filter(entry => entry.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, 8)
  const sortedBriefs = [...briefs].sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`))

  function addEntry(platform: Platform, kind: PostKind) {
    setEntries(current => [
      ...current,
      {
        id: makeId(),
        date: selectedDate,
        platform,
        kind,
        status: 'draft',
        caption: '',
        assets: [],
      },
    ])
  }

  function updateEntry(id: string, patch: Partial<SocialEntry>) {
    setEntries(current => current.map(entry => entry.id === id ? { ...entry, ...patch } : entry))
  }

  function removeEntry(id: string) {
    setEntries(current => current.filter(entry => entry.id !== id))
  }

  function addBrief() {
    setBriefs(current => [
      ...current,
      {
        id: makeId(),
        date: selectedDate,
        time: '09:00',
        kind: 'In person video content briefs',
        title: '',
        notes: '',
      },
    ])
  }

  function updateBrief(id: string, patch: Partial<ContentBrief>) {
    setBriefs(current => current.map(brief => brief.id === id ? { ...brief, ...patch } : brief))
  }

  function removeBrief(id: string) {
    setBriefs(current => current.filter(brief => brief.id !== id))
  }

  async function handleFiles(entryId: string, fileList: FileList | null) {
    if (!fileList?.length) return
    const assets = await Promise.all(Array.from(fileList).map(file => new Promise<MediaAsset>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({
        id: makeId(),
        name: file.name,
        type: file.type || 'application/octet-stream',
        size: file.size,
        dataUrl: String(reader.result),
        addedAt: new Date().toISOString(),
      })
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })))

    setEntries(current => current.map(entry => entry.id === entryId ? { ...entry, assets: [...entry.assets, ...assets] } : entry))
  }

  function removeAsset(entryId: string, assetId: string) {
    setEntries(current => current.map(entry => entry.id === entryId ? { ...entry, assets: entry.assets.filter(asset => asset.id !== assetId) } : entry))
  }

  const exportDataUrl = `data:application/json;charset=utf-8,${encodeURIComponent(JSON.stringify({ entries, briefs }, null, 2))}`

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Socials</h1>
          <p style={{ color: 'rgba(240,236,228,0.55)', fontSize: 13, marginTop: 2 }}>Plan posts, stories, media assets, and content briefs.</p>
        </div>
        <a href={exportDataUrl} download="social-media-planner.json" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 6, border: '1px solid rgba(184,149,106,0.35)', color: '#d4b896', textDecoration: 'none', fontSize: 13, fontWeight: 700 }}>
          <Download size={15} />
          Download planner
        </a>
      </div>

      <div style={{ display: 'flex', gap: 4, marginBottom: 22, background: 'rgba(240,236,228,0.04)', borderRadius: 8, padding: 4 }}>
        {platforms.map(platform => (
          <button key={platform.id} onClick={() => setActivePlatform(platform.id)} style={{
            flex: 1,
            padding: '10px 16px',
            borderRadius: 6,
            border: 'none',
            cursor: 'pointer',
            background: activePlatform === platform.id ? '#1a1815' : 'transparent',
            color: activePlatform === platform.id ? platformColor[platform.id] : 'rgba(240,236,228,0.55)',
            fontFamily: "'Barlow Condensed', sans-serif",
            fontWeight: activePlatform === platform.id ? 800 : 500,
            fontSize: 15,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            boxShadow: activePlatform === platform.id ? '0 1px 4px rgba(0,0,0,0.4)' : 'none',
          }}>
            {platform.label}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.45fr) minmax(320px, 0.9fr)', gap: 20, alignItems: 'start' }}>
        <section style={{ ...panel, padding: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <button aria-label="Previous month" onClick={() => setMonth(current => subMonths(current, 1))} style={iconButton}>
              <ChevronLeft size={17} />
            </button>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{format(month, 'MMMM yyyy')}</div>
            <button aria-label="Next month" onClick={() => setMonth(current => addMonths(current, 1))} style={iconButton}>
              <ChevronRight size={17} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(78px, 1fr))', gap: 6 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} style={{ color: 'rgba(240,236,228,0.42)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0 4px 6px' }}>{day}</div>
            ))}
            {calendarDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayEntries = filteredEntries.filter(entry => entry.date === dateKey)
              const selected = dateKey === selectedDate
              return (
                <button key={dateKey} onClick={() => setSelectedDate(dateKey)} style={{
                  minHeight: 96,
                  textAlign: 'left',
                  borderRadius: 7,
                  border: selected ? '1px solid rgba(184,149,106,0.8)' : '1px solid rgba(240,236,228,0.08)',
                  background: selected ? 'rgba(184,149,106,0.1)' : 'rgba(240,236,228,0.035)',
                  color: isSameMonth(day, month) ? '#f0ece4' : 'rgba(240,236,228,0.25)',
                  padding: 9,
                  cursor: 'pointer',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 6,
                }}>
                  <span style={{ fontWeight: 800, fontSize: 13 }}>{format(day, 'd')}</span>
                  <span style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                    {dayEntries.slice(0, 3).map(entry => (
                      <span key={entry.id} title={entryLabel(entry)} style={{ width: 8, height: 8, borderRadius: '50%', background: entry.status === 'posted' ? '#4caf84' : platformColor[entry.platform] }} />
                    ))}
                    {dayEntries.length > 3 ? <span style={{ fontSize: 10, color: 'rgba(240,236,228,0.45)' }}>+{dayEntries.length - 3}</span> : null}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        <aside style={{ ...panel, padding: 18 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.42)', marginBottom: 4 }}>Selected day</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{format(new Date(`${selectedDate}T12:00:00`), 'EEE, d MMM yyyy')}</div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 18 }}>
            {postKinds.map(kind => (
              <button key={kind.id} onClick={() => addEntry(activePlatform, kind.id)} style={{ ...primaryButton, justifyContent: 'center' }}>
                <Plus size={14} />
                {platformLabel(activePlatform)} {kind.label}
              </button>
            ))}
          </div>

          <div style={{ display: 'grid', gap: 12 }}>
            {selectedEntries.length === 0 ? (
              <div style={{ border: '1px dashed rgba(240,236,228,0.16)', borderRadius: 8, padding: 22, color: 'rgba(240,236,228,0.42)', fontSize: 13, textAlign: 'center' }}>
                No {platformLabel(activePlatform)} items planned for this day.
              </div>
            ) : selectedEntries.map(entry => (
              <article key={entry.id} style={{ background: 'rgba(240,236,228,0.04)', border: '1px solid rgba(240,236,228,0.08)', borderRadius: 8, padding: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{entryLabel(entry)}</div>
                    <div style={{ color: 'rgba(240,236,228,0.42)', fontSize: 12, marginTop: 2 }}>{entry.assets.length} media asset{entry.assets.length === 1 ? '' : 's'}</div>
                  </div>
                  <button onClick={() => updateEntry(entry.id, { status: entry.status === 'posted' ? 'draft' : 'posted' })} style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    border: `1px solid ${entry.status === 'posted' ? 'rgba(76,175,132,0.35)' : 'rgba(240,236,228,0.16)'}`,
                    background: entry.status === 'posted' ? 'rgba(76,175,132,0.12)' : 'transparent',
                    color: entry.status === 'posted' ? '#4caf84' : 'rgba(240,236,228,0.62)',
                    borderRadius: 20,
                    padding: '5px 10px',
                    cursor: 'pointer',
                    fontSize: 12,
                    fontWeight: 700,
                  }}>
                    {entry.status === 'posted' ? <Check size={13} /> : null}
                    {entry.status === 'posted' ? 'Posted' : 'Draft'}
                  </button>
                </div>

                <textarea value={entry.caption} onChange={(event) => updateEntry(entry.id, { caption: event.target.value })} placeholder="Caption or posting notes" rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />

                <label style={{ ...secondaryButton, width: '100%', justifyContent: 'center', marginBottom: 10 }}>
                  <ImagePlus size={15} />
                  Upload photo or video
                  <input type="file" accept="image/*,video/*" multiple onChange={(event) => handleFiles(entry.id, event.target.files)} style={{ display: 'none' }} />
                </label>

                {entry.assets.length > 0 ? (
                  <div style={{ display: 'grid', gap: 8 }}>
                    {entry.assets.map(asset => (
                      <div key={asset.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(12,11,9,0.35)', borderRadius: 6, padding: 8 }}>
                        <FileText size={15} color="rgba(240,236,228,0.5)" />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{asset.name}</div>
                          <div style={{ fontSize: 11, color: 'rgba(240,236,228,0.38)' }}>{Math.max(1, Math.round(asset.size / 1024))} KB</div>
                        </div>
                        <a href={asset.dataUrl} download={asset.name} title="Download media asset" style={iconLink}>
                          <Download size={14} />
                        </a>
                        <button aria-label="Remove media asset" onClick={() => removeAsset(entry.id, asset.id)} style={iconButton}>
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}

                <button onClick={() => removeEntry(entry.id)} style={{ ...dangerButton, marginTop: 12 }}>
                  <Trash2 size={14} />
                  Remove item
                </button>
              </article>
            ))}
          </div>
        </aside>
      </div>

      <section style={{ marginTop: 24, ...panel, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Content planner</h2>
            <p style={{ color: 'rgba(240,236,228,0.5)', fontSize: 13, marginTop: 2 }}>Dates, times, in person video content briefs, and content briefs.</p>
          </div>
          <button onClick={addBrief} style={primaryButton}>
            <Plus size={14} />
            Add brief
          </button>
        </div>

        {briefs.length === 0 ? (
          <div style={{ border: '1px dashed rgba(240,236,228,0.16)', borderRadius: 8, padding: 28, color: 'rgba(240,236,228,0.42)', fontSize: 13, textAlign: 'center' }}>
            Add your first content brief with a date and time.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 860 }}>
              <thead>
                <tr>
                  {['Date', 'Time', 'Brief type', 'Title', 'Brief notes', ''].map(head => (
                    <th key={head} style={{ textAlign: 'left', color: 'rgba(240,236,228,0.42)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', fontWeight: 800, padding: '0 8px 10px' }}>{head}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sortedBriefs.map(brief => (
                  <tr key={brief.id} style={{ borderTop: '1px solid rgba(240,236,228,0.08)' }}>
                    <td style={{ padding: 8, width: 150 }}>
                      <input type="date" value={brief.date} onChange={(event) => updateBrief(brief.id, { date: event.target.value })} style={inputStyle} />
                    </td>
                    <td style={{ padding: 8, width: 120 }}>
                      <input type="time" value={brief.time} onChange={(event) => updateBrief(brief.id, { time: event.target.value })} style={inputStyle} />
                    </td>
                    <td style={{ padding: 8, width: 230 }}>
                      <select value={brief.kind} onChange={(event) => updateBrief(brief.id, { kind: event.target.value as BriefKind })} style={inputStyle}>
                        {briefKinds.map(kind => <option key={kind} value={kind}>{kind}</option>)}
                      </select>
                    </td>
                    <td style={{ padding: 8, width: 180 }}>
                      <input value={brief.title} onChange={(event) => updateBrief(brief.id, { title: event.target.value })} placeholder="Shoot or brief title" style={inputStyle} />
                    </td>
                    <td style={{ padding: 8 }}>
                      <input value={brief.notes} onChange={(event) => updateBrief(brief.id, { notes: event.target.value })} placeholder="Key shots, copy angles, locations, hooks" style={inputStyle} />
                    </td>
                    <td style={{ padding: 8, width: 46 }}>
                      <button aria-label="Remove brief" onClick={() => removeBrief(brief.id)} style={iconButton}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section style={{ marginTop: 24, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
        {platforms.map(platform => {
          const platformEntries = entries.filter(entry => entry.platform === platform.id)
          const drafts = platformEntries.filter(entry => entry.status === 'draft').length
          const posted = platformEntries.filter(entry => entry.status === 'posted').length
          return (
            <div key={platform.id} style={{ ...panel, padding: 18 }}>
              <div style={{ color: platformColor[platform.id], fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{platform.label}</div>
              <div style={{ display: 'flex', gap: 18, marginTop: 12, color: 'rgba(240,236,228,0.62)', fontSize: 13 }}>
                <span>{platformEntries.length} planned</span>
                <span>{drafts} draft</span>
                <span>{posted} posted</span>
              </div>
            </div>
          )
        })}
      </section>

      {upcomingEntries.length > 0 ? (
        <section style={{ marginTop: 24, ...panel, padding: 20 }}>
          <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 12 }}>{platformLabel(activePlatform)} queue</h2>
          <div style={{ display: 'grid', gap: 8 }}>
            {upcomingEntries.map(entry => (
              <div key={entry.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 14, padding: '10px 0', borderTop: '1px solid rgba(240,236,228,0.08)' }}>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 800 }}>{entryLabel(entry)}</div>
                  <div style={{ fontSize: 12, color: 'rgba(240,236,228,0.42)', marginTop: 2 }}>{format(new Date(`${entry.date}T12:00:00`), 'EEE, d MMM')} · {entry.assets.length} asset{entry.assets.length === 1 ? '' : 's'}</div>
                </div>
                <span style={{ color: entry.status === 'posted' ? '#4caf84' : 'rgba(240,236,228,0.5)', fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em' }}>{entry.status}</span>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  )
}

const iconButton = {
  width: 32,
  height: 32,
  borderRadius: 6,
  border: '1px solid rgba(240,236,228,0.12)',
  background: 'rgba(240,236,228,0.04)',
  color: '#f0ece4',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
}

const iconLink = {
  ...iconButton,
  color: '#d4b896',
  textDecoration: 'none',
}

const primaryButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: 'none',
  background: '#b8956a',
  color: '#0c0b09',
  borderRadius: 6,
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: "'Barlow', sans-serif",
}

const secondaryButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid rgba(184,149,106,0.35)',
  background: 'rgba(184,149,106,0.08)',
  color: '#d4b896',
  borderRadius: 6,
  padding: '9px 12px',
  fontSize: 13,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: "'Barlow', sans-serif",
}

const dangerButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid rgba(230,104,92,0.25)',
  background: 'transparent',
  color: '#e6685c',
  borderRadius: 6,
  padding: '8px 10px',
  fontSize: 12,
  fontWeight: 800,
  cursor: 'pointer',
  fontFamily: "'Barlow', sans-serif",
}
