'use client'

import type { AdminUser } from '@/lib/auth-types'

export type ClientLogActivityInput = {
  action: string
  entityType: string
  entityId?: string | null
  entityLabel?: string | null
  oldValue?: Record<string, unknown> | null
  newValue?: Record<string, unknown> | null
  metadata?: Record<string, unknown> | null
}

export async function logActivity(input: ClientLogActivityInput) {
  try {
    await fetch('/api/activity-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
  } catch (error) {
    console.error('Activity log client error:', error)
  }
}

export type AuthContextValue = {
  admin: AdminUser | null
  loading: boolean
  notApproved: boolean
  refresh: () => Promise<void>
  signOut: () => Promise<void>
}
