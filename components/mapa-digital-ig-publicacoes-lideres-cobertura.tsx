'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ChevronDown, ExternalLink, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchInstagramCommentsGrouped,
  type InstagramPostWithComments,
  type InstagramStoredComment,
} from '@/lib/instagramApi'
import {
  fetchMobilizacaoLideresInstagramPorTd,
  type LiderInstagramCoberturaDto,
} from '@/lib/mobilizacao-lideres-instagram-cobertura-client'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { INSTAGRAM_COMMENTS_SYNCED_EVENT } from '@/lib/instagram-comments-sync-events'

type Props = {
  /** Filtro opcional: só líderes cujo TD (município da liderança) coincide. */
  territorioFoco: TerritorioDesenvolvimentoPI | null
  sidebarCollapsed: boolean
  visualPreset: 'default' | 'futuristic'
}

function iniciaisNome(nome: string): string {
  const p = nome.trim().split(/\s+/).filter(Boolean)
  if (p.length === 0) return '?'
  const a = p[0]?.[0]
  const b = p.length > 1 ? p[p.length - 1]?.[0] : p[0]?.[1]
  return `${(a ?? '?').toUpperCase()}${(b ?? '').toUpperCase()}`.slice(0, 2)
}

function commentersNormalizados(comments: InstagramStoredComment[]): Set<string> {
  const s = new Set<string>()
  for (const c of comments) {
    const h = normalizeInstagramHandle(c.commenter_username)
    if (h) s.add(h)
  }
  return s
}

function analisarCobertura(lideres: LiderInstagramCoberturaDto[], commenters: Set<string>) {
  const comRede = lideres.filter((l) => l.handles.length > 0)
  const comentaram = comRede.filter((l) => l.handles.some((h) => commenters.has(h)))
  const naoComentaram = comRede.filter((l) => !l.handles.some((h) => commenters.has(h)))
  const semRedeCadastrada = lideres.length - comRede.length
  const nMedido = comRede.length
  const nOk = comentaram.length
  const pct = nMedido > 0 ? (nOk / nMedido) * 100 : 0
  return { comRede, comentaram, naoComentaram, semRedeCadastrada, nMedido, nOk, pct }
}

