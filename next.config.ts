import type { NextConfig } from 'next'

function firstNonEmpty(...values: Array<string | undefined>) {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) return trimmed
  }
  return ''
}

// Vercel production had empty NEXT_PUBLIC_* while SUPABASE_* held the real values.
// Map at build time so the client bundle always gets the configured credentials.
// No hardcoded fallback: a missing value must surface as a broken config, not
// quietly connect to production.
const supabaseUrl = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_URL,
)

const supabaseAnonKey = firstNonEmpty(
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  process.env.SUPABASE_ANON_KEY,
)

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    '[next.config] Supabase public env is missing — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or the SUPABASE_* equivalents).',
  )
}

const nextConfig: NextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: supabaseUrl,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: supabaseAnonKey,
  },
}

export default nextConfig
