'use client'

import { useState } from 'react'
import { Download, ExternalLink, Eye, Heart, MessageCircle, Share2 } from 'lucide-react'
import { tseBotaoPrimarioClass, tseCampoClass, tseLinkAcaoClass } from '@/components/tse/tse-ui'
import {
  isTemaObras,
  type InstagramPost,
  type InstagramPostClassification,
} from '@/hooks/use-instagram-redes'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import { cn } from '@/lib/utils'

const TIPO_LABEL: Record<string, string> = { image: 'Imagem', video: 'Vídeo', carousel: 'Carrossel' }
const NOVO_TEMA = '__novo__'
const controleClass = 'h-7 rounded-md border border-[var(--tse-border)] bg-white px-2 text-[12px] outline-none focus:border-[var(--tse-yellow)]'

function rotuloObra(obra: ObraMapaRow): string {
  const nome = (obra.obra || obra.tipo || 'Obra').trim()
  return `${obra.municipio?.trim() || 'Município'} — ${nome.length > 48 ? `${nome.slice(0, 48)}…` : nome}`
}

function Variacao({ atual, anterior, rotulo }: { atual: number; anterior: number | null | undefined; rotulo: string }) {
  if (!anterior) return null
  const pct = ((atual - anterior) / anterior) * 100
  if (pct === 0) return <span className="text-[10px] text-[var(--tse-muted)]">=</span>
  const sobe = pct > 0
  return (
    <span
      className={cn('text-[10px] font-bold tabular-nums', sobe ? 'text-[var(--tse-olive)]' : 'text-[#B42318]')}
      title={`${rotulo}: ${sobe ? '+' : ''}${pct.toFixed(1)}% em relação ao post anterior`}
    >
      {sobe ? '↑' : '↓'} {Math.abs(pct).toFixed(1)}%
    </span>
  )
}

type Props = {
  post: InstagramPost
  anterior: InstagramPost | null
  classificacao: InstagramPostClassification
  temas: string[]
  obras: ObraMapaRow[]
  onClassificar: (theme: string, isBoosted: boolean, obraMapaId: string | null) => void
  onAdicionarTema: (nome: string) => boolean
}

