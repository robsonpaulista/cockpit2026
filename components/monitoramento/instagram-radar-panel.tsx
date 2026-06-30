'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { InstagramCompareBoard } from '@/components/instagram-radar/instagram-compare-board'
import { YoutubeActorsManager } from '@/components/youtube-radar/youtube-actors-manager'
import type { InstagramRadarCollectStatus } from '@/lib/instagram-radar-types'
import type { InstagramRadarPostWithActor } from '@/lib/instagram-radar-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { loadInstagramConfigAsync } from '@/lib/instagramApi'
import { chromeButtonClass, chromeFilterChipClass, chromePanelToolbarClass } from '@/lib/button-chrome'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const LOOKBACK_OPTIONS = [30, 60, 90] as const

function formatNextCollect(iso: string | null): string {
  if (!iso) return ''
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function InstagramRadarPanel() {
  const [lookbackDays, setLookbackDays] = useState<number>(30)
  const [actors, setActors] = useState<PoliticalActorWithTerms[]>([])
  const [setupRequired, setSetupRequired] = useState(false)
  const [posts, setPosts] = useState<InstagramRadarPostWithActor[]>([])
  const [status, setStatus] = useState<InstagramRadarCollectStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [collecting, setCollecting] = useState(false)
  const [error, setError] = useState('')
  const [collectMessage, setCollectMessage] = useState('')
  const [collectWarnings, setCollectWarnings] = useState<string[]>([])

  const refreshStatus = useCallback(async () => {
    const res = await fetch('/api/instagram-radar/status', { cache: 'no-store' })
    const j = (await res.json()) as InstagramRadarCollectStatus & {
      setupRequired?: boolean
      message?: string
      error?: string
    }
    if (!res.ok && !j.setupRequired) {
      setError(j.error ?? 'Falha ao carregar status do Instagram Radar.')
      return null
    }
    setStatus(j)
    return j
  }, [])

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [actorsRes, postsRes, statusJson] = await Promise.all([
        fetch('/api/monitoramento/actors', { cache: 'no-store' }),
        fetch(`/api/instagram-radar/mentions?politico=all&days=${lookbackDays}&limit=400`, {
          cache: 'no-store',
        }),
        refreshStatus(),
      ])

      const actorsJson = (await actorsRes.json()) as {
        setupRequired?: boolean
        actors?: PoliticalActorWithTerms[]
      }
      setSetupRequired(Boolean(actorsJson.setupRequired))
      setActors(actorsJson.actors ?? [])

      const postsJson = (await postsRes.json()) as {
        error?: string
        setupRequired?: boolean
        posts?: InstagramRadarPostWithActor[]
      }

      if (!postsRes.ok) {
        if (postsJson.setupRequired) {
          setSetupRequired(true)
          setPosts([])
        } else {
          throw new Error(postsJson.error ?? 'Falha ao carregar posts Instagram.')
        }
      } else {
        setSetupRequired(Boolean(postsJson.setupRequired))
        setPosts(postsJson.posts ?? [])
      }

      if (statusJson?.setupRequired) setSetupRequired(true)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar Instagram.')
    } finally {
      setLoading(false)
    }
  }, [lookbackDays, refreshStatus])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const coletar = useCallback(async () => {
    setCollecting(true)
    setCollectMessage('')
    setCollectWarnings([])
    setError('')
    try {
      const igConfig = await loadInstagramConfigAsync()
      const res = await fetch('/api/instagram-radar/collect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instagramToken: igConfig.token || undefined,
          instagramBusinessAccountId: igConfig.businessAccountId || undefined,
        }),
      })
      const j = (await res.json()) as {
        error?: string
        totals?: {
          postsFound: number
          postsInserted: number
          postsUpdated: number
          estimatedCostUsd: number
          errors?: string[]
        }
      }
      if (!res.ok) throw new Error(j.error ?? 'Falha na coleta.')

      const t = j.totals
      const warnings = (t?.errors ?? []).filter(Boolean)
      setCollectWarnings(warnings)
      setCollectMessage(
        t
          ? `Coleta concluída: ${t.postsFound} posts · ${t.postsInserted} novos · ${t.postsUpdated} atualizados`
          : 'Coleta concluída.'
      )
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro na coleta.')
    } finally {
      setCollecting(false)
      await refreshStatus()
    }
  }, [carregar, refreshStatus])

  const canCollect = status?.canCollect ?? false
  const cooldownEnabled = status?.cooldownEnabled ?? true
  const apifyConfigured = status?.apifyConfigured ?? false
  const ownAccountConfigured = status?.ownAccountConfigured ?? false
  const collectDisabled =
    collecting ||
    setupRequired ||
    (!apifyConfigured && !ownAccountConfigured) ||
    (cooldownEnabled && !canCollect && !collecting)

  return (
    <div className="flex flex-col gap-4">
      {setupRequired ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Execute{' '}
          <code className="rounded bg-white/80 px-1">database/create-instagram-radar-tables.sql</code> no
          Supabase e configure o candidato próprio em Redes &amp; Instagram.
        </div>
      ) : null}

      <div className={chromePanelToolbarClass}>
        <span className={typographyBodyMutedClass}>Janela:</span>
        {LOOKBACK_OPTIONS.map((days) => (
          <button
            key={days}
            type="button"
            onClick={() => setLookbackDays(days)}
            className={chromeFilterChipClass(lookbackDays === days)}
          >
            {days} dias
          </button>
        ))}
        <button
          type="button"
          disabled={collectDisabled}
          onClick={() => void coletar()}
          title={
            cooldownEnabled && !canCollect && status?.nextCollectAt
              ? `Próxima coleta: ${formatNextCollect(status.nextCollectAt)}`
              : undefined
          }
          className={cn(chromeButtonClass, 'ml-auto')}
        >
          {collecting ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Atualizar
        </button>
      </div>

      {collectMessage ? <p className="text-sm text-[#3B6D11]">{collectMessage}</p> : null}
      {collectWarnings.length > 0 ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
          <p className="font-medium">Avisos da coleta</p>
          <ul className="mt-1 list-disc pl-4">
            {collectWarnings.map((w) => (
              <li key={w}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <InstagramCompareBoard
        actors={actors}
        posts={posts}
        lookbackDays={lookbackDays}
        loading={loading}
      />

      {!setupRequired ? (
        <YoutubeActorsManager
          actors={actors}
          onChanged={carregar}
          disabled={loading || collecting}
          showInstagramField
        />
      ) : null}
    </div>
  )
}
