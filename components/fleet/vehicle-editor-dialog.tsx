'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { VehicleImageHero } from '@/components/fleet/vehicle-image-hero'
import { uploadFleetVehicleImage } from '@/components/fleet/vehicle-image-upload'
import type { FleetVehicleCardData } from '@/components/fleet/vehicle-card'
import { dangerButton, fieldLabel, inputStyle, primaryButton, secondaryButton, sectionTitle, theme } from '@/lib/theme'
import { vehicleNotes, vehicleRegistration, vehicleSeats } from '@/lib/fleet'

export type VehicleFormValues = {
  title: string
  registrationNumber: string
  seats: string
  defaultRate: string
  notes: string
}

type VehicleEditorDialogProps = {
  open: boolean
  mode: 'add' | 'edit'
  vehicle?: FleetVehicleCardData | null
  saving?: boolean
  deleting?: boolean
  onClose: () => void
  onSave: (values: VehicleFormValues, imageFile: File | null) => Promise<void>
  onDelete?: () => Promise<void>
}

const emptyForm: VehicleFormValues = {
  title: '',
  registrationNumber: '',
  seats: '7',
  defaultRate: '',
  notes: '',
}

export function VehicleEditorDialog({
  open,
  mode,
  vehicle,
  saving,
  deleting,
  onClose,
  onSave,
  onDelete,
}: VehicleEditorDialogProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [form, setForm] = useState<VehicleFormValues>(emptyForm)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [uploadingImage, setUploadingImage] = useState(false)
  const [localImageUrl, setLocalImageUrl] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    if (mode === 'edit' && vehicle) {
      setForm({
        title: vehicle.title,
        registrationNumber: vehicleRegistration(vehicle),
        seats: String(vehicleSeats(vehicle) || 1),
        defaultRate: vehicle.base_price === null || vehicle.base_price === undefined ? '' : String(Number(vehicle.base_price)),
        notes: vehicleNotes(vehicle),
      })
      setLocalImageUrl(vehicle.image_url || null)
    } else {
      setForm(emptyForm)
      setLocalImageUrl(null)
    }
    setImageFile(null)
    setImagePreview(null)
  }, [open, mode, vehicle])

  useEffect(() => {
    return () => {
      if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    }
  }, [imagePreview])

  if (!open) return null

  const displayImage = imagePreview || localImageUrl

  async function handleImagePick(file: File) {
    if (imagePreview?.startsWith('blob:')) URL.revokeObjectURL(imagePreview)
    setImageFile(file)
    setImagePreview(URL.createObjectURL(file))

    if (mode === 'edit' && vehicle?.id) {
      setUploadingImage(true)
      try {
        const url = await uploadFleetVehicleImage(vehicle.id, file)
        setLocalImageUrl(url)
        setImageFile(null)
        toast.success('Photo updated')
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Failed to upload photo')
      } finally {
        setUploadingImage(false)
      }
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    await onSave(form, imageFile)
  }

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        background: theme.modalOverlay,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '90vh',
          overflowY: 'auto',
          background: theme.surface,
          borderRadius: 12,
          border: `1px solid ${theme.border}`,
          boxShadow: theme.modalShadow,
          padding: 24,
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
          <div>
            <div style={sectionTitle}>{mode === 'add' ? 'Add vehicle' : 'Edit vehicle'}</div>
            <p style={{ color: theme.textMuted, fontSize: 13, margin: '4px 0 0' }}>
              {mode === 'add' ? 'Add a new vehicle to your fleet.' : 'Update details or remove this vehicle.'}
            </p>
          </div>
          <button type="button" onClick={onClose} style={{ ...secondaryButton, padding: '6px 10px' }} aria-label="Close">
            ✕
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void handleImagePick(file)
            event.target.value = ''
          }}
        />

        <VehicleImageHero
          imageUrl={displayImage}
          title={form.title || 'Vehicle'}
          height={180}
          editable
          uploading={uploadingImage}
          onChoosePhoto={() => fileInputRef.current?.click()}
        />

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 14, marginTop: 18 }}>
          <Field label="Vehicle name" value={form.title} onChange={(title) => setForm((c) => ({ ...c, title }))} placeholder="Mercedes Sprinter" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Field label="Registration" value={form.registrationNumber} onChange={(registrationNumber) => setForm((c) => ({ ...c, registrationNumber }))} placeholder="CAA 123 456" />
            <Field label="Seats" type="number" value={form.seats} onChange={(seats) => setForm((c) => ({ ...c, seats }))} placeholder="12" />
          </div>
          <Field label="Default day rate (R)" type="number" value={form.defaultRate} onChange={(defaultRate) => setForm((c) => ({ ...c, defaultRate }))} placeholder="2500" />
          <TextArea label="Notes" value={form.notes} onChange={(notes) => setForm((c) => ({ ...c, notes }))} placeholder="Colour, class, driver notes…" />

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4 }}>
            <button type="submit" disabled={saving || deleting} style={primaryButton}>
              {saving ? 'Saving…' : mode === 'add' ? 'Add vehicle' : 'Save changes'}
            </button>
            <button type="button" onClick={onClose} style={secondaryButton}>
              Cancel
            </button>
            {mode === 'edit' && onDelete && (
              <button
                type="button"
                disabled={saving || deleting}
                onClick={() => void onDelete()}
                style={{ ...dangerButton, marginLeft: 'auto' }}
              >
                {deleting ? 'Deleting…' : 'Delete vehicle'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  type?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={inputStyle} />
    </label>
  )
}

function TextArea({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={fieldLabel}>{label}</span>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} rows={3} style={{ ...inputStyle, resize: 'vertical', minHeight: 80 }} />
    </label>
  )
}
