'use client'

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react'
import { TseBarraRotulo, TsePill, tseLinkAcaoClass } from '@/components/tse/tse-ui'
import { isSituacaoEleito, parseVotosEleicao, type ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import { cn } from '@/lib/utils'

const fmt = (n: number): string => n.toLocaleString('pt-BR')

/* Dados Gerais (faixa horizontal) */

function BlocoDado({ rotulo, valor, children }: { rotulo: string; valor: ReactNode; children?: ReactNode }) {
  return (
    <div className="min-w-0 xl:px-5 xl:first:pl-0 xl:last:pr-0">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">{rotulo}</p>
      <p className="mt-0.5 text-[26px] font-bold leading-tight tabular-nums">{valor}</p>
      {children}
    </div>
  )
}

export function AtendimentoDadosGerais({
  fonte,
  eleitores,
  alcancePct,
  votos2022,
  rotuloCenario,
  votosCenario,
  crescimentoPct,
  diferencaVs2022,
  liderancas,
  acoesLiderancas,
}: {
  fonte: ReactNode
  eleitores: number | null
  alcancePct: number | null
  votos2022: number
  rotuloCenario: string
  votosCenario: number
  crescimentoPct: number | null
  diferencaVs2022: number
  liderancas: number
  acoesLiderancas?: ReactNode
}) {
  const fmtPct = (n: number): string => `${n.toFixed(1).replace('.', ',')}%`
  return (
    <section className="mt-4 rounded-2xl bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-[15px] font-bold">Dados Gerais</h2>
        <p className="text-[10px] font-semibold text-[var(--tse-muted)]">{fonte}</p>
      </div>
      <div className="mt-3 grid gap-4 sm:grid-cols-2 xl:grid-cols-4 xl:gap-0 xl:divide-x xl:divide-[#EEEEEE]">
        <BlocoDado rotulo="Eleitores" valor={eleitores !== null ? fmt(eleitores) : '—'}>
          {alcancePct !== null ? (
            <>
              <TseBarraRotulo pct={alcancePct} rotulo={fmtPct(alcancePct)} />
              <p className="mt-1 text-[11px] text-[var(--tse-muted)]">do eleitorado na expectativa</p>
            </>
          ) : null}
        </BlocoDado>
        <BlocoDado rotulo="Votos 2022" valor={fmt(votos2022)}>
          <p className="mt-2 text-[11px] text-[var(--tse-muted)]">Referência: Jadyel, dep. federal</p>
        </BlocoDado>
        <BlocoDado rotulo={rotuloCenario} valor={fmt(votosCenario)}>
          {crescimentoPct !== null ? (
            <TseBarraRotulo
              pct={Math.abs(crescimentoPct)}
              rotulo={`${crescimentoPct > 0 ? '+' : ''}${fmtPct(crescimentoPct)}`}
            />
          ) : null}
          <p
            className={cn(
              'mt-1 flex items-center gap-0.5 text-[11px] font-bold tabular-nums',
              diferencaVs2022 > 0 && 'text-[var(--tse-olive)]',
              diferencaVs2022 < 0 && 'text-red-700',
              diferencaVs2022 === 0 && 'text-[var(--tse-muted)]',
            )}
          >
            {diferencaVs2022 > 0 ? <ArrowUp className="h-3 w-3" aria-hidden /> : null}
            {diferencaVs2022 < 0 ? <ArrowDown className="h-3 w-3" aria-hidden /> : null}
            {diferencaVs2022 > 0 ? '+' : ''}
            {fmt(diferencaVs2022)}
            <span className="font-semibold text-[var(--tse-muted)]"> vs. 2022</span>
          </p>
        </BlocoDado>
        <BlocoDado rotulo="Lideranças" valor={fmt(liderancas)}>
          <div className="mt-2 flex flex-wrap items-center gap-3">{acoesLiderancas}</div>
        </BlocoDado>
      </div>
    </section>
  )
}

/* Quadros dos cargos */

const thClass = 'px-1.5 py-2 text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]'
const tdClass = 'px-1.5 py-1.5'
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
  const eleitos = mostrarSituacao ? itens.filter((i) => isSituacaoEleito(i.situacao)).length : 0
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
            <th className={cn(thClass, mostrarSituacao ? 'w-[3.6rem]' : 'w-[4.25rem]')}>Partido</th>
            <th className={cn(thClass, 'w-14 text-right')}>Votos</th>
            {mostrarSituacao ? <th className={cn(thClass, 'w-[4.6rem] text-center')}>Situação</th> : null}
          </tr>
        </thead>
        <tbody>
          {visiveis.map((item) => {
            const rowId = `${chaveTabela}:${item.nomeUrnaCandidato}:${item.numeroUrna}`
            const votos = parseVotosEleicao(item.quantidadeVotosNominais)
            const selecionada = selecao[rowId] !== undefined
            const destaque = destacar?.(item) ?? false
            const eleito = isSituacaoEleito(item.situacao)
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
                <td className={cn(tdClass, 'truncate text-[11px] text-[var(--tse-muted)]')} title={partido}>
                  {partido || '—'}
                </td>
                <td className={cn(tdClass, 'text-right tabular-nums')}>{fmt(votos)}</td>
                {mostrarSituacao ? (
                  <td className={cn(tdClass, 'text-center')}>
                    <TsePill tom={eleito ? 'amarelo' : 'neutro'} className="max-w-full truncate px-1.5 text-[10px]">
                      {item.situacao || '—'}
                    </TsePill>
                  </td>
                ) : null}
              </tr>
            )
          })}
          <tr className="border-t border-[#DDDDDD] bg-[var(--tse-bar)] font-bold">
            <td className={tdClass} />
            <td className={cn(tdClass, 'text-[11px] uppercase tracking-wide')}>Total</td>
            <td className={tdClass} />
            <td className={cn(tdClass, 'text-right tabular-nums')}>{fmt(total)}</td>
            {mostrarSituacao ? (
              <td className={cn(tdClass, 'text-center text-[10px] font-semibold text-[var(--tse-muted)]')}>
                {eleitos} eleitos
              </td>
            ) : null}
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
      titulo="Votação por Partido 2024"
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
            <th className={cn(thClass, 'w-14 text-right')}>Eleitos</th>
          </tr>
        </thead>
        <tbody>
          {visiveis.map((item) => {
            const rowId = `partido_2024:${item.partido}`
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
