'use client'

import { cn } from '@/lib/utils'
import {
  TseBarraValor,
  TseChevronCelula,
  TsePill,
  TseRank,
  TseThOrdenavel,
  tseLinkAcaoClass,
  tseTabela,
} from '@/components/tse/tse-ui'

export type LiderancaBase = Record<string, unknown>

export type SortCidadeCol = 'cidade' | 'liderancas' | 'expectativa' | 'votacao2026'

export interface CidadeBaseLinha {
  cidade: string
  liderancas: LiderancaBase[]
  expectativa: number
  /** Votação apurada do Jadyel no município; `null` = sem dado. */
  votacao2026: number | null
}

const fmt = (n: number): string => Math.round(n).toLocaleString('pt-BR')
const fmtPct = (n: number): string => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** Cor do nível do cargo (majoritário, legislativo, liderança comunitária, outros). */
export function corNivelCargo(cargo: string): string {
  const c = cargo.toLowerCase().trim()
  if (/prefeito|governador|deputado federal|senador/.test(c)) return 'var(--tse-olive)'
  if (/vereador|dep\.?\s*estadual|deputado/.test(c)) return 'var(--tse-yellow)'
  if (/lider|coord|secret|presidente|diretor/.test(c)) return '#5D8AA7'
  return 'var(--tse-zero)'
}

interface TerritorioCidadesTabelaProps {
  linhas: CidadeBaseLinha[]
  rank: Map<string, number>
  maxExpectativa: number
  maxVotacao: number
  sortCol: SortCidadeCol
  sortAsc: boolean
  onSort: (col: SortCidadeCol) => void
  expandidas: Set<string>
  onToggle: (cidade: string) => void
  onBriefing: (linha: CidadeBaseLinha) => void
  onObras: (cidade: string) => void
  nomeCol: string
  cargoCol?: string
  votosReferenciaCol?: string
  normalizeNumber: (value: unknown) => number
  labelExpectativa: string
  labelVotacao: string
}

