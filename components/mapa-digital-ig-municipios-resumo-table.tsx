'use client'

import type { CSSProperties } from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ClassificacaoTdBadge } from '@/components/classificacao-td-badge'
import { CORES_TERRITORIO_DESENVOLVIMENTO_PI } from '@/lib/piaui-territorio-desenvolvimento-cores'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import type { ClassificacaoTerritorioTd } from '@/lib/piaui-territorio-classificacao'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'

const fmtInt = new Intl.NumberFormat('pt-BR')

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '')
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `rgba(${r},${g},${b},${alpha})`
}

function cssFuturistTdLinhaSelecionadaSolid(fill: string): string {
  const h = String(fill || '').trim()
  return h.startsWith('#') && h.length >= 4 ? h : hexToRgba('#ff6a00', 1)
}

export type IgMunicipiosResumoLinha = {
  nome: string
  lideres: number
  liderados: number
  comentarios: number
  perfisUnicos: number
  part: number
  rankIg: number
  visitasMun: number
}

export type IgMunicipiosSortKey =
  | 'rank'
  | 'territorio'
  | 'municipios'
  | 'lideres'
  | 'liderados'
  | 'comentarios'
  | 'perfis'
  | 'participacao'
  | 'vis'

type Props = {
  visualPreset: 'default' | 'futuristic'
  sidebarCollapsed: boolean
  territorioPai: TerritorioDesenvolvimentoPI
  linhas: IgMunicipiosResumoLinha[]
  loadState: 'idle' | 'loading' | 'ready' | 'error'
  onAlternarSort: (key: IgMunicipiosSortKey) => void
  indicadorSort: (key: IgMunicipiosSortKey) => string
  maxComentarios: number
  totalComentariosLista: number
  classificacaoPorMunicipio: Map<string, ClassificacaoTerritorioTd>
  totais: { mun: number; lideres: number; liderados: number; com: number; perf: number; vis: number }
  municipioFocado: string | null
  onAlternarFocoMunicipio: (nome: string) => void
  /** Duplo clique na linha (ou no nome do município) abre o drill mobilização líderes → liderados. */
  onDrillMobilizacaoMunicipio?: (nome: string) => void
}

