'use client'

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, TrendingDown, TrendingUp, UserPlus } from 'lucide-react'
import { TsePill, tseLinkAcaoClass } from '@/components/tse/tse-ui'
import {
  isSituacaoEleito,
  parseVotosEleicao,
  type EstreanteCandidato,
  type MovimentoCandidato,
  type MovimentosCandidatos,
  type ParticipacaoCandidato,
  type ResultadoEleicao,
} from '@/lib/resumo-eleicoes-dados'
import { cn } from '@/lib/utils'

const fmt = (n: number): string => n.toLocaleString('pt-BR')

type SiglaSituacao = { sigla: 'E' | 'S' | 'N' | '—'; tom: 'amarelo' | 'verde' | 'neutro' }

function siglaSituacao(situacao: string): SiglaSituacao {
  if (isSituacaoEleito(situacao)) return { sigla: 'E', tom: 'amarelo' }
  const texto = situacao.trim()
  if (/suplente/i.test(texto)) return { sigla: 'S', tom: 'verde' }
  if (!texto || texto.startsWith('#')) return { sigla: '—', tom: 'neutro' }
  return { sigla: 'N', tom: 'neutro' }
}

/* Dados Gerais (faixa horizontal) */

const fmtPct = (n: number): string => `${n.toFixed(1).replace('.', ',')}%`

function Kpi({
  rotulo,
  valor,
  selo,
  children,
}: {
  rotulo: string
  valor: string
  selo?: ReactNode
  children?: ReactNode
}) {
  return (
    <div className="min-w-0 xl:px-6 xl:first:pl-0 xl:last:pr-0">
      <p className="truncate text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">{rotulo}</p>
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        {/* div, não span: o CSS global do war-room força 13px em todo p/span dentro de main */}
        <div className="text-[28px] font-bold leading-none tabular-nums">{valor}</div>
        {selo}
      </div>
      {children ? <div className="mt-2 text-[12px] leading-snug text-[var(--tse-muted)]">{children}</div> : null}
    </div>
  )
}

function SeloVariacao({ pct, titulo }: { pct: number; titulo: string }) {
  const Icone = pct > 0 ? ArrowUp : pct < 0 ? ArrowDown : null
  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-bold tabular-nums',
        pct > 0 && 'bg-[color-mix(in_srgb,var(--tse-olive)_14%,white)] text-[var(--tse-olive)]',
        pct < 0 && 'bg-red-50 text-red-700',
        pct === 0 && 'bg-[var(--tse-bar)] text-[var(--tse-muted)]',
      )}
    >
      {Icone ? <Icone className="h-3 w-3" aria-hidden /> : null}
      {fmtPct(Math.abs(pct))}
    </span>
  )
}

