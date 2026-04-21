'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  fetchInstagramCommentLeaders,
  fetchInstagramCommentsGrouped,
  loadInstagramConfigAsync,
  saveInstagramConfig,
  syncInstagramComments,
  type InstagramCommentLeader,
  type InstagramCommentLeadersResponse,
  type InstagramCommentsGroupedResponse,
  type InstagramPostWithComments,
  type InstagramStoredComment,
} from '@/lib/instagramApi'
import { InstagramConfigModal } from '@/components/instagram-config-modal'
import {
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  ImageIcon,
  Loader2,
  MessageCircle,
  RefreshCw,
  Settings,
  Trophy,
  ExternalLink,
  X,
} from 'lucide-react'

function commentMatchesLeader(c: InstagramStoredComment, leader: InstagramCommentLeader): boolean {
  if (leader.commenter_ig_id && c.commenter_ig_id) {
    return leader.commenter_ig_id === c.commenter_ig_id
  }
  const a = (c.commenter_username || '').trim().toLowerCase()
  const b = (leader.commenter_username || '').trim().toLowerCase()
  return Boolean(a && b && a === b)
}

function buildPostsForLeader(
  allPosts: InstagramPostWithComments[],
  leader: InstagramCommentLeader
): { post: InstagramPostWithComments; comments: InstagramStoredComment[] }[] {
  const out: { post: InstagramPostWithComments; comments: InstagramStoredComment[] }[] = []
  for (const post of allPosts) {
    const comments = post.comments.filter((c) => commentMatchesLeader(c, leader))
    if (comments.length > 0) {
      out.push({ post, comments })
    }
  }
  return out
}

