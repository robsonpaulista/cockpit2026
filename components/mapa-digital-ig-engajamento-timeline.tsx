'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchInstagramCommentsGrouped,
  type InstagramPostWithComments,
} from '@/lib/instagramApi'
import {
  fetchMobilizacaoLideresInstagramPorTd,
  type LiderInstagramCoberturaDto,
} from '@/lib/mobilizacao-lideres-instagram-cobertura-client'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { INSTAGRAM_COMMENTS_SYNCED_EVENT } from '@/lib/instagram-comments-sync-events'
import {
  MapaDigitalIgOperacaoBarChart,
  OperacaoBarChartLegend,
  type OperacaoBarBucket,
} from '@/components/mapa-digital-ig-operacao-bar-chart'

type Props = {
  territorioFoco: TerritorioDesenvolvimentoPI | null
  visualPreset: 'default' | 'futuristic'
  visualTheme?: 'dark' | 'light'
  shellClassName?: string
}

type PostEngajamentoLinha = {
  post: InstagramPostWithComments
  total: number
  liderados: number
  organico: number
  pctLiderados: number
  pctOrganico: number
  postedAtMs: number
}

/** Agrupamento temporal para o gráfico (mês ou dia). */
type BucketTimeline = {
  key: string
  label: string
  sublabel: string
  publicacoes: number
  total: number
  liderados: number
  organico: number
  pctLiderados: number
  pctOrganico: number
  sortMs: number
}

const MAX_COLUNAS = 14

function buildLideradosHandleSet(lideres: LiderInstagramCoberturaDto[]): Set<string> {
  const handles = new Set<string>()
  for (const lider of lideres) {
    for (const handle of lider.handles) {
      const normalized = normalizeInstagramHandle(handle)
      if (normalized) handles.add(normalized)
    }
  }
  return handles
}

function analisarComentariosPost(
  post: InstagramPostWithComments,
  lideradosHandles: Set<string>,
): Pick<PostEngajamentoLinha, 'total' | 'liderados' | 'organico' | 'pctLiderados' | 'pctOrganico'> {
  const total = post.comments.length
  let liderados = 0
  for (const comment of post.comments) {
    const handle = normalizeInstagramHandle(comment.commenter_username)
    if (handle && lideradosHandles.has(handle)) {
      liderados += 1
    }
  }
  const organico = total - liderados
  const pctLiderados = total > 0 ? (liderados / total) * 100 : 0
  const pctOrganico = total > 0 ? (organico / total) * 100 : 0
  return { total, liderados, organico, pctLiderados, pctOrganico }
}

function timestampPost(post: InstagramPostWithComments): number {
  const raw = post.media_posted_at
  if (!raw) return 0
  const t = Date.parse(raw)
  return Number.isNaN(t) ? 0 : t
}

function formatarLabelDia(ms: number): string {
  return new Date(ms).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
  })
}

function agruparBuckets(linhas: PostEngajamentoLinha[]): BucketTimeline[] {
  if (linhas.length === 0) return []

  const map = new Map<string, BucketTimeline>()

  for (const row of linhas) {
    const d = row.postedAtMs > 0 ? new Date(row.postedAtMs) : null
    let key: string
    let label: string
    let sortMs: number

    if (!d || Number.isNaN(d.getTime())) {
      key = 'sem-data'
      label = 'Sem data'
      sortMs = 0
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
      label = formatarLabelDia(row.postedAtMs)
      sortMs = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
    }

    let bucket = map.get(key)
    if (!bucket) {
      bucket = {
        key,
        label,
        sublabel: '',
        publicacoes: 0,
        total: 0,
        liderados: 0,
        organico: 0,
        pctLiderados: 0,
        pctOrganico: 0,
        sortMs,
      }
      map.set(key, bucket)
    }

    bucket.publicacoes += 1
    bucket.total += row.total
    bucket.liderados += row.liderados
    bucket.organico += row.organico
    if (row.postedAtMs > bucket.sortMs) bucket.sortMs = row.postedAtMs
  }

  const buckets = [...map.values()]
    .map((b) => {
      const pctLiderados = b.total > 0 ? (b.liderados / b.total) * 100 : 0
      const pctOrganico = b.total > 0 ? (b.organico / b.total) * 100 : 0
      const pubLabel =
        b.publicacoes === 1 ? '1 publicação' : `${b.publicacoes} publicações`
      return {
        ...b,
        pctLiderados,
        pctOrganico,
        sublabel: pubLabel,
      }
    })
    .sort((a, b) => a.sortMs - b.sortMs)

  if (buckets.length > MAX_COLUNAS) {
    return buckets.slice(-MAX_COLUNAS)
  }
  return buckets
}

