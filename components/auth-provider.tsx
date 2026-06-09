'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import type { AdminUser } from '@/lib/auth-types'
import type { AuthContextValue } from '@/lib/activity-log'

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [notApproved, setNotApproved] = useState(false)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = await res.json()

      if (res.status === 403) {
        setAdmin(null)
        setNotApproved(true)
        return
      }

      if (!res.ok) {
        setAdmin(null)
        setNotApproved(false)
        return
      }

      setAdmin(data.admin as AdminUser)
      setNotApproved(false)
    } catch {
      setAdmin(null)
      setNotApproved(false)
    } finally {
      setLoading(false)
    }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    await fetch('/api/auth/logout', { method: 'POST' })
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    refresh()
    const supabase = getSupabaseBrowserClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh()
    })
    return () => subscription.unsubscribe()
  }, [refresh])

  const value = useMemo(
    () => ({ admin, loading, notApproved, refresh, signOut }),
    [admin, loading, notApproved, refresh, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
