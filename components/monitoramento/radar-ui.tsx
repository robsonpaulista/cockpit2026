'use client'

import { Fragment, useCallback, useEffect, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ExternalLink, Loader2, RefreshCw, X } from 'lucide-react'
import {
  TseChevronCelula,
  TseListaFiltro,
  TseRank,
  TseThOrdenavel,
  tseBotaoPrimarioClass,
  tseCardClass,
  tseTabela,
  type TseItemLista,
} from '@/components/tse/tse-ui'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import { labelActorType } from '@/lib/youtube-radar-labels'
import type { PoliticalActorType, PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

/** Props comuns às abas do radar: candidatos cadastrados e o filtro global de candidato (slug). */
export type RadarAbaProps = {
  atores: PoliticalActorWithTerms[]
  candidato: string | null
  onCandidatoChange: (slug: string | null) => void
}

export const fmtInt = (n: number): string => n.toLocaleString('pt-BR')

export function fmtData(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso}T12:00:00` : iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function fmtDataHora(iso: string | null | undefined): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

export function plural(n: number, um: string, varios: string): string {
  return `${fmtInt(n)} ${n === 1 ? um : varios}`
}

const TSE_HEX = TSE_TOKENS as Record<string, string>

/** Cores em hex para séries SVG (recharts não resolve var() em todos os navegadores). */
export const RADAR_CORES_SERIE = {
  proprio: TSE_HEX['--tse-yellow'],
  outros: [
    TSE_HEX['--tse-olive'],
    TSE_HEX['--tse-green'],
    TSE_HEX['--tse-muted'],
    TSE_HEX['--tse-gold-text'],
    TSE_HEX['--tse-text'],
    TSE_HEX['--tse-zero'],
  ],
  grade: TSE_HEX['--tse-border'],
  texto: TSE_HEX['--tse-muted'],
} as const

export function corDaSerie(tipo: PoliticalActorType | null | undefined, indiceOutro: number): string {
  return tipo === 'own_candidate'
    ? RADAR_CORES_SERIE.proprio
    : RADAR_CORES_SERIE.outros[indiceOutro % RADAR_CORES_SERIE.outros.length]
}

const COR_TIPO: Record<PoliticalActorType, string> = {
  own_candidate: 'var(--tse-yellow)',
  competitor: 'var(--tse-green)',
  ally: 'var(--tse-olive)',
  other: 'var(--tse-zero)',
}

export function corDoTipo(tipo: PoliticalActorType | null | undefined): string {
  return tipo ? COR_TIPO[tipo] : COR_TIPO.other
}

export function normalizar(texto: string | null | undefined): string {
  return (texto ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

export function useOrdenacao<C extends string>(inicial: C, colunasTexto: readonly C[] = []) {
  const [ordem, setOrdem] = useState<C>(inicial)
  const [asc, setAsc] = useState<boolean>(colunasTexto.includes(inicial))

  const ordenar = useCallback(
    (col: C) => {
      if (col === ordem) {
        setAsc((v) => !v)
        return
      }
      setOrdem(col)
      setAsc(colunasTexto.includes(col))
    },
    [ordem, colunasTexto],
  )

  return { ordem, asc, ordenar }
}

export function ordenarLinhas<T, C extends string>(
  linhas: readonly T[],
  valor: (linha: T, col: C) => number | string,
  ordem: C,
  asc: boolean,
): T[] {
  return [...linhas].sort((a, b) => {
    const va = valor(a, ordem)
    const vb = valor(b, ordem)
    const r =
      typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'pt-BR')
    return asc ? r : -r
  })
}

/** Posição de cada linha no ranking pelo valor principal (maior primeiro). */
export function rankPor<T>(linhas: readonly T[], chave: (l: T) => string, valor: (l: T) => number): Map<string, number> {
  const mapa = new Map<string, number>()
  ;[...linhas].sort((a, b) => valor(b) - valor(a)).forEach((l, i) => mapa.set(chave(l), i + 1))
  return mapa
}

/** Mantém abertas as linhas expandidas; ao focar um candidato no filtro global, abre a linha dele. */
export function useLinhasAbertas(candidato: string | null) {
  const [abertas, setAbertas] = useState<Set<string>>(() => new Set(candidato ? [candidato] : []))

  useEffect(() => {
    setAbertas(new Set(candidato ? [candidato] : []))
  }, [candidato])

  const alternar = useCallback((id: string) => {
    setAbertas((prev) => {
      const prox = new Set(prev)
      if (prox.has(id)) prox.delete(id)
      else prox.add(id)
      return prox
    })
  }, [])

  return { abertas, alternar, setAbertas }
}

export function RadarLayout({ aside, children }: { aside: ReactNode; children: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
      <aside className="space-y-4">{aside}</aside>
      <main className="min-w-0">{children}</main>
    </div>
  )
}

export function RadarDadosGerais({ fonte, children }: { fonte: ReactNode; children: ReactNode }) {
  return (
    <section className={tseCardClass}>
      <h2 className="text-xl font-bold">Dados Gerais</h2>
      <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">{fonte}</p>
      {children}
    </section>
  )
}

/** Lista lateral de candidatos: clicar aplica o filtro global de candidato. */
export function RadarListaCandidatos({
  titulo = 'Candidatos',
  itens,
  candidato,
  onCandidatoChange,
  formatar,
}: {
  titulo?: ReactNode
  itens: { slug: string; nome: string; tipo: PoliticalActorType | null; valor: number }[]
  candidato: string | null
  onCandidatoChange: (slug: string | null) => void
  formatar?: (n: number) => string
}) {
  if (itens.length === 0) return null
  const lista: TseItemLista<string>[] = itens.map((i) => ({
    id: i.slug,
    label: i.nome,
    valor: i.valor,
    cor: corDoTipo(i.tipo),
  }))
  return (
    <TseListaFiltro titulo={titulo} itens={lista} ativo={candidato} onChange={onCandidatoChange} formatar={formatar} />
  )
}

export function RadarResumo({
  titulo,
  escopo,
  descricao,
  numeros,
}: {
  titulo: string
  escopo: string
  descricao: ReactNode
  numeros: { rotulo: string; valor: ReactNode }[]
}) {
  return (
    <section className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
      <div className="min-w-[180px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xl font-bold uppercase">{titulo}</p>
          <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
            {escopo}
          </span>
        </div>
        <p className="text-[15px] text-[var(--tse-muted)]">{descricao}</p>
      </div>
      {numeros.map((n) => (
        <div key={n.rotulo} className="text-right">
          <p className="text-3xl font-black tabular-nums">{n.valor}</p>
          <p className="text-[13px] lowercase text-[var(--tse-muted)]">{n.rotulo}</p>
        </div>
      ))}
    </section>
  )
}

export function RadarLinhaContagem({ children, acoes }: { children: ReactNode; acoes?: ReactNode }) {
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
      <p className="text-[12px] text-[var(--tse-muted)]">{children}</p>
      {acoes ? <div className="flex items-center gap-4">{acoes}</div> : null}
    </div>
  )
}

/** Aviso em amarelo-claro (configuração pendente, limite de coleta) ou confirmação de coleta. */
export function RadarAviso({
  titulo,
  children,
  tom = 'atencao',
  carregando = false,
}: {
  titulo?: ReactNode
  children?: ReactNode
  tom?: 'atencao' | 'ok'
  carregando?: boolean
}) {
  const Icone = carregando ? Loader2 : tom === 'ok' ? CheckCircle2 : AlertTriangle
  return (
    <div
      role="status"
      className={cn(
        'mt-4 flex items-start gap-2.5 rounded-xl px-4 py-3 text-[13px]',
        tom === 'ok' ? 'bg-white shadow-sm' : 'bg-[var(--tse-yellow-soft)]',
      )}
    >
      <Icone
        className={cn(
          'mt-0.5 h-4 w-4 shrink-0',
          tom === 'ok' ? 'text-[var(--tse-olive)]' : 'text-[var(--tse-gold-text)]',
          carregando && 'animate-spin',
        )}
        aria-hidden
      />
      <div className="min-w-0">
        {titulo ? <p className="font-bold">{titulo}</p> : null}
        {children ? <div className={cn(titulo && 'mt-0.5', 'text-[var(--tse-text)]')}>{children}</div> : null}
      </div>
    </div>
  )
}

/** Progresso de coleta longa (Meta Ads, coleta geral do Panorama). */
export function RadarProgresso({
  titulo,
  detalhe,
  percent,
  rodape,
}: {
  titulo: ReactNode
  detalhe?: ReactNode
  percent: number
  rodape?: ReactNode
}) {
  const pct = Math.min(100, Math.max(4, percent))
  return (
    <div role="status" aria-live="polite" className="mt-4 rounded-xl bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex min-w-0 items-start gap-2">
          <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-[var(--tse-yellow)]" aria-hidden />
          <div className="min-w-0">
            <p className="text-[14px] font-bold">{titulo}</p>
            {detalhe ? <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">{detalhe}</p> : null}
          </div>
        </div>
        <span className="text-xl font-black tabular-nums">{Math.round(percent)}%</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#EEEEEE]">
        <div className="h-full rounded-full bg-[var(--tse-green)] transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
      {rodape ? <p className="mt-2 text-[11px] text-[var(--tse-muted)]">{rodape}</p> : null}
    </div>
  )
}

/** Filtro ativo removível na barra de ferramentas. */
export function RadarChip({ children, onRemover }: { children: ReactNode; onRemover: () => void }) {
  return (
    <button
      type="button"
      onClick={onRemover}
      className="inline-flex h-8 max-w-[260px] items-center gap-1.5 rounded-md border border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] px-2.5 text-[13px] font-semibold"
    >
      <span className="truncate">{children}</span>
      <X className="h-3.5 w-3.5 shrink-0" aria-hidden />
    </button>
  )
}

export type RadarColuna<T, C extends string> = {
  id: C
  rotulo: ReactNode
  celula: (linha: T) => ReactNode
  alinhar?: 'left' | 'right'
  className?: string
  ordenavel?: boolean
}

/** Tabela TSE com ranking, cabeçalhos ordenáveis e linhas expansíveis. */
export function RadarTabela<T, C extends string>({
  linhas,
  chave,
  rank,
  colunas,
  ordem,
  asc,
  onOrdenar,
  abertas,
  onAlternar,
  detalhe,
}: {
  linhas: readonly T[]
  chave: (linha: T) => string
  rank?: (linha: T) => number
  colunas: readonly RadarColuna<T, C>[]
  ordem: C
  asc: boolean
  onOrdenar: (col: C) => void
  abertas: Set<string>
  onAlternar: (id: string) => void
  detalhe: (linha: T) => ReactNode
}) {
  const totalColunas = colunas.length + (rank ? 2 : 1)
  return (
    <div className={tseTabela.container}>
      <table className={tseTabela.table} data-tse-tabela>
        <thead className={tseTabela.thead}>
          <tr>
            {rank ? <th className={cn(tseTabela.th, 'w-14')}>Pos.</th> : null}
            {colunas.map((c) =>
              c.ordenavel === false ? (
                <th key={c.id} className={cn(tseTabela.th, c.alinhar === 'right' && 'text-right', c.className)}>
                  {c.rotulo}
                </th>
              ) : (
                <TseThOrdenavel
                  key={c.id}
                  col={c.id}
                  sortCol={ordem}
                  sortAsc={asc}
                  onSort={onOrdenar}
                  alinhar={c.alinhar}
                  className={c.className}
                >
                  {c.rotulo}
                </TseThOrdenavel>
              ),
            )}
            <th className="w-8" aria-label="Detalhes" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const id = chave(linha)
            const aberta = abertas.has(id)
            return (
              <Fragment key={id}>
                <tr className={tseTabela.trClicavel} onClick={() => onAlternar(id)} aria-expanded={aberta}>
                  {rank ? (
                    <td className={tseTabela.td}>
                      <TseRank posicao={rank(linha)} />
                    </td>
                  ) : null}
                  {colunas.map((c) => (
                    <td key={c.id} className={cn(tseTabela.td, c.alinhar === 'right' && 'text-right', c.className)}>
                      {c.celula(linha)}
                    </td>
                  ))}
                  <TseChevronCelula aberta={aberta} />
                </tr>
                {aberta ? (
                  <tr className={tseTabela.tr}>
                    <td colSpan={totalColunas} className="p-0">
                      {detalhe(linha)}
                    </td>
                  </tr>
                ) : null}
              </Fragment>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export function RadarCodigo({ children }: { children: ReactNode }) {
  return <code className="rounded bg-white px-1 text-[12px]">{children}</code>
}

export function RadarColetar({
  onClick,
  ocupado,
  disabled = false,
  title,
  children = 'Coletar agora',
}: {
  onClick: () => void
  ocupado: boolean
  disabled?: boolean
  title?: string
  children?: ReactNode
}) {
  return (
    <button type="button" onClick={onClick} disabled={ocupado || disabled} title={title} className={tseBotaoPrimarioClass}>
      {ocupado ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
      {ocupado ? 'Coletando…' : children}
    </button>
  )
}

export function RadarCandidatoNome({
  nome,
  tipo,
  extra,
}: {
  nome: string
  tipo: PoliticalActorType | null
  extra?: ReactNode
}) {
  return (
    <div className="min-w-0">
      <p className="truncate font-bold">{nome}</p>
      <p className="flex flex-wrap items-center gap-x-2 text-[11px] text-[var(--tse-muted)]">
        {tipo ? (
          <span className={cn(tipo === 'own_candidate' && 'font-bold text-[var(--tse-gold-text)]')}>
            {labelActorType(tipo)}
          </span>
        ) : null}
        {extra}
      </p>
    </div>
  )
}

/** Resumo em texto dos principais itens (canais, fontes, páginas). */
export function RadarTopItens({ itens }: { itens: { nome: string; qtd: number }[] }) {
  if (itens.length === 0) return <span className="text-[var(--tse-muted)]">—</span>
  const texto = itens.map((i) => `${i.nome} (${i.qtd})`).join(' · ')
  return (
    <p className="truncate text-[12px]" title={texto}>
      {itens.map((i, idx) => (
        <span key={i.nome}>
          {idx > 0 ? <span className="text-[var(--tse-muted)]"> · </span> : null}
          {i.nome}
          <span className="text-[var(--tse-muted)]"> ({i.qtd})</span>
        </span>
      ))}
    </p>
  )
}

export function RadarSubLista({ vazio, children }: { vazio?: ReactNode; children?: ReactNode }) {
  return (
    <div className="bg-[var(--tse-bar)] px-4 py-3">
      {children ? (
        <ul className="divide-y divide-[#EEEEEE] overflow-hidden rounded-lg bg-white">{children}</ul>
      ) : (
        <p className="text-[12px] text-[var(--tse-muted)]">{vazio}</p>
      )}
    </div>
  )
}

export function RadarSubItem({
  titulo,
  href,
  meta,
  valor,
  extra,
}: {
  titulo: ReactNode
  href?: string | null
  meta?: ReactNode
  valor?: ReactNode
  extra?: ReactNode
}) {
  return (
    <li className="flex items-start gap-3 px-3 py-2">
      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 text-[13px] font-semibold">{titulo}</p>
        {extra}
        {meta ? <p className="mt-0.5 truncate text-[11px] text-[var(--tse-muted)]">{meta}</p> : null}
      </div>
      {valor != null ? <span className="shrink-0 text-right text-[13px] font-bold tabular-nums">{valor}</span> : null}
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="shrink-0 pt-0.5 text-[var(--tse-olive)] hover:text-[var(--tse-gold-text)]"
          aria-label="Abrir em nova aba"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      ) : null}
    </li>
  )
}