export function MapaDigitalIgEngajamentoTimeline({
  territorioFoco,
  visualPreset,
  visualTheme = 'dark',
  shellClassName,
}: Props) {
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'forbidden'>('idle')
  const [erro, setErro] = useState('')
  const [posts, setPosts] = useState<InstagramPostWithComments[]>([])
  const [lideres, setLideres] = useState<LiderInstagramCoberturaDto[]>([])

  const isFutDark = visualPreset === 'futuristic' && visualTheme === 'dark'
  const isFutLight = visualPreset === 'futuristic' && visualTheme === 'light'

  const carregar = useCallback(async () => {
    setLoadState('loading')
    setErro('')
    const [grouped, lideresRes] = await Promise.all([
      fetchInstagramCommentsGrouped(8000),
      fetchMobilizacaoLideresInstagramPorTd(territorioFoco),
    ])

    if (lideresRes.ok === false) {
      if (lideresRes.status === 403) {
        setLoadState('forbidden')
        setErro(lideresRes.message ?? 'Sem permissão.')
        setPosts([])
        setLideres([])
        return
      }
      setLoadState('error')
      setErro(lideresRes.message ?? 'Não foi possível carregar liderados.')
      setPosts([])
      setLideres([])
      return
    }

    setLideres(lideresRes.data.lideres)

    if (!grouped) {
      setLoadState('error')
      setErro('Não foi possível carregar publicações sincronizadas.')
      setPosts([])
      return
    }

    setPosts(grouped.posts)
    setLoadState('ready')
  }, [territorioFoco])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const onSync = () => {
      void carregar()
    }
    window.addEventListener(INSTAGRAM_COMMENTS_SYNCED_EVENT, onSync)
    return () => window.removeEventListener(INSTAGRAM_COMMENTS_SYNCED_EVENT, onSync)
  }, [carregar])

  const lideradosHandles = useMemo(() => buildLideradosHandleSet(lideres), [lideres])

  const linhas = useMemo((): PostEngajamentoLinha[] => {
    return posts
      .map((post) => {
        const stats = analisarComentariosPost(post, lideradosHandles)
        return {
          post,
          ...stats,
          postedAtMs: timestampPost(post),
        }
      })
      .filter((row) => row.total > 0 || row.postedAtMs > 0)
  }, [posts, lideradosHandles])

  const buckets = useMemo(() => agruparBuckets(linhas), [linhas])

  const totais = useMemo(() => {
    let comentarios = 0
    let liderados = 0
    for (const row of linhas) {
      comentarios += row.total
      liderados += row.liderados
    }
    const organico = comentarios - liderados
    const pctLiderados = comentarios > 0 ? (liderados / comentarios) * 100 : 0
    const pctOrganico = comentarios > 0 ? (organico / comentarios) * 100 : 0
    return { comentarios, liderados, organico, pctLiderados, pctOrganico, publicacoes: linhas.length }
  }, [linhas])

  const fmtPct1 = useMemo(
    () => new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 }),
    [],
  )
  const fmtInt = useMemo(() => new Intl.NumberFormat('pt-BR'), [])

  const chartBuckets = useMemo((): OperacaoBarBucket[] => {
    return buckets.map((b) => ({
      key: b.key,
      label: b.label,
      sublabel: b.sublabel,
      pctPrimary: b.pctLiderados,
      pctSecondary: b.pctOrganico,
      footerTertiary: `${fmtInt.format(b.total)} com.`,
      tooltip: [
        `${b.label}: ${b.sublabel}`,
        `Liderados ${fmtPct1.format(b.pctLiderados)}% (${fmtInt.format(b.liderados)} coment.)`,
        `Orgânico ${fmtPct1.format(b.pctOrganico)}% (${fmtInt.format(b.organico)} coment.)`,
        `${fmtInt.format(b.total)} comentários no total`,
      ].join(' · '),
    }))
  }, [buckets, fmtInt, fmtPct1])

  const tituloRecorte = territorioFoco
    ? `Recorte: liderados ativos do TD ${territorioFoco}`
    : 'Recorte: todos os liderados ativos'

  return (
    <section className={cn('flex min-h-0 flex-col', shellClassName)}>
      <div className="mb-2 shrink-0">
        <h2 className="m-0 text-sm font-semibold text-text-primary">Engajamento por publicação</h2>
        <p className="mt-1 text-xs text-text-secondary">
          Linha do tempo por data de publicação: % de comentários da rede mobilizada (liderados) e engajamento
          orgânico. Várias publicações no mesmo dia aparecem na mesma coluna.
        </p>
        <p className="mt-0.5 text-[11px] text-text-muted">{tituloRecorte}</p>
      </div>

      {loadState === 'loading' ? (
        <p className="flex items-center gap-2 text-xs text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando linha do tempo…
        </p>
      ) : null}

      {loadState === 'error' && erro ? <p className="text-xs text-status-danger">{erro}</p> : null}
      {loadState === 'forbidden' && erro ? <p className="text-xs text-text-muted">{erro}</p> : null}

      {loadState === 'ready' ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <KpiMini
              titulo="Publicações"
              valor={fmtInt.format(totais.publicacoes)}
              isFutDark={isFutDark}
              isFutLight={isFutLight}
            />
            <KpiMini
              titulo="Comentários"
              valor={fmtInt.format(totais.comentarios)}
              isFutDark={isFutDark}
              isFutLight={isFutLight}
            />
            <KpiMini
              titulo="Liderados"
              valor={`${fmtPct1.format(totais.pctLiderados)}%`}
              hint={`${fmtInt.format(totais.liderados)} coment.`}
              destaque="liderados"
              isFutDark={isFutDark}
              isFutLight={isFutLight}
            />
            <KpiMini
              titulo="Orgânico"
              valor={`${fmtPct1.format(totais.pctOrganico)}%`}
              hint={`${fmtInt.format(totais.organico)} coment.`}
              isFutDark={isFutDark}
              isFutLight={isFutLight}
            />
          </div>

          <OperacaoBarChartLegend
            primaryLabel="Liderados (% comentários)"
            secondaryLabel="Orgânico (cauda / rótulo)"
            isFutDark={isFutDark}
          />

          <div className="mt-auto flex min-h-0 w-full flex-1 flex-col justify-end">
            {chartBuckets.length === 0 ? (
              <p className="text-xs text-text-muted">Nenhuma publicação com comentários sincronizados neste recorte.</p>
            ) : (
              <MapaDigitalIgOperacaoBarChart
                buckets={chartBuckets}
                isFutDark={isFutDark}
                isFutLight={isFutLight}
                ariaLabel="Gráfico de linha do tempo: percentual de comentários de liderados e orgânicos por data de publicação"
              />
            )}
          </div>
        </div>
      ) : null}
    </section>
  )
}