export function TerritorioCidadesTabela({
  linhas,
  rank,
  maxExpectativa,
  maxVotacao,
  sortCol,
  sortAsc,
  onSort,
  expandidas,
  onToggle,
  onBriefing,
  onObras,
  nomeCol,
  cargoCol,
  votosReferenciaCol,
  normalizeNumber,
  labelExpectativa,
  labelVotacao,
}: TerritorioCidadesTabelaProps) {
  const ordem = { sortCol, sortAsc, onSort }
  return (
    <div className={cn('mt-3', tseTabela.container)}>
      <table className={tseTabela.table} data-tse-tabela>
        <thead className={tseTabela.thead}>
          <tr>
            <th className="w-14 px-3 py-2.5 text-center">Pos.</th>
            <TseThOrdenavel col="cidade" {...ordem}>
              Município
            </TseThOrdenavel>
            <TseThOrdenavel col="liderancas" alinhar="right" {...ordem}>
              Lideranças
            </TseThOrdenavel>
            <TseThOrdenavel col="votacao2026" alinhar="right" className="w-[200px]" {...ordem}>
              {labelVotacao}
            </TseThOrdenavel>
            <TseThOrdenavel col="expectativa" alinhar="right" className="w-[200px]" {...ordem}>
              {labelExpectativa}
            </TseThOrdenavel>
            <th className="px-3 py-2.5 text-right">% da expectativa</th>
            <th className="px-3 py-2.5 text-right">Ações</th>
            <th className="w-10 px-2 py-2.5" aria-label="Expandir" />
          </tr>
        </thead>
        <tbody>
          {linhas.map((linha) => {
            const aberta = expandidas.has(linha.cidade)
            return (
              <LinhaCidade
                key={linha.cidade}
                linha={linha}
                posicao={rank.get(linha.cidade) ?? 0}
                aberta={aberta}
                pct={
                  linha.votacao2026 != null && linha.expectativa > 0
                    ? (linha.votacao2026 / linha.expectativa) * 100
                    : null
                }
                maxExpectativa={maxExpectativa}
                maxVotacao={maxVotacao}
                onToggle={() => onToggle(linha.cidade)}
                onBriefing={() => onBriefing(linha)}
                onObras={() => onObras(linha.cidade)}
                nomeCol={nomeCol}
                cargoCol={cargoCol}
                votosReferenciaCol={votosReferenciaCol}
                normalizeNumber={normalizeNumber}
              />
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function LinhaCidade({
  linha,
  posicao,
  aberta,
  pct,
  maxExpectativa,
  maxVotacao,
  onToggle,
  onBriefing,
  onObras,
  nomeCol,
  cargoCol,
  votosReferenciaCol,
  normalizeNumber,
}: {
  linha: CidadeBaseLinha
  posicao: number
  aberta: boolean
  /** Votação 2026 ÷ expectativa; `null` sem votação apurada ou sem expectativa. */
  pct: number | null
  maxExpectativa: number
  maxVotacao: number
  onToggle: () => void
  onBriefing: () => void
  onObras: () => void
  nomeCol: string
  cargoCol?: string
  votosReferenciaCol?: string
  normalizeNumber: (value: unknown) => number
}) {
  const votosDe = (l: LiderancaBase): number => (votosReferenciaCol ? normalizeNumber(l[votosReferenciaCol]) : 0)
  const liderancasOrdenadas = aberta
    ? [...linha.liderancas].sort(
        (a, b) =>
          votosDe(b) - votosDe(a) || String(a[nomeCol] ?? '').localeCompare(String(b[nomeCol] ?? ''), 'pt-BR'),
      )
    : []

  return (
    <>
      <tr onClick={onToggle} aria-expanded={aberta} className={cn(tseTabela.trClicavel, aberta && 'bg-[var(--tse-yellow-soft)]')}>
        <td className="px-3 py-2 text-center">
          <TseRank posicao={posicao} />
        </td>
        <td className="px-3 py-2 font-bold uppercase">{linha.cidade}</td>
        <td className="px-3 py-2 text-right tabular-nums">{fmt(linha.liderancas.length)}</td>
        <td className="px-3 py-2">
          {linha.votacao2026 == null ? (
            <span className="block text-right text-[var(--tse-muted)]">—</span>
          ) : (
            <TseBarraValor valor={linha.votacao2026} max={maxVotacao} formatado={fmt(linha.votacao2026)} />
          )}
        </td>
        <td className="px-3 py-2">
          <TseBarraValor
            valor={linha.expectativa}
            max={maxExpectativa}
            formatado={fmt(linha.expectativa)}
            cor="amarelo"
          />
        </td>
        <td className="px-3 py-2 text-right">
          {pct == null ? (
            <span className="text-[var(--tse-muted)]">—</span>
          ) : (
            <TsePill tom={pct >= 100 ? 'verde' : 'amarelo'}>{fmtPct(pct)}</TsePill>
          )}
        </td>
        <td className="px-3 py-2">
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onBriefing()
              }}
              className={tseLinkAcaoClass}
            >
              Briefing
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                onObras()
              }}
              className={tseLinkAcaoClass}
            >
              Obras
            </button>
          </div>
        </td>
        <TseChevronCelula aberta={aberta} />
      </tr>
      {aberta ? (
        <tr className="bg-[var(--tse-bar)]">
          <td colSpan={8} className="px-4 pb-3 pt-1">
            <ul className="grid gap-x-8 md:grid-cols-2 min-[1600px]:grid-cols-3">
              {liderancasOrdenadas.map((l, i) => {
                const nome = String(l[nomeCol] ?? '').trim() || 'Sem nome'
                const cargo = cargoCol ? String(l[cargoCol] ?? '').trim() : ''
                const votos = votosDe(l)
                return (
                  <li
                    key={`${nome}-${i}`}
                    className="flex items-center gap-2 border-b border-[#EEEEEE] py-1.5 text-[13px]"
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: corNivelCargo(cargo) }}
                      aria-hidden
                    />
                    <span className="min-w-0 flex-1 truncate">
                      <span className="font-semibold">{nome}</span>
                      {cargo ? <span className="text-[var(--tse-muted)]"> · {cargo}</span> : null}
                    </span>
                    <span className={cn('shrink-0 font-bold tabular-nums', !votos && 'text-[var(--tse-muted)]')}>
                      {votos ? fmt(votos) : '—'}
                    </span>
                  </li>
                )
              })}
            </ul>
          </td>
        </tr>
      ) : null}
    </>
  )
}
