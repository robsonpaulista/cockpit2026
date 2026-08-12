'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Download, Loader2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  buildMapaObraListaExportRows,
  defaultMapaObraListaExportFieldIds,
  exportarMapaObrasLista,
  MAPA_OBRAS_LISTA_EXPORT_FIELDS,
  type MapaObraListaExportFieldId,
  type MapaObraListaExportFormat,
} from '@/lib/mapa-obras-lista-export'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import type { ObraPlanoDriveLink } from '@/lib/obras-mapa-plano-drive'
import { valorExibidoMapaObra } from '@/lib/obras-mapa'

type Props = {
  isOpen: boolean
  onClose: () => void
  obras: ObraMapaRow[]
  linksByObra: Record<string, ObraPlanoDriveLink>
  filtrosResumo?: string[]
  /** Quando a exportação usa checkboxes de registros (não só filtros). */
  selecaoResumo?: string
}

const FORMATOS: Array<{ id: MapaObraListaExportFormat; label: string; hint: string }> = [
  { id: 'xlsx', label: 'Excel', hint: '.xlsx' },
  { id: 'csv', label: 'CSV', hint: '.csv' },
  { id: 'pdf', label: 'PDF', hint: '.pdf' },
]

/** Modal para exportar a lista filtrada do Mapa de Obras. */
export function MapaObrasListaExportModal({
  isOpen,
  onClose,
  obras,
  linksByObra,
  filtrosResumo,
  selecaoResumo,
}: Props) {
  const [selected, setSelected] = useState<Set<MapaObraListaExportFieldId>>(
    () => new Set(defaultMapaObraListaExportFieldIds()),
  )
  const [formato, setFormato] = useState<MapaObraListaExportFormat>('xlsx')
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setSelected(new Set(defaultMapaObraListaExportFieldIds()))
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
      MAPA_OBRAS_LISTA_EXPORT_FIELDS.map((f) => f.id).filter((id) => selected.has(id)),
    [selected],
  )

  const selectedCount = orderedSelected.length
  const allSelected = selectedCount === MAPA_OBRAS_LISTA_EXPORT_FIELDS.length

  const municipiosCount = useMemo(() => {
    const set = new Set<string>()
    for (const obra of obras) {
      const m = (obra.municipio || '').trim()
      if (m) set.add(m)
    }
    return set.size
  }, [obras])

  const valorTotal = useMemo(() => {
    let sum = 0
    let any = false
    for (const obra of obras) {
      const v = valorExibidoMapaObra(obra)
      if (v != null && Number.isFinite(v)) {
        sum += v
        any = true
      }
    }
    return any ? sum : null
  }, [obras])

  if (!isOpen) return null

  const toggle = (id: MapaObraListaExportFieldId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(MAPA_OBRAS_LISTA_EXPORT_FIELDS.map((f) => f.id)))
  }

  const selectDefaults = () => {
    setSelected(new Set(defaultMapaObraListaExportFieldIds()))
  }

  const clearAll = () => setSelected(new Set())

  const handleExport = () => {
    setError(null)
    if (obras.length === 0) {
      setError('Nenhuma obra para exportar com os filtros atuais.')
      return
    }
    if (selectedCount === 0) {
      setError('Selecione ao menos uma coluna.')
      return
    }
    setExporting(true)
    try {
      exportarMapaObrasLista(formato, {
        rows: buildMapaObraListaExportRows(obras, linksByObra),
        fieldIds: orderedSelected,
        filtrosResumo,
        municipiosCount,
        valorTotal,
      })
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao exportar')
    } finally {
      setExporting(false)
    }
  }

  const modal = (
    <div
      className="wr-obras-export-modal fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapa-obras-lista-export-title"
      onClick={onClose}
    >
      <div
        className="wr-obras-export-modal__panel w-full max-w-md rounded-2xl border border-card shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-card px-4 py-3">
          <div className="min-w-0">
            <h2
              id="mapa-obras-lista-export-title"
              className="text-base font-semibold text-text-primary"
            >
              Exportar lista de obras
            </h2>
            <p className="mt-0.5 text-xs text-text-secondary">
              {obras.length.toLocaleString('pt-BR')} obra
              {obras.length === 1 ? '' : 's'}
              {selecaoResumo ? ' selecionada' : ' filtrada'}
              {obras.length === 1 ? '' : 's'} · {municipiosCount.toLocaleString('pt-BR')}{' '}
              município
              {municipiosCount === 1 ? '' : 's'}
            </p>
            {selecaoResumo ? (
              <p className="mt-1 text-[11px] text-text-muted">{selecaoResumo}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card p-1.5 text-text-secondary hover:bg-[#f5f6f8]"
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
                        ? 'border-[var(--palette-blue,#005B8F)] bg-[color-mix(in_srgb,var(--palette-blue,#005B8F)_10%,#fff)] text-text-primary'
                        : 'border-card bg-[#f5f6f8] text-text-secondary hover:border-[color-mix(in_srgb,var(--palette-blue,#005B8F)_40%,transparent)]',
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
                Colunas ({selectedCount}/{MAPA_OBRAS_LISTA_EXPORT_FIELDS.length})
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={selectDefaults}
                  className="rounded-md border border-card bg-white px-2 py-0.5 text-[10px] font-medium text-text-secondary hover:bg-[#f5f6f8]"
                >
                  Padrão
                </button>
                <button
                  type="button"
                  onClick={allSelected ? clearAll : selectAll}
                  className="rounded-md border border-card bg-white px-2 py-0.5 text-[10px] font-medium text-text-secondary hover:bg-[#f5f6f8]"
                >
                  {allSelected ? 'Limpar' : 'Todas'}
                </button>
              </div>
            </div>
            <ul className="wr-obras-export-modal__cols max-h-[240px] space-y-1 overflow-y-auto rounded-xl border border-card p-2">
              {MAPA_OBRAS_LISTA_EXPORT_FIELDS.map((field) => {
                const checked = selected.has(field.id)
                return (
                  <li key={field.id}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-xs text-text-primary hover:bg-[#f5f6f8]">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(field.id)}
                        className="h-3.5 w-3.5 rounded border-card accent-[var(--palette-blue,#005B8F)]"
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
            className="rounded-lg border border-card bg-white px-3 py-2 text-xs font-medium text-text-primary hover:bg-[#f5f6f8]"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || selectedCount === 0 || obras.length === 0}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--palette-blue,#005B8F)] bg-[var(--palette-blue,#005B8F)] px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Download className="h-3.5 w-3.5" aria-hidden />
            )}
            {exporting
              ? 'Exportando…'
              : `Exportar ${FORMATOS.find((f) => f.id === formato)?.label}`}
          </button>
        </div>
      </div>
    </div>
  )

  if (typeof document === 'undefined') return null
  return createPortal(modal, document.body)
}