export function MapaDigitalIgPublicacoesLideresCobertura({
  territorioFoco,
  sidebarCollapsed,
  visualPreset,
}: Props) {
  const [loadState, setLoadState] = useState<'idle' | 'loading' | 'ready' | 'error' | 'forbidden'>('idle')
  const [erro, setErro] = useState<string>('')
  const [posts, setPosts] = useState<InstagramPostWithComments[]>([])
  const [postsMeta, setPostsMeta] = useState<{ truncated: boolean } | null>(null)
  const [lideres, setLideres] = useState<LiderInstagramCoberturaDto[]>([])

  const carregar = useCallback(async () => {
    setLoadState('loading')
    setErro('')
    const [g, L] = await Promise.all([
      fetchInstagramCommentsGrouped(8000),
      fetchMobilizacaoLideresInstagramPorTd(territorioFoco),
    ])
    if (L.ok === false) {
      if (L.status === 403) {
        setLoadState('forbidden')
        setErro(L.message ?? 'Sem permissão.')
        setPosts([])
        setLideres([])
        return
      }
      setLoadState('error')
      setErro(L.message ?? 'Não foi possível carregar líderes.')
      setPosts([])
      setLideres([])
      return
    }
    setLideres(L.data.lideres)
    if (!g) {
      setLoadState('error')
      setErro('Não foi possível carregar publicações sincronizadas.')
      setPosts([])
      setPostsMeta(null)
      return
    }
    const lista = g.posts.slice(0, 60)
    setPosts(lista)
    setPostsMeta({ truncated: g.meta.truncated || g.posts.length > lista.length })
    setLoadState('ready')
  }, [territorioFoco])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    const on = () => {
      void carregar()
    }
    window.addEventListener(INSTAGRAM_COMMENTS_SYNCED_EVENT, on)
    return () => window.removeEventListener(INSTAGRAM_COMMENTS_SYNCED_EVENT, on)
  }, [carregar])

  const textSm = sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
  const isFut = visualPreset === 'futuristic'

  const tituloContexto = useMemo(() => {
    if (territorioFoco) return `Líderes do TD ${territorioFoco} (via @ de liderados ativos)`
    return 'Todos os TDs (via @ de liderados ativos por líder)'
  }, [territorioFoco])

  return (
    <section className="mt-4 min-w-0">
      <h2
        className={cn(
          'm-0 text-xs font-semibold uppercase tracking-wide sm:text-sm',
          isFut ? 'text-text-secondary' : 'text-text-muted'
        )}
      >
        Publicações recentes
      </h2>
      <p className="mt-1 text-[10px] text-text-muted sm:text-[11px]">
        {tituloContexto}. Ordem: mais recente → mais antiga. Cobertura = algum @ do grupo do líder apareceu nos
        comentários desta publicação.
      </p>

      {loadState === 'loading' ? (
        <p className="mt-2 flex items-center gap-2 text-[10px] text-text-muted sm:text-[11px]">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          Carregando publicações…
        </p>
      ) : null}
      {loadState === 'error' && erro ? (
        <p className="mt-2 text-[10px] text-status-danger sm:text-[11px]">{erro}</p>
      ) : null}
      {loadState === 'forbidden' && erro ? (
        <p className="mt-2 text-[10px] text-text-muted sm:text-[11px]">{erro}</p>
      ) : null}

      {loadState === 'ready' ? (
        <>
          {lideres.length === 0 ? (
            <p className="mt-2 text-[10px] text-text-muted sm:text-[11px]">
              Nenhum líder com @ de liderado ativo neste recorte — cadastre Instagram em mobilização para medir
              cobertura.
            </p>
          ) : null}
          {posts.length === 0 ? (
            <p className="mt-2 text-[10px] text-text-muted sm:text-[11px]">
              Sincronize comentários do Instagram para ver publicações aqui.
            </p>
          ) : (
            <div className="max-h-[min(52vh,28rem)] space-y-0 overflow-y-auto overscroll-contain pt-2">
              {posts.map((post) => (
                <PostCoberturaCard key={post.instagram_media_id} post={post} lideres={lideres} textSm={textSm} isFut={isFut} />
              ))}
            </div>
          )}
          {postsMeta?.truncated ? (
            <p className="mt-2 text-[10px] text-text-muted sm:text-[11px]">
              Lista limitada às publicações mais recentes com comentários sincronizados.
            </p>
          ) : null}
        </>
      ) : null}
    </section>
  )
}

