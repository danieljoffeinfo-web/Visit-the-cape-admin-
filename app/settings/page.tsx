import { redirect } from 'next/navigation'

export default function SettingsRedirect({ searchParams }: { searchParams: Record<string, string> }) {
  const params = new URLSearchParams(searchParams)
  redirect(`/?panel=settings&${params.toString()}`)
}
