'use client'

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import { cn } from '@/lib/utils'

export type TerritorioSortDir = 'asc' | 'desc'

export function toggleTerritorioSort<T extends string>(
  currentColumn: T,
  currentAsc: boolean,
  nextColumn: T,
  /** Colunas de texto começam em A→Z; numéricas em Z→A (maior primeiro). */
  textColumns: readonly T[],
): { column: T; asc: boolean } {
  if (currentColumn === nextColumn) {
    return { column: currentColumn, asc: !currentAsc }
  }
  return {
    column: nextColumn,
    asc: textColumns.includes(nextColumn),
  }
}

export function compareTerritorioText(a: string, b: string, asc: boolean): number {
  const cmp = a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
  return asc ? cmp : -cmp
}

export function compareTerritorioNumber(a: number, b: number, asc: boolean): number {
  const cmp = a - b
  if (cmp !== 0) return asc ? cmp : -cmp
  return 0
}

type TerritorioSortableHeaderButtonProps = {
  label: string
  active: boolean
  asc: boolean
  onClick: () => void
  align?: 'left' | 'right' | 'center'
  className?: string
  compact?: boolean
}

/** Botão de cabeçalho clicável (A→Z / Z→A) para tabelas e barras de lista. */
export function TerritorioSortableHeaderButton({
  label,
  active,
  asc,
  onClick,
  align = 'left',
  className,
  compact = false,
}: TerritorioSortableHeaderButtonProps) {
  const nextDirection = active && asc ? 'Z→A' : 'A→Z'

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-0.5 font-medium transition-colors hover:text-text-primary',
        compact ? 'text-[11px]' : 'text-xs',
        align === 'right' && 'justify-end',
        align === 'center' && 'justify-center',
        align === 'left' && 'justify-start',
        active ? 'text-text-primary' : 'text-text-secondary',
        className,
      )}
      title={`Ordenar ${label} (${nextDirection})`}
      aria-label={`Ordenar ${label} (${nextDirection})`}
    >
      <span>{label}</span>
      {active ? (
        asc ? (
          <ArrowUp className="h-3 w-3 shrink-0" aria-hidden />
        ) : (
          <ArrowDown className="h-3 w-3 shrink-0" aria-hidden />
        )
      ) : (
        <ArrowUpDown className="h-3 w-3 shrink-0 opacity-45" aria-hidden />
      )}
    </button>
  )
}

type TerritorioSortBarProps = {
  cidadeActive: boolean
  cidadeAsc: boolean
  expectativaActive: boolean
  expectativaAsc: boolean
  onSortCidade: () => void
  onSortExpectativa: () => void
  expectativaLabel?: string
  className?: string
}

/** Barra de ordenação para listas agrupadas por cidade (sem `<table>`). */
export function TerritorioCidadeExpectativaSortBar({
  cidadeActive,
  cidadeAsc,
  expectativaActive,
  expectativaAsc,
  onSortCidade,
  onSortExpectativa,
  expectativaLabel = 'Expectativa de votos',
  className,
}: TerritorioSortBarProps) {
  return (
    <div
      className={cn(
        'mb-2 flex items-center justify-between gap-3 rounded-lg border border-card bg-background/60 px-3 py-2',
        className,
      )}
      role="toolbar"
      aria-label="Ordenar lista"
    >
      <TerritorioSortableHeaderButton
        label="Cidade"
        active={cidadeActive}
        asc={cidadeAsc}
        onClick={onSortCidade}
        align="left"
      />
      <TerritorioSortableHeaderButton
        label={expectativaLabel}
        active={expectativaActive}
        asc={expectativaAsc}
        onClick={onSortExpectativa}
        align="right"
      />
    </div>
  )
}
