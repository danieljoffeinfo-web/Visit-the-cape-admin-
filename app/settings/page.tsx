import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

export default async function SettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
  const params = await searchParams
  const qs = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') qs.set(key, value)
    else if (Array.isArray(value)) value.forEach((entry) => qs.append(key, entry))
  }

  const suffix = qs.toString()
  redirect(suffix ? `/?panel=settings&${suffix}` : '/?panel=settings')
}
