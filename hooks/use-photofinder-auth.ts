'use client'

import { useCallback, useEffect, useState } from 'react'
import { photofinderApi } from '@/lib/photofinder-api'
import type { PhotofinderAuthStatus } from '@/lib/photofinder/types'

export function usePhotofinderAuth() {
  const [authStatus, setAuthStatus] = useState<PhotofinderAuthStatus>({ authenticated: false })
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  const checkAuthStatus = useCallback(async () => {
    try {
      setLoading(true)
      const status = await photofinderApi.getAuthStatus()
      setAuthStatus(status)
      setError(null)
    } catch (err) {
      console.error('Erro ao verificar autenticação Drive:', err)
      setError('Falha ao verificar conexão com o Google Drive')
      setAuthStatus({ authenticated: false })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void checkAuthStatus()
  }, [checkAuthStatus])

  const login = useCallback(async () => {
    try {
      const { authUrl } = await photofinderApi.getAuthUrl()
      window.location.href = authUrl
    } catch (err) {
      console.error('Erro ao iniciar login Drive:', err)
      setError('Falha ao conectar com o Google Drive')
    }
  }, [])

  const logout = useCallback(async () => {
    try {
      await photofinderApi.logout()
      setAuthStatus({ authenticated: false })
    } catch (err) {
      console.error('Erro ao desconectar Drive:', err)
      setError('Falha ao desconectar')
    }
  }, [])

  return {
    ...authStatus,
    photosCount: authStatus.photosCount,
    loading,
    error,
    login,
    logout,
    refresh: checkAuthStatus,
  }
}