export function MapaDigitalIgMunicipiosResumoTable({
  visualPreset,
  sidebarCollapsed,
  territorioPai,
  linhas,
  loadState,
  onAlternarSort,
  indicadorSort,
  maxComentarios,
  totalComentariosLista,
  classificacaoPorMunicipio,
  totais,
  municipioFocado,
  onAlternarFocoMunicipio,
  onDrillMobilizacaoMunicipio,
}: Props) {
  const territorioCor = CORES_TERRITORIO_DESENVOLVIMENTO_PI[territorioPai]

  return (
    <div className="min-w-0 space-y-2">
      {loadState === 'loading' ? (
        <p className="flex items-center gap-2 text-[10px] text-text-muted sm:text-[11px]">
          <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          Carregando indicadores por município…
        </p>
      ) : null}
      {loadState === 'error' ? (
        <p className="text-[10px] text-status-danger sm:text-[11px]">
          Não foi possível carregar o resumo IG por município.
        </p>
      ) : null}
      <table
        aria-label="Resumo Instagram por município no território"
        className={cn(
          'td-resumo-table td-resumo-table--premium w-full min-w-0',
          visualPreset === 'futuristic' && 'td-resumo-table--futuristic'
        )}
      >
        <thead>
          <tr className="td-resumo-table__row td-resumo-table__row--header tracking-wide">
            <th className="td-resumo-table__cell td-resumo-table__cell--rank text-right font-medium">
              <button
                type="button"
                onClick={() => onAlternarSort('rank')}
                className="inline-flex items-center gap-1"
              >
                # <span aria-hidden>{indicadorSort('rank')}</span>
              </button>
            </th>
            <th className="td-resumo-table__cell td-resumo-table__cell--territorio text-left font-medium">
              <button
                type="button"
                onClick={() => onAlternarSort('territorio')}
                className="inline-flex items-center gap-1"
              >
                Município <span aria-hidden>{indicadorSort('territorio')}</span>
              </button>
            </th>
            <th className="td-resumo-table__cell text-right font-medium" title="Um município por linha">
              <button
                type="button"
                onClick={() => onAlternarSort('municipios')}
                className="inline-flex items-center gap-1"
              >
                Mun. <span aria-hidden>{indicadorSort('municipios')}</span>
              </button>
            </th>
            <th
              className="td-resumo-table__cell text-right font-medium"
              title="Líderes (tabela leaders) no município — mobilização"
            >
              <button type="button" onClick={() => onAlternarSort('lideres')} className="inline-flex items-center gap-1">
                Líderes <span aria-hidden>{indicadorSort('lideres')}</span>
              </button>
            </th>
            <th
              className="td-resumo-table__cell text-right font-medium"
              title="Liderados ativos no município — mobilização"
            >
              <button
                type="button"
                onClick={() => onAlternarSort('liderados')}
                className="inline-flex items-center gap-1"
              >
                Liderados <span aria-hidden>{indicadorSort('liderados')}</span>
              </button>
            </th>
            <th
              className="td-resumo-table__cell text-right font-medium"
              title="Comentários cujo @ bate com liderado ativo deste município"
            >
              <button
                type="button"
                onClick={() => onAlternarSort('comentarios')}
                className="inline-flex items-center gap-1"
              >
                Coment. <span aria-hidden>{indicadorSort('comentarios')}</span>
              </button>
            </th>
            <th
              className="td-resumo-table__cell text-right font-medium"
              title="Perfis distintos (comentaristas) vinculados a liderados deste município"
            >
              <button type="button" onClick={() => onAlternarSort('perfis')} className="inline-flex items-center gap-1">
                Perfis <span aria-hidden>{indicadorSort('perfis')}</span>
              </button>
            </th>
            <th
              className="td-resumo-table__cell text-right font-medium"
              title="Comentários vinculados por mil liderados no município"
            >
              <button
                type="button"
                onClick={() => onAlternarSort('participacao')}
                className="inline-flex items-center gap-1"
              >
                /1k <span aria-hidden>{indicadorSort('participacao')}</span>
              </button>
            </th>
            <th
              className="td-resumo-table__cell text-center font-medium"
              title="Visitas com check-in (Campo & Agenda) no município"
            >
              <button
                type="button"
                onClick={() => onAlternarSort('vis')}
                className="inline-flex w-full items-center justify-center gap-1"
              >
                Vis. <span aria-hidden>{indicadorSort('vis')}</span>
              </button>
            </th>
            <th
              className="td-resumo-table__cell td-resumo-table__grupo-status-start text-center font-medium"
              title="Tercil entre municípios do TD pelo volume de comentários vinculados"
            >
              Eng. IG
            </th>
          </tr>
        </thead>
        <tbody>
          {linhas.map(
            ({ nome, lideres, liderados, comentarios, perfisUnicos, part, rankIg, visitasMun }) => {
              const selecionado =
                municipioFocado !== null &&
                normalizeMunicipioNome(nome) === normalizeMunicipioNome(municipioFocado)
              const tipoEng = classificacaoPorMunicipio.get(nome) ?? 'baixo-impacto'
              const pctTot =
                totalComentariosLista > 0 ? (comentarios / totalComentariosLista) * 100 : 0
              const hintEng = `Comentários vinculados: ${fmtInt.format(comentarios)} (${new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 }).format(pctTot)}% do total desta lista)`
              const barW =
                maxComentarios > 0 ? Math.max(8, Math.round((comentarios / maxComentarios) * 100)) : 8
              return (
                <tr
                  key={nome}
                  className={cn(
                    'td-resumo-table__row td-resumo-table__row--data td-resumo-table__row--premium select-none transition-[transform,box-shadow,background-color] duration-200 ease-out',
                    selecionado && 'td-resumo-table__row--selected'
                  )}
                  onDoubleClick={
                    onDrillMobilizacaoMunicipio
                      ? () => {
                          onDrillMobilizacaoMunicipio(nome)
                        }
                      : undefined
                  }
                  style={
                    visualPreset === 'futuristic'
                      ? ({
                          '--fut-row-bg': selecionado
                            ? cssFuturistTdLinhaSelecionadaSolid(territorioCor.fill)
                            : 'rgba(18,24,33,0.72)',
                          '--fut-row-selected': cssFuturistTdLinhaSelecionadaSolid(territorioCor.fill),
                          '--fut-row-selected-edge': territorioCor.stroke,
                        } as CSSProperties)
                      : undefined
                  }
                >
                  <td
                    className={cn(
                      'td-resumo-table__cell td-resumo-table__cell--rank text-right tabular-nums text-text-secondary',
                      rankIg <= 3 && 'td-resumo-table__rank--top3',
                      rankIg === 1 && 'td-resumo-table__rank--first'
                    )}
                  >
                    <span className="tabular-nums">{rankIg}</span>
                  </td>
                  <td className="td-resumo-table__cell td-resumo-table__cell--territorio text-left">
                    <button
                      type="button"
                      onClick={(e) => {
                        if (e.detail >= 2) return
                        onAlternarFocoMunicipio(nome)
                      }}
                      onDoubleClick={(e) => {
                        e.stopPropagation()
                        onDrillMobilizacaoMunicipio?.(nome)
                      }}
                      className={cn(
                        'td-resumo-table__nome-municipio-btn relative flex min-w-0 max-w-full flex-col items-stretch overflow-hidden rounded-md border border-transparent px-1 py-0.5 text-left transition-colors hover:border-border-card/40 hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold-soft',
                        selecionado && 'border-accent-gold/35 bg-accent-gold/5'
                      )}
                      title="Clique para filtrar este município na lista (ou limpar se já selecionado)"
                    >
                      <div
                        className={cn(
                          'td-resumo-table__peso-eleitoral-bar pointer-events-none',
                          visualPreset === 'futuristic' && 'td-resumo-table__peso-eleitoral-bar--fut'
                        )}
                        style={
                          {
                            '--td-peso-a': territorioCor.fill,
                            width: `${barW}%`,
                          } as CSSProperties
                        }
                        aria-hidden
                      />
                      <div className="relative z-[1] flex min-w-0 items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-sm sm:h-2.5 sm:w-2.5"
                          style={{ backgroundColor: territorioCor.fill }}
                          aria-hidden
                        />
                        <span
                          className={cn(
                            'min-w-0 break-words font-semibold text-text-primary',
                            visualPreset === 'futuristic' && 'tracking-tight'
                          )}
                          title={nome}
                        >
                          {nome}
                        </span>
                      </div>
                    </button>
                  </td>
                  <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">1</td>
                  <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">
                    {fmtInt.format(lideres)}
                  </td>
                  <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">
                    {fmtInt.format(liderados)}
                  </td>
                  <td className="td-resumo-table__cell text-right tabular-nums text-text-primary">
                    {fmtInt.format(comentarios)}
                  </td>
                  <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">
                    {fmtInt.format(perfisUnicos)}
                  </td>
                  <td className="td-resumo-table__cell text-right tabular-nums text-text-secondary">
                    {new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(part)}
                  </td>
                  <td className="td-resumo-table__cell td-resumo-table__cell--vis text-center tabular-nums text-text-secondary">
                    {visitasMun}
                  </td>
                  <td className="td-resumo-table__cell td-resumo-table__cell--classe td-resumo-table__grupo-status-start">
                    <div className="flex justify-center">
                      <ClassificacaoTdBadge
                        tipo={tipoEng}
                        visualTone={visualPreset === 'futuristic' ? 'futuristic' : 'command'}
                        titleOverride={hintEng}
                      />
                    </div>
                  </td>
                </tr>
              )
            }
          )}
        </tbody>
        <tfoot>
          <tr className="td-resumo-table__row td-resumo-table__row--totals select-none">
            <td
              className="td-resumo-table__cell td-resumo-table__cell--rank text-right tabular-nums text-text-muted"
              aria-hidden
            />
            <td className="td-resumo-table__cell td-resumo-table__cell--territorio text-left font-semibold text-text-primary">
              Total
            </td>
            <td className="td-resumo-table__cell text-right tabular-nums font-semibold text-text-primary">
              {totais.mun}
            </td>
            <td className="td-resumo-table__cell text-right tabular-nums font-semibold text-text-primary">
              {fmtInt.format(totais.lideres)}
            </td>
            <td className="td-resumo-table__cell text-right tabular-nums font-semibold text-text-primary">
              {fmtInt.format(totais.liderados)}
            </td>
            <td className="td-resumo-table__cell text-right tabular-nums font-semibold text-text-primary">
              {fmtInt.format(totais.com)}
            </td>
            <td className="td-resumo-table__cell text-right tabular-nums font-semibold text-text-primary">
              {fmtInt.format(totais.perf)}
            </td>
            <td className="td-resumo-table__cell text-right tabular-nums text-text-muted">
              {totais.liderados > 0
                ? new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(
                    (totais.com / totais.liderados) * 1000
                  )
                : '—'}
            </td>
            <td className="td-resumo-table__cell td-resumo-table__cell--vis text-center tabular-nums font-semibold text-text-primary">
              {totais.vis}
            </td>
            <td className="td-resumo-table__cell td-resumo-table__cell--classe td-resumo-table__grupo-status-start text-center text-text-muted">
              —
            </td>
          </tr>
        </tfoot>
      </table>
      <p
        className={cn(
          'text-text-muted',
          sidebarCollapsed ? 'text-xs sm:text-sm' : 'text-[10px] sm:text-[11px]'
        )}
      >
        Mesmas colunas do resumo por TD; dados de mobilização e comentários por município (cidade do cadastro).
        {onDrillMobilizacaoMunicipio ? ' Duplo clique na linha abre líderes e liderados (mobilização).' : ''}
      </p>
    </div>
  )
}
