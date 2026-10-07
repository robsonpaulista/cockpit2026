'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, LogOut } from 'lucide-react'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import { useAuth } from '@/hooks/use-auth'
import { usePermissions } from '@/hooks/use-permissions'
import { rotaInicialDashboard } from '@/lib/dashboard-entrada'

/** Entrada autenticada: leva direto à primeira tela do menu liberada para o usuário. */
export default function DashboardEntrada() {
  const router = useRouter()
  const { canAccess, isAdmin, loading } = usePermissions()
  const { signOut } = useAuth()
  const [saindo, setSaindo] = useState<boolean>(false)

  const destino = useMemo<string | null>(
    () => (loading ? null : rotaInicialDashboard(canAccess, isAdmin)),
    [loading, canAccess, isAdmin],
  )
  const semAcesso = !loading && destino === null

  useEffect(() => {
    if (destino) router.replace(destino)
  }, [destino, router])

  const sair = async () => {
    setSaindo(true)
    await signOut()
    window.location.href = '/'
  }

  return (
    <div
      className="relative flex h-full min-h-0 w-full flex-1 items-center justify-center bg-[var(--tse-yellow)] px-6 text-center text-[var(--tse-text)]"
      style={TSE_TOKENS}
    >
      {semAcesso ? (
        <div className="max-w-sm rounded-2xl bg-white p-7 shadow-[0_28px_70px_-28px_rgba(51,51,51,0.55)]">
          <p className="text-[15px] font-semibold">Nenhuma tela liberada</p>
          <p className="mt-2 text-sm text-[var(--tse-muted)]">
            Seu usuário ainda não tem páginas liberadas no Cockpit. Fale com a coordenação para ajustar suas
            permissões.
          </p>
          <button
            type="button"
            onClick={() => void sair()}
            disabled={saindo}
            className="mt-5 inline-flex h-10 items-center gap-2 rounded-lg bg-[var(--tse-text)] px-5 text-sm font-semibold text-white transition hover:bg-black disabled:opacity-70"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sair
          </button>
        </div>
      ) : (
        <p className="inline-flex items-center gap-2.5 text-sm font-semibold" aria-live="polite">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Abrindo o Cockpit…
        </p>
      )}
    </div>
  )
}
