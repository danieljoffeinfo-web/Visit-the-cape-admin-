'use client'

import { useEffect, useMemo, useState } from 'react'
import { addDays, format, isWithinInterval, parseISO } from 'date-fns'
import { toast } from 'sonner'
import {
  buildSeatsLabel,
  isFleetVehicle,
  vehicleCalendarLabel,
  vehicleRegistration,
  vehicleSeats,
  vehicleNotes,
  type FleetServiceBlock,
} from '@/lib/fleet'

type VehicleRow = {
  id: string
  title: string
  family: string
  summary?: string | null
  duration_label?: string | null
  pickup_notes?: string | null
  base_price?: number | null
  active?: boolean | null
  imageUrl?: string | null
  calendarLabel?: string | null
  calendarColor?: string | null
  serviceBlocks?: FleetServiceBlock[]
}

const CALENDAR_COLORS = ['#b8956a', '#4caf84', '#6495ed', '#ef5350', '#8e6ad8', '#00bcd4', '#ff7043', '#f4c542']

function vehicleStatus(vehicle: VehicleRow, today = new Date()) {
  const inService = (vehicle.serviceBlocks || []).some((block) => {
    const start = parseISO(block.startDate)
    const end = parseISO(block.endDate)
    return isWithinInterval(today, { start, end })
  })
  if (inService) return { label: 'In service', color: '#ef5350' }
  return { label: 'Available', color: '#4caf84' }
}

