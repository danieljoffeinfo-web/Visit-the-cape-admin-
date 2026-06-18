'use client'

import { Suspense, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import { inputStyle, primaryButton, theme } from '@/lib/theme'

function LoginForm() {
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
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, background: theme.bg }}>
      <div style={{ width: '100%', maxWidth: 420, background: theme.surface, border: `1px solid ${theme.border}`, borderRadius: 12, padding: '40px 36px', boxShadow: '0 12px 40px rgba(44,38,32,0.08)' }}>
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: theme.headingFont, fontWeight: 900, fontSize: 28, letterSpacing: '0.08em', textTransform: 'uppercase', color: theme.bronze, lineHeight: 1 }}>
            Visit The Cape
          </div>
          <div style={{ fontSize: 11, letterSpacing: '0.18em', textTransform: 'uppercase', color: theme.textFaint, marginTop: 6 }}>
            Admin Console
          </div>
        </div>

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
        <p style={{ textAlign: 'center', fontSize: 12, color: theme.textFaint, marginTop: 24, lineHeight: 1.5 }}>
          Approved staff only. Contact your administrator for access.
        </p>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
