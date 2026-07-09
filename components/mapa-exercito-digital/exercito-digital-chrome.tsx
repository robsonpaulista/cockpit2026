'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  IconCalendar,
  IconChevronDown,
  IconFileTypePdf,
  IconInfoCircle,
  IconKey,
  IconMilitaryRank,
  IconRefresh,
  IconTableExport,
  IconX,
} from '@tabler/icons-react'
import { Loader2 } from 'lucide-react'
import { InstagramConfigModal } from '@/components/instagram-config-modal'
import {
  downloadBlob,
  exportRelatorioMapaDigitalIgParaPdf,
  exportRelatorioMapaDigitalIgParaXlsx,
  nomeArquivoRelatorioIg,
} from '@/lib/mapa-digital-ig-relatorio-check-export'
import { dispatchInstagramCommentsSynced } from '@/lib/instagram-comments-sync-events'
import { loadInstagramConfigAsync, saveInstagramConfig, syncInstagramComments } from '@/lib/instagramApi'
import type { RelatorioMapaDigitalIgTdPayload } from '@/lib/relatorio-mapa-digital-ig-td-types'
import { getReferenceMonthOptions } from '@/lib/mapa-exercito-digital-gamification'
import { ghostButtonClass } from '@/lib/premium-ui-classes'
import { exercitoSectionCardClass } from '@/lib/mapa-exercito-digital-layout'
import { resumoAmberInfoBoxClass } from '@/lib/resumo-eleicoes-table-styles'
import { cn } from '@/lib/utils'

