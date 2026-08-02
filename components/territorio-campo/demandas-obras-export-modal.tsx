'use client'

import { useEffect, useMemo, useState } from 'react'
import { Download, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildDemandaObraExportRows,
  defaultDemandaObraExportFieldIds,
  DEMANDAS_OBRAS_EXPORT_FIELDS,
  exportarDemandasObras,
  type DemandaObraExportFieldId,
  type DemandaObraExportFormat,
} from '@/lib/demandas-obras-export'
import type { CampoDemandaObraRow } from '@/lib/campo-demandas-obras'

type Props = {
  isOpen: boolean
  onClose: () => void
  rows: CampoDemandaObraRow[]
  cidadesCount: number
  filtrosResumo?: string[]
}

const FORMATOS: Array<{ id: DemandaObraExportFormat; label: string; hint: string }> = [
  { id: 'xlsx', label: 'Excel', hint: '.xlsx' },
  { id: 'csv', label: 'CSV', hint: '.csv' },
  { id: 'pdf', label: 'PDF', hint: '.pdf' },
]

/** Modal para escolher colunas e formato da exportação de Demandas. */
export function DemandasObrasExportModal({
  isOpen,
  onClose,
  rows,
  cidadesCount,
  filtrosResumo,
}: Props) {
  const [selected, setSelected] = useState<Set<DemandaObraExportFieldId>>(
    () => new Set(defaultDemandaObraExportFieldIds()),
  )
  const [formato, setFormato] = useState<DemandaObraExportFormat>('xlsx')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setSelected(new Set(defaultDemandaObraExportFieldIds()))
    setFormato('xlsx')
    setError(null)
    setExporting(false)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const orderedSelected = useMemo(
    () =>
      DEMANDAS_OBRAS_EXPORT_FIELDS.map((f) => f.id).filter((id) => selected.has(id)),
    [selected],
  )

  const selectedCount = orderedSelected.length
  const allSelected = selectedCount === DEMANDAS_OBRAS_EXPORT_FIELDS.length

  if (!isOpen) return null

  const toggle = (id: DemandaObraExportFieldId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(DEMANDAS_OBRAS_EXPORT_FIELDS.map((f) => f.id)))
  }

  const selectDefaults = () => {
    setSelected(new Set(defaultDemandaObraExportFieldIds()))
  }

  const clearAll = () => setSelected(new Set())

  const handleExport = () => {
    setError(null)
    if (rows.length === 0) {
      setError('Nenhuma demanda para exportar com os filtros atuais.')
      return
    }
    if (selectedCount === 0) {
      setError('Selecione ao menos uma coluna.')
      return
    }
    setExporting(true)
    try {
      exportarDemandasObras(formato, {
        rows: buildDemandaObraExportRows(rows),
        fieldIds: orderedSelected,
        filtrosResumo,
        cidadesCount,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao exportar')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="demandas-obras-export-title"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-card bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-card px-4 py-3">
          <div className="min-w-0">
            <h2 id="demandas-obras-export-title" className="text-base font-semibold text-text-primary">
              Exportar demandas
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              {rows.length.toLocaleString('pt-BR')} obra
              {rows.length === 1 ? '' : 's'} filtrada
              {rows.length === 1 ? '' : 's'} · organizadas por status
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card p-1.5 text-text-secondary hover:bg-background"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-4 px-4 py-3">
          <div>
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              Formato
            </p>
            <div className="grid grid-cols-3 gap-2">
              {FORMATOS.map((item) => {
                const active = formato === item.id
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setFormato(item.id)}
                    aria-pressed={active}
                    className={cn(
                      'rounded-xl border px-3 py-2 text-left transition-colors',
                      active
                        ? 'border-[#ff9800] bg-[#ff9800]/10 text-text-primary'
                        : 'border-card bg-background text-text-secondary hover:border-[#ff9800]/40',
                    )}
                  >
                    <span className="block text-xs font-semibold">{item.label}</span>
                    <span className="block text-[10px] opacity-70">{item.hint}</span>
                  </button>
                )
              })}
            </div>
          </div>

          <div>
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
                Colunas ({selectedCount}/{DEMANDAS_OBRAS_EXPORT_FIELDS.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={selectDefaults}
                  className="rounded-md border border-card px-2 py-0.5 text-[10px] font-medium text-text-secondary hover:bg-background"
                >
                  Padrão
                </button>
                <button
                  type="button"
                  onClick={allSelected ? clearAll : selectAll}
                  className="rounded-md border border-card px-2 py-0.5 text-[10px] font-medium text-text-secondary hover:bg-background"
                >
                  {allSelected ? 'Limpar' : 'Todas'}
                </button>
              </div>
            </div>
            <ul className="max-h-[240px] space-y-1 overflow-y-auto rounded-xl border border-card bg-background p-2">
              {DEMANDAS_OBRAS_EXPORT_FIELDS.map((field) => {
                const checked = selected.has(field.id)
                return (
                  <li key={field.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-text-primary hover:bg-surface">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(field.id)}
                        className="h-3.5 w-3.5 rounded border-card accent-[#ff9800]"
                      />
                      <span>{field.label}</span>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>

          {error ? (
            <p className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-card px-4 py-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card bg-background px-3 py-2 text-xs font-medium text-text-primary"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || selectedCount === 0 || rows.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#ff9800] bg-[#ff9800] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            {exporting ? 'Exportando…' : `Exportar ${FORMATOS.find((f) => f.id === formato)?.label}`}
          </button>
        </div>
      </div>
    </div>
  )
}
