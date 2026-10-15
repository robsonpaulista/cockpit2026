'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { listarArenaPerfis, type ArenaPerfisResposta } from '@/lib/services/arena-perfis-client'
import { intervaloDoPeriodo, lerPeriodo, type ArenaPeriodo } from '@/lib/arena/periodo'
import type { ArenaIntervalo, ArenaPerfilPapel } from '@/lib/arena/types'

export type ArenaPerfisEstado =
  | { status: 'loading' }
  | { status: 'erro'; mensagem: string }
  | ({ status: 'ok' } & ArenaPerfisResposta)

/** Perfis da Arena com a pontuação do intervalo, ordenados por pontos. */
export function useArenaPerfis(
  intervalo: ArenaIntervalo,
  papel?: ArenaPerfilPapel,
): ArenaPerfisEstado {
  const [estado, setEstado] = useState<ArenaPerfisEstado>({ status: 'loading' })
  const { inicio, fim } = intervalo

  useEffect(() => {
    let cancelled = false
    setEstado({ status: 'loading' })
    listarArenaPerfis({ inicio, fim }, papel)
      .then((resposta) => {
        if (!cancelled) setEstado({ status: 'ok', ...resposta })
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setEstado({
            status: 'erro',
            mensagem: e instanceof Error ? e.message : 'Erro ao carregar perfis da arena',
          })
        }
      })
    return () => {
      cancelled = true
    }
  }, [papel, inicio, fim])

  return estado
}

export type ArenaPeriodoFiltro = {
  periodo: ArenaPeriodo
  de: string | null
  ate: string | null
  intervalo: ArenaIntervalo
  definir: (periodo: ArenaPeriodo, de?: string | null, ate?: string | null) => void
}

/** Filtro de período da Arena guardado na URL (`periodo`, `de`, `ate`), compartilhado entre as abas. */
export function useArenaPeriodo(): ArenaPeriodoFiltro {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const periodo = lerPeriodo(searchParams.get('periodo'))
  const de = searchParams.get('de')
  const ate = searchParams.get('ate')
  const intervalo = useMemo(() => intervaloDoPeriodo(periodo, de, ate), [periodo, de, ate])

  const definir = useCallback(
    (novo: ArenaPeriodo, novoDe?: string | null, novoAte?: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (novo === 'tudo') params.delete('periodo')
      else params.set('periodo', novo)
      if (novo === 'personalizado' && novoDe) params.set('de', novoDe)
      else params.delete('de')
      if (novo === 'personalizado' && novoAte) params.set('ate', novoAte)
      else params.delete('ate')
      const qs = params.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return useMemo(
    () => ({ periodo, de, ate, intervalo, definir }),
    [periodo, de, ate, intervalo, definir],
  )
}

/** Link para o painel de um perfil mantendo o filtro de período. */
export function hrefPainelArena(perfilId: string, filtro: ArenaPeriodoFiltro): string {
  const params = new URLSearchParams({ membro: perfilId })
  if (filtro.periodo !== 'tudo') params.set('periodo', filtro.periodo)
  if (filtro.periodo === 'personalizado') {
    if (filtro.de) params.set('de', filtro.de)
    if (filtro.ate) params.set('ate', filtro.ate)
  }
  return `/dashboard/mobilizacao/painel?${params.toString()}`
}

export function formatarDataIso(iso: string | null): string {
  if (!iso) return '—'
  const [ano, mes, dia] = iso.slice(0, 10).split('-')
  return `${dia}/${mes}/${ano}`
}
