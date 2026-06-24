'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { LayoutGrid, Loader2, Map, MapPin } from 'lucide-react'
import type {
  ComparativoExpectativa2022Resumo,
  ComparativoExpectativa2022Row,
  TendenciaExpectativa2022,
} from '@/lib/comparativo-expectativa-2022'
import { loadComparativoAnterior2026Client } from '@/lib/territorio-comparativo-anterior-2026-client'
import {
  buildCidadesComCargoSet,
  buildLiderancasPorCidadeKeyMap,
  liderancasExibidasNaCidade,
  type CidadeLiderancasCargoRow,
} from '@/lib/territorio-liderancas-cargo-por-cidade'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import { typographyBodyMutedClass, typographySectionLabelClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import {
  TERRITORIO_PANORAMA_PANEL_HEIGHT_PX,
  TERRITORIO_PANORAMA_TABLE_MAX_HEIGHT_PX,
  TerritorioDataPanel,
  TerritorioFilterChip,
  TerritorioMetaChip,
  TerritorioPanelHeader,
  TerritorioPanelSearchBar,
  TerritorioPanelToolbar,
  TerritorioRowIcon,
  TerritorioSearchField,
  TerritorioTabButton,
  TerritorioTableScroll,
  TerritorioTextButton,
  territorioTdClass,
  territorioTfootClass,
  territorioThClass,
} from '@/components/territorio-campo/territorio-panorama-panel-chrome'

const MapaExpectativaVs2022 = dynamic(
  () => import('@/components/mapa-expectativa-vs-2022').then((mod) => mod.MapaExpectativaVs2022),
  {
    ssr: false,
    loading: () => (
      <div className={cn('flex min-h-[min(40vh,360px)] items-center justify-center', typographyBodyMutedClass)}>
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa…
      </div>
    ),
  }
)

type ComparativoView = 'tabela' | 'mapa'

const FILTROS: Array<{ id: TendenciaExpectativa2022 | 'todos'; label: string }> = [
  { id: 'todos', label: 'Todos' },
  { id: 'cresceu', label: 'Cresceu' },
  { id: 'manteve', label: 'Estável' },
  { id: 'caiu', label: 'Caiu' },
]

const VIEWS: { id: ComparativoView; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'tabela', label: 'Tabela', icon: LayoutGrid },
  { id: 'mapa', label: 'Mapa', icon: Map },
]

function formatVotos(value: number): string {
  return value.toLocaleString('pt-BR')
}

function ComparativoBarraCell({ row }: { row: ComparativoExpectativa2022Row }) {
  const max = Math.max(row.votos2022, row.expectativa2026, 1)
  const pct2022 = (row.votos2022 / max) * 100
  const pct2026 = (row.expectativa2026 / max) * 100
  const lo = Math.min(pct2022, pct2026)
  const hi = Math.max(pct2022, pct2026)
  const cresceu = row.expectativa2026 > row.votos2022
  const caiu = row.expectativa2026 < row.votos2022

  return (
    <div className="relative mx-auto h-1.5 w-full min-w-[4rem] max-w-[7rem] overflow-hidden rounded-full bg-[rgb(var(--color-border-secondary)/0.45)]">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-text-primary/25"
        style={{ width: `${lo}%` }}
      />
      {hi > lo ? (
        <div
          className={cn(
            'absolute inset-y-0 rounded-full',
            cresceu ? 'bg-emerald-500' : caiu ? 'bg-red-500' : 'bg-amber-500'
          )}
          style={{ left: `${lo}%`, width: `${hi - lo}%` }}
        />
      ) : null}
    </div>
  )
}

export type ComparativoExpectativa2022BarrasProps = {
  cargoFiltro?: string | null
  liderancasPorCidade?: CidadeLiderancasCargoRow[]
  onClearCargoFiltro?: () => void
}

