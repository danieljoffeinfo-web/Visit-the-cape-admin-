/**
 * Supabase public client credentials.
 *
 * Read from the environment only — there is deliberately no baked-in fallback.
 * A hardcoded default silently points a misconfigured deployment at the
 * production project, which is worse than failing loudly.
 *
 * Required (either spelling):
 *   NEXT_PUBLIC_SUPABASE_URL      / SUPABASE_URL
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY / SUPABASE_ANON_KEY
 */

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const value = process.env[key]?.trim()
    if (value) return value
  }
  return ''
}

export function getSupabaseUrl() {
  return readEnv('NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL')
}

export function getSupabaseAnonKey() {
  return readEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY')
}

export function requireSupabasePublicEnv() {
  const url = getSupabaseUrl()
  const anonKey = getSupabaseAnonKey()
  if (!url || !anonKey) {
    throw new Error(
      'Supabase is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.',
    )
  }
  return { url, anonKey }
}
