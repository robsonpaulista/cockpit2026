'use client'

import { useMemo, useState } from 'react'
import {
  classificarObraFase,
  OBRA_FASE_LABEL,
  valorExibidoMapaObra,
  type ObraFaseMapa,
  type ObraMapaRow,
} from '@/lib/obras-mapa'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import {
  compareTerritorioNumber,
  compareTerritorioText,
  TerritorioSortableHeaderButton,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'

type SortObraCol = 'municipio' | 'cota'

const TIPO_LABEL: Record<string, string> = {
  asfalto: 'Asfalto',
  paralelepipedo: 'Paralelepípedo',
  'quadras-esportivas': 'Quadras e areninhas',
  'maquinario-agricola': 'Maquinário agrícola',
  'passagens-cisternas': 'Passagens e cisternas',
  outros: 'Outros',
}

function formatCurrency(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  }).format(value)
}

interface MapaObrasListaStatusProps {
  /** Obras já filtradas (mesma fonte do mapa: planilha Demandas). */
  obras: ObraMapaRow[]
  onStatusSalvo?: () => void
}

/** Lista das obras no mapa — mesma planilha Sheets da guia Demandas. */
export function MapaObrasListaStatus({ obras }: MapaObrasListaStatusProps) {
  const [busca, setBusca] = useState('')
  const [sortCol, setSortCol] = useState<SortObraCol>('municipio')
  const [sortAsc, setSortAsc] = useState(true)

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const base = !q
      ? obras
      : obras.filter((obra) => {
          const blob = [obra.municipio, obra.obra, obra.orgao, obra.status, obra.tipo]
            .filter(Boolean)
            .join(' ')
            .toLowerCase()
          return blob.includes(q)
        })

    return [...base].sort((a, b) => {
      if (sortCol === 'municipio') {
        const byMun = compareTerritorioText(a.municipio || '', b.municipio || '', sortAsc)
        if (byMun !== 0) return byMun
        return compareTerritorioNumber(
          valorExibidoMapaObra(a) ?? 0,
          valorExibidoMapaObra(b) ?? 0,
          false,
        )
      }
      const byCota = compareTerritorioNumber(
        valorExibidoMapaObra(a) ?? 0,
        valorExibidoMapaObra(b) ?? 0,
        sortAsc,
      )
      if (byCota !== 0) return byCota
      return compareTerritorioText(a.municipio || '', b.municipio || '', true)
    })
  }, [busca, obras, sortAsc, sortCol])

  const alternarSort = (column: SortObraCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, ['municipio'] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-card bg-bg-surface p-4">
        <h2 className="text-base font-semibold text-text-primary">
          Obras da planilha de Demandas
        </h2>
        <p className={cn('mt-1 max-w-3xl', typographyBodyMutedClass)}>
          Mesma fonte e filtros da guia Demandas (sem espaço, recurso ou transferência
          especial). Status vem da planilha e alimenta a fase no mapa.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar município, obra, status…"
          className="min-w-[12rem] flex-1 rounded-lg border border-card bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:max-w-xs"
        />
        <span className="text-xs text-text-secondary">
          {filtradas.length.toLocaleString('pt-BR')} obra
          {filtradas.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-card bg-bg-surface">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-card bg-bg-app/60 text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-3 py-2.5">
                  <TerritorioSortableHeaderButton
                    label="Município"
                    active={sortCol === 'municipio'}
                    asc={sortAsc}
                    onClick={() => alternarSort('municipio')}
                    compact
                  />
                </th>
                <th className="px-3 py-2.5">Obra</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">
                  <TerritorioSortableHeaderButton
                    label="Valor"
                    active={sortCol === 'cota'}
                    asc={sortAsc}
                    onClick={() => alternarSort('cota')}
                    align="left"
                    compact
                  />
                </th>
                <th className="px-3 py-2.5">Tema / órgão</th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Fase no mapa</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card">
              {filtradas.map((obra) => {
                const fase = classificarObraFase(obra.status) as ObraFaseMapa
                return (
                  <tr key={obra.id} className="align-top hover:bg-bg-app/30">
                    <td className="px-3 py-3 font-medium text-text-primary">
                      {obra.municipio}
                    </td>
                    <td className="max-w-md px-3 py-3 text-text-primary">{obra.obra}</td>
                    <td className="px-3 py-3 text-text-secondary">
                      {TIPO_LABEL[obra.tipo ?? ''] ?? obra.tipo ?? '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-text-secondary">
                      {formatCurrency(valorExibidoMapaObra(obra))}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">{obra.orgao ?? '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{obra.status ?? '—'}</td>
                    <td className="px-3 py-3 text-text-secondary">{OBRA_FASE_LABEL[fase]}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filtradas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-text-muted">
            Nenhuma obra encontrada.
          </p>
        ) : null}
      </div>
    </div>
  )
}