export function ComparativoExpectativa2022Barras({
  cargoFiltro = null,
  liderancasPorCidade = [],
  onClearCargoFiltro,
}: ComparativoExpectativa2022BarrasProps = {}) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cenarioLabel, setCenarioLabel] = useState('Anterior 2026')
  const [resumo, setResumo] = useState<ComparativoExpectativa2022Resumo | null>(null)
  const [rows, setRows] = useState<ComparativoExpectativa2022Row[]>([])
  const [view, setView] = useState<ComparativoView>('tabela')
  const [filtro, setFiltro] = useState<TendenciaExpectativa2022 | 'todos'>('todos')
  const [busca, setBusca] = useState('')

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const result = await loadComparativoAnterior2026Client()
        if (!result.ok) {
          setError(result.error)
          setResumo(null)
          setRows([])
          return
        }
        setCenarioLabel(result.cenarioLabel)
        setResumo(result.resumo)
        setRows(result.rows)
      } catch {
        setError('Erro ao carregar comparativo territorial.')
        setResumo(null)
        setRows([])
      } finally {
        setLoading(false)
      }
    })()
  }, [])

  const cidadesCargoSet = useMemo(() => {
    if (!cargoFiltro || liderancasPorCidade.length === 0) return null
    return buildCidadesComCargoSet(liderancasPorCidade, cargoFiltro)
  }, [cargoFiltro, liderancasPorCidade])

  const liderancasPorCidadeMap = useMemo(
    () => buildLiderancasPorCidadeKeyMap(liderancasPorCidade),
    [liderancasPorCidade]
  )

  const liderancasColumnTitle = cargoFiltro
    ? `Lideranças com cargo: ${cargoFiltro}`
    : 'Lideranças na cidade (base Território)'

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return rows.filter((row) => {
      if (cidadesCargoSet && !cidadesCargoSet.has(normalizeMunicipioNome(row.cidade))) return false
      if (filtro !== 'todos' && row.tendencia !== filtro) return false
      if (q && !row.cidade.toLowerCase().includes(q)) return false
      if (row.tendencia === 'sem-dados') return false
      return row.votos2022 > 0 || row.expectativa2026 > 0
    })
  }, [rows, filtro, busca, cidadesCargoSet])

  const totalLiderancasVisiveis = useMemo(() => {
    return rowsFiltradas.reduce((acc, row) => {
      const cidadeRow = liderancasPorCidadeMap.get(normalizeMunicipioNome(row.cidade))
      return acc + liderancasExibidasNaCidade(cidadeRow, cargoFiltro, row.liderancas)
    }, 0)
  }, [rowsFiltradas, liderancasPorCidadeMap, cargoFiltro])

  if (loading) {
    return (
      <TerritorioDataPanel style={{ maxHeight: TERRITORIO_PANORAMA_PANEL_HEIGHT_PX }}>
        <div className={cn('flex flex-1 items-center justify-center gap-2 py-12', typographyBodyMutedClass)}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando comparativo 2026 × 2022…
        </div>
      </TerritorioDataPanel>
    )
  }

  if (error) {
    return (
      <TerritorioDataPanel style={{ maxHeight: TERRITORIO_PANORAMA_PANEL_HEIGHT_PX }}>
        <TerritorioPanelHeader title="Anterior 2026 × Federal 2022" description={error} />
      </TerritorioDataPanel>
    )
  }

  return (
    <TerritorioDataPanel style={{ maxHeight: TERRITORIO_PANORAMA_PANEL_HEIGHT_PX }}>
      <TerritorioPanelHeader
        title="Anterior 2026 × Federal 2022"
        description={
          <>
            Cenário <span className="font-medium text-text-secondary">{cenarioLabel}</span> — expectativa da aba Base
            versus votação federal de 2022.
          </>
        }
        meta={
          resumo ? (
            <>
              <TerritorioMetaChip label="Anterior" value={formatVotos(resumo.totalExpectativa2026)} />
              <TerritorioMetaChip label="2022" value={formatVotos(resumo.totalVotos2022)} />
              <TerritorioMetaChip
                label="Δ"
                value={`${resumo.delta >= 0 ? '+' : ''}${formatVotos(resumo.delta)}`}
                tone={resumo.delta >= 0 ? 'positive' : 'negative'}
              />
              {rowsFiltradas.length > 0 ? (
                <TerritorioMetaChip
                  label={cargoFiltro ? 'Lid. filtro' : 'Lideranças'}
                  value={formatVotos(totalLiderancasVisiveis)}
                />
              ) : null}
              {cargoFiltro ? (
                <TerritorioMetaChip label="Cargo" value={cargoFiltro} tone="primary" />
              ) : null}
            </>
          ) : null
        }
        action={
          cargoFiltro && onClearCargoFiltro ? (
            <TerritorioTextButton onClick={onClearCargoFiltro}>Limpar filtro</TerritorioTextButton>
          ) : null
        }
      />

      <TerritorioPanelToolbar>
        <div className="flex items-center gap-4">
          {VIEWS.map((item) => (
            <TerritorioTabButton
              key={item.id}
              active={view === item.id}
              onClick={() => setView(item.id)}
              icon={item.icon}
            >
              {item.label}
            </TerritorioTabButton>
          ))}
        </div>

        {view === 'tabela' ? (
          <>
            <div className="ml-auto flex flex-wrap items-center gap-1.5">
              {FILTROS.map((item) => (
                <TerritorioFilterChip
                  key={item.id}
                  active={filtro === item.id}
                  onClick={() => setFiltro(item.id)}
                >
                  {item.label}
                </TerritorioFilterChip>
              ))}
            </div>
          </>
        ) : null}
      </TerritorioPanelToolbar>

      {view === 'tabela' ? (
        <TerritorioPanelSearchBar>
          <TerritorioSearchField
            value={busca}
            onChange={setBusca}
            placeholder="Buscar município"
            className="max-w-md"
          />
        </TerritorioPanelSearchBar>
      ) : null}

      {view === 'mapa' ? (
        <div className="min-h-0 flex-1 p-4">
          <div
            id="mapa-comparativo-panorama-container"
            className={cn(
              'relative min-h-[min(40vh,360px)] min-w-0 overflow-hidden rounded-md border border-[rgb(var(--color-border-secondary)/0.55)]',
              '[&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-full [&:fullscreen]:flex-col [&:fullscreen]:min-h-0 [&:fullscreen]:bg-bg-surface'
            )}
          >
            <MapaExpectativaVs2022
              comparativoLista={rowsFiltradas}
              labelExpectativa2026={cenarioLabel}
              onFullscreen={() => {
                const container = document.getElementById('mapa-comparativo-panorama-container')
                if (!container) return
                if (document.fullscreenElement) {
                  void document.exitFullscreen()
                } else {
                  void container.requestFullscreen()
                }
              }}
            />
          </div>
        </div>
      ) : (
        <TerritorioTableScroll maxHeight={TERRITORIO_PANORAMA_TABLE_MAX_HEIGHT_PX}>
          <table className="w-full min-w-[22rem] border-collapse">
            <thead>
              <tr>
                <th className={territorioThClass}>Município</th>
                <th className={cn(territorioThClass, 'w-12 text-center')} title={liderancasColumnTitle}>
                  Lid.
                </th>
                <th className={cn(territorioThClass, 'w-16 text-right')}>2022</th>
                <th className={cn(territorioThClass, 'w-24 text-center')}>Variação</th>
                <th className={cn(territorioThClass, 'w-16 text-right')}>2026</th>
                <th className={cn(territorioThClass, 'w-16 text-right')}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={6} className={cn('px-4 py-8 text-center', typographyBodyMutedClass)}>
                    Nenhum município neste filtro.
                  </td>
                </tr>
              ) : (
                rowsFiltradas.map((row) => {
                  const cresceu = row.expectativa2026 > row.votos2022
                  const caiu = row.expectativa2026 < row.votos2022
                  const cidadeRow = liderancasPorCidadeMap.get(normalizeMunicipioNome(row.cidade))
                  const liderancasCount = liderancasExibidasNaCidade(
                    cidadeRow,
                    cargoFiltro,
                    row.liderancas
                  )
                  return (
                    <tr key={row.cidade} className="transition-colors hover:bg-bg-app/50">
                      <td className={territorioTdClass}>
                        <div className="flex min-w-0 items-center gap-2.5">
                          <TerritorioRowIcon>
                            <MapPin className="h-4 w-4" aria-hidden />
                          </TerritorioRowIcon>
                          <span className="truncate font-medium">{row.cidade}</span>
                        </div>
                      </td>
                      <td
                        className={cn(
                          territorioTdClass,
                          'text-center tabular-nums',
                          liderancasCount > 0 ? 'text-text-primary' : 'text-text-muted/50'
                        )}
                        title={liderancasColumnTitle}
                      >
                        {liderancasCount > 0 ? liderancasCount : '—'}
                      </td>
                      <td className={cn(territorioTdClass, 'text-right tabular-nums text-text-secondary')}>
                        {formatVotos(row.votos2022)}
                      </td>
                      <td className={cn(territorioTdClass, 'text-center')}>
                        <ComparativoBarraCell row={row} />
                      </td>
                      <td
                        className={cn(
                          territorioTdClass,
                          'text-right tabular-nums',
                          cresceu ? 'text-emerald-700' : caiu ? 'text-red-700' : 'text-text-secondary'
                        )}
                      >
                        {formatVotos(row.expectativa2026)}
                      </td>
                      <td
                        className={cn(
                          territorioTdClass,
                          'text-right font-medium tabular-nums',
                          cresceu ? 'text-emerald-600' : caiu ? 'text-red-600' : 'text-text-muted'
                        )}
                      >
                        {row.delta >= 0 ? '+' : ''}
                        {formatVotos(row.delta)}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
            {rowsFiltradas.length > 0 ? (
              <tfoot className={territorioTfootClass}>
                <tr>
                  <td className={cn(territorioTdClass, 'border-b-0 bg-bg-app', typographySectionLabelClass)}>
                    {rowsFiltradas.length} municípios
                  </td>
                  <td
                    className={cn(territorioTdClass, 'border-b-0 bg-bg-app text-center font-semibold tabular-nums text-text-primary')}
                    title={liderancasColumnTitle}
                  >
                    {totalLiderancasVisiveis.toLocaleString('pt-BR')}
                  </td>
                  <td colSpan={4} className={cn(territorioTdClass, 'border-b-0 bg-bg-app text-right', typographyBodyMutedClass)}>
                    {cargoFiltro ? `Total · ${cargoFiltro}` : 'Total de lideranças visíveis'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </TerritorioTableScroll>
      )}
    </TerritorioDataPanel>
  )
}
