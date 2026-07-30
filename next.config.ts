import type { NextConfig } from 'next'

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ''
}

// Vercel production has repeatedly had empty NEXT_PUBLIC_* while SUPABASE_* held
// the real values. Map at build time so the client bundle always gets working
// credentials, falling back to the public anon credentials rather than shipping
// a bundle that throws on every login.
const supabaseUrl = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_URL,
  'https://zsxiflghjqacoayhbsyg.supabase.co',
)

const supabaseAnonKey = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.SUPABASE_ANON_KEY,
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpzeGlmbGdoanFhY29heWhic3lnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk1NDc0NzYsImV4cCI6MjA5NTEyMzQ3Nn0.X7-UcBKL2Unqoqp_Zme7aWVZurgQQv7eo3yDf2nzT28',
)

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
}

export default nextConfig
