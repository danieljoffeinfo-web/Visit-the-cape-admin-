// Admin Supabase project — public client credentials.
//
// These are the anon/publishable credentials, which are designed to be exposed
// in a browser bundle; RLS is what protects the data. They are kept as a
// fallback because Vercel production has repeatedly had NEXT_PUBLIC_* unset,
// and without a fallback the login screen throws "Login failed" for everyone.
//
// Env vars still win when present. Set NEXT_PUBLIC_SUPABASE_URL and
// NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel, then these are never read.
const ADMIN_SUPABASE_URL = 'https://zsxiflghjqacoayhbsyg.supabase.co'
const ADMIN_SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzeGlmbGdoanFhY29heWhic3lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDc0NzYsImV4cCI6MjA5NTEyMzQ3Nn0.X7-UcBKL2Unqoqp_Zme7aWVZurgQQv7eo3yDf2nzT28'

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return ''
}

export function getSupabaseUrl() {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL') || ADMIN_SUPABASE_URL
}

export function getSupabaseAnonKey() {
  return readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY') || ADMIN_SUPABASE_ANON_KEY
}

export function requireSupabasePublicEnv() {
  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()
  if (!url || !anonKey) {
    throw new Error('Supabase URL and anon key must be configured')
  }
  return { url, anonKey }
}