export function FleetPanel({ onNavigate }: { onNavigate: (panel: string) => void }) {
  const [vehicles, setVehicles] = useState<VehicleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [savingVehicle, setSavingVehicle] = useState(false)
  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [vehicleForm, setVehicleForm] = useState({
    title: '',
    registrationNumber: '',
    seats: '7',
    defaultRate: '',
    notes: '',
    imageUrl: '',
    calendarLabel: '',
    calendarColor: CALENDAR_COLORS[0],
  })
  const [editingVehicleId, setEditingVehicleId] = useState<string | null>(null)
  const [editingVehicleForm, setEditingVehicleForm] = useState({
    title: '',
    registrationNumber: '',
    seats: '1',
    defaultRate: '',
    notes: '',
    imageUrl: '',
    calendarLabel: '',
    calendarColor: CALENDAR_COLORS[0],
  })
  const [serviceForm, setServiceForm] = useState({ startDate: format(new Date(), 'yyyy-MM-dd'), endDate: format(addDays(new Date(), 2), 'yyyy-MM-dd'), notes: '' })
  const [savingVehicleEdit, setSavingVehicleEdit] = useState(false)
  const [schedulingServiceFor, setSchedulingServiceFor] = useState<string | null>(null)
  const [savingService, setSavingService] = useState(false)

  useEffect(() => {
    loadFleet()
  }, [])

  async function loadFleet() {
    setLoading(true)
    try {
      const response = await fetch('/api/fleet/vehicles', { cache: 'no-store' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to load vehicles')
      setVehicles(((result.vehicles || []) as VehicleRow[]).filter(isFleetVehicle))
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load fleet dashboard')
    } finally {
      setLoading(false)
    }
  }

  const stats = useMemo(() => {
    const today = new Date()
    const inService = vehicles.filter((vehicle) => vehicleStatus(vehicle, today).label === 'In service').length
    return {
      vehicles: vehicles.length,
      inService,
      available: vehicles.length - inService,
    }
  }, [vehicles])

  function startVehicleEdit(vehicle: VehicleRow) {
    setEditingVehicleId(vehicle.id)
    setSchedulingServiceFor(null)
    setEditingVehicleForm({
      title: vehicle.title,
      registrationNumber: vehicleRegistration(vehicle),
      seats: String(vehicleSeats(vehicle) || 1),
      defaultRate: vehicle.base_price === null || vehicle.base_price === undefined ? '' : String(Number(vehicle.base_price)),
      notes: vehicleNotes(vehicle),
      imageUrl: vehicle.imageUrl || '',
      calendarLabel: vehicle.calendarLabel || '',
      calendarColor: vehicle.calendarColor || CALENDAR_COLORS[0],
    })
    setServiceForm({
      startDate: format(new Date(), 'yyyy-MM-dd'),
      endDate: format(addDays(new Date(), 2), 'yyyy-MM-dd'),
      notes: '',
    })
  }

  function cancelVehicleEdit() {
    setEditingVehicleId(null)
    setSchedulingServiceFor(null)
  }

  async function saveVehicleEdit() {
    if (!editingVehicleId) return
    setSavingVehicleEdit(true)
    try {
      const response = await fetch('/api/fleet/vehicles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: editingVehicleId,
          ...editingVehicleForm,
          seats: Number(editingVehicleForm.seats),
          defaultRate: editingVehicleForm.defaultRate ? Number(editingVehicleForm.defaultRate) : null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to update vehicle')
      toast.success('Vehicle updated')
      cancelVehicleEdit()
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to update vehicle')
    } finally {
      setSavingVehicleEdit(false)
    }
  }

  async function saveVehicle() {
    if (!vehicleForm.title.trim() || !vehicleForm.registrationNumber.trim() || !vehicleForm.seats.trim()) {
      toast.error('Add the vehicle name, registration number, and seats')
      return
    }
    setSavingVehicle(true)
    try {
      const response = await fetch('/api/fleet/vehicles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...vehicleForm,
          seats: Number(vehicleForm.seats),
          defaultRate: vehicleForm.defaultRate ? Number(vehicleForm.defaultRate) : null,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to save vehicle')
      toast.success('Vehicle added')
      setVehicleForm({ title: '', registrationNumber: '', seats: '7', defaultRate: '', notes: '', imageUrl: '', calendarLabel: '', calendarColor: CALENDAR_COLORS[0] })
      setShowVehicleForm(false)
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to save vehicle')
    } finally {
      setSavingVehicle(false)
    }
  }

  async function scheduleService(vehicleId: string) {
    if (!serviceForm.startDate || !serviceForm.endDate) {
      toast.error('Choose service dates')
      return
    }
    setSavingService(true)
    try {
      const response = await fetch('/api/fleet/vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: vehicleId,
          action: 'add-service',
          ...serviceForm,
        }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to schedule service')
      toast.success('Service scheduled')
      setSchedulingServiceFor(null)
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to schedule service')
    } finally {
      setSavingService(false)
    }
  }

  async function removeServiceBlock(vehicleId: string, blockId: string) {
    if (!confirm('Remove this service block?')) return
    try {
      const response = await fetch('/api/fleet/vehicles', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vehicleId, action: 'remove-service', blockId }),
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Failed to remove service block')
      toast.success('Service block removed')
      loadFleet()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to remove service block')
    }
  }

  const card = { background: '#1a1815', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, padding: '20px 24px' }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 28, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Fleet Manager</h1>
          <p style={{ color: 'rgba(240,236,228,0.55)', fontSize: 13, marginTop: 2 }}>Vehicle dashboard — photos, labels, and service scheduling for the calendar.</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={() => setShowVehicleForm((v) => !v)} style={primaryButton}>+ Add Vehicle</button>
          <button onClick={() => onNavigate('calendar')} style={secondaryButton}>Open Calendar</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
        {[
          { label: 'Vehicles', value: stats.vehicles, sub: 'In your fleet' },
          { label: 'Available', value: stats.available, sub: 'Ready to use' },
          { label: 'In Service', value: stats.inService, sub: 'Currently off-road' },
        ].map((item) => (
          <div key={item.label} style={card}>
            <div style={{ fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(240,236,228,0.45)', marginBottom: 8 }}>{item.label}</div>
            <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 26, color: '#f0ece4' }}>{loading ? '—' : item.value}</div>
            <div style={{ color: 'rgba(240,236,228,0.4)', fontSize: 12, marginTop: 6 }}>{item.sub}</div>
          </div>
        ))}
      </div>

      {showVehicleForm && (
        <div style={{ ...card, display: 'grid', gap: 14 }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase' }}>Add Vehicle</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <Input label="Vehicle name" value={vehicleForm.title} onChange={(value) => setVehicleForm((c) => ({ ...c, title: value }))} placeholder="Mercedes V-Class" />
            <Input label="Registration" value={vehicleForm.registrationNumber} onChange={(value) => setVehicleForm((c) => ({ ...c, registrationNumber: value }))} placeholder="CA 123 456" />
            <Input label="Seats" type="number" value={vehicleForm.seats} onChange={(value) => setVehicleForm((c) => ({ ...c, seats: value }))} placeholder="7" />
            <Input label="Calendar label" value={vehicleForm.calendarLabel} onChange={(value) => setVehicleForm((c) => ({ ...c, calendarLabel: value }))} placeholder="V-Class 1" />
            <Input label="Image URL" value={vehicleForm.imageUrl} onChange={(value) => setVehicleForm((c) => ({ ...c, imageUrl: value }))} placeholder="https://..." />
            <ColorPicker label="Calendar colour" value={vehicleForm.calendarColor} onChange={(value) => setVehicleForm((c) => ({ ...c, calendarColor: value }))} />
          </div>
          <TextArea label="Notes" value={vehicleForm.notes} onChange={(value) => setVehicleForm((c) => ({ ...c, notes: value }))} placeholder="Colour, class, driver notes" />
          <div style={{ display: 'flex', gap: 10 }}>
            <button onClick={saveVehicle} disabled={savingVehicle} style={primaryButton}>{savingVehicle ? 'Saving…' : 'Save Vehicle'}</button>
            <button onClick={() => setShowVehicleForm(false)} style={secondaryButton}>Cancel</button>
          </div>
        </div>
      )}

      <div style={card}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, letterSpacing: '0.04em', textTransform: 'uppercase', marginBottom: 16 }}>Vehicles</div>
        {loading ? (
          <div style={{ color: 'rgba(240,236,228,0.4)' }}>Loading vehicles…</div>
        ) : vehicles.length === 0 ? (
          <div style={{ color: 'rgba(240,236,228,0.4)', padding: 24, textAlign: 'center' }}>No vehicles yet. Add your first vehicle above.</div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
            {vehicles.map((vehicle) => {
              const status = vehicleStatus(vehicle)
              const isEditing = editingVehicleId === vehicle.id
              const label = vehicleCalendarLabel(vehicle)
              const color = vehicle.calendarColor || CALENDAR_COLORS[0]

              return (
                <div key={vehicle.id} style={{ borderRadius: 12, border: `1px solid ${color}33`, background: 'rgba(240,236,228,0.02)', overflow: 'hidden' }}>
                  <div style={{ height: 160, background: vehicle.imageUrl ? `url(${vehicle.imageUrl}) center/cover no-repeat` : `linear-gradient(135deg, ${color}22, rgba(26,24,21,0.95))`, position: 'relative' }}>
                    {!vehicle.imageUrl && (
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(240,236,228,0.35)', fontSize: 13 }}>No photo</div>
                    )}
                    <div style={{ position: 'absolute', top: 12, left: 12, padding: '4px 10px', borderRadius: 999, background: `${color}33`, border: `1px solid ${color}66`, color: '#f0ece4', fontSize: 12, fontWeight: 700 }}>{label}</div>
                    <div style={{ position: 'absolute', top: 12, right: 12, padding: '4px 10px', borderRadius: 999, background: 'rgba(12,11,9,0.72)', color: status.color, fontSize: 11, fontWeight: 700 }}>{status.label}</div>
                  </div>
                  <div style={{ padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 20 }}>{vehicle.title}</div>
                        <div style={mutedSmall}>{vehicleRegistration(vehicle) || 'No registration'} · {buildSeatsLabel(vehicleSeats(vehicle) || 0)}</div>
                      </div>
                      <button type="button" onClick={() => isEditing ? cancelVehicleEdit() : startVehicleEdit(vehicle)} style={secondaryButton}>{isEditing ? 'Close' : 'Edit'}</button>
                    </div>

                    {(vehicle.serviceBlocks || []).length > 0 && (
                      <div style={{ marginTop: 12, display: 'grid', gap: 6 }}>
                        {(vehicle.serviceBlocks || []).slice(0, 2).map((block) => (
                          <div key={block.id} style={{ fontSize: 12, color: 'rgba(240,236,228,0.55)', padding: '6px 8px', borderRadius: 6, background: 'rgba(239,83,80,0.08)' }}>
                            Service: {format(parseISO(block.startDate), 'd MMM')} → {format(parseISO(block.endDate), 'd MMM yyyy')}
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                      <button type="button" onClick={() => setSchedulingServiceFor(schedulingServiceFor === vehicle.id ? null : vehicle.id)} style={secondaryButton}>Schedule Service</button>
                    </div>

                    {schedulingServiceFor === vehicle.id && !isEditing && (
                      <div style={{ ...pickerCard, marginTop: 12 }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                          <Input label="Start" type="date" value={serviceForm.startDate} onChange={(value) => setServiceForm((c) => ({ ...c, startDate: value }))} />
                          <Input label="End" type="date" value={serviceForm.endDate} onChange={(value) => setServiceForm((c) => ({ ...c, endDate: value }))} />
                        </div>
                        <Input label="Notes" value={serviceForm.notes} onChange={(value) => setServiceForm((c) => ({ ...c, notes: value }))} placeholder="Annual service, tyres, etc." />
                        <button type="button" onClick={() => scheduleService(vehicle.id)} disabled={savingService} style={primaryButton}>{savingService ? 'Saving…' : 'Save Service Block'}</button>
                      </div>
                    )}

                    {isEditing && (
                      <div style={{ ...pickerCard, marginTop: 16 }}>
                        <Input label="Vehicle name" value={editingVehicleForm.title} onChange={(value) => setEditingVehicleForm((c) => ({ ...c, title: value }))} />
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                          <Input label="Registration" value={editingVehicleForm.registrationNumber} onChange={(value) => setEditingVehicleForm((c) => ({ ...c, registrationNumber: value }))} />
                          <Input label="Seats" type="number" value={editingVehicleForm.seats} onChange={(value) => setEditingVehicleForm((c) => ({ ...c, seats: value }))} />
                        </div>
                        <Input label="Calendar label" value={editingVehicleForm.calendarLabel} onChange={(value) => setEditingVehicleForm((c) => ({ ...c, calendarLabel: value }))} placeholder="Short name shown on calendar" />
                        <Input label="Image URL" value={editingVehicleForm.imageUrl} onChange={(value) => setEditingVehicleForm((c) => ({ ...c, imageUrl: value }))} placeholder="https://..." />
                        <ColorPicker label="Calendar colour" value={editingVehicleForm.calendarColor} onChange={(value) => setEditingVehicleForm((c) => ({ ...c, calendarColor: value }))} />
                        <TextArea label="Notes" value={editingVehicleForm.notes} onChange={(value) => setEditingVehicleForm((c) => ({ ...c, notes: value }))} />
                        {(vehicle.serviceBlocks || []).length > 0 && (
                          <div>
                            <div style={fieldLabel}>Scheduled service</div>
                            <div style={{ display: 'grid', gap: 8, marginTop: 8 }}>
                              {(vehicle.serviceBlocks || []).map((block) => (
                                <div key={block.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center', fontSize: 12, color: 'rgba(240,236,228,0.62)' }}>
                                  <span>{format(parseISO(block.startDate), 'd MMM yyyy')} → {format(parseISO(block.endDate), 'd MMM yyyy')}{block.notes ? ` · ${block.notes}` : ''}</span>
                                  <button type="button" onClick={() => removeServiceBlock(vehicle.id, block.id)} style={{ ...dangerButton, padding: '4px 8px', fontSize: 11 }}>Remove</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: 10 }}>
                          <button type="button" onClick={saveVehicleEdit} disabled={savingVehicleEdit} style={primaryButton}>{savingVehicleEdit ? 'Saving…' : 'Save changes'}</button>
                          <button type="button" onClick={cancelVehicleEdit} style={secondaryButton}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

function Input({ label, value, onChange, placeholder, type = 'text' }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; type?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <input type={type} value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} style={fieldInput} />
    </label>
  )
}

function TextArea({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <textarea value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} rows={3} style={{ ...fieldInput, resize: 'vertical', minHeight: 86 }} />
    </label>
  )
}

function ColorPicker({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {CALENDAR_COLORS.map((color) => (
          <button
            key={color}
            type="button"
            onClick={() => onChange(color)}
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              border: value === color ? '2px solid #f0ece4' : '2px solid transparent',
              background: color,
              cursor: 'pointer',
            }}
          />
        ))}
        <input type="color" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 36, height: 28, border: 'none', background: 'transparent', cursor: 'pointer' }} />
      </div>
    </label>
  )
}

const fieldLabel = { fontSize: 11, letterSpacing: '0.12em', textTransform: 'uppercase' as const, color: 'rgba(240,236,228,0.45)' }
const fieldInput = { background: '#100f0d', border: '1px solid rgba(240,236,228,0.12)', borderRadius: 8, color: '#f0ece4', padding: '10px 12px', fontSize: 14, outline: 'none' }
const primaryButton = { padding: '10px 16px', borderRadius: 6, background: '#b8956a', color: '#0c0b09', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 14, fontFamily: "'Barlow', sans-serif" }
const secondaryButton = { padding: '9px 14px', borderRadius: 6, background: 'transparent', color: '#d7bc94', border: '1px solid rgba(184,149,106,0.30)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: "'Barlow', sans-serif" }
const dangerButton = { padding: '9px 14px', borderRadius: 6, background: 'rgba(239,83,80,0.10)', color: '#f2b5b3', border: '1px solid rgba(239,83,80,0.25)', cursor: 'pointer', fontWeight: 700, fontSize: 13, fontFamily: "'Barlow', sans-serif" }
const mutedSmall = { fontSize: 12, color: 'rgba(240,236,228,0.45)', marginTop: 4 }
const pickerCard = { display: 'grid', gap: 10, borderRadius: 8, border: '1px solid rgba(240,236,228,0.10)', background: 'rgba(240,236,228,0.02)', padding: 12 }
