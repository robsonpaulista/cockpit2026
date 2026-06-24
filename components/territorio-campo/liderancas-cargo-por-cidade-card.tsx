'use client'

import { useEffect, useMemo, useState } from 'react'
import { Briefcase, Loader2 } from 'lucide-react'
import type {
  CidadeLiderancasCargoRow,
  LiderancasCargoPorCidadeResumo,
} from '@/lib/territorio-liderancas-cargo-por-cidade'
import {
  TERRITORIO_PANORAMA_PANEL_HEIGHT_PX,
  TerritorioDataPanel,
  TerritorioMetaChip,
  TerritorioPanelHeader,
  TerritorioRowIcon,
  TerritorioTableScroll,
  TerritorioTextButton,
  TerritorioThinProgress,
  territorioTdClass,
  territorioThClass,
} from '@/components/territorio-campo/territorio-panorama-panel-chrome'
import { typographyBodyClass, typographyBodyMediumClass, typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

function cargoPercent(total: number, base: number): number {
  if (base <= 0) return 0
  return Math.round((total / base) * 100)
}

export type LiderancasCargoPorCidadeCardProps = {
  cargoSelecionado: string | null
  onCargoSelecionado: (cargo: string | null) => void
  onRowsLoaded?: (rows: CidadeLiderancasCargoRow[]) => void
}

export function LiderancasCargoPorCidadeCard({
  cargoSelecionado,
  onCargoSelecionado,
  onRowsLoaded,
}: LiderancasCargoPorCidadeCardProps) {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumo, setResumo] = useState<LiderancasCargoPorCidadeResumo | null>(null)

  useEffect(() => {
    void (async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/territorio/liderancas-por-cargo-cidade')
        if (!res.ok) {
          const payload = (await res.json().catch(() => ({}))) as { error?: string }
          setError(payload.error ?? 'Não foi possível carregar lideranças por cargo.')
          setResumo(null)
          onRowsLoaded?.([])
          return
        }
        const data = (await res.json()) as {
          resumo?: LiderancasCargoPorCidadeResumo
          rows?: CidadeLiderancasCargoRow[]
        }
        setResumo(data.resumo ?? null)
        onRowsLoaded?.(data.rows ?? [])
      } catch {
        setError('Erro ao carregar lideranças por cargo.')
        setResumo(null)
        onRowsLoaded?.([])
      } finally {
        setLoading(false)
      }
    })()
  }, [onRowsLoaded])

  const cargos = useMemo(() => resumo?.cargosEstado ?? [], [resumo])
  const totalBase = resumo?.totalLiderancas ?? 0

  if (loading) {
    return (
      <TerritorioDataPanel style={{ maxHeight: TERRITORIO_PANORAMA_PANEL_HEIGHT_PX }}>
        <div className={cn('flex flex-1 items-center justify-center gap-2 py-12', typographyBodyMutedClass)}>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando base política…
        </div>
      </TerritorioDataPanel>
    )
  }

  if (error) {
    return (
      <TerritorioDataPanel style={{ maxHeight: TERRITORIO_PANORAMA_PANEL_HEIGHT_PX }}>
        <TerritorioPanelHeader title="Base política" description={error} />
      </TerritorioDataPanel>
    )
  }

  return (
    <TerritorioDataPanel style={{ maxHeight: TERRITORIO_PANORAMA_PANEL_HEIGHT_PX }}>
      <TerritorioPanelHeader
        title="Base política"
        description="Composição por cargo no estado — selecione uma linha para filtrar o comparativo."
        meta={
          resumo ? (
            <>
              <TerritorioMetaChip label="Lideranças" value={totalBase.toLocaleString('pt-BR')} />
              <TerritorioMetaChip label="Cidades" value={String(resumo.totalCidades)} />
              {cargoSelecionado ? (
                <TerritorioMetaChip label="Filtro" value={cargoSelecionado} tone="primary" />
              ) : null}
            </>
          ) : null
        }
        action={
          cargoSelecionado ? (
            <TerritorioTextButton onClick={() => onCargoSelecionado(null)}>Limpar filtro</TerritorioTextButton>
          ) : null
        }
      />

      <TerritorioTableScroll>
        <table className="w-full min-w-[16rem] border-collapse">
          <thead>
            <tr>
              <th className={territorioThClass}>Cargo</th>
              <th className={cn(territorioThClass, 'w-36')}>Participação</th>
              <th className={cn(territorioThClass, 'w-16 text-right')}>Total</th>
            </tr>
          </thead>
          <tbody>
            {cargos.length === 0 ? (
              <tr>
                <td colSpan={3} className={cn('px-4 py-8 text-center', typographyBodyMutedClass)}>
                  Nenhum cargo na base.
                </td>
              </tr>
            ) : (
              cargos.map((item) => {
                const selected = cargoSelecionado === item.cargo
                const percent = cargoPercent(item.total, totalBase)
                return (
                  <tr key={item.cargo}>
                    <td colSpan={3} className="p-0">
                      <button
                        type="button"
                        title={`${item.cargo} — ${item.total.toLocaleString('pt-BR')} lideranças`}
                        aria-pressed={selected}
                        onClick={() => onCargoSelecionado(selected ? null : item.cargo)}
                        className={cn(
                          'flex w-full items-center gap-3 border-b border-[rgb(var(--color-border-secondary)/0.3)] bg-bg-surface px-4 py-2.5 text-left transition-colors hover:bg-bg-app/55',
                          selected &&
                            'border-l-2 border-l-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint)/0.45)] pl-[14px]'
                        )}
                      >
                        <TerritorioRowIcon>
                          <Briefcase className="h-4 w-4" aria-hidden />
                        </TerritorioRowIcon>
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate',
                            selected ? cn(typographyBodyMediumClass, 'font-medium') : typographyBodyClass,
                            !selected && 'text-text-secondary'
                          )}
                        >
                          {item.cargo}
                        </span>
                        <span className="flex w-36 shrink-0 items-center gap-2">
                          <TerritorioThinProgress percent={percent} active={selected} />
                          <span
                            className={cn(
                              'w-9 shrink-0 text-right tabular-nums',
                              selected ? 'font-semibold text-[rgb(var(--color-primary))]' : typographyBodyMutedClass
                            )}
                          >
                            {percent}%
                          </span>
                        </span>
                        <span className={cn('w-16 shrink-0 text-right tabular-nums', typographyBodyClass)}>
                          {item.total.toLocaleString('pt-BR')}
                        </span>
                      </button>
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
        </table>
      </TerritorioTableScroll>
    </TerritorioDataPanel>
  )
}