function KpiMini({
  titulo,
  valor,
  hint,
  destaque,
  isFutDark,
  isFutLight,
}: {
  titulo: string
  valor: string
  hint?: string
  destaque?: 'liderados'
  isFutDark: boolean
  isFutLight: boolean
}) {
  return (
    <div
      className={cn(
        'rounded-lg border px-2.5 py-2',
        destaque === 'liderados' &&
          (isFutDark
            ? 'border-blue-500/25 bg-blue-500/[0.08]'
            : isFutLight
              ? 'border-blue-300 bg-blue-50'
              : 'border-blue-200 bg-blue-50/80'),
        destaque !== 'liderados' &&
          (isFutDark
            ? 'border-white/12 bg-white/[0.04]'
            : isFutLight
              ? 'border-slate-200 bg-white/90'
              : 'border-border-card bg-background/60'),
      )}
    >
      <p
        className={cn(
          'text-[10px] font-medium uppercase tracking-wide',
          destaque === 'liderados' ? 'text-blue-700 dark:text-blue-200' : 'text-text-muted',
        )}
      >
        {titulo}
      </p>
      <p
        className={cn(
          'mt-0.5 text-lg font-bold tabular-nums',
          destaque === 'liderados' ? 'text-blue-800 dark:text-blue-100' : 'text-text-primary',
        )}
      >
        {valor}
      </p>
      {hint ? <p className="text-[10px] tabular-nums text-text-muted">{hint}</p> : null}
    </div>
  )
}
