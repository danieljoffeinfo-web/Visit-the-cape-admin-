import type { UserColor } from '@/lib/user-colors'

export type AdminRole = 'owner' | 'admin' | 'staff'

export type AdminUser = {
  id: string
  auth_user_id: string
  full_name: string
  email: string
  role: AdminRole
  color: UserColor
  is_approved: boolean
  created_at: string
  updated_at: string
}

export type ActivityLogEntry = {
  id: string
  user_id: string | null
  user_name: string
  user_email: string
  user_color: string
  action: string
  entity_type: string
  entity_id: string | null
  entity_label: string | null
  old_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  metadata: Record<string, unknown> | null
  created_at: string
}

export type TourBookingRow = {
  id: string
  booking_reference?: string | null
  name: string
  email: string
  phone?: string | null
  passengers?: number | null
  tour_name?: string | null
  tour_date?: string | null
  tour_id?: string | null
  amount?: number | null
  source?: string | null
  booking_type?: string | null
  status?: string | null
  payment_status?: string | null
  invoice_status?: string | null
  vehicle_name?: string | null
  created_by_user_id?: string | null
  created_by_name?: string | null
  created_by_color?: string | null
  notes?: string | null
  created_at: string
  updated_at?: string | null
}
