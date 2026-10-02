'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import { Loader2, MessageSquare, RefreshCw } from 'lucide-react'
import { syncInstagramComments, loadInstagramConfigAsync } from '@/lib/instagramApi'
import { formatPts } from '@/components/arena/arena-shell'
import { cn } from '@/lib/utils'

type MatchRow = {
  leaderId: string
  name: string
  city: string | null
  instagram: string
  commentCount: number
  lastCommentedAt: string | null
  sampleComments: Array<{
    id: string
    text: string
    commentedAt: string
    permalink: string | null
  }>
}

type MatchResponse = {
  days: number
  leadersTotal: number
  leadersWithComments: number
  commentsScanned: number
  commentsMatched: number
  matches: MatchRow[]
  error?: string
}

function fmtWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Date(iso).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

export function ArenaCommentsSyncPanel({ className }: { className?: string }) {
  const [days, setDays] = useState(30)
  const [lookbackSync, setLookbackSync] = useState(15)
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [data, setData] = useState<MatchResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [syncMsg, setSyncMsg] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  const loadMatch = useCallback(async (windowDays: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/arena/comments-match?days=${windowDays}`, { cache: 'no-store' })
      const json = (await res.json()) as MatchResponse
      if (!res.ok) {
        setError(json.error || 'Falha ao cruzar comentários')
        setData(null)
        return
      }
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro de rede')
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadMatch(days)
  }, [days, loadMatch])

  const handleSync = useCallback(async () => {
    setSyncing(true)
    setSyncMsg(null)
    setError(null)
    const cfg = await loadInstagramConfigAsync()
    const result = await syncInstagramComments(
      cfg.token,
      cfg.businessAccountId,
      40,
      lookbackSync,
    )
    setSyncing(false)
    if (!result.success) {
      setError(
        result.error ||
          (!cfg.configured
            ? 'Instagram não configurado no servidor (INSTAGRAM_TOKEN / INSTAGRAM_BUSINESS_ID).'
            : 'Sincronização falhou'),
      )
      return
    }
    setSyncMsg(
      `${result.commentsUpserted ?? 0} comentários gravados · ${result.mediaProcessed ?? 0} posts · janela ${result.lookbackDays ?? lookbackSync}d`,
    )
    await loadMatch(days)
  }, [days, lookbackSync, loadMatch])

  return (
    <section className={cn('arena-card', className)}>
      <div className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="arena-section-title mb-1 flex items-center gap-2">
            <MessageSquare className="h-4 w-4" strokeWidth={1.5} aria-hidden />
            Comentários reais × lideranças
          </h2>
          <p className="arena-sub">
            Sincroniza a Graph API (conta da campanha) e cruza com os @ cadastrados nas lideranças
            Engaja.
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <div className="arena-field">
            <label htmlFor="arena-match-days">Janela match</label>
            <select
              id="arena-match-days"
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              <option value={7}>7 dias</option>
              <option value={15}>15 dias</option>
              <option value={30}>30 dias</option>
              <option value={60}>60 dias</option>
            </select>
          </div>
          <div className="arena-field">
            <label htmlFor="arena-sync-days">Sync posts</label>
            <select
              id="arena-sync-days"
              value={lookbackSync}
              onChange={(e) => setLookbackSync(Number(e.target.value))}
            >
              <option value={7}>7 dias</option>
              <option value={15}>15 dias</option>
              <option value={30}>30 dias</option>
            </select>
          </div>
          <button
            type="button"
            className="arena-btn arena-btn--primary"
            disabled={syncing || loading}
            onClick={() => void handleSync()}
          >
            {syncing ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="h-4 w-4" strokeWidth={1.5} />
            )}
            {syncing ? 'Sincronizando…' : 'Sincronizar e cruzar'}
          </button>
          <button
            type="button"
            className="arena-btn arena-btn--ghost"
            disabled={loading || syncing}
            onClick={() => void loadMatch(days)}
          >
            Só cruzar
          </button>
        </div>
      </div>

      {error ? <p className="mb-3 text-sm text-[var(--arena-critical,#c0392b)]">{error}</p> : null}
      {syncMsg ? <p className="mb-3 text-sm text-[var(--cx-muted,#686865)]">{syncMsg}</p> : null}

      {loading && !data ? (
        <p className="arena-sub flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} /> Carregando cruzamento…
        </p>
      ) : data ? (
        <>
          <div className="arena-tiles mb-4" style={{ gridTemplateColumns: 'repeat(4, minmax(0,1fr))' }}>
            <article className="arena-card">
              <span className="arena-tile__label">Lideranças</span>
              <strong className="arena-tile__val">{data.leadersTotal}</strong>
            </article>
            <article className="arena-card">
              <span className="arena-tile__label">Com comentário</span>
              <strong className="arena-tile__val">{data.leadersWithComments}</strong>
            </article>
            <article className="arena-card">
              <span className="arena-tile__label">Coments. escaneados</span>
              <strong className="arena-tile__val">{formatPts(data.commentsScanned)}</strong>
            </article>
            <article className="arena-card">
              <span className="arena-tile__label">Matches</span>
              <strong className="arena-tile__val">{formatPts(data.commentsMatched)}</strong>
            </article>
          </div>

          <div className="arena-table-wrap">
            <table className="arena-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Liderança</th>
                  <th>@</th>
                  <th>Cidade</th>
                  <th>Comentários</th>
                  <th>Último</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {data.matches.map((m, i) => (
                  <Fragment key={m.leaderId}>
                    <tr>
                      <td className="arena-mono">{i + 1}</td>
                      <td className="font-semibold">{m.name}</td>
                      <td className="text-[var(--cx-muted,#686865)]">@{m.instagram}</td>
                      <td>{m.city ?? '—'}</td>
                      <td className="arena-mono font-bold">{m.commentCount}</td>
                      <td className="text-xs text-[var(--cx-muted,#686865)]">
                        {fmtWhen(m.lastCommentedAt)}
                      </td>
                      <td>
                        {m.commentCount > 0 ? (
                          <button
                            type="button"
                            className="arena-podium__link border-0 bg-transparent p-0"
                            onClick={() =>
                              setExpanded((cur) => (cur === m.leaderId ? null : m.leaderId))
                            }
                          >
                            {expanded === m.leaderId ? 'Ocultar' : 'Amostras'}
                          </button>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                    {expanded === m.leaderId
                      ? m.sampleComments.map((s) => (
                          <tr key={s.id}>
                            <td />
                            <td colSpan={6} className="text-xs text-[var(--cx-muted,#686865)]">
                              <span className="arena-mono">{fmtWhen(s.commentedAt)}</span>
                              {' · '}
                              {s.permalink ? (
                                <a
                                  href={s.permalink}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="text-[var(--cx-ink,#14161a)] underline"
                                >
                                  post
                                </a>
                              ) : (
                                'post'
                              )}
                              {' — '}
                              {s.text || '(sem texto)'}
                            </td>
                          </tr>
                        ))
                      : null}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  )
}