export function RedesPostCard({ post, anterior, classificacao, temas, obras, onClassificar, onAdicionarTema }: Props) {
  const [novoTemaAberto, setNovoTemaAberto] = useState<boolean>(false)
  const [novoTema, setNovoTema] = useState<string>('')
  const tema = classificacao.theme ?? ''
  const impulsionado = classificacao.isBoosted ?? false
  const obraId = classificacao.obraMapaId ?? null
  const temaDuplicado = novoTema.trim() !== '' && temas.includes(novoTema.trim())

  const fecharNovoTema = () => {
    setNovoTemaAberto(false)
    setNovoTema('')
  }

  const confirmarNovoTema = () => {
    const nome = novoTema.trim()
    if (!onAdicionarTema(nome)) return
    onClassificar(nome, impulsionado, null)
    fecharNovoTema()
  }

  const metricas = [
    { icone: Heart, rotulo: 'Curtidas', valor: post.metrics.likes, anterior: anterior?.metrics.likes },
    { icone: MessageCircle, rotulo: 'Comentários', valor: post.metrics.comments, anterior: anterior?.metrics.comments },
    { icone: Eye, rotulo: 'Visualizações', valor: post.metrics.views ?? 0, anterior: anterior?.metrics.views },
    { icone: Share2, rotulo: 'Compartilhamentos', valor: post.metrics.shares, anterior: anterior?.metrics.shares },
    { icone: Download, rotulo: 'Salvamentos', valor: post.metrics.saves, anterior: anterior?.metrics.saves },
  ]

  return (
    <article className="flex flex-col gap-3 overflow-hidden rounded-xl bg-white p-3 shadow-sm sm:flex-row">
      <div className="relative h-44 w-full shrink-0 overflow-hidden rounded-lg bg-[var(--tse-bar)] sm:h-40 sm:w-40">
        {post.thumbnail ? (
          <div
            className="h-full w-full bg-cover bg-center"
            style={{ backgroundImage: `url(${post.thumbnail})` }}
            role="img"
            aria-label="Preview da postagem"
          />
        ) : null}
        <div className="absolute right-1.5 top-1.5 flex flex-col items-end gap-1">
          <span className="rounded bg-[var(--tse-yellow)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
            {TIPO_LABEL[post.type] ?? post.type}
          </span>
          {impulsionado ? (
            <span className="rounded bg-[var(--tse-gold-text)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              Impulsionada
            </span>
          ) : null}
          {tema ? (
            <span className="max-w-[9rem] truncate rounded bg-[var(--tse-green)] px-2 py-0.5 text-[10px] font-bold uppercase text-white">
              {tema}
            </span>
          ) : null}
        </div>
      </div>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-start justify-between gap-2">
          <span className="text-[12px] text-[var(--tse-muted)]">
            {new Date(post.postedAt).toLocaleDateString('pt-BR', {
              day: '2-digit',
              month: '2-digit',
              year: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1', tseLinkAcaoClass)}
          >
            <ExternalLink className="h-3 w-3" /> Ver
          </a>
        </div>

        <p className="mt-1 line-clamp-2 text-[13px]">{post.caption || 'Sem legenda'}</p>

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[140px] flex-1">
            <select
              value={tema}
              onChange={(e) => {
                if (e.target.value === NOVO_TEMA) {
                  setNovoTemaAberto(true)
                  return
                }
                const proximo = e.target.value
                onClassificar(proximo, impulsionado, isTemaObras(proximo) ? obraId : null)
              }}
              className={cn(controleClass, 'w-full')}
              aria-label="Tema"
            >
              <option value="">Tema</option>
              {temas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value={NOVO_TEMA}>+ Adicionar novo tema</option>
            </select>

            {novoTemaAberto ? (
              <>
                <button
                  type="button"
                  aria-label="Fechar"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={fecharNovoTema}
                />
                <div className="absolute left-0 top-full z-50 mt-1 w-60 rounded-lg border border-[var(--tse-border)] bg-white p-3 shadow-lg">
                  <label className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                    Novo tema
                    <input
                      value={novoTema}
                      onChange={(e) => setNovoTema(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          confirmarNovoTema()
                        } else if (e.key === 'Escape') {
                          fecharNovoTema()
                        }
                      }}
                      placeholder="Nome do tema"
                      className={cn(tseCampoClass, 'mt-1 normal-case')}
                      autoFocus
                    />
                  </label>
                  {temaDuplicado ? <p className="mt-1 text-[11px] text-[#B42318]">Este tema já existe</p> : null}
                  <div className="mt-2 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={confirmarNovoTema}
                      disabled={!novoTema.trim() || temaDuplicado}
                      className={cn(tseBotaoPrimarioClass, 'flex-1')}
                    >
                      Adicionar
                    </button>
                    <button type="button" onClick={fecharNovoTema} className={tseLinkAcaoClass}>
                      Cancelar
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </div>

          {isTemaObras(tema) ? (
            <select
              value={obraId ?? ''}
              onChange={(e) => onClassificar(tema || 'Obras', impulsionado, e.target.value || null)}
              className={cn(controleClass, 'min-w-[160px] max-w-[240px] flex-[1.4]')}
              title="Relacionar post à obra do Mapa / Diagnóstico"
            >
              <option value="">Obra (match)</option>
              {[...obras]
                .sort(
                  (a, b) =>
                    a.municipio.localeCompare(b.municipio, 'pt-BR') ||
                    String(a.obra || '').localeCompare(String(b.obra || ''), 'pt-BR'),
                )
                .map((obra) => (
                  <option key={obra.id} value={obra.id}>
                    {rotuloObra(obra)}
                  </option>
                ))}
            </select>
          ) : null}

          <select
            value={impulsionado ? 'sim' : 'nao'}
            onChange={(e) => onClassificar(tema, e.target.value === 'sim', obraId)}
            className={cn(controleClass, 'w-[130px]')}
            aria-label="Impulsionado"
          >
            <option value="nao">Orgânica</option>
            <option value="sim">Impulsionada</option>
          </select>
        </div>

        <div className="mt-auto grid grid-cols-5 gap-1 pt-3 text-center">
          {metricas.map((m) => (
            <div key={m.rotulo} className="rounded-md bg-[var(--tse-bar)] px-1 py-1.5">
              <p className="flex items-center justify-center gap-1 text-[13px] font-black tabular-nums">
                <m.icone className="h-3 w-3 text-[var(--tse-gold-text)]" />
                {m.valor > 0 ? m.valor.toLocaleString('pt-BR') : '—'}
              </p>
              <p className="mt-0.5 flex flex-wrap items-center justify-center gap-x-1 text-[10px] text-[var(--tse-muted)]">
                <span className="truncate">{m.rotulo}</span>
                <Variacao atual={m.valor} anterior={m.anterior} rotulo={m.rotulo} />
              </p>
            </div>
          ))}
        </div>
      </div>
    </article>
  )
}
