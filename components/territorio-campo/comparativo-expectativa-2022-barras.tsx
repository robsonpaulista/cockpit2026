'use client'

import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { LayoutGrid, Loader2, Map, Search } from 'lucide-react'
import type {
  ComparativoExpectativa2022Resumo,
  ComparativoExpectativa2022Row,
  TendenciaExpectativa2022,
} from '@/lib/comparativo-expectativa-2022'
import { loadComparativoAnterior2026Client } from '@/lib/territorio-comparativo-anterior-2026-client'
import { cn } from '@/lib/utils'

const MapaExpectativaVs2022 = dynamic(
  () => import('@/components/mapa-expectativa-vs-2022').then((mod) => mod.MapaExpectativaVs2022),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[min(40vh,360px)] items-center justify-center text-xs text-text-muted">
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

const thClass =
  'sticky top-0 z-10 border-b border-[rgb(var(--color-border-tertiary)/0.55)] bg-bg-surface px-1.5 py-1 text-[9px] font-semibold uppercase tracking-wide text-text-muted'
const tdClass = 'border-b border-[rgb(var(--color-border-tertiary)/0.35)] px-1.5 py-1 align-middle text-[10px] tabular-nums'

/** Área da tabela: cabeçalho + N linhas visíveis antes da barra de rolagem. */
const COMPARATIVO_TABELA_LINHAS_VISIVEIS = 10
const COMPARATIVO_TABELA_ALTURA_HEADER_PX = 28
const COMPARATIVO_TABELA_ALTURA_LINHA_PX = 26
const COMPARATIVO_TABELA_AREA_MAX_HEIGHT_PX =
  COMPARATIVO_TABELA_ALTURA_HEADER_PX + COMPARATIVO_TABELA_ALTURA_LINHA_PX * COMPARATIVO_TABELA_LINHAS_VISIVEIS

/** Título, resumo, filtros, padding — altura fixa do card acima da área rolável. */
const COMPARATIVO_CARD_CHROME_PX = 118
const COMPARATIVO_CARD_MAX_HEIGHT_PX = COMPARATIVO_CARD_CHROME_PX + COMPARATIVO_TABELA_AREA_MAX_HEIGHT_PX

const comparativoCardClassName =
  'flex min-h-0 flex-col overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-3 py-2'

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
    <div className="relative mx-auto h-2 w-full min-w-[4rem] max-w-[8rem] rounded-full bg-[rgb(var(--color-border-tertiary)/0.35)]">
      <div
        className="absolute inset-y-0 left-0 rounded-full bg-slate-400/80"
        style={{ width: `${lo}%` }}
      />
      {hi > lo ? (
        <div
          className={cn(
            'absolute inset-y-0 rounded-full',
            cresceu ? 'bg-emerald-500/90' : caiu ? 'bg-red-500/90' : 'bg-amber-500/90'
          )}
          style={{ left: `${lo}%`, width: `${hi - lo}%` }}
        />
      ) : null}
      <span
        className="absolute top-1/2 z-10 h-2.5 w-px -translate-y-1/2 bg-slate-800"
        style={{ left: `${pct2022}%` }}
        aria-hidden
      />
      <span
        className={cn(
          'absolute top-1/2 z-10 h-2.5 w-px -translate-y-1/2',
          cresceu ? 'bg-emerald-900' : caiu ? 'bg-red-900' : 'bg-amber-900'
        )}
        style={{ left: `${pct2026}%` }}
        aria-hidden
      />
    </div>
  )
}

