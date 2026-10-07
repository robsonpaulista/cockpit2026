'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchInstagramData,
  fetchInstagramHistory,
  loadInstagramConfigAsync,
  saveInstagramConfig,
  saveInstagramSnapshot,
  type InstagramHistoryResponse,
  type InstagramMetrics,
} from '@/lib/instagramApi'
import {
  FOLLOWERS_HISTORY_RANGE_OPTIONS,
  followersHistoryDaysFromRange,
} from '@/lib/instagram-followers-history-chart'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import {
  cacheInstagramClassifications,
  fetchInstagramClassifications,
  fetchObrasMapaLista,
  loadInstagramCustomThemes,
  saveInstagramClassification,
  saveInstagramCustomThemes,
  type InstagramClassificationsMap,
  type InstagramPostClassification,
} from '@/lib/services/instagram-redes-client'

export type InstagramPost = InstagramMetrics['posts'][number]
export type { InstagramPostClassification }

function ordenarTemas(temas: string[]): string[] {
  return [...temas].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true }))
}

const TEMAS_PADRAO = ordenarTemas([
  'Atendimentos',
  'Autismo',
  'Campanha',
  'Causa Animal',
  'Depoimento',
  'Dica',
  'Eca Digital',
  'Educação',
  'Evento',
  'Família',
  'Hospital do Amor',
  'Informativo',
  'Obras',
  'Outros',
  "PL'S",
  'Pesquisas',
  'Promoção',
  'Saúde',
  'Segurança',
])

export function isTemaObras(theme: string | undefined | null): boolean {
  return String(theme || '').trim().toLowerCase() === 'obras'
}

/** Chave estável do post nas classificações (id da Graph API ou data + início da legenda). */
export function idPostInstagram(post: { id: string; postedAt?: string; caption?: string }): string {
  if (post.id) return post.id
  if (post.postedAt && post.caption) {
    const dia = new Date(post.postedAt).toISOString().split('T')[0]
    const hash = post.caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    return `${dia}_${hash}`
  }
  return ''
}

/** Estado e dados da página Instagram Pessoal (métricas, histórico, classificações, temas, obras). */
export function useInstagramRedes() {
  const [dateRange, setDateRange] = useState<string>('30d')
  const [metrics, setMetrics] = useState<InstagramMetrics | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [metricsHistory, setMetricsHistory] = useState<InstagramHistoryResponse | null>(null)
  const [loadingHistory, setLoadingHistory] = useState<boolean>(false)
  const [classificacoes, setClassificacoes] = useState<InstagramClassificationsMap>({})
  const [temasCustom, setTemasCustom] = useState<string[]>([])
  const [obrasMapa, setObrasMapa] = useState<ObraMapaRow[]>([])
  const businessAccountIdRef = useRef<string | null>(null)
  const requisicaoRef = useRef<number>(0)

  const carregarHistorico = useCallback(async () => {
    setLoadingHistory(true)
    try {
      setMetricsHistory(await fetchInstagramHistory(followersHistoryDaysFromRange(dateRange)))
    } catch (err: unknown) {
      console.error('Erro ao buscar histórico:', err)
    } finally {
      setLoadingHistory(false)
    }
  }, [dateRange])

  const carregar = useCallback(
    async (forceRefresh: boolean) => {
      const requisicao = ++requisicaoRef.current
      setLoading(true)
      setError(null)
      try {
        if (businessAccountIdRef.current == null) {
          businessAccountIdRef.current = (await loadInstagramConfigAsync()).businessAccountId
        }
        const data = await fetchInstagramData('', businessAccountIdRef.current, dateRange, forceRefresh)
        if (requisicao !== requisicaoRef.current) return
        if (!data) {
          setError('Erro ao buscar dados do Instagram')
          return
        }
        setMetrics(data)
        saveInstagramConfig('', businessAccountIdRef.current)
        await saveInstagramSnapshot(data)
        void carregarHistorico()
      } catch (err: unknown) {
        if (requisicao !== requisicaoRef.current) return
        setError(err instanceof Error && err.message ? err.message : 'Erro ao conectar com Instagram')
      } finally {
        if (requisicao === requisicaoRef.current) setLoading(false)
      }
    },
    [dateRange, carregarHistorico],
  )

  useEffect(() => {
    void carregar(false)
  }, [carregar])

  useEffect(() => {
    setTemasCustom(loadInstagramCustomThemes())
    void fetchInstagramClassifications().then(setClassificacoes)
    void fetchObrasMapaLista().then(setObrasMapa)
  }, [])

  const temasDisponiveis = useMemo(() => ordenarTemas([...TEMAS_PADRAO, ...temasCustom]), [temasCustom])

  const classificar = useCallback(
    (post: InstagramPost, theme: string, isBoosted: boolean, obraMapaId?: string | null) => {
      const id = idPostInstagram(post)
      const obraId = isTemaObras(theme) ? (obraMapaId ?? null) : null
      setClassificacoes((atual) => {
        const proximo = { ...atual, [id]: { theme: theme || undefined, isBoosted, obraMapaId: obraId } }
        cacheInstagramClassifications(proximo)
        return proximo
      })
      void saveInstagramClassification({
        postId: post.id || undefined,
        postDate: post.postedAt || undefined,
        postCaption: post.caption || undefined,
        theme: theme || '',
        isBoosted,
        obraMapaId: obraId,
      })
    },
    [],
  )

  const adicionarTema = useCallback(
    (nome: string): boolean => {
      const tema = nome.trim()
      if (!tema || temasDisponiveis.includes(tema)) return false
      const proximos = [...temasCustom, tema]
      setTemasCustom(proximos)
      saveInstagramCustomThemes(proximos)
      return true
    },
    [temasCustom, temasDisponiveis],
  )

  const postsPeriodo = useMemo(() => {
    const inicio = Date.now() - followersHistoryDaysFromRange(dateRange) * 24 * 60 * 60 * 1000
    return (metrics?.posts ?? []).filter((post) => {
      const t = new Date(post.postedAt).getTime()
      return !Number.isNaN(t) && t >= inicio
    })
  }, [metrics?.posts, dateRange])

  const periodLabel =
    FOLLOWERS_HISTORY_RANGE_OPTIONS.find((o) => o.value === dateRange)?.label ??
    `${followersHistoryDaysFromRange(dateRange)} dias`

  return {
    dateRange,
    setDateRange,
    periodLabel,
    metrics,
    loading,
    error,
    conectado: metrics != null,
    metricsHistory,
    loadingHistory,
    carregarHistorico,
    atualizar: () => void carregar(true),
    postsPeriodo,
    classificacoes,
    classificar,
    temasDisponiveis,
    adicionarTema,
    obrasMapa,
  }
}

export type InstagramRedes = ReturnType<typeof useInstagramRedes>
