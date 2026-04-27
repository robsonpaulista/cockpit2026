'use client'

import { useCallback, useState } from 'react'
import { FileSpreadsheet, FileText, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import type { RelatorioMapaDigitalIgTdPayload } from '@/lib/relatorio-mapa-digital-ig-td-types'
import {
  downloadBlob,
  exportRelatorioMapaDigitalIgParaPdf,
  exportRelatorioMapaDigitalIgParaXlsx,
  nomeArquivoRelatorioIg,
} from '@/lib/mapa-digital-ig-relatorio-check-export'

type Props = {
  visualPreset?: 'default' | 'futuristic'
  visualTheme?: 'dark' | 'light'
  className?: string
  /** Export do TD em foco no mapa (resumo + detalhe só desse TD). */
  exportTd?: { territorio: TerritorioDesenvolvimentoPI; disabled: boolean }
  /** Export consolidado: todos os municípios dos 12 TDs num único ficheiro. */
  exportPiTodas?: boolean
}

export function MapaDigitalIgRelatorioCheckExport({
  visualPreset = 'default',
  visualTheme = 'dark',
  className,
  exportTd,
  exportPiTodas,
}: Props) {
  const isFut = visualPreset === 'futuristic'
  const isLight = visualTheme === 'light'
  const [busy, setBusy] = useState<'idle' | 'td-xlsx' | 'td-pdf' | 'pi-xlsx' | 'pi-pdf'>('idle')

  const carregarTd = useCallback(async (td: TerritorioDesenvolvimentoPI): Promise<RelatorioMapaDigitalIgTdPayload> => {
    const q = new URLSearchParams({ td })
    const res = await fetch(`/api/mobilizacao/relatorio-check-mapa-digital-ig?${q.toString()}`, { cache: 'no-store' })
    if (res.status === 401) throw new Error('Sessão expirada. Entre novamente.')
    if (res.status === 403) throw new Error('Sem permissão para exportar (mobilização / Instagram).')
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? 'Falha ao montar o relatório.')
    }
    return (await res.json()) as RelatorioMapaDigitalIgTdPayload
  }, [])

  const carregarPi = useCallback(async (): Promise<RelatorioMapaDigitalIgTdPayload> => {
    const res = await fetch('/api/mobilizacao/relatorio-check-mapa-digital-ig?escopo=pi', { cache: 'no-store' })
    if (res.status === 401) throw new Error('Sessão expirada. Entre novamente.')
    if (res.status === 403) throw new Error('Sem permissão para exportar (mobilização / Instagram).')
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? 'Falha ao montar o relatório do PI.')
    }
    return (await res.json()) as RelatorioMapaDigitalIgTdPayload
  }, [])

  const exportarTdXlsx = useCallback(async () => {
    if (!exportTd || exportTd.disabled || busy !== 'idle') return
    setBusy('td-xlsx')
    try {
      const payload = await carregarTd(exportTd.territorio)
      const blob = exportRelatorioMapaDigitalIgParaXlsx(payload)
      downloadBlob(blob, nomeArquivoRelatorioIg('td', exportTd.territorio, 'xlsx'))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao exportar XLSX (TD).')
    } finally {
      setBusy('idle')
    }
  }, [busy, carregarTd, exportTd])

  const exportarTdPdf = useCallback(async () => {
    if (!exportTd || exportTd.disabled || busy !== 'idle') return
    setBusy('td-pdf')
    try {
      const payload = await carregarTd(exportTd.territorio)
      const blob = exportRelatorioMapaDigitalIgParaPdf(payload)
      downloadBlob(blob, nomeArquivoRelatorioIg('td', exportTd.territorio, 'pdf'))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao exportar PDF (TD).')
    } finally {
      setBusy('idle')
    }
  }, [busy, carregarTd, exportTd])

  const exportarPiXlsx = useCallback(async () => {
    if (!exportPiTodas || busy !== 'idle') return
    setBusy('pi-xlsx')
    try {
      const payload = await carregarPi()
      const blob = exportRelatorioMapaDigitalIgParaXlsx(payload)
      downloadBlob(blob, nomeArquivoRelatorioIg('pi', 'pi', 'xlsx'))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao exportar XLSX (PI todo).')
    } finally {
      setBusy('idle')
    }
  }, [busy, carregarPi, exportPiTodas])

  const exportarPiPdf = useCallback(async () => {
    if (!exportPiTodas || busy !== 'idle') return
    setBusy('pi-pdf')
    try {
      const payload = await carregarPi()
      const blob = exportRelatorioMapaDigitalIgParaPdf(payload)
      downloadBlob(blob, nomeArquivoRelatorioIg('pi', 'pi', 'pdf'))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao exportar PDF (PI todo).')
    } finally {
      setBusy('idle')
    }
  }, [busy, carregarPi, exportPiTodas])

  const offTd = !exportTd || exportTd.disabled || busy !== 'idle'
  const offPi = !exportPiTodas || busy !== 'idle'

  const btn = (isPi: boolean) =>
    cn(
      'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[9px] font-semibold transition-colors sm:px-2 sm:py-1 sm:text-[10px]',
      isFut
        ? isLight
          ? 'h-9 rounded-[10px] border border-[#D9E2EC] bg-white px-3 text-[#0B2A4A] hover:border-[#0057B8] hover:bg-[#E8F1FF] hover:text-[#0057B8] disabled:cursor-not-allowed disabled:opacity-70'
          : 'border-white/40 bg-white/15 text-white hover:bg-white/25 disabled:cursor-not-allowed disabled:opacity-70'
        : 'border-border-card bg-card text-text-primary hover:bg-background disabled:cursor-not-allowed disabled:opacity-70'
    )

  if (!exportTd && !exportPiTodas) return null

  return (
    <div
      className={cn(
        'flex min-h-[2rem] shrink-0 flex-wrap items-center gap-x-2 gap-y-1.5 rounded-lg border px-2 py-1.5',
        isFut
          ? isLight
            ? 'border border-[#D9E2EC] bg-white'
            : 'border-white/35 bg-[rgba(0,0,0,0.25)]'
          : 'border-border-card bg-muted/40',
        className
      )}
    >
      {exportTd ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]',
              isFut ? (isLight ? 'text-[#334155]' : 'text-white/90') : 'text-text-primary'
            )}
          >
            TD
          </span>
          <button
            type="button"
            disabled={offTd}
            onClick={() => void exportarTdXlsx()}
            title={exportTd.disabled ? 'Aguarde o resumo IG por município deste TD.' : 'Exportar este território (XLSX)'}
            className={btn(false)}
          >
            {busy === 'td-xlsx' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-3 w-3" aria-hidden />}
            XLS
          </button>
          <button
            type="button"
            disabled={offTd}
            onClick={() => void exportarTdPdf()}
            title={exportTd.disabled ? 'Aguarde o resumo IG por município deste TD.' : 'Exportar este território (PDF)'}
            className={btn(false)}
          >
            {busy === 'td-pdf' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <FileText className="h-3 w-3" aria-hidden />}
            PDF
          </button>
        </div>
      ) : null}

      {exportTd && exportPiTodas ? (
        <span className={cn('hidden sm:inline', isFut ? (isLight ? 'text-slate-300' : 'text-white/30') : 'text-border-card')} aria-hidden>
          |
        </span>
      ) : null}

      {exportPiTodas ? (
        <div className="flex flex-wrap items-center gap-1.5">
          <span
            className={cn(
              'text-[9px] font-semibold uppercase tracking-wide sm:text-[10px]',
              isFut ? (isLight ? 'text-[#334155]' : 'text-white/90') : 'text-text-primary'
            )}
            title="Todos os territórios de desenvolvimento do Piauí num único ficheiro"
          >
            PI todo
          </span>
          <button
            type="button"
            disabled={offPi}
            onClick={() => void exportarPiXlsx()}
            title="Exportar todos os TDs e municípios (XLSX) — pode demorar"
            className={btn(true)}
          >
            {busy === 'pi-xlsx' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <FileSpreadsheet className="h-3 w-3" aria-hidden />}
            XLS
          </button>
          <button
            type="button"
            disabled={offPi}
            onClick={() => void exportarPiPdf()}
            title="Exportar todos os TDs e municípios (PDF) — pode demorar"
            className={btn(true)}
          >
            {busy === 'pi-pdf' ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden /> : <FileText className="h-3 w-3" aria-hidden />}
            PDF
          </button>
        </div>
      ) : null}
    </div>
  )
}
