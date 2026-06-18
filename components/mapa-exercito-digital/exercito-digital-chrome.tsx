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
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import { labelAudience } from '@/lib/mandatos-instagram-piaui'
import { ghostButtonClass, primaryButtonClass } from '@/lib/premium-ui-classes'
import { exercitoSectionCardClass } from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

const BANNER_STORAGE_KEY = 'cockpit2026.exercito-digital.banner.dismissed'
const LOOKBACK_OPTIONS = [7, 15, 30] as const

type IgCfg = { token: string; businessAccountId: string }

const AUDIENCE_OPTIONS: ExercitoDigitalAudience[] = ['liderados', 'mandatos']

interface ExercitoDigitalHeaderProps {
  audience: ExercitoDigitalAudience
  onAudienceChange: (audience: ExercitoDigitalAudience) => void
  lookbackDays: number
  onLookbackChange: (days: number) => void
  onSyncComplete: () => void
}

export function ExercitoDigitalHeader({
  audience,
  onAudienceChange,
  lookbackDays,
  onLookbackChange,
  onSyncComplete,
}: ExercitoDigitalHeaderProps) {
  const [cfg, setCfg] = useState<IgCfg | null>(null)
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [exportBusy, setExportBusy] = useState<'idle' | 'xlsx' | 'pdf'>('idle')
  const [windowOpen, setWindowOpen] = useState(false)
  const [audienceOpen, setAudienceOpen] = useState(false)

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

  const relatorioUrl = useCallback(
    (aud: ExercitoDigitalAudience) =>
      `/api/mobilizacao/relatorio-check-mapa-digital-ig?escopo=pi${aud === 'mandatos' ? '&base=mandatos' : ''}`,
    []
  )

  const carregarPi = useCallback(async (): Promise<RelatorioMapaDigitalIgTdPayload> => {
    const res = await fetch(relatorioUrl(audience), { cache: 'no-store' })
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { error?: string }
      throw new Error(j.error ?? 'Falha ao montar o relatório.')
    }
    return (await res.json()) as RelatorioMapaDigitalIgTdPayload
  }, [audience, relatorioUrl])

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

  return (
    <>
      <div className={cn(exercitoSectionCardClass, 'px-4 py-3')}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5">
            <IconMilitaryRank
              className="mt-0.5 h-[18px] w-[18px] shrink-0 text-[rgb(var(--color-primary))]"
              stroke={1.5}
              aria-hidden
            />
            <div>
              <h1 className="text-sm font-medium text-text-primary">Mobilização digital · Exército</h1>
              <p className="text-[11.5px] text-text-muted">
                {audience === 'mandatos'
                  ? 'Engajamento de prefeitos e vereadores nas postagens do Instagram'
                  : 'Ativação de líderes nas postagens do Instagram'}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <button
                type="button"
                onClick={() => setAudienceOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-[99px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-3 py-1.5 text-[11.5px] font-medium text-text-primary"
              >
                {labelAudience(audience)}
                <IconChevronDown className="h-3 w-3 opacity-60" stroke={1.5} aria-hidden />
              </button>
              {audienceOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[180px] rounded-lg border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface py-1">
                  {AUDIENCE_OPTIONS.map((opt) => (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => {
                        onAudienceChange(opt)
                        setAudienceOpen(false)
                      }}
                      className={cn(
                        'block w-full px-3 py-1.5 text-left text-[11.5px] transition-colors hover:bg-bg-app',
                        opt === audience ? 'font-medium text-[rgb(var(--color-primary))]' : 'text-text-secondary'
                      )}
                    >
                      {labelAudience(opt)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={() => setWindowOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-[99px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-3 py-1.5 text-[11.5px] font-medium text-text-primary"
              >
                <IconCalendar className="h-3.5 w-3.5 opacity-70" stroke={1.5} aria-hidden />
                {lookbackDays} dias
                <IconChevronDown className="h-3 w-3 opacity-60" stroke={1.5} aria-hidden />
              </button>
              {windowOpen ? (
                <div className="absolute right-0 top-full z-20 mt-1 min-w-[120px] rounded-lg border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface py-1">
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
                        days === lookbackDays ? 'font-medium text-[rgb(var(--color-primary))]' : 'text-text-secondary'
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
              className={cn(ghostButtonClass, 'disabled:opacity-50')}
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
              className={cn(ghostButtonClass, 'disabled:opacity-50')}
            >
              {exportBusy === 'pdf' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin opacity-70" aria-hidden />
              ) : (
                <IconFileTypePdf className="h-3.5 w-3.5 opacity-70" stroke={1.5} aria-hidden />
              )}
              PDF
            </button>
            <button type="button" onClick={() => setShowConfig(true)} className={ghostButtonClass}>
              <IconKey className="h-3.5 w-3.5 opacity-70" stroke={1.5} aria-hidden />
              Credenciais
            </button>
            <button
              type="button"
              disabled={syncing || loadingCfg}
              onClick={() => void handleSync()}
              className={cn(primaryButtonClass, 'disabled:opacity-50')}
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              ) : (
                <IconRefresh className="h-3.5 w-3.5" stroke={1.5} aria-hidden />
              )}
              Sincronizar
            </button>
          </div>
        </div>
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

export function ExercitoDigitalBanner({ audience }: { audience: ExercitoDigitalAudience }) {
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
    <div className="flex items-start gap-2.5 rounded-[10px] border border-[#B5D4F4] bg-[#E6F1FB] px-3.5 py-2.5">
      <IconInfoCircle className="mt-px h-[15px] w-[15px] shrink-0 text-[rgb(var(--color-primary))]" stroke={1.5} aria-hidden />
      <p className="flex-1 text-[11.5px] leading-[1.5] text-[#0C447C]">
        {audience === 'mandatos' ? (
          <>
            <strong className="font-medium">O que é medido aqui:</strong> cruzamos os comentários nas postagens do
            deputado com os perfis de Instagram de prefeitos e vereadores do Piauí (planilha mandatos 2024). Mostra
            quantos mandatários com perfil cadastrado interagiram e o engajamento por município.
          </>
        ) : (
          <>
            <strong className="font-medium">O que é medido aqui:</strong> cada líder da nossa rede recebeu uma instrução
            para comentar nas postagens do deputado. Esta página mostra quantos cumpriram a missão (ativação), gerando
            percepção de relevância e engajamento orgânico no Instagram. Meta: acima de 70% de ativação por município.
          </>
        )}
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
        className="shrink-0 text-[rgb(var(--color-primary))]"
      >
        <IconX className="h-3 w-3" stroke={1.5} aria-hidden />
      </button>
    </div>
  )
}
