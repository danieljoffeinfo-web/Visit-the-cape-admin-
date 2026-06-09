import { supabaseAdmin } from '@/lib/supabase-admin'
import type { AdminUser } from '@/lib/auth-types'

const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
  'service_role',
])

function sanitizeValue(value: unknown): unknown {
  if (value === null || value === undefined) return value
  if (Array.isArray(value)) return value.map(sanitizeValue)
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>
    const clean: Record<string, unknown> = {}
    for (const [key, val] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(key.toLowerCase())) continue
      clean[key] = sanitizeValue(val)
    }
    return clean
  }
  return value
}

export type LogActivityInput = {
  admin: AdminUser
  action: string
  entityType: string
  entityId?: string | null
  entityLabel?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export async function logActivityServer(input: LogActivityInput) {
  const { admin, action, entityType, entityId, entityLabel, oldValue, newValue, metadata } = input

  const { error } = await supabaseAdmin.from('activity_logs').insert({
    user_id: admin.id,
    user_name: admin.full_name,
    user_email: admin.email,
    user_color: admin.color,
    action,
    entity_type: entityType,
    entity_id: entityId || null,
    entity_label: entityLabel || null,
    old_value: oldValue ? sanitizeValue(oldValue) : null,
    new_value: newValue ? sanitizeValue(newValue) : null,
    metadata: metadata ? sanitizeValue(metadata) : null,
  })

  if (error) {
    console.error('Activity log insert error:', error)
  }
}
