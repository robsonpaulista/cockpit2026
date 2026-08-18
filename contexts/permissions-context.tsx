'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export interface UsePermissionsResult {
  permissions: string[] | null
  isAdmin: boolean
  loading: boolean
  canAccess: (pageKey: string) => boolean
}

const PermissionsContext = createContext<UsePermissionsResult | undefined>(undefined)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const [permissions, setPermissions] = useState<string[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    fetch('/api/auth/permissions')
      .then((res) => (res.ok ? res.json() : { permissions: [], is_admin: false }))
      .then((data) => {
        if (!mounted) return
        setPermissions(data.permissions ?? [])
        setIsAdmin(Boolean(data.is_admin))
      })
      .catch(() => {
        if (mounted) {
          setPermissions([])
          setIsAdmin(false)
        }
      })
      .finally(() => {
        if (mounted) setLoading(false)
      })
    return () => {
      mounted = false
    }
  }, [])

  const canAccess = useCallback(
    (pageKey: string): boolean => {
      if (isAdmin) return true
      if (permissions === null) return false
      return permissions.includes(pageKey)
    },
    [isAdmin, permissions],
  )

  const value = useMemo(
    () => ({ permissions, isAdmin, loading, canAccess }),
    [permissions, isAdmin, loading, canAccess],
  )

  return <PermissionsContext.Provider value={value}>{children}</PermissionsContext.Provider>
}

export function usePermissionsContext(): UsePermissionsResult {
  const context = useContext(PermissionsContext)
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionsProvider')
  }
  return context
}