const exercitoAmberIconClass = 'text-[#C8900A]'
const exercitoAmberTextClass = 'text-[#854F0B]'
const exercitoAmberPrimaryButtonClass =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-[#C8900A] px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#A87308] disabled:pointer-events-none disabled:opacity-50'

const BANNER_STORAGE_KEY = 'cockpit2026.exercito-digital.banner.dismissed'
const LOOKBACK_OPTIONS = [7, 15, 30] as const

type IgCfg = { token: string; businessAccountId: string }

interface ExercitoDigitalHeaderProps {
  lookbackDays: number
  onLookbackChange: (days: number) => void
  onSyncComplete: () => void
  variant?: 'default' | 'compact'
  referenceMonth?: string
  referenceMonthLabel?: string
  onReferenceMonthChange?: (value: string) => void
}

export function ExercitoDigitalHeader({
  lookbackDays,
  onLookbackChange,
  onSyncComplete,
  variant = 'default',
  referenceMonth,
  referenceMonthLabel,
  onReferenceMonthChange,
}: ExercitoDigitalHeaderProps) {
  const [cfg, setCfg] = useState<IgCfg | null>(null)
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [exportBusy, setExportBusy] = useState<'idle' | 'xlsx' | 'pdf'>('idle')
  const [windowOpen, setWindowOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      setLoadingCfg(true)
      const c = await loadInstagramConfigAsync()
      if (cancelled) return
      setCfg(c.token && c.businessAccountId ? { token: c.token, businessAccountId: c.businessAccountId } : null)
      setLoadingCfg(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleSync = useCallback(async () => {
    const c = cfg ?? (await loadInstagramConfigAsync())
    if (!c.token || !c.businessAccountId) {
      setShowConfig(true)
      return
    }
    setSyncing(true)
    const result = await syncInstagramComments(c.token, c.businessAccountId, 40, lookbackDays)
    setSyncing(false)
    if (result.success) {
      dispatchInstagramCommentsSynced()
      onSyncComplete()
    } else if (!c.token) {
      setShowConfig(true)
    }
  }, [cfg, lookbackDays, onSyncComplete])

  const relatorioUrl = '/api/mobilizacao/relatorio-check-mapa-digital-ig?escopo=pi'

  const carregarPi = useCallback(async (): Promise<RelatorioMapaDigitalIgTdPayload> => {
    const res = await fetch(relatorioUrl, { cache: 'no-store' })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? 'Falha ao montar o relatório.')
    }
    return (await res.json()) as RelatorioMapaDigitalIgTdPayload
  }, [])

  const exportXls = useCallback(async () => {
    if (exportBusy !== 'idle') return
    setExportBusy('xlsx')
    try {
      const payload = await carregarPi()
      const blob = exportRelatorioMapaDigitalIgParaXlsx(payload)
      downloadBlob(blob, nomeArquivoRelatorioIg('pi', 'pi', 'xlsx'))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao exportar XLS.')
    } finally {
      setExportBusy('idle')
    }
  }, [carregarPi, exportBusy])

  const exportPdf = useCallback(async () => {
    if (exportBusy !== 'idle') return
    setExportBusy('pdf')
    try {
      const payload = await carregarPi()
      const blob = exportRelatorioMapaDigitalIgParaPdf(payload)
      downloadBlob(blob, nomeArquivoRelatorioIg('pi', 'pi', 'pdf'))
    } catch (e) {
      window.alert(e instanceof Error ? e.message : 'Erro ao exportar PDF.')
    } finally {
      setExportBusy('idle')
    }
  }, [carregarPi, exportBusy])

  const monthOptions = getReferenceMonthOptions(12)
  const isCompact = variant === 'compact'

  const controlsRow = (
    <div className="flex gap-2 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden md:flex-wrap md:overflow-visible md:pb-0">
      {isCompact && referenceMonth && onReferenceMonthChange ? (
        <label className="relative shrink-0">
          <span className="sr-only">Mês de referência</span>
          <select
            value={referenceMonth}
            onChange={(e) => onReferenceMonthChange(e.target.value)}
            className="h-8 appearance-none rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface py-0 pl-2.5 pr-7 text-[11.5px] font-medium text-text-primary"
          >
            {monthOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
          <IconChevronDown
            className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 opacity-50"
            stroke={1.5}
            aria-hidden
          />
        </label>
      ) : null}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => setWindowOpen((v) => !v)}
          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-2.5 text-[11.5px] font-medium text-text-primary"
        >
          <IconCalendar className="h-3.5 w-3.5 opacity-70" stroke={1.5} aria-hidden />
          {lookbackDays}d
          <IconChevronDown className="h-3 w-3 opacity-60" stroke={1.5} aria-hidden />
        </button>
        {windowOpen ? (
          <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface py-1 shadow-sm">
            {LOOKBACK_OPTIONS.map((days) => (
              <button
                key={days}
                type="button"
                onClick={() => {
                  onLookbackChange(days)
                  setWindowOpen(false)
                }}
                className={cn(
                  'block w-full px-3 py-1.5 text-left text-[11.5px] transition-colors hover:bg-bg-app',
                  days === lookbackDays ? cn('font-medium', exercitoAmberIconClass) : 'text-text-secondary'
                )}
              >
                {days} dias
              </button>
            ))}
          </div>
        ) : null}
      </div>
      <button
        type="button"
        disabled={exportBusy !== 'idle'}
        onClick={() => void exportXls()}
        className={cn(ghostButtonClass, 'h-8 shrink-0 px-2.5 py-0 text-[11.5px] disabled:opacity-50')}
      >
        {exportBusy === 'xlsx' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" aria-hidden />
        ) : (
          <IconTableExport className="h-3.5 w-3.5 opacity-70" stroke={1.5} aria-hidden />
        )}
        XLS
      </button>
      <button
        type="button"
        disabled={exportBusy !== 'idle'}
        onClick={() => void exportPdf()}
        className={cn(ghostButtonClass, 'h-8 shrink-0 px-2.5 py-0 text-[11.5px] disabled:opacity-50')}
      >
        {exportBusy === 'pdf' ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" aria-hidden />
        ) : (
          <IconFileTypePdf className="h-3.5 w-3.5 opacity-70" stroke={1.5} aria-hidden />
        )}
        PDF
      </button>
      <button
        type="button"
        onClick={() => setShowConfig(true)}
        className={cn(ghostButtonClass, 'h-8 shrink-0 px-2.5 py-0 text-[11.5px]')}
      >
        <IconKey className="h-3.5 w-3.5 opacity-70" stroke={1.5} aria-hidden />
        <span className="max-md:sr-only">Credenciais</span>
      </button>
      <button
        type="button"
        disabled={syncing || loadingCfg}
        onClick={() => void handleSync()}
        className={cn(exercitoAmberPrimaryButtonClass, 'h-8 shrink-0 px-3 py-0 text-[11.5px] disabled:opacity-50')}
      >
        {syncing ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <IconRefresh className="h-3.5 w-3.5" stroke={1.5} aria-hidden />
        )}
        Sincronizar
      </button>
    </div>
  )

  return (
    <>
      <div className={cn(exercitoSectionCardClass, 'px-3 py-3 md:px-4')}>
        {isCompact ? (
          <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
            <p className="min-w-0 text-[11.5px] leading-relaxed text-text-muted">
              Comentários da base eleitoral nas publicações do deputado
              {referenceMonthLabel ? (
                <>
                  {' '}
                  · mês <span className="font-medium text-text-secondary">{referenceMonthLabel}</span>
                </>
              ) : null}
            </p>
            {controlsRow}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <IconMilitaryRank
                className={cn('mt-0.5 h-[18px] w-[18px] shrink-0', exercitoAmberIconClass)}
                stroke={1.5}
                aria-hidden
              />
              <div className="min-w-0">
                <h1 className="text-sm font-medium text-text-primary">Mobilização digital · Exército</h1>
                <p className="mt-0.5 text-[11.5px] leading-relaxed text-text-muted">
                  Base eleitoral unificada: rede de liderados e mandatários nas postagens do Instagram
                </p>
              </div>
            </div>
            {controlsRow}
          </div>
        )}
      </div>
      {showConfig ? (
        <InstagramConfigModal
          onClose={() => setShowConfig(false)}
          onSave={(next) => {
            saveInstagramConfig(next.token, next.businessAccountId)
            setCfg(next)
            setShowConfig(false)
          }}
          currentConfig={cfg ?? undefined}
        />
      ) : null}
    </>
  )
}

