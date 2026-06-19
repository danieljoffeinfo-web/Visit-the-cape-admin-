import type { NextConfig } from 'next'

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ''
}

// Vercel production had empty NEXT_PUBLIC_* while SUPABASE_* held the real values.
// Map at build time so the client bundle always gets working public credentials.
const supabaseUrl = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_URL,
  'https://zsxiflghjqacoayhbsyg.supabase.co',
)

const supabaseAnonKey = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.SUPABASE_ANON_KEY,
)

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
}

export default nextConfig