function LeaderCommentsModal({
  leader,
  postsByMedia,
  onClose,
}: {
  leader: InstagramCommentLeader
  postsByMedia: InstagramPostWithComments[]
  onClose: () => void
}) {
  const slices = useMemo(() => buildPostsForLeader(postsByMedia, leader), [postsByMedia, leader])

  return (
    <div
      className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="leader-modal-title"
      onClick={onClose}
    >
      <div
        className="w-full sm:max-w-2xl max-h-[92dvh] sm:max-h-[88vh] rounded-t-2xl sm:rounded-2xl border border-border-card bg-bg-surface shadow-2xl flex flex-col overflow-hidden sm:my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-start justify-between gap-3 border-b border-border-card px-4 py-3">
          <div className="min-w-0">
            <h2 id="leader-modal-title" className="font-semibold text-text-primary truncate">
              @{leader.commenter_username || '—'}
            </h2>
            <p className="text-xs text-secondary mt-0.5">
              {leader.comment_count.toLocaleString('pt-BR')} comentário(s) no ranking · {slices.length}{' '}
              {slices.length === 1 ? 'publicação' : 'publicações'} nos dados carregados nesta página
            </p>
            {leader.commenter_ig_id && (
              <p className="text-[11px] text-secondary/80 font-mono break-all mt-1">ID: {leader.commenter_ig_id}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-2 text-secondary hover:bg-accent-gold-soft hover:text-text-primary"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-6">
          {slices.length === 0 ? (
            <p className="text-sm text-secondary">
              Nenhum comentário encontrado nos dados exibidos nesta página. Se a lista de publicações estiver limitada
              pela quantidade de linhas sincronizadas, sincronize novamente ou aumente o limite na API.
            </p>
          ) : (
            slices.map(({ post, comments }) => (
              <div key={post.instagram_media_id} className="rounded-lg border border-border-card overflow-hidden">
                <div className="flex gap-3 p-3 bg-accent-gold-soft/10 border-b border-border-card/80">
                  <div className="shrink-0 w-14 h-14 rounded-md border border-border-card overflow-hidden bg-accent-gold-soft/30 flex items-center justify-center">
                    {post.media_thumbnail_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={post.media_thumbnail_url} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <ImageIcon className="w-6 h-6 text-secondary" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary line-clamp-2">
                      {post.media_caption?.trim() || 'Sem legenda'}
                    </p>
                    <div className="mt-1 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-secondary">
                      {post.media_posted_at && (
                        <time>
                          {new Date(post.media_posted_at).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </time>
                      )}
                      {post.media_permalink && (
                        <a
                          href={post.media_permalink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-accent-gold hover:underline inline-flex items-center gap-0.5"
                        >
                          Instagram <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>
                </div>
                <ul className="divide-y divide-border-card/60">
                  {comments.map((c) => (
                    <li key={c.id} className="px-3 py-2.5 text-sm">
                      <div className="flex flex-wrap items-baseline justify-between gap-2">
                        <time className="text-xs text-secondary">
                          {new Date(c.commented_at).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </time>
                        {c.parent_instagram_comment_id && (
                          <span className="text-[10px] uppercase text-secondary">resposta</span>
                        )}
                      </div>
                      <p className="mt-1 text-text-primary whitespace-pre-wrap break-words">{c.comment_text}</p>
                    </li>
                  ))}
                </ul>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

function CommentRow({ c }: { c: InstagramStoredComment }) {
  return (
    <tr className="border-b border-border-card/50 hover:bg-accent-gold-soft/15 align-top">
      <td className="px-3 py-2 font-medium text-text-primary whitespace-nowrap">
        @{c.commenter_username || '—'}
        {c.parent_instagram_comment_id && (
          <span className="ml-1.5 text-[10px] uppercase tracking-wide text-secondary">resposta</span>
        )}
      </td>
      <td className="px-3 py-2 text-secondary text-xs whitespace-nowrap">
        {new Date(c.commented_at).toLocaleString('pt-BR', {
          dateStyle: 'short',
          timeStyle: 'short',
        })}
      </td>
      <td className="px-3 py-2 text-sm text-text-primary">
        <span className="line-clamp-3 whitespace-pre-wrap break-words">{c.comment_text}</span>
        <div className="mt-1 flex flex-wrap gap-2 text-[11px] text-secondary">
          {c.comment_like_count > 0 && <span>❤️ {c.comment_like_count}</span>}
          {c.hidden && <span className="text-status-warning">oculto</span>}
        </div>
      </td>
    </tr>
  )
}

function PostCard({ post, defaultOpen }: { post: InstagramPostWithComments; defaultOpen: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  const caption = post.media_caption?.trim() || 'Sem legenda'
  const posted = post.media_posted_at
    ? new Date(post.media_posted_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  return (
    <article className="rounded-xl border border-border-card bg-bg-surface shadow-card overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full text-left gap-4 p-4 hover:bg-accent-gold-soft/20 transition-premium"
      >
        <div className="shrink-0 w-20 h-20 rounded-lg bg-accent-gold-soft/30 border border-border-card overflow-hidden flex items-center justify-center">
          {post.media_thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL externa do Instagram
            <img src={post.media_thumbnail_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <ImageIcon className="w-8 h-8 text-secondary" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-semibold text-text-primary line-clamp-2 text-sm md:text-base">{caption}</h3>
            <span className="shrink-0 inline-flex items-center gap-1 text-secondary text-xs">
              {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </span>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-secondary">
            {posted && <time>{posted}</time>}
            <span className="font-medium text-accent-gold">
              {post.comments_count} comentário{post.comments_count !== 1 ? 's' : ''}
            </span>
            <span className="font-mono text-[10px] opacity-70 truncate max-w-[140px]" title={post.instagram_media_id}>
              {post.instagram_media_id}
            </span>
            {post.media_permalink && (
              <a
                href={post.media_permalink}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-1 text-accent-gold hover:underline"
              >
                Abrir no Instagram <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        </div>
      </button>
      {open && (
        <div className="border-t border-border-card px-2 pb-3">
          <div className="overflow-x-auto max-h-[min(75dvh,640px)] overflow-y-auto overscroll-contain">
            <table className="w-full text-sm min-w-[min(100%,520px)]">
              <thead className="sticky top-0 bg-bg-surface z-[1] border-b border-border-card">
                <tr className="text-left text-secondary text-xs uppercase tracking-wide">
                  <th className="px-3 py-2 w-[140px]">Perfil</th>
                  <th className="px-3 py-2 w-[130px]">Data / hora</th>
                  <th className="px-3 py-2">Comentário</th>
                </tr>
              </thead>
              <tbody>
                {post.comments.map((c) => (
                  <CommentRow key={c.id} c={c} />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </article>
  )
}

export default function InstagramLideresPage() {
  const [config, setConfig] = useState<{ token: string; businessAccountId: string } | null>(null)
  const [showConfig, setShowConfig] = useState(false)
  const [loadingConfig, setLoadingConfig] = useState(true)
  const [leaders, setLeaders] = useState<InstagramCommentLeader[]>([])
  const [stats, setStats] = useState<InstagramCommentLeadersResponse['stats'] | null>(null)
  const [grouped, setGrouped] = useState<InstagramCommentsGroupedResponse | null>(null)
  const [loadingData, setLoadingData] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [rankingLeader, setRankingLeader] = useState<InstagramCommentLeader | null>(null)

  const loadBoard = useCallback(async () => {
    setLoadingData(true)
    setError(null)
    try {
      const [L, G] = await Promise.all([
        fetchInstagramCommentLeaders(80),
        fetchInstagramCommentsGrouped(8000),
      ])
      if (L) {
        setLeaders(L.leaders)
        setStats(L.stats)
      } else {
        setLeaders([])
        setStats(null)
      }
      setGrouped(G)
    } catch {
      setError('Não foi possível carregar os dados salvos.')
    } finally {
      setLoadingData(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoadingConfig(true)
      const c = await loadInstagramConfigAsync()
      if (!cancelled) {
        if (c.token && c.businessAccountId) {
          setConfig(c)
        } else {
          setConfig(null)
        }
        setLoadingConfig(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    void loadBoard()
  }, [loadBoard])

  useEffect(() => {
    if (!rankingLeader) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setRankingLeader(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rankingLeader])

  const handleSync = async () => {
    const c = config ?? (await loadInstagramConfigAsync())
    if (!c.token || !c.businessAccountId) {
      setShowConfig(true)
      return
    }
    setSyncing(true)
    setSyncMessage(null)
    setError(null)
    const result = await syncInstagramComments(c.token, c.businessAccountId, 40)
    setSyncing(false)
    if (!result.success) {
      setError(result.error || 'Sincronização falhou')
      if (result.resetAt) {
        setSyncMessage(`Tente após ${new Date(result.resetAt).toLocaleString('pt-BR')}`)
      }
      return
    }
    const parts = [
      `${result.commentsUpserted ?? 0} comentários gravados/atualizados`,
      `${result.mediaProcessed ?? 0} publicações processadas`,
    ]
    if (result.errors?.length) {
      parts.push(`${result.errors.length} aviso(s) em mídias específicas`)
    }
    setSyncMessage(parts.join(' · '))
    await loadBoard()
  }

  const handleSaveConfig = (newConfig: { token: string; businessAccountId: string }) => {
    saveInstagramConfig(newConfig.token, newConfig.businessAccountId)
    setConfig(newConfig)
    setShowConfig(false)
  }

  const configured = Boolean(config?.token && config?.businessAccountId)
  const posts = grouped?.posts ?? []

  return (
    <div className="min-h-full p-4 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <Link
            href="/dashboard/conteudo"
            className="inline-flex items-center gap-2 text-sm text-secondary hover:text-accent-gold mb-3"
          >
            <ArrowLeft className="w-4 h-4" />
            Voltar para Conteúdo & Redes
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold text-text-primary flex items-center gap-3">
            <Trophy className="w-8 h-8 text-accent-gold shrink-0" />
            Instagram Líderes
          </h1>
            <p className="mt-2 text-secondary max-w-2xl">
            Comentários por publicação à esquerda; à direita, resumo e ranking. Duplo clique em uma linha do ranking
            para ver os comentários dessa pessoa por publicação. Mesmas credenciais da página Conteúdo.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setShowConfig(true)}
            className="inline-flex items-center gap-2 rounded-lg border border-border-card bg-bg-surface px-4 py-2.5 text-sm font-medium text-text-primary hover:border-accent-gold/50 transition-premium"
          >
            <Settings className="w-4 h-4" />
            Credenciais
          </button>
          <button
            type="button"
            disabled={syncing || loadingConfig}
            onClick={() => void handleSync()}
            className="inline-flex items-center gap-2 rounded-lg bg-accent-gold text-white px-4 py-2.5 text-sm font-semibold shadow-sm hover:opacity-95 disabled:opacity-50 transition-premium"
          >
            {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Sincronizar comentários
          </button>
        </div>
      </div>

      {!loadingConfig && !configured && (
        <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 px-4 py-3 text-sm text-text-primary">
          Configure o token e o ID da página na aba Conteúdo ou pelo botão &quot;Credenciais&quot; acima para
          habilitar a sincronização.
        </div>
      )}

      {error && (
        <div className="rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {syncMessage && (
        <div className="rounded-xl border border-status-success/40 bg-status-success/10 px-4 py-3 text-sm text-text-primary">
          {syncMessage}
        </div>
      )}

      <div className="flex flex-col lg:flex-row lg:items-start gap-8 lg:gap-10">
        {/* Coluna esquerda: publicações */}
        <section className="flex-1 min-w-0 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2">
            <h2 className="text-lg font-bold text-text-primary flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-accent-gold" />
              Por publicação
            </h2>
            {grouped?.meta.truncated && (
              <p className="text-xs text-status-warning">
                Lista limitada a {grouped.meta.maxRows} comentários no total; sincronize ou aumente o escopo na API se
                precisar de histórico maior.
              </p>
            )}
          </div>

          {loadingData ? (
            <div className="flex justify-center py-16 rounded-xl border border-border-card bg-bg-surface">
              <Loader2 className="w-10 h-10 animate-spin text-accent-gold" />
            </div>
          ) : posts.length === 0 ? (
            <div className="rounded-xl border border-border-card bg-bg-surface p-8 text-center text-secondary text-sm">
              Nenhuma publicação com comentários salvos. Rode uma sincronização após configurar o Instagram.
            </div>
          ) : (
            <div className="space-y-4">
              {posts.map((post, index) => (
                <PostCard key={post.instagram_media_id} post={post} defaultOpen={index < 4} />
              ))}
            </div>
          )}
        </section>

        {/* Coluna direita: resumo + ranking (largura maior; sticky com altura segura ao scroll) */}
        <aside className="w-full max-w-full sm:max-w-md lg:max-w-none lg:w-[26rem] xl:w-[28rem] shrink-0 lg:sticky lg:top-20 lg:self-start space-y-4">
          <div className="rounded-xl border border-border-card bg-bg-surface p-4 shadow-card">
            <div className="flex items-center gap-2 text-secondary text-xs font-medium uppercase tracking-wide">
              <MessageCircle className="w-3.5 h-3.5" />
              Resumo
            </div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div>
                <p className="text-[11px] text-secondary">Comentários</p>
                <p className="text-xl font-bold text-text-primary tabular-nums">
                  {loadingData ? '—' : (stats?.totalComments ?? 0).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-secondary">Perfis</p>
                <p className="text-xl font-bold text-text-primary tabular-nums">
                  {loadingData ? '—' : (stats?.uniqueCommenters ?? 0).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-xl border border-border-card bg-bg-surface overflow-hidden shadow-card flex flex-col lg:max-h-[calc(100dvh-7.5rem)]">
            <div className="border-b border-border-card px-3 py-3 shrink-0 flex items-start gap-2">
              <Trophy className="w-5 h-5 text-accent-gold shrink-0 mt-0.5" />
              <div>
                <h2 className="font-semibold text-text-primary text-sm leading-tight">Ranking geral</h2>
                <p className="text-[11px] text-secondary leading-snug mt-0.5">
                  Quem mais comenta · <span className="text-accent-gold/90">duplo clique</span> na linha para detalhar
                </p>
              </div>
            </div>
            <div className="overflow-y-auto overflow-x-auto flex-1 min-h-[12rem] max-h-[min(72dvh,calc(100dvh-10rem))] overscroll-contain">
              {loadingData ? (
                <div className="flex justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-accent-gold" />
                </div>
              ) : leaders.length === 0 ? (
                <p className="p-4 text-xs text-secondary">Nenhum dado para o ranking ainda.</p>
              ) : (
                <table className="w-full text-xs table-fixed">
                  <colgroup>
                    <col className="w-8" />
                    <col />
                    <col className="w-11" />
                    <col className="w-[5.5rem]" />
                  </colgroup>
                  <thead className="sticky top-0 z-[1] bg-bg-surface border-b border-border-card shadow-sm">
                    <tr className="text-left text-secondary">
                      <th className="px-2 py-2">#</th>
                      <th className="px-2 py-2">Perfil</th>
                      <th className="px-2 py-2 text-right">Tot.</th>
                      <th className="px-2 py-2">Último</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaders.map((row) => (
                      <tr
                        key={`${row.rank}-${row.commenter_ig_id ?? row.commenter_username ?? 'x'}`}
                        onDoubleClick={() => setRankingLeader(row)}
                        className="border-b border-border-card/60 hover:bg-accent-gold-soft/30 align-top cursor-pointer select-none"
                        title="Duplo clique para ver comentários por publicação"
                      >
                        <td className="px-2 py-2 text-secondary tabular-nums align-top">{row.rank}</td>
                        <td className="px-2 py-2 min-w-0 align-top">
                          <div className="font-medium text-text-primary break-words" title={row.commenter_username || ''}>
                            @{row.commenter_username || '—'}
                          </div>
                          {row.commenter_ig_id && (
                            <div
                              className="text-[10px] text-secondary break-all opacity-90 mt-0.5"
                              title={row.commenter_ig_id}
                            >
                              {row.commenter_ig_id}
                            </div>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right font-semibold tabular-nums whitespace-nowrap align-top">
                          {row.comment_count.toLocaleString('pt-BR')}
                        </td>
                        <td className="px-2 py-2 text-secondary leading-snug align-top break-words">
                          {new Date(row.last_commented_at).toLocaleString('pt-BR', {
                            day: '2-digit',
                            month: '2-digit',
                            year: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </aside>
      </div>

      {showConfig && (
        <InstagramConfigModal
          onClose={() => setShowConfig(false)}
          onSave={handleSaveConfig}
          currentConfig={config ?? undefined}
        />
      )}

      {rankingLeader && (
        <LeaderCommentsModal
          leader={rankingLeader}
          postsByMedia={posts}
          onClose={() => setRankingLeader(null)}
        />
      )}
    </div>
  )
}