export function ExercitoDigitalBanner() {
  const [dismissed, setDismissed] = useState(() => {
    if (typeof window === 'undefined') return false
    try {
      return localStorage.getItem(BANNER_STORAGE_KEY) === '1'
    } catch {
      return false
    }
  })

  if (dismissed) return null

  return (
    <div className={cn('flex items-start gap-2.5 rounded-[10px] px-3.5 py-2.5', resumoAmberInfoBoxClass)}>
      <IconInfoCircle className={cn('mt-px h-[15px] w-[15px] shrink-0', exercitoAmberIconClass)} stroke={1.5} aria-hidden />
      <p className={cn('flex-1 text-[11.5px] leading-[1.5]', exercitoAmberTextClass)}>
        <strong className="font-medium">O que é medido aqui:</strong> cruzamos comentários nas postagens do deputado
        com a base eleitoral completa — liderados da rede de mobilização e mandatários (prefeitos/vereadores) com
        perfil cadastrado. Perfis marcados como <strong className="font-medium">Rede</strong> são líderes com
        liderados vinculados; clique para ver o detalhamento por @.
      </p>
      <button
        type="button"
        aria-label="Fechar aviso"
        onClick={() => {
          try {
            localStorage.setItem(BANNER_STORAGE_KEY, '1')
          } catch {
            // ignore
          }
          setDismissed(true)
        }}
        className={cn('shrink-0', exercitoAmberIconClass)}
      >
        <IconX className="h-3 w-3" stroke={1.5} aria-hidden />
      </button>
    </div>
  )
}
