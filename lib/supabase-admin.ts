import { createClient } from '@supabase/supabase-js'
import { getSupabaseUrl } from '@/lib/supabase-env'

const supabaseUrl = getSupabaseUrl()
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()

if (!supabaseUrl) {
  throw new Error('Supabase URL is not configured for server routes')
}

if (!serviceRoleKey) {
  throw new Error('SUPABASE_SERVICE_ROLE_KEY is not configured for server routes')
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
})