export function AtendimentoDadosGerais({
  fonte,
  eleitores,
  alcancePct,
  votos2022,
  votos2026,
  rotuloCenario,
  votosCenario,
  liderancas,
  acoesLiderancas,
}: {
  fonte: ReactNode
  eleitores: number | null
  alcancePct: number | null
  votos2022: number
  votos2026: number | null
  rotuloCenario: string
  votosCenario: number
  liderancas: number
  acoesLiderancas?: ReactNode
}) {
  const destaque = 'font-bold text-[var(--tse-text)]'
  const variacao = (atual: number, base: number): number | null => (base > 0 ? ((atual - base) / base) * 100 : null)
  const pctVs2022 = votos2026 !== null ? variacao(votos2026, votos2022) : null
  const pctVsExpectativa = votos2026 !== null ? variacao(votos2026, votosCenario) : null
  const saldoVsExpectativa = votos2026 !== null ? votos2026 - votosCenario : 0
  return (
    <section className="mt-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold">Dados Gerais</h2>
        <p className="text-[10px] font-semibold text-[var(--tse-muted)]">{fonte}</p>
      </div>
      <div className="mt-4 grid gap-5 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 xl:divide-x xl:divide-[#EEEEEE]">
        <Kpi rotulo="Eleitores" valor={eleitores !== null ? fmt(eleitores) : '—'}>
          {alcancePct !== null ? (
            <>
              <span className={destaque}>{fmtPct(alcancePct)}</span> do eleitorado na expectativa
            </>
          ) : (
            'Eleitorado não informado'
          )}
        </Kpi>
        <Kpi
          rotulo="Votos 2026 · Jadyel"
          valor={votos2026 !== null ? fmt(votos2026) : '—'}
          selo={pctVs2022 !== null ? <SeloVariacao pct={pctVs2022} titulo="Em relação a 2022" /> : null}
        >
          <span className={destaque}>{fmt(votos2022)}</span> votos em 2022
        </Kpi>
        <Kpi
          rotulo={rotuloCenario}
          valor={fmt(votosCenario)}
          selo={
            pctVsExpectativa !== null ? (
              <SeloVariacao pct={pctVsExpectativa} titulo="Resultado 2026 em relação à expectativa" />
            ) : null
          }
        >
          {votos2026 === null ? (
            'Aguardando resultado 2026'
          ) : saldoVsExpectativa === 0 ? (
            'Resultado igual à expectativa'
          ) : (
            <>
              Resultado <span className={destaque}>{fmt(Math.abs(saldoVsExpectativa))}</span> votos{' '}
              {saldoVsExpectativa > 0 ? 'acima' : 'abaixo'}
            </>
          )}
        </Kpi>
        <Kpi rotulo="Lideranças" valor={fmt(liderancas)}>
          <div className="flex flex-wrap items-center gap-3">{acoesLiderancas}</div>
        </Kpi>
      </div>
    </section>
  )
}

/* Quadros dos cargos */

const thClass = 'px-1.5 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]'
const tdClass = 'px-1.5 py-1.5'
/** Em telas menores os cinco quadros ficam estreitos; a coluna de partido sai para dar espaço ao nome. */
const colunaPartidoClass = 'hidden min-[1700px]:table-cell'
const checkboxClass = 'h-3.5 w-3.5 cursor-pointer accent-[var(--tse-olive)]'

function Paginacao({
  pagina,
  totalItens,
  porPagina,
  onPagina,
}: {
  pagina: number
  totalItens: number
  porPagina: number
  onPagina: (pagina: number) => void
}) {
  const total = Math.ceil(totalItens / porPagina)
  if (total <= 1) return null
  const botao =
    'rounded-md p-1 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-olive)] disabled:opacity-30 disabled:hover:bg-transparent'
  return (
    <div className="flex items-center gap-1 text-[11px] font-semibold text-[var(--tse-muted)]">
      <button
        type="button"
        onClick={() => onPagina(Math.max(1, pagina - 1))}
        disabled={pagina === 1}
        aria-label="Página anterior"
        className={botao}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
      <span className="tabular-nums">
        {pagina}/{total}
      </span>
      <button
        type="button"
        onClick={() => onPagina(Math.min(total, pagina + 1))}
        disabled={pagina === total}
        aria-label="Próxima página"
        className={botao}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  )
}

