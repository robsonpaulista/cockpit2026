'use client'

import { useEffect, useMemo, useState } from 'react'
import { IconDownload, IconX } from '@tabler/icons-react'
import { cn } from '@/lib/utils'
import {
  defaultTerritorioBaseExportFieldIds,
  exportarTerritorioBaseExcel,
  TERRITORIO_BASE_EXPORT_FIELDS,
  type TerritorioBaseExportFieldId,
} from '@/lib/territorio-base-export'
import {
  territorioBaseGhostButtonClass,
  territorioBaseTextClass,
} from '@/lib/territorio-base-styles'

type Props = {
  isOpen: boolean
  onClose: () => void
  records: Array<Record<string, unknown>>
  filtrosResumo?: Array<{ Campo: string; Valor: string }>
}

export function TerritorioBaseExportModal({
  isOpen,
  onClose,
  records,
  filtrosResumo,
}: Props) {
  const [selected, setSelected] = useState<Set<TerritorioBaseExportFieldId>>(
    () => new Set(defaultTerritorioBaseExportFieldIds())
  )
  const [exporting, setExporting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!isOpen) return
    setSelected(new Set(defaultTerritorioBaseExportFieldIds()))
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

  const selectedCount = selected.size
  const allSelected = selectedCount === TERRITORIO_BASE_EXPORT_FIELDS.length

  const orderedSelected = useMemo(
    () => TERRITORIO_BASE_EXPORT_FIELDS.map((f) => f.id).filter((id) => selected.has(id)),
    [selected]
  )

  if (!isOpen) return null

  const toggle = (id: TerritorioBaseExportFieldId) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const selectAll = () => {
    setSelected(new Set(TERRITORIO_BASE_EXPORT_FIELDS.map((f) => f.id)))
  }

  const selectDefaults = () => {
    setSelected(new Set(defaultTerritorioBaseExportFieldIds()))
  }

  const clearAll = () => setSelected(new Set())

  const handleExport = () => {
    setError(null)
    setExporting(true)
    try {
      exportarTerritorioBaseExcel({
        records,
        fieldIds: orderedSelected,
        filtrosResumo,
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
      aria-labelledby="territorio-base-export-title"
      onClick={onClose}
    >
      <div
        className={cn(
          'w-full max-w-md rounded-2xl border border-card bg-surface shadow-card',
          territorioBaseTextClass
        )}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-card px-4 py-3">
          <div className="min-w-0">
            <h2 id="territorio-base-export-title" className="text-base font-semibold">
              Exportar lideranças
            </h2>
            <p className="mt-0.5 text-xs text-black/60">
              {records.length.toLocaleString('pt-BR')} registro
              {records.length === 1 ? '' : 's'} da seleção filtrada · Excel (.xlsx)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-black/55 hover:bg-black/5 hover:text-black"
            aria-label="Fechar"
          >
            <IconX className="h-4 w-4" stroke={1.5} />
          </button>
        </div>

        <div className="px-4 py-3">
          <div className="mb-2 flex flex-wrap items-center gap-2 text-[11.5px]">
            <button type="button" onClick={selectAll} className="underline-offset-2 hover:underline">
              Todos
            </button>
            <span className="text-black/30">·</span>
            <button
              type="button"
              onClick={selectDefaults}
              className="underline-offset-2 hover:underline"
            >
              Padrão
            </button>
            <span className="text-black/30">·</span>
            <button type="button" onClick={clearAll} className="underline-offset-2 hover:underline">
              Limpar
            </button>
            <span className="ml-auto text-black/50">
              {selectedCount}/{TERRITORIO_BASE_EXPORT_FIELDS.length} campos
            </span>
          </div>

          <ul className="max-h-[min(52vh,360px)] space-y-1 overflow-y-auto pr-1">
            {TERRITORIO_BASE_EXPORT_FIELDS.map((field) => {
              const checked = selected.has(field.id)
              return (
                <li key={field.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-xl border px-3 py-2 text-sm transition-colors',
                      checked
                        ? 'border-[#ff9800]/45 bg-[#ff9800]/8'
                        : 'border-card bg-background/40 hover:bg-black/[0.03]'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(field.id)}
                      className="h-3.5 w-3.5 accent-[#ff9800]"
                    />
                    <span className="min-w-0 flex-1">{field.label}</span>
                  </label>
                </li>
              )
            })}
          </ul>

          {error ? (
            <p className="mt-2 text-xs text-status-error" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-card px-4 py-3">
          <button type="button" onClick={onClose} className={territorioBaseGhostButtonClass}>
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleExport}
            disabled={exporting || selectedCount === 0 || records.length === 0}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[99px] border border-[#ff9800] bg-[#ff9800] px-3.5 py-1.5 text-[13px] font-medium text-black',
              'disabled:cursor-not-allowed disabled:opacity-45'
            )}
            title={
              selectedCount === 0
                ? 'Selecione ao menos um campo'
                : allSelected
                  ? 'Exportar todos os campos'
                  : `Exportar ${selectedCount} campos`
            }
          >
            <IconDownload className="h-[14px] w-[14px]" stroke={1.5} aria-hidden />
            {exporting ? 'Exportando…' : 'Exportar Excel'}
          </button>
        </div>
      </div>
    </div>
  )
}
