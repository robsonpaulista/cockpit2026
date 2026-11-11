'use client'

import { useMemo, useState } from 'react'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { rotaInicialDashboard } from '@/lib/dashboard-entrada'
import { DashboardBoasVindas } from '@/components/dashboard/dashboard-boas-vindas'

/** Entrada autenticada: boas-vindas e orientação para o menu lateral (sem redirecionar). */
export default function DashboardEntrada() {
  const { user, signOut } = useAuth()
  const { canAccess, isAdmin, loading } = usePermissions()
  const [saindo, setSaindo] = useState<boolean>(false)

  const temModulos = useMemo(
    () => (!loading ? rotaInicialDashboard(canAccess, isAdmin) !== null : true),
    [loading, canAccess, isAdmin],
  )

  const sair = async () => {
    setSaindo(true)
    await signOut()
    window.location.href = '/'
  }

  return (
    <DashboardBoasVindas
      loading={loading}
      nome={user?.profile?.name}
      email={user?.email ?? user?.profile?.email}
      role={user?.profile?.role}
      semModulos={!loading && !temModulos}
      saindo={saindo}
      onSair={() => void sair()}
    />
  )
}