export function ComparativoExpectativa2022Barras() {
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

  const rowsFiltradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return rows.filter((row) => {
      if (filtro !== 'todos' && row.tendencia !== filtro) return false
      if (q && !row.cidade.toLowerCase().includes(q)) return false
      if (row.tendencia === 'sem-dados') return false
      return row.votos2022 > 0 || row.expectativa2026 > 0
    })
  }, [rows, filtro, busca])

  if (loading) {
    return (
      <section
        className={comparativoCardClassName}
        style={{ maxHeight: COMPARATIVO_CARD_MAX_HEIGHT_PX }}
      >
        <div className="flex flex-1 items-center justify-center gap-2 py-4 text-xs text-text-muted">
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          Carregando comparativo 2026 × 2022…
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section
        className={comparativoCardClassName}
        style={{ maxHeight: COMPARATIVO_CARD_MAX_HEIGHT_PX }}
      >
        <h2 className="text-xs font-semibold text-text-primary">Expectativa 2026 × Federal 2022</h2>
        <p className="mt-1 text-xs text-text-secondary">{error}</p>
      </section>
    )
  }

  return (
    <section
      className={comparativoCardClassName}
      style={{ maxHeight: COMPARATIVO_CARD_MAX_HEIGHT_PX }}
    >
      <div className="shrink-0 flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <div className="min-w-0">
          <h2 className="text-xs font-semibold leading-tight text-text-primary">
            Anterior 2026 × Federal 2022
          </h2>
          <p className="text-[10px] leading-tight text-text-muted">
            Cenário <strong className="font-medium text-text-secondary">{cenarioLabel}</strong> — mesma coluna da aba Base
          </p>
        </div>
        {resumo ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[9px] tabular-nums text-text-secondary">
            <span>
              <strong className="text-text-primary">{formatVotos(resumo.totalExpectativa2026)}</strong> anterior
            </span>
            <span className="text-text-muted">·</span>
            <span>
              <strong className="text-text-primary">{formatVotos(resumo.totalVotos2022)}</strong> 2022
            </span>
            <span className="text-text-muted">·</span>
            <span className={resumo.delta >= 0 ? 'text-emerald-600' : 'text-red-600'}>
              {resumo.delta >= 0 ? '+' : ''}
              {formatVotos(resumo.delta)}
            </span>
            <span className="text-text-muted">·</span>
            <span className="text-emerald-700">↑{resumo.cresceu}</span>
            <span className="text-amber-700">={resumo.manteve}</span>
            <span className="text-red-700">↓{resumo.caiu}</span>
          </div>
        ) : null}
      </div>

      <div className="mt-1.5 flex shrink-0 flex-wrap items-center gap-1.5">
        <div className="flex flex-wrap gap-0.5 rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-app p-0.5">
          {VIEWS.map((item) => {
            const Icon = item.icon
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setView(item.id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[10px] font-medium leading-none transition-colors',
                  view === item.id
                    ? 'bg-[#E6F1FB] text-[rgb(var(--color-primary))]'
                    : 'text-text-secondary hover:text-text-primary'
                )}
              >
                <Icon className="h-3 w-3" aria-hidden />
                {item.label}
              </button>
            )
          })}
        </div>

        {view === 'tabela' ? (
          <>
            <div className="flex flex-wrap gap-0.5">
              {FILTROS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setFiltro(item.id)}
                  className={cn(
                    'rounded-full border px-2 py-0.5 text-[10px] font-medium leading-none transition-colors',
                    filtro === item.id
                      ? 'border-[rgb(var(--color-primary))] bg-[#E6F1FB] text-[rgb(var(--color-primary))]'
                      : 'border-[rgb(var(--color-border-secondary)/0.85)] text-text-secondary hover:bg-bg-app'
                  )}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <label className="relative ml-auto min-w-[8rem] flex-1 sm:max-w-[11rem]">
              <Search className="pointer-events-none absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-text-muted" aria-hidden />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar…"
                className="w-full rounded-md border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-app py-1 pl-6 pr-1.5 text-[10px] text-text-primary outline-none focus:border-[rgb(var(--color-primary))]"
              />
            </label>
          </>
        ) : null}
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-auto">
        {view === 'mapa' ? (
          <div
            id="mapa-comparativo-panorama-container"
            className={cn(
              'relative min-h-0 min-w-0 overflow-hidden rounded-lg border border-[rgb(var(--color-border-tertiary)/0.45)]',
              '[&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-full [&:fullscreen]:flex-col [&:fullscreen]:min-h-0 [&:fullscreen]:bg-bg-surface'
            )}
          >
            <MapaExpectativaVs2022
              comparativoLista={rows}
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
        ) : (
          <table className="w-full min-w-[20rem] border-collapse">
            <thead>
              <tr>
                <th className={cn(thClass, 'text-left')}>Município</th>
                <th className={cn(thClass, 'w-14 text-right')}>2022</th>
                <th className={cn(thClass, 'w-24 text-center')}>Barra</th>
                <th className={cn(thClass, 'w-14 text-right')}>2026</th>
                <th className={cn(thClass, 'w-14 text-right')}>Δ</th>
              </tr>
            </thead>
            <tbody>
              {rowsFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-text-secondary">
                    Nenhum município neste filtro.
                  </td>
                </tr>
              ) : (
                rowsFiltradas.map((row) => {
                  const cresceu = row.expectativa2026 > row.votos2022
                  const caiu = row.expectativa2026 < row.votos2022
                  return (
                    <tr key={row.cidade} className="hover:bg-bg-app/50">
                      <td className={cn(tdClass, 'max-w-[8rem] truncate text-left font-medium text-text-primary')}>
                        {row.cidade}
                      </td>
                      <td className={cn(tdClass, 'text-right text-slate-600')}>{formatVotos(row.votos2022)}</td>
                      <td className={cn(tdClass, 'text-center')}>
                        <ComparativoBarraCell row={row} />
                      </td>
                      <td
                        className={cn(
                          tdClass,
                          'text-right',
                          cresceu ? 'text-emerald-700' : caiu ? 'text-red-700' : 'text-text-secondary'
                        )}
                      >
                        {formatVotos(row.expectativa2026)}
                      </td>
                      <td
                        className={cn(
                          tdClass,
                          'text-right font-semibold',
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
          </table>
        )}
      </div>
    </section>
  )
}
