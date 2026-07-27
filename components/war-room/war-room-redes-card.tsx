'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  IconChevronRight,
  IconEye,
  IconHeart,
  IconLoader2,
  IconPhoto,
  IconTags,
} from '@tabler/icons-react'
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
import { WarRoomHBar } from '@/components/war-room/war-room-ui'
import {
  WarRoomPostagensDiaModal,
  type WarRoomPostagemDiaItem,
} from '@/components/war-room/war-room-postagens-dia-modal'
import { cn } from '@/lib/utils'

const WAR_ROOM_TZ = 'America/Sao_Paulo'
const THEME_VISIBLE = 5

type PostClassification = {
  theme?: string
  isBoosted?: boolean
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

function todayKeyInTz(timeZone: string = WAR_ROOM_TZ): string {
  return calendarDateInTz(new Date(), timeZone)
}

function formatPostTime(iso: string, timeZone: string = WAR_ROOM_TZ): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return new Intl.DateTimeFormat('pt-BR', {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(d)
}

function getPostIdentifier(post: { id: string; postedAt?: string; caption?: string }): string {
  if (post.id) return post.id
  if (post.postedAt && post.caption) {
    const dateStr = new Date(post.postedAt).toISOString().split('T')[0]
    const captionHash = post.caption.substring(0, 50).replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    return `${dateStr}_${captionHash}`
  }
  return `post_${Date.now()}`
}

type Props = {
  className?: string
}

/** Redes sociais — 3 KPIs em linha + ranking por tema. */
export function WarRoomRedesCard({ className }: Props) {
  const { register } = useWarRoomRefresh()
  const change = useWarRoomCardChange('redes')
  const [metrics, setMetrics] = useState<InstagramMetrics | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [configured, setConfigured] = useState(false)
  const [classifications, setClassifications] = useState<Record<string, PostClassification>>({})
  const [postagensModalAberto, setPostagensModalAberto] = useState(false)

  const loadClassifications = async () => {
    try {
      const response = await fetch('/api/instagram/classifications', { cache: 'no-store' })
      if (!response.ok) return
      const data = (await response.json()) as {
        success?: boolean
        classifications?: Record<string, PostClassification>
      }
      if (data.success && data.classifications) {
        setClassifications(data.classifications)
        return
      }
    } catch {
      // fallback localStorage
    }
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('instagram_post_classifications')
      if (saved) {
        try {
          setClassifications(JSON.parse(saved) as Record<string, PostClassification>)
        } catch {
          // ignore
        }
      }
    }
  }

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
        '1d',
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
      await loadClassifications()
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
    return register('redes', async ({ silent }) => {
      await loadInstagram({ silent, forceRefresh: false })
    })
  }, [register, loadInstagram])

  const todayPosts = useMemo(() => {
    const today = todayKeyInTz()
    return (metrics?.posts ?? []).filter((post) => calendarDateInTz(post.postedAt) === today)
  }, [metrics])

  const socialKpis = useMemo(() => {
    const views = todayPosts.reduce((s, p) => s + (p.metrics.views || 0), 0)
    const engagement = todayPosts.reduce((s, p) => s + (p.metrics.engagement || 0), 0)
    return { views, engagement, postsCount: todayPosts.length }
  }, [todayPosts])

  const postagensDia = useMemo((): WarRoomPostagemDiaItem[] => {
    return [...todayPosts]
      .map((post) => {
        const id = getPostIdentifier(post)
        return {
          id,
          header: instagramCaptionHeader(post.caption) || 'Sem cabeçalho na legenda',
          theme: classifications[id]?.theme?.trim() || 'Sem tema',
          timeLabel: formatPostTime(post.postedAt),
          views: post.metrics.views || 0,
          engagement: post.metrics.engagement || 0,
          likes: post.metrics.likes || 0,
          comments: post.metrics.comments || 0,
          shares: post.metrics.shares || 0,
          saves: post.metrics.saves || 0,
        }
      })
      .sort((a, b) => b.engagement - a.engagement)
  }, [todayPosts, classifications])

  const themePerformance = useMemo(() => {
    const byTheme = new Map<string, number>()
    for (const post of postagensDia) {
      byTheme.set(post.theme, (byTheme.get(post.theme) || 0) + post.engagement)
    }
    const entries = [...byTheme.entries()]
    if (entries.length === 0) return []
    const maxEngagement = Math.max(...entries.map(([, eng]) => eng), 0)
    return entries
      .map(([label, engagement]) => ({
        label,
        engagement,
        pct: maxEngagement > 0 ? Math.round((engagement / maxEngagement) * 100) : 0,
      }))
      .sort(
        (a, b) =>
          b.engagement - a.engagement || a.label.localeCompare(b.label, 'pt-BR'),
      )
      .slice(0, THEME_VISIBLE)
  }, [postagensDia])

  const snapshotLines = useMemo(() => {
    if (!metrics) return null
    const posts = (metrics.posts ?? []).map(
      (p) => `${p.id}\t${p.metrics.engagement}\t${p.metrics.views}`,
    )
    return [
      `kpis\t${socialKpis.views}\t${socialKpis.engagement}\t${socialKpis.postsCount}`,
      ...posts,
    ]
  }, [metrics, socialKpis])

  useWarRoomSnapshot({
    cardId: 'redes',
    lines: snapshotLines,
    noun: 'indicador',
    ready: !loading || metrics != null,
  })

  const themes = themePerformance
  const emptyConfigured = configured && !loading && socialKpis.postsCount === 0

  return (
    <section
      id="wr-redes"
      className={cn('wr-redes-clean', 'wr-cell--redes', className)}
      aria-label="Redes sociais"
    >
      <header className="wr-redes-clean__header">
        <div>
          <h2 className="wr-redes-clean__heading">Redes sociais</h2>
          <p className="wr-redes-clean__sub">Desempenho de hoje</p>
        </div>
        <Link href="/dashboard/conteudo/redes" className="wr-redes-clean__header-link">
          Ver todas
        </Link>
      </header>

      {change ? (
        <div className="wr-redes-clean__badge">
          <WarRoomChangeBadge change={change} />
        </div>
      ) : null}

      {loading && !metrics ? (
        <div className="wr-redes-clean__state">
          <IconLoader2 className="h-5 w-5 animate-spin text-[var(--wr-muted)]" stroke={1.5} />
        </div>
      ) : !configured ? (
        <p className="wr-redes-clean__state">
          Configure o Instagram Pessoal para ver visualizações e engajamentos.{' '}
          <Link href="/dashboard/conteudo/redes" className="font-medium text-[var(--wr-gold)]">
            Abrir Instagram Pessoal
          </Link>
        </p>
      ) : (
        <>
          {error ? (
            <p className="wr-redes-clean__hint wr-redes-clean__hint--error">{error}</p>
          ) : null}
          {emptyConfigured ? (
            <p className="wr-redes-clean__hint">Nenhuma publicação de hoje ainda.</p>
          ) : null}

          <div className="wr-redes-clean__kpis" aria-label="Indicadores de hoje">
            <div className="wr-redes-clean__kpi wr-redes-clean__kpi--gold">
              <span className="wr-redes-clean__kpi-value tabular-nums">
                {loading ? '…' : formatWarRoomNumber(socialKpis.views)}
              </span>
              <span className="wr-redes-clean__kpi-label">
                <IconEye className="h-3 w-3 shrink-0" stroke={1.75} aria-hidden />
                Visualizações
              </span>
            </div>
            <div className="wr-redes-clean__kpi wr-redes-clean__kpi--slate">
              <span className="wr-redes-clean__kpi-value tabular-nums">
                {loading ? '…' : formatWarRoomNumber(socialKpis.engagement)}
              </span>
              <span className="wr-redes-clean__kpi-label">
                <IconHeart className="h-3 w-3 shrink-0" stroke={1.75} aria-hidden />
                Engajamentos
              </span>
            </div>
            <button
              type="button"
              className="wr-redes-clean__kpi wr-redes-clean__kpi--mist wr-redes-clean__kpi--btn"
              onClick={() => setPostagensModalAberto(true)}
              aria-label="Ver postagens do dia"
              title="Ver postagens do dia"
            >
              <span className="wr-redes-clean__kpi-value tabular-nums">
                {loading ? '…' : formatWarRoomNumber(socialKpis.postsCount)}
              </span>
              <span className="wr-redes-clean__kpi-label">
                <IconPhoto className="h-3 w-3 shrink-0" stroke={1.75} aria-hidden />
                Postagens
              </span>
            </button>
          </div>

          <p className="wr-redes-clean__section">
            <IconTags className="h-3 w-3" stroke={1.75} aria-hidden />
            Por tema
          </p>

          {loading && themes.length === 0 ? (
            <div className="wr-redes-clean__state wr-redes-clean__state--compact">
              <IconLoader2 className="h-5 w-5 animate-spin text-[var(--wr-muted)]" stroke={1.5} />
            </div>
          ) : themes.length === 0 ? (
            <p className="wr-redes-clean__empty">Sem temas de hoje.</p>
          ) : (
            <ul className="wr-redes-clean__list">
              {themes.map((theme) => (
                <li key={theme.label} className="wr-redes-clean__row">
                  <div className="wr-redes-clean__row-main min-w-0">
                    <span className="wr-redes-clean__theme truncate">{theme.label}</span>
                    <WarRoomHBar pct={theme.pct} tone="teal" className="mt-1.5" />
                  </div>
                  <span className="wr-redes-clean__value shrink-0 tabular-nums">
                    {formatWarRoomNumber(theme.engagement)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Link href="/dashboard/conteudo/redes" className="wr-redes-clean__footer">
        <span>
          {configured && socialKpis.postsCount > 0
            ? `Ver Instagram (${socialKpis.postsCount} hoje)`
            : 'Abrir Instagram Pessoal'}
        </span>
        <IconChevronRight className="h-4 w-4" stroke={1.75} aria-hidden />
      </Link>

      {postagensModalAberto ? (
        <WarRoomPostagensDiaModal
          posts={postagensDia}
          onClose={() => setPostagensModalAberto(false)}
        />
      ) : null}
    </section>
  )
}
