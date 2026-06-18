'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase'
import type { AdminUser } from '@/lib/auth-types'
import type { AuthContextValue } from '@/lib/activity-log'

const ADMIN_CACHE_KEY = 'vtc_admin_session'

const AuthContext = createContext<AuthContextValue | null>(null)

function readCachedAdmin(): AdminUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = sessionStorage.getItem(ADMIN_CACHE_KEY)
    return raw ? (JSON.parse(raw) as AdminUser) : null
  } catch {
    return null
  }
}

function writeCachedAdmin(admin: AdminUser | null) {
  if (typeof window === 'undefined') return
  if (admin) sessionStorage.setItem(ADMIN_CACHE_KEY, JSON.stringify(admin))
  else sessionStorage.removeItem(ADMIN_CACHE_KEY)
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminUser | null>(() => readCachedAdmin())
  const [loading, setLoading] = useState(() => !readCachedAdmin())
  const [notApproved, setNotApproved] = useState(false)

  const refresh = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent && !admin) setLoading(true)
    try {
      const res = await fetch('/api/auth/me', { cache: 'no-store' })
      const data = await res.json()

      if (res.status === 403) {
        setAdmin(null)
        writeCachedAdmin(null)
        setNotApproved(true)
        return
      }

      if (!res.ok) {
        setAdmin(null)
        writeCachedAdmin(null)
        setNotApproved(false)
        return
      }

      const next = data.admin as AdminUser
      setAdmin(next)
      writeCachedAdmin(next)
      setNotApproved(false)
    } catch {
      if (!admin) {
        setAdmin(null)
        writeCachedAdmin(null)
        setNotApproved(false)
      }
    } finally {
      setLoading(false)
    }
  }, [admin])

  const signOut = useCallback(async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    await fetch('/api/auth/logout', { method: 'POST' })
    writeCachedAdmin(null)
    window.location.href = '/login'
  }, [])

  useEffect(() => {
    refresh({ silent: !!admin })
    const supabase = getSupabaseBrowserClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => {
      refresh({ silent: true })
    })
    return () => subscription.unsubscribe()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
