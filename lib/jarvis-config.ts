import type { AdminUser } from '@/lib/auth-types'

/** Default model for Jarvis (OpenRouter). */
export const JARVIS_DEFAULT_MODEL = 'openrouter/auto'

const DEFAULT_ALLOWED_EMAILS = ['tanya@visitthecape.co.za']

export function getJarvisModel(): string {
  const raw = process.env.JARVIS_MODEL?.trim()
  if (!raw) return JARVIS_DEFAULT_MODEL
  // Invalid legacy value: the old env var held an API key, not a model id.
  if (raw.startsWith('Jarvissk-or-v1-') || raw.startsWith('sk-or-v1-')) {
    return JARVIS_DEFAULT_MODEL
  }
  return raw
}

/**
 * Normalize OpenRouter API key. The Jarvissk-or-v1-… string was mistakenly used
 * as both model and key — the real key is sk-or-v1-… with the same suffix.
 */
export function normalizeOpenRouterApiKey(raw: string | undefined | null): string | null {
  const key = raw?.trim()
  if (!key) return null
  if (key.startsWith('sk-or-v1-')) return key
  if (key.startsWith('Jarvissk-or-v1-')) {
    return `sk-or-v1-${key.slice('Jarvissk-or-v1-'.length)}`
  }
  if (key.startsWith('or-v1-')) {
    return `sk-${key}`
  }
  return null
}

export function getOpenRouterApiKey(): string | null {
  return normalizeOpenRouterApiKey(process.env.OPENROUTER_API_KEY)
}

export function isJarvisConfigured(): boolean {
  return Boolean(getOpenRouterApiKey())
}

function getAllowedEmails(): string[] | null {
  const raw = process.env.JARVIS_ALLOWED_EMAILS?.trim()
  if (!raw) return null
  if (raw === '*') return null
  return raw.split(',').map((e) => e.trim().toLowerCase()).filter(Boolean)
}

/** Approved admins may use Jarvis; optionally restrict via JARVIS_ALLOWED_EMAILS. */
export function canUseJarvis(admin: AdminUser): boolean {
  if (!admin.is_approved) return false

  const allowed = getAllowedEmails()
  const email = admin.email.trim().toLowerCase()

  if (!allowed) {
    return true
  }

  const merged = new Set([...allowed, ...DEFAULT_ALLOWED_EMAILS.map((e) => e.toLowerCase())])
  return merged.has(email)
}

export function jarvisSystemPrompt(admin: AdminUser): string {
  return `You are Jarvis, the Visit The Cape admin AI assistant (Jarvis SK v1).

You help ${admin.full_name} (${admin.email}, role: ${admin.role}) with the Visit The Cape admin dashboard.

You have read-only access to live admin data via tools: dashboard metrics, bookings, enquiries, tours & pricing, fleet, content library, activity logs, and calendar departures.

Guidelines:
- Answer clearly and concisely about tours, pricing, bookings, fleet, enquiries, accounting summaries, reports, and operational suggestions.
- Use South African Rand (ZAR) for money. Cape Town timezone context applies.
- When data is missing or Xero is disconnected, say so and suggest what to check in the admin console.
- Never invent booking IDs, customer details, or prices — always use tool results.
- Suggest practical next steps when helpful (e.g. follow up enquiries, check fleet availability).
- You cannot modify data, send emails, or delete records — only advise based on current data.
- Keep responses focused; use bullet lists for multi-item answers.`
}
