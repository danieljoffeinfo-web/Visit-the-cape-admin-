const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || 'https://www.visitthecape.co.za').replace(/\/$/, '')
const REVALIDATE_SECRET = process.env.REVALIDATE_SECRET?.trim()

export async function revalidateWebsitePaths(paths: string[]) {
  const secret = REVALIDATE_SECRET
  if (!secret) {
    console.warn('REVALIDATE_SECRET not set — skipping website cache revalidation')
    return { ok: false, reason: 'missing_secret' as const }
  }

  const unique = [...new Set(paths.filter(Boolean))]
  const results: { path: string; ok: boolean; status?: number }[] = []

  for (const path of unique) {
    try {
      const url = `${SITE_URL}/api/revalidate?secret=${encodeURIComponent(secret)}`
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path }),
        cache: 'no-store',
      })
      results.push({ path, ok: res.ok, status: res.status })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        console.warn(`Revalidate failed for ${path}: ${res.status} ${text}`)
      }
    } catch (error) {
      console.warn(`Revalidate error for ${path}:`, error)
      results.push({ path, ok: false })
    }
  }

  return { ok: results.every((r) => r.ok), results }
}

export function tourRevalidationPaths(tour: { slug?: string | null }) {
  const paths = ['/', '/tours']
  if (tour.slug) paths.push(`/tours/${tour.slug}`)
  return paths
}
