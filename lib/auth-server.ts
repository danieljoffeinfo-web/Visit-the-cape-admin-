import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase-admin'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import type { AdminUser } from '@/lib/auth-types'

export async function getSessionUser() {
  const supabase = await createSupabaseServerClient()
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null
  return user
}

export async function getApprovedAdminUser(): Promise<AdminUser | null> {
  const user = await getSessionUser()
  if (!user) return null

  const { data, error } = await supabaseAdmin
    .from('admin_users')
    .select('*')
    .eq('auth_user_id', user.id)
    .eq('is_approved', true)
    .maybeSingle()

  if (error || !data) return null
  return data as AdminUser
}

export async function requireApprovedAdmin(request?: NextRequest) {
  void request
  const admin = await getApprovedAdminUser()
  if (!admin) {
    return { admin: null, error: 'Unauthorized' as const }
  }
  return { admin, error: null }
}

export function generateBookingReference(prefix = 'VTB') {
  const stamp = Date.now().toString(36).toUpperCase()
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase()
  return `${prefix}-${stamp}-${rand}`
}
