'use client'

import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { inputStyle, primaryButton, theme } from '@/lib/theme'

export function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const supabase = getSupabaseBrowserClient()
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError) {
        setError(signInError.message)
        return
      }

      const meRes = await fetch('/api/auth/me', { cache: 'no-store' })
      const meData = await meRes.json()

      if (meRes.status === 403) {
        await supabase.auth.signOut()
        setError('Your account has not been approved for admin access.')
        return
      }

      if (!meRes.ok) {
        await supabase.auth.signOut()
        setError('Unable to verify admin access. Contact your administrator.')
        return
      }

      toast.success(`Welcome back, ${meData.admin?.full_name || 'Admin'}`)
      router.push(redirect)
      router.refresh()
    } catch {
      setError('Login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleLogin}>
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6 }}>Email</label>
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" style={inputStyle} />
      </div>
      <div style={{ marginBottom: 24 }}>
        <label style={{ display: 'block', fontSize: 11, letterSpacing: '0.1em', textTransform: 'uppercase', color: theme.textMuted, marginBottom: 6 }}>Password</label>
        <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" style={inputStyle} />
      </div>
      {error && (
        <div style={{ padding: '10px 14px', borderRadius: 6, background: 'rgba(196,92,74,0.1)', border: '1px solid rgba(196,92,74,0.25)', color: theme.danger, fontSize: 13, marginBottom: 16, lineHeight: 1.5 }}>
          {error}
        </div>
      )}
      <button type="submit" disabled={loading} style={{ ...primaryButton, width: '100%', opacity: loading ? 0.7 : 1, cursor: loading ? 'not-allowed' : 'pointer' }}>
        {loading ? 'Signing in…' : 'Sign In'}
      </button>
    </form>
  )
}