function Quadro({
  titulo,
  qtdSelecionados,
  votosSelecionados,
  onLimpar,
  paginacao,
  children,
}: {
  titulo: string
  qtdSelecionados: number
  votosSelecionados: number
  onLimpar: () => void
  paginacao: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex min-w-0 flex-col rounded-2xl bg-white p-3 shadow-sm">
      <h3 className="px-1.5 text-[14px] font-bold">{titulo}</h3>
      <div className="mt-2 min-w-0 flex-1">{children}</div>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[#EEEEEE] px-1.5 pt-2 text-[11px] text-[var(--tse-muted)]">
        <span>
          Selecionados <strong className="text-[var(--tse-text)]">{qtdSelecionados}</strong> · Votos{' '}
          <strong className="tabular-nums text-[var(--tse-text)]">{fmt(votosSelecionados)}</strong>
          {qtdSelecionados > 0 ? (
            <button type="button" onClick={onLimpar} className={cn(tseLinkAcaoClass, 'ml-2 text-[10px]')}>
              Limpar
            </button>
          ) : null}
        </span>
        {paginacao}
      </div>
    </section>
  )
}

function classeLinha(selecionada: boolean, destaque: boolean): string {
  return cn(
    'border-t border-[#EEEEEE] transition-colors',
    selecionada ? 'bg-[var(--tse-yellow-soft)]' : 'hover:bg-[var(--tse-bar)]',
    destaque && 'font-bold shadow-[inset_3px_0_0_var(--tse-yellow)]',
  )
}

export function QuadroCandidatos({
  titulo,
  chaveTabela,
  itens,
  pagina,
  porPagina,
  onPagina,
  selecao,
  onAlternar,
  onLimpar,
  onIncluirLideranca,
  renderNome,
  formatarPartido,
  destacar,
  iconeDestaque,
  mostrarSituacao = false,
  onDuploClique,
  dicaLinha,
}: {
  titulo: string
  chaveTabela: string
  itens: ResultadoEleicao[]
  pagina: number
  porPagina: number
  onPagina: (pagina: number) => void
  selecao: Record<string, number>
  onAlternar: (rowId: string, votos: number) => void
  onLimpar: () => void
  onIncluirLideranca: (event: ReactMouseEvent, item: ResultadoEleicao, votos: number) => void
  renderNome: (item: ResultadoEleicao) => ReactNode
  formatarPartido: (partido: string) => string
  destacar?: (item: ResultadoEleicao) => boolean
  iconeDestaque?: ReactNode
  mostrarSituacao?: boolean
  onDuploClique?: (item: ResultadoEleicao) => void
  dicaLinha?: string
}) {
  const visiveis = itens.slice((pagina - 1) * porPagina, pagina * porPagina)
  const total = itens.reduce((acc, i) => acc + parseVotosEleicao(i.quantidadeVotosNominais), 0)
  const votosSelecionados = Object.values(selecao).reduce((a, b) => a + b, 0)

  return (
    <Quadro
      titulo={titulo}
      qtdSelecionados={Object.keys(selecao).length}
      votosSelecionados={votosSelecionados}
      onLimpar={onLimpar}
      paginacao={<Paginacao pagina={pagina} totalItens={itens.length} porPagina={porPagina} onPagina={onPagina} />}
    >
      <table className="w-full table-fixed text-[12px]" data-tse-tabela>
        <thead className="bg-[var(--tse-bar)] text-left">
          <tr>
            <th className={cn(thClass, 'w-7 text-center')}>
              <span className="sr-only">Selecionar</span>
            </th>
            <th className={thClass}>Candidato</th>
            <th className={cn(thClass, colunaPartidoClass, 'w-[4.25rem]')}>Partido</th>
            <th className={cn(thClass, 'w-14 text-right')}>Votos</th>
            {mostrarSituacao ? (
              <th className={cn(thClass, 'w-10 text-center')} title="Situação: E eleito · S suplente · N não eleito">
                Sit.
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {visiveis.map((item) => {
            const rowId = `${chaveTabela}:${item.nomeUrnaCandidato}:${item.numeroUrna}`
            const votos = parseVotosEleicao(item.quantidadeVotosNominais)
            const selecionada = selecao[rowId] !== undefined
            const destaque = destacar?.(item) ?? false
            const situacao = siglaSituacao(item.situacao)
            const partido = formatarPartido(item.partido)
            return (
              <tr
                key={`${item.nomeUrnaCandidato}-${item.numeroUrna}`}
                className={cn(classeLinha(selecionada, destaque), onDuploClique && destaque && 'select-none')}
                onDoubleClick={onDuploClique ? () => onDuploClique(item) : undefined}
                title={dicaLinha}
              >
                <td className={cn(tdClass, 'text-center')}>
                  <input
                    type="checkbox"
                    checked={selecionada}
                    onChange={() => onAlternar(rowId, votos)}
                    onContextMenu={(e) => onIncluirLideranca(e, item, votos)}
                    title="Botão direito: incluir como liderança"
                    aria-label={`Selecionar ${item.nomeUrnaCandidato}`}
                    className={checkboxClass}
                  />
                </td>
                <td className={cn(tdClass, 'min-w-0')}>
                  <span className="flex min-w-0 items-center gap-1">
                    <span className="min-w-0 truncate">{renderNome(item)}</span>
                    {destaque ? iconeDestaque : null}
                  </span>
                </td>
                <td
                  className={cn(tdClass, colunaPartidoClass, 'truncate text-[11px] text-[var(--tse-muted)]')}
                  title={partido}
                >
                  {partido || '—'}
                </td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{fmt(votos)}</td>
                {mostrarSituacao ? (
                  <td className={cn(tdClass, 'text-center')} title={item.situacao || undefined}>
                    <TsePill tom={situacao.tom} className="px-1.5 text-[10px]">
                      {situacao.sigla}
                    </TsePill>
                  </td>
                ) : null}
              </tr>
            )
          })}
          <tr className="border-t border-[#DDDDDD] bg-[var(--tse-bar)] font-bold">
            <td className={tdClass} />
            <td className={cn(tdClass, 'text-[11px] uppercase tracking-wide')}>Total</td>
            <td className={cn(tdClass, colunaPartidoClass)} />
            <td className={cn(tdClass, 'text-right tabular-nums')}>{fmt(total)}</td>
            {mostrarSituacao ? <td className={tdClass} /> : null}
          </tr>
        </tbody>
      </table>
    </Quadro>
  )
}

export type PartidoQuadro = { partido: string; votos: number; eleitos: number }

export function QuadroPartidos({
  itens,
  pagina,
  porPagina,
  onPagina,
  selecao,
  onAlternar,
  onLimpar,
  ativo,
  onFiltrar,
}: {
  itens: PartidoQuadro[]
  pagina: number
  porPagina: number
  onPagina: (pagina: number) => void
  selecao: Record<string, number>
  onAlternar: (rowId: string, votos: number) => void
  onLimpar: () => void
  ativo: (partido: string) => boolean
  onFiltrar: (partido: string) => void
}) {
  const visiveis = itens.slice((pagina - 1) * porPagina, pagina * porPagina)
  return (
    <Quadro
      titulo="Votação por Partido 2026"
      qtdSelecionados={Object.keys(selecao).length}
      votosSelecionados={Object.values(selecao).reduce((a, b) => a + b, 0)}
      onLimpar={onLimpar}
      paginacao={<Paginacao pagina={pagina} totalItens={itens.length} porPagina={porPagina} onPagina={onPagina} />}
    >
      <table className="w-full table-fixed text-[12px]" data-tse-tabela>
        <thead className="bg-[var(--tse-bar)] text-left">
          <tr>
            <th className={cn(thClass, 'w-7 text-center')}>
              <span className="sr-only">Selecionar</span>
            </th>
            <th className={thClass}>Partido</th>
            <th className={cn(thClass, 'w-16 text-right')}>Votos</th>
            <th className={cn(thClass, 'w-11 text-right')} title="Eleitos">
              Eleit.
            </th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((item) => {
            const rowId = `partido_2026:${item.partido}`
            const selecionada = selecao[rowId] !== undefined
            const filtrado = ativo(item.partido)
            return (
              <tr
                key={item.partido}
                className={classeLinha(selecionada || filtrado, filtrado)}
                title="Duplo clique no partido filtra os demais quadros"
              >
                <td className={cn(tdClass, 'text-center')}>
                  <input
                    type="checkbox"
                    checked={selecionada}
                    onChange={() => onAlternar(rowId, item.votos)}
                    aria-label={`Selecionar ${item.partido}`}
                    className={checkboxClass}
                  />
                </td>
                <td className={cn(tdClass, 'cursor-pointer truncate')} onDoubleClick={() => onFiltrar(item.partido)}>
                  {item.partido}
                </td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{fmt(item.votos)}</td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{item.eleitos}</td>
              </tr>
            )
          })}
          <tr className="border-t border-[#DDDDDD] bg-[var(--tse-bar)] font-bold">
            <td className={tdClass} />
            <td className={cn(tdClass, 'text-[11px] uppercase tracking-wide')}>Total</td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>{fmt(itens.reduce((a, i) => a + i.votos, 0))}</td>
            <td className={cn(tdClass, 'text-right tabular-nums')}>{itens.reduce((a, i) => a + i.eleitos, 0)}</td>
          </tr>
        </tbody>
      </table>
    </Quadro>
  )
}

/* Ascensão e queda entre eleições */

function abreviarCargoMovimento(cargo: string): string {
  return cargo.replace(/^Deputado Federal$/i, 'Dep. Fed.').replace(/^Deputado Estadual$/i, 'Dep. Est.')
}

function Participacao({ p }: { p: ParticipacaoCandidato }) {
  return (
    <span className="whitespace-nowrap">
      {abreviarCargoMovimento(p.cargo)} {p.ano} · <span className="font-semibold text-[var(--tse-text)]">{fmt(p.votos)}</span>
    </span>
  )
}

function ListaMovimentos({
  titulo,
  itens,
  sobe,
}: {
  titulo: string
  itens: MovimentoCandidato[]
  sobe: boolean
}) {
  const Icone = sobe ? TrendingUp : TrendingDown
  const corTexto = sobe ? 'text-[var(--tse-olive)]' : 'text-red-700'
  return (
    <div className="min-w-0">
      <p className={cn('flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide', corTexto)}>
        <Icone className="h-4 w-4" aria-hidden />
        {titulo}
      </p>
      {itens.length === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--tse-muted)]">Nenhum movimento destacável.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#EEEEEE]">
          {itens.map((m) => (
            <li key={m.chave} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold uppercase">
                  {m.nomeUrna}
                  {m.partido ? <span className="ml-1.5 font-semibold text-[var(--tse-muted)]">{m.partido}</span> : null}
                </p>
                <p className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[11px] text-[var(--tse-muted)]">
                  <Participacao p={m.anterior} />
                  <span aria-hidden>→</span>
                  <Participacao p={m.atual} />
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className={cn('text-[13px] font-bold tabular-nums', corTexto)}>
                  {sobe ? '+' : '−'}
                  {fmt(Math.abs(m.diferenca))}
                </p>
                <p className="text-[11px] tabular-nums text-[var(--tse-muted)]">
                  {m.variacaoPct === null ? 'novo' : `${sobe ? '+' : '−'}${fmtPct(Math.abs(m.variacaoPct))}`}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ListaEstreantes({ itens }: { itens: EstreanteCandidato[] }) {
  return (
    <div className="min-w-0">
      <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-gold-text)]">
        <UserPlus className="h-4 w-4" aria-hidden />
        Estreantes
      </p>
      {itens.length === 0 ? (
        <p className="mt-3 text-[12px] text-[var(--tse-muted)]">Nenhum estreante com votação expressiva.</p>
      ) : (
        <ul className="mt-2 divide-y divide-[#EEEEEE]">
          {itens.map((e) => (
            <li key={e.chave} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold uppercase">
                  {e.nomeUrna}
                  {e.partido ? <span className="ml-1.5 font-semibold text-[var(--tse-muted)]">{e.partido}</span> : null}
                </p>
                <p className="mt-0.5 text-[11px] text-[var(--tse-muted)]">
                  {abreviarCargoMovimento(e.cargo)} 2026 · sem disputa desde 2020
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[13px] font-bold tabular-nums text-[var(--tse-gold-text)]">{fmt(e.votos)}</p>
                <p className="text-[11px] tabular-nums text-[var(--tse-muted)]">{fmtPct(e.pctCargo)} do cargo</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function QuadroMovimentosCandidatos({
  municipio,
  movimentos,
}: {
  municipio: string
  movimentos: MovimentosCandidatos
}) {
  return (
    <section className="mt-3 rounded-2xl bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold">Ascensão e queda · {municipio}</h2>
        <p className="text-[10px] font-semibold text-[var(--tse-muted)]">
          Mesma pessoa pelo nome, entre 2022, 2024 e 2026 · compara as duas últimas disputas, mesmo em cargos diferentes ·
          estreante = sem candidatura em 2020, 2022 ou 2024 em nenhum município
        </p>
      </div>
      <div className="mt-3 grid gap-6 md:grid-cols-2 xl:grid-cols-3">
        <ListaMovimentos titulo="Em ascensão" itens={movimentos.subidas} sobe />
        <ListaMovimentos titulo="Em queda" itens={movimentos.quedas} sobe={false} />
        <ListaEstreantes itens={movimentos.estreantes} />
      </div>
    </section>
  )
}
