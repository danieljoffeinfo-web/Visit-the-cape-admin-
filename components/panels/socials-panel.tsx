'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { addMonths, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameMonth, startOfMonth, startOfWeek, subMonths } from 'date-fns'
import { Bold, Check, ChevronLeft, ChevronRight, Download, FileText, ImagePlus, Plus, Save, Table2, Trash2, Underline, X } from 'lucide-react'

type Platform = 'instagram' | 'tiktok' | 'facebook'
type PostKind = 'post' | 'story'
type PublishStatus = 'draft' | 'posted'
type BriefKind = 'Camera shoot' | 'Content brief'

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
  documentHtml: string
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

const briefKinds: BriefKind[] = ['Camera shoot', 'Content brief']

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

function entryDescription(entry: SocialEntry) {
  return entry.caption.trim() || `Add description for this ${entry.kind}`
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

function escapeHtml(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function normalizeBrief(brief: ContentBrief): ContentBrief {
  const legacyKind = brief.kind as string
  const kind: BriefKind = legacyKind === 'In person video content briefs'
    ? 'Camera shoot'
    : legacyKind === 'Content briefs'
      ? 'Content brief'
      : brief.kind

  return {
    ...brief,
    kind,
    documentHtml: brief.documentHtml || '',
  }
}

export function SocialsPanel() {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [activePlatform, setActivePlatform] = useState<Platform>('instagram')
  const [month, setMonth] = useState(startOfMonth(new Date()))
  const [selectedDate, setSelectedDate] = useState(today)
  const [selectedDayOpen, setSelectedDayOpen] = useState(true)
  const [entries, setEntries] = useState<SocialEntry[]>(() => readStored<SocialEntry[]>(STORAGE_KEY, []))
  const [briefs, setBriefs] = useState<ContentBrief[]>(() => readStored<ContentBrief[]>(BRIEFS_KEY, []).map(normalizeBrief))
  const [openBriefId, setOpenBriefId] = useState<string | null>(null)
  const editorRef = useRef<HTMLDivElement | null>(null)

  const openBrief = briefs.find(brief => brief.id === openBriefId)

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

  function completeEntry(id: string) {
    updateEntry(id, { status: 'posted' })
    setSelectedDayOpen(false)
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
        kind: 'Camera shoot',
        title: '',
        notes: '',
        documentHtml: '',
      },
    ])
  }

  function updateBrief(id: string, patch: Partial<ContentBrief>) {
    setBriefs(current => current.map(brief => brief.id === id ? { ...brief, ...patch } : brief))
  }

  function removeBrief(id: string) {
    setBriefs(current => current.filter(brief => brief.id !== id))
    if (openBriefId === id) setOpenBriefId(null)
  }

  function getBriefDocument(brief: ContentBrief) {
    return brief.documentHtml || (brief.notes ? `<p>${escapeHtml(brief.notes)}</p>` : '')
  }

  function openBriefDocument(id: string) {
    setOpenBriefId(id)
    window.setTimeout(() => editorRef.current?.focus(), 0)
  }

  function runEditorCommand(command: string, value?: string) {
    editorRef.current?.focus()
    document.execCommand(command, false, value)
  }

  function insertTable() {
    editorRef.current?.focus()
    document.execCommand('insertHTML', false, '<table><tbody><tr><td>Topic</td><td>Notes</td></tr><tr><td></td><td></td></tr></tbody></table><p></p>')
  }

  function saveBriefDocument() {
    if (!openBriefId || !editorRef.current) return
    const html = editorRef.current.innerHTML
    updateBrief(openBriefId, {
      documentHtml: html,
      notes: editorRef.current.textContent?.trim() || '',
    })
    setOpenBriefId(null)
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

      <div style={{ display: 'grid', gridTemplateColumns: selectedDayOpen ? 'minmax(0, 1.45fr) minmax(320px, 0.9fr)' : 'minmax(0, 1fr)', gap: 20, alignItems: 'start' }}>
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

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(104px, 1fr))', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day} style={{ color: 'rgba(240,236,228,0.42)', fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', padding: '0 4px 6px' }}>{day}</div>
            ))}
            {calendarDays.map(day => {
              const dateKey = format(day, 'yyyy-MM-dd')
              const dayEntries = filteredEntries.filter(entry => entry.date === dateKey)
              const selected = dateKey === selectedDate
              return (
                <button key={dateKey} onClick={() => {
                  setSelectedDate(dateKey)
                  setSelectedDayOpen(true)
                }} style={{
                  minHeight: 122,
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
                  <span style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontWeight: 800, fontSize: 13 }}>{format(day, 'd')}</span>
                    {dayEntries.length > 0 ? (
                      <span style={{
                        color: selected ? '#d4b896' : 'rgba(240,236,228,0.5)',
                        fontSize: 10,
                        fontWeight: 800,
                        textTransform: 'uppercase',
                        letterSpacing: '0.08em',
                      }}>
                        {dayEntries.length}
                      </span>
                    ) : null}
                  </span>
                  <span style={{ display: 'grid', gap: 4, minWidth: 0 }}>
                    {dayEntries.slice(0, 3).map(entry => (
                      <span key={entry.id} title={`${entryLabel(entry)}: ${entryDescription(entry)}`} style={{
                        display: 'grid',
                        gridTemplateColumns: 'auto minmax(0, 1fr)',
                        gap: 6,
                        alignItems: 'center',
                        minWidth: 0,
                        borderRadius: 5,
                        background: entry.status === 'posted' ? 'rgba(76,175,132,0.13)' : 'rgba(12,11,9,0.36)',
                        border: `1px solid ${entry.status === 'posted' ? 'rgba(76,175,132,0.22)' : 'rgba(240,236,228,0.08)'}`,
                        padding: '5px 6px',
                      }}>
                        <span style={{
                          width: 6,
                          height: 24,
                          borderRadius: 999,
                          background: entry.status === 'posted' ? '#4caf84' : platformColor[entry.platform],
                        }} />
                        <span style={{ minWidth: 0 }}>
                          <span style={{
                            display: 'block',
                            color: entry.status === 'posted' ? '#7dd1a6' : platformColor[entry.platform],
                            fontSize: 10,
                            fontWeight: 900,
                            lineHeight: 1,
                            textTransform: 'uppercase',
                            letterSpacing: '0.06em',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {entry.kind} {entry.status === 'posted' ? 'done' : 'draft'}
                          </span>
                          <span style={{
                            display: 'block',
                            marginTop: 3,
                            color: entry.caption.trim() ? 'rgba(240,236,228,0.76)' : 'rgba(240,236,228,0.36)',
                            fontSize: 11,
                            fontWeight: 700,
                            lineHeight: 1.15,
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                          }}>
                            {entryDescription(entry)}
                          </span>
                        </span>
                      </span>
                    ))}
                    {dayEntries.length > 3 ? (
                      <span style={{ fontSize: 10, color: 'rgba(240,236,228,0.45)', fontWeight: 700 }}>+{dayEntries.length - 3} more item{dayEntries.length - 3 === 1 ? '' : 's'}</span>
                    ) : null}
                  </span>
                </button>
              )
            })}
          </div>
        </section>

        {selectedDayOpen ? (
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

                <textarea value={entry.caption} onChange={(event) => updateEntry(entry.id, { caption: event.target.value })} placeholder="Description shown on the calendar" rows={3} style={{ ...inputStyle, resize: 'vertical', marginBottom: 12 }} />

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

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 12 }}>
                  <button onClick={() => removeEntry(entry.id)} style={dangerButton}>
                    <Trash2 size={14} />
                    Remove item
                  </button>
                  <button onClick={() => completeEntry(entry.id)} style={{
                    ...doneButton,
                    background: entry.status === 'posted' ? 'rgba(76,175,132,0.16)' : '#4caf84',
                    color: entry.status === 'posted' ? '#4caf84' : '#07110c',
                    border: entry.status === 'posted' ? '1px solid rgba(76,175,132,0.35)' : '1px solid rgba(76,175,132,0.65)',
                  }}>
                    <Check size={14} />
                    Done
                  </button>
                </div>
              </article>
            ))}
          </div>
        </aside>
        ) : null}
      </div>

      <section style={{ marginTop: 24, ...panel, padding: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, marginBottom: 16 }}>
          <div>
            <h2 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Content planner</h2>
            <p style={{ color: 'rgba(240,236,228,0.5)', fontSize: 13, marginTop: 2 }}>Dates, times, camera shoots, and content documents.</p>
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
                  {['Date', 'Time', 'Content type', 'Title', 'Document', ''].map(head => (
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
                    <td style={{ padding: 8, width: 210 }}>
                      <button onClick={() => openBriefDocument(brief.id)} style={{ ...secondaryButton, width: '100%', justifyContent: 'center' }}>
                        <FileText size={14} />
                        {brief.notes ? 'View document' : 'Add document'}
                      </button>
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

      {openBrief ? (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 50,
          background: 'rgba(12,11,9,0.94)',
          padding: 24,
          overflowY: 'auto',
        }}>
          <div style={{
            maxWidth: 980,
            minHeight: 'calc(100vh - 48px)',
            margin: '0 auto',
            background: '#1a1815',
            border: '1px solid rgba(240,236,228,0.12)',
            borderRadius: 8,
            boxShadow: '0 24px 70px rgba(0,0,0,0.48)',
            display: 'flex',
            flexDirection: 'column',
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 16,
              padding: '18px 20px',
              borderBottom: '1px solid rgba(240,236,228,0.1)',
            }}>
              <div>
                <div style={{ color: 'rgba(240,236,228,0.42)', fontSize: 11, fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
                  {openBrief.kind} · {format(new Date(`${openBrief.date}T12:00:00`), 'd MMM yyyy')} · {openBrief.time}
                </div>
                <h3 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 24, letterSpacing: '0.04em', textTransform: 'uppercase', marginTop: 4 }}>
                  {openBrief.title || 'Untitled content document'}
                </h3>
              </div>
              <button aria-label="Close document" onClick={() => setOpenBriefId(null)} style={iconButton}>
                <X size={16} />
              </button>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '12px 20px',
              borderBottom: '1px solid rgba(240,236,228,0.08)',
              flexWrap: 'wrap',
            }}>
              <button title="Bold" onClick={() => runEditorCommand('bold')} style={iconButton}>
                <Bold size={15} />
              </button>
              <button title="Underline" onClick={() => runEditorCommand('underline')} style={iconButton}>
                <Underline size={15} />
              </button>
              <label title="Text colour" style={{ ...iconButton, width: 42 }}>
                <input type="color" defaultValue="#d4b896" onChange={(event) => runEditorCommand('foreColor', event.target.value)} style={{ width: 24, height: 24, border: 'none', padding: 0, background: 'transparent', cursor: 'pointer' }} />
              </label>
              <button onClick={insertTable} style={{ ...secondaryButton, padding: '8px 10px' }}>
                <Table2 size={15} />
                Table
              </button>
            </div>

            <div style={{ padding: 20, flex: 1 }}>
              <div
                ref={editorRef}
                className="socials-document-editor"
                contentEditable
                suppressContentEditableWarning
                dangerouslySetInnerHTML={{ __html: getBriefDocument(openBrief) }}
                style={{
                  minHeight: 'calc(100vh - 245px)',
                  background: '#f0ece4',
                  color: '#1a1815',
                  borderRadius: 6,
                  padding: '34px 38px 92px',
                  fontFamily: "'Barlow', sans-serif",
                  fontSize: 16,
                  lineHeight: 1.55,
                  outline: 'none',
                  boxShadow: 'inset 0 0 0 1px rgba(12,11,9,0.08)',
                }}
              />
            </div>

            <div style={{
              position: 'sticky',
              bottom: 0,
              display: 'flex',
              justifyContent: 'flex-end',
              padding: '14px 20px',
              background: 'rgba(26,24,21,0.96)',
              borderTop: '1px solid rgba(240,236,228,0.1)',
              borderBottomLeftRadius: 8,
              borderBottomRightRadius: 8,
            }}>
              <button onClick={saveBriefDocument} style={primaryButton}>
                <Save size={14} />
                Save
              </button>
            </div>
          </div>
        </div>
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

const doneButton = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  borderRadius: 6,
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 900,
  cursor: 'pointer',
  fontFamily: "'Barlow', sans-serif",
  textTransform: 'uppercase' as const,
  letterSpacing: '0.06em',
}
