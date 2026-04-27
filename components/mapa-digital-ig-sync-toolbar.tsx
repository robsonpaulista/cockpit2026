'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { COCKPIT_PAGE_ACTIVE_MENU_ITEM } from '@/lib/sidebar-menu-active-style'
import { InstagramConfigModal } from '@/components/instagram-config-modal'
import { dispatchInstagramCommentsSynced } from '@/lib/instagram-comments-sync-events'
import { loadInstagramConfigAsync, saveInstagramConfig, syncInstagramComments } from '@/lib/instagramApi'

type IgCfg = { token: string; businessAccountId: string }
const LOOKBACK_OPTIONS = [7, 15, 30] as const

export function MapaDigitalIgSyncToolbar({
  className,
  visualTheme = 'dark',
}: {
  className?: string
  visualTheme?: 'dark' | 'light'
}) {
  const isLight = visualTheme === 'light'
  const [cfg, setCfg] = useState<IgCfg | null>(null)
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)
  const [lookbackDays, setLookbackDays] = useState<number>(15)

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
    setSyncMessage(null)
    setSyncError(null)
    const result = await syncInstagramComments(c.token, c.businessAccountId, 40, lookbackDays)
    setSyncing(false)
    if (!result.success) {
      setSyncError(result.error || 'Sincronização falhou')
      if (result.resetAt) {
        setSyncMessage(`Tente após ${new Date(result.resetAt).toLocaleString('pt-BR')}`)
      }
      return
    }
    const parts = [
      `${result.commentsUpserted ?? 0} comentários gravados/atualizados`,
      `${result.mediaProcessed ?? 0} publicações processadas`,
      `janela de ${result.lookbackDays ?? lookbackDays} dia(s)`,
    ]
    if (result.elapsedMs != null) {
      parts.push(`${Math.round(result.elapsedMs / 1000)}s`)
    }
    if (result.timedOutEarly) {
      parts.push('sincronização parcial por limite de tempo')
    }
    setSyncMessage(parts.join(' · '))
    dispatchInstagramCommentsSynced()
  }, [cfg, lookbackDays])

  const configured = Boolean(cfg?.token && cfg?.businessAccountId)

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <button
          type="button"
          onClick={() => setShowConfig(true)}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium sm:text-xs',
            isLight
              ? 'h-9 rounded-[10px] border border-[#D9E2EC] bg-white px-3 text-[#0B2A4A] hover:border-[#0057B8] hover:bg-[#E8F1FF] hover:text-[#0057B8]'
              : 'border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] text-[#E6EDF3] hover:bg-[rgba(255,255,255,0.06)]'
          )}
        >
          <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Credenciais
        </button>
        <label
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium sm:text-xs',
            isLight
              ? 'h-9 rounded-[10px] border border-[#D9E2EC] bg-white px-3 text-[#0B2A4A]'
              : 'border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] text-[#E6EDF3]'
          )}
        >
          Janela
          <select
            value={lookbackDays}
            onChange={(e) => setLookbackDays(Number(e.target.value))}
            disabled={syncing || loadingCfg}
            className={cn(
              'rounded border px-1.5 py-0.5 text-[11px] disabled:opacity-60',
              isLight
                ? 'rounded-md border border-[#BFD0E2] bg-white text-[#0B2A4A]'
                : 'border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.35)] text-[#E6EDF3]'
            )}
          >
            {LOOKBACK_OPTIONS.map((days) => (
              <option key={days} value={days}>
                {days} dias
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          disabled={syncing || loadingCfg}
          onClick={() => void handleSync()}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold disabled:opacity-50 sm:text-xs',
            isLight
              ? cn('h-9 rounded-[10px] px-3 transition-all duration-200', COCKPIT_PAGE_ACTIVE_MENU_ITEM)
              : 'border-[rgba(218,165,32,0.45)] bg-[rgba(218,165,32,0.15)] text-[#E6EDF3] hover:bg-[rgba(218,165,32,0.22)]'
          )}
        >
          {syncing ? (
            <Loader2
              className={cn('h-3.5 w-3.5 shrink-0 animate-spin', isLight && 'text-white')}
              aria-hidden
            />
          ) : (
            <RefreshCw className={cn('h-3.5 w-3.5 shrink-0', isLight && 'text-white')} aria-hidden />
          )}
          Sincronizar comentários
        </button>
      </div>
      {!loadingCfg && !configured ? (
        <p className="mt-1 max-w-md text-[10px] leading-snug text-[#AAB4C0] sm:text-[11px]">
          Configure token e ID da página (Credenciais) para gravar comentários no banco — visíveis para toda a equipe
          no mapa.
        </p>
      ) : null}
      {syncError ? <p className="mt-1 text-[10px] text-red-300 sm:text-[11px]">{syncError}</p> : null}
      {syncMessage && !syncError ? (
        <p className="mt-1 text-[10px] text-emerald-300/90 sm:text-[11px]">{syncMessage}</p>
      ) : null}
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
