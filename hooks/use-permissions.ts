'use client'

import { useEffect, useState } from 'react'

export interface UsePermissionsResult {
  permissions: string[] | null
  isAdmin: boolean
  loading: boolean
  canAccess: (pageKey: string) => boolean
}

/**
 * Retorna permissões do usuário atual e helper canAccess(pageKey).
 * isAdmin => acesso a todas as páginas. Caso contrário, usa permissions.
 */
export function usePermissions(): UsePermissionsResult {
  const [permissions, setPermissions] = useState<string[] | null>(null)
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    setLoading(true)
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

  const canAccess = (pageKey: string): boolean => {
    if (isAdmin) return true
    if (permissions === null) return false
    return permissions.includes(pageKey)
  }

  return { permissions, isAdmin, loading, canAccess }
}