function PostCoberturaCard({
  post,
  lideres,
  textSm,
  isFut,
}: {
  post: InstagramPostWithComments
  lideres: LiderInstagramCoberturaDto[]
  textSm: string
  isFut: boolean
}) {
  const caption = post.media_caption?.trim() || 'Sem legenda'
  const posted = post.media_posted_at
    ? new Date(post.media_posted_at).toLocaleString('pt-BR', { dateStyle: 'medium', timeStyle: 'short' })
    : null

  const commenters = useMemo(() => commentersNormalizados(post.comments), [post.comments])
  const { comentaram, naoComentaram, semRedeCadastrada, nMedido, nOk, pct } = useMemo(
    () => analisarCobertura(lideres, commenters),
    [lideres, commenters]
  )

  return (
    <details
      className={cn(
        'group border-b border-border-card/25 pb-2 pt-2 first:pt-0 last:border-b-0',
        isFut && 'border-white/[0.08]'
      )}
    >
      <summary className="flex cursor-pointer list-none items-stretch gap-2 py-1 marker:hidden [&::-webkit-details-marker]:hidden sm:gap-2.5">
        <span
          aria-hidden
          className={cn(
            'mt-0.5 inline-block shrink-0 text-text-muted transition-transform group-open:rotate-180',
            isFut && 'text-white/50'
          )}
        >
          <ChevronDown className="h-4 w-4" />
        </span>
        <div className="h-14 w-14 shrink-0 overflow-hidden rounded-md border border-border-card/40 bg-card/50 sm:h-16 sm:w-16">
          {post.media_thumbnail_url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL do Instagram
            <img src={post.media_thumbnail_url} alt="" className="h-full w-full object-cover" loading="lazy" />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-[10px] text-text-muted">—</div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p
            className={cn(
              'line-clamp-2 font-medium leading-snug text-text-primary',
              textSm,
              isFut && 'text-white'
            )}
          >
            {caption}
          </p>
          <div className={cn('mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1', textSm)}>
            {posted ? (
              <time className={cn('text-text-muted', isFut && 'text-white/60')} dateTime={post.media_posted_at ?? undefined}>
                {posted}
              </time>
            ) : null}
            <span
              className={cn(
                'rounded-full border border-border-card/50 bg-card/40 px-2 py-0.5 tabular-nums text-text-secondary',
                isFut && 'border-white/15 bg-white/10 text-white/85'
              )}
            >
              {post.comments_count} comentário{post.comments_count === 1 ? '' : 's'}
            </span>
            {post.media_permalink ? (
              <a
                href={post.media_permalink}
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  'inline-flex items-center gap-1 text-accent-gold hover:underline',
                  isFut && 'text-amber-200/95'
                )}
                onClick={(e) => e.stopPropagation()}
              >
                Abrir no IG <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            ) : null}
          </div>
        </div>
      </summary>

      <div className={cn('mt-1 border-t border-border-card/20 pt-2', isFut && 'border-white/[0.08]')}>
        <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
          <span className={cn('text-[11px] font-medium uppercase tracking-wide text-text-muted sm:text-xs', isFut && 'text-white/55')}>
            Cobertura de líderes
          </span>
          <span className={cn('text-sm font-semibold tabular-nums text-status-success sm:text-base', isFut && 'text-emerald-300')}>
            {nOk} / {nMedido}
            <span className={cn('ml-1 text-xs font-normal text-text-muted', isFut && 'text-white/50')}>com rede</span>
          </span>
        </div>

        {nMedido === 0 ? (
          <p className={cn('text-text-muted', textSm, isFut && 'text-white/60')}>Sem @ de liderados para comparar.</p>
        ) : (
          <>
            <div className="mb-2 h-2 w-full overflow-hidden rounded-full bg-border-card/50">
              <div
                className="h-full rounded-full bg-accent-gold transition-[width] duration-300"
                style={{ width: `${Math.min(100, Math.round(pct))}%` }}
              />
            </div>
            <div className={cn('mb-3 flex flex-wrap gap-2', textSm)}>
              <span className="rounded-md bg-status-success/15 px-2 py-1 text-status-success">
                ✓ {nOk} comentaram
              </span>
              <span className="rounded-md bg-status-danger/12 px-2 py-1 text-status-danger">
                ✕ {naoComentaram.length} não comentaram
              </span>
              <span className="rounded-md bg-accent-gold/15 px-2 py-1 text-text-secondary">
                {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(pct)}% cobertura
              </span>
            </div>
            {semRedeCadastrada > 0 ? (
              <p className={cn('mb-2 text-text-muted', textSm, isFut && 'text-white/55')}>
                {semRedeCadastrada} líder{semRedeCadastrada === 1 ? '' : 'es'} sem @ de liderado neste recorte (fora da barra).
              </p>
            ) : null}
            {naoComentaram.length > 0 ? (
              <div>
                <p
                  className={cn(
                    'mb-1.5 text-[10px] font-semibold uppercase tracking-wide text-text-muted sm:text-[11px]',
                    isFut && 'text-rose-200/90'
                  )}
                >
                  Líderes sem comentário nesta publicação
                </p>
                <ul className="flex flex-wrap gap-1.5">
                  {naoComentaram.map((L) => (
                    <li
                      key={L.id}
                      title={L.nome}
                      className={cn(
                        'flex h-8 w-8 list-none items-center justify-center rounded-full border border-status-danger/35 bg-status-danger/10 text-[10px] font-semibold text-status-danger',
                        isFut && 'border-rose-400/40 bg-rose-950/50 text-rose-100'
                      )}
                    >
                      {iniciaisNome(L.nome)}
                    </li>
                  ))}
                </ul>
              </div>
            ) : (
              <p className={cn('text-text-muted', textSm, isFut && 'text-white/60')}>Todos os líderes com rede comentaram.</p>
            )}
          </>
        )}
      </div>
    </details>
  )
}
