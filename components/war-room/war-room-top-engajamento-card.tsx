'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { IconChevronRight, IconHeart, IconLoader2 } from '@tabler/icons-react'
import {
  fetchInstagramData,
  loadInstagramConfig,
  loadInstagramConfigAsync,
  type InstagramMetrics,
} from '@/lib/instagramApi'
import { instagramCaptionHeader } from '@/lib/instagram-caption-municipio'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { WarRoomChangeBadge } from '@/components/war-room/war-room-change-badge'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'
import { useWarRoomSnapshot } from '@/components/war-room/use-war-room-snapshot'
import { cn } from '@/lib/utils'

const WAR_ROOM_TZ = 'America/Sao_Paulo'
const LOOKBACK_DAYS = 7
const TOP_SIZE = 5

type TopPost = {
  id: string
  dateLabel: string
  header: string
  engagement: number
}

type Props = {
  className?: string
}

function calendarDateInTz(iso: string | Date, timeZone: string = WAR_ROOM_TZ): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d)
}

function formatDataCurta(iso: string, timeZone: string = WAR_ROOM_TZ): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    day: '2-digit',
    month: '2-digit',
  }).format(d)
}

function cutoffKeyDaysAgo(days: number, timeZone: string = WAR_ROOM_TZ): string {
  const now = new Date()
  const cutoff = new Date(now.getTime() - (days - 1) * 24 * 60 * 60 * 1000)
  return calendarDateInTz(cutoff, timeZone)
}

/** Top 5 publicações por engajamento — últimos 7 dias (Instagram Pessoal). */
export function WarRoomTopEngajamentoCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('top-engajamento')
  const [metrics, setMetrics] = useState<InstagramMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)

  const loadInstagram = useCallback(async (opts?: {
    silent?: boolean
    forceRefresh?: boolean
  }) => {
    const silent = opts?.silent === true
    const forceRefresh = opts?.forceRefresh === true
    if (!silent) {
      setLoading(true)
      setError(null)
    }
    try {
      let cfg = loadInstagramConfig()
      if (!cfg.token || !cfg.businessAccountId) {
        cfg = await loadInstagramConfigAsync()
      }
      if (!cfg.token || !cfg.businessAccountId) {
        setConfigured(false)
        if (!silent) {
          setMetrics(null)
          setError('Instagram Pessoal não configurado')
        }
        return
      }
      setConfigured(true)
      const data = await fetchInstagramData(
        cfg.token,
        cfg.businessAccountId,
        '7d',
        forceRefresh,
      )
      if (!data) {
        if (!silent) {
          setError('Não foi possível carregar o Instagram')
          setMetrics(null)
        }
        return
      }
      setMetrics(data)
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Erro ao carregar Instagram')
        setMetrics(null)
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadInstagram({ silent: false })
  }, [loadInstagram])

  useEffect(() => {
    return register('top-engajamento', async ({ silent }) => {
      await loadInstagram({ silent, forceRefresh: false })
    })
  }, [register, loadInstagram])

  const topPosts = useMemo((): TopPost[] => {
    const cutoff = cutoffKeyDaysAgo(LOOKBACK_DAYS)
    return [...(metrics?.posts ?? [])]
      .filter((post) => {
        const day = calendarDateInTz(post.postedAt)
        return day !== '' && day >= cutoff
      })
      .map((post) => ({
        id: post.id || `${post.postedAt}-${(post.caption || '').slice(0, 24)}`,
        dateLabel: formatDataCurta(post.postedAt),
        header: instagramCaptionHeader(post.caption) || 'Sem cabeçalho',
        engagement: post.metrics.engagement || 0,
      }))
      .sort((a, b) => b.engagement - a.engagement)
      .slice(0, TOP_SIZE)
  }, [metrics])

  const snapshotLines = useMemo(
    () =>
      topPosts.map(
        (p) => `${p.id}\t${p.dateLabel}\t${p.engagement}\t${p.header}`,
      ),
    [topPosts],
  )

  useWarRoomSnapshot({
    cardId: 'top-engajamento',
    lines: loading && !metrics ? null : snapshotLines,
    noun: 'publicação',
    ready: !loading || metrics != null,
  })

  const initialLoading = loading && !metrics

  return (
    <section
      id="wr-top-engajamento"
      className={cn('wr-top-engajamento', 'wr-cell--top-engajamento', className)}
      aria-label="Top engajamento"
    >
      <header className="wr-top-engajamento__header">
        <div className="wr-top-engajamento__title-row">
          <div>
            <h2 className="wr-top-engajamento__heading">Top engajamento</h2>
            <p className="wr-top-engajamento__sub">
              Top {TOP_SIZE} · últimos {LOOKBACK_DAYS} dias
            </p>
          </div>
          {change ? (
            <WarRoomChangeBadge change={change} className="wr-top-engajamento__badge" />
          ) : null}
        </div>
      </header>

      {initialLoading ? (
        <div className="wr-top-engajamento__state">
          <IconLoader2 className="h-4 w-4 animate-spin" stroke={1.5} />
          Carregando publicações…
        </div>
      ) : !configured ? (
        <p className="wr-top-engajamento__state">
          Configure o Instagram Pessoal para ver o ranking.{' '}
          <Link href="/dashboard/conteudo/redes" className="font-medium text-[var(--wr-gold)]">
            Abrir Instagram
          </Link>
        </p>
      ) : error && topPosts.length === 0 ? (
        <p className="wr-top-engajamento__state wr-top-engajamento__state--erro">{error}</p>
      ) : topPosts.length === 0 ? (
        <p className="wr-top-engajamento__state">
          Nenhuma publicação nos últimos {LOOKBACK_DAYS} dias.
        </p>
      ) : (
        <ul className="wr-top-engajamento__list" aria-label="Top publicações por engajamento">
          <li className="wr-top-engajamento__row wr-top-engajamento__row--head" aria-hidden>
            <span>Data</span>
            <span>Header</span>
            <span className="text-right">Eng.</span>
          </li>
          {topPosts.map((post) => (
            <li
              key={post.id}
              className="wr-top-engajamento__row"
              title={`${post.dateLabel} · ${post.header} · ${formatWarRoomNumber(post.engagement)}`}
            >
              <span className="wr-top-engajamento__date tabular-nums">{post.dateLabel}</span>
              <span className="wr-top-engajamento__header-text truncate">{post.header}</span>
              <span className="wr-top-engajamento__eng tabular-nums">
                <IconHeart className="h-3 w-3 shrink-0 opacity-70" stroke={1.75} aria-hidden />
                {formatWarRoomNumber(post.engagement)}
              </span>
            </li>
          ))}
        </ul>
      )}

      <Link href="/dashboard/conteudo/redes" className="wr-top-engajamento__footer">
        <span>Ver publicações</span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>
    </section>
  )
}
