'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Settings } from 'lucide-react'
import { cn } from '@/lib/utils'
import { InstagramConfigModal } from '@/components/instagram-config-modal'
import { dispatchInstagramCommentsSynced } from '@/lib/instagram-comments-sync-events'
import { loadInstagramConfigAsync, saveInstagramConfig, syncInstagramComments } from '@/lib/instagramApi'

type IgCfg = { token: string; businessAccountId: string }

export function MapaDigitalIgSyncToolbar({ className }: { className?: string }) {
  const [cfg, setCfg] = useState<IgCfg | null>(null)
  const [loadingCfg, setLoadingCfg] = useState(true)
  const [showConfig, setShowConfig] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

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
    const result = await syncInstagramComments(c.token, c.businessAccountId, 40)
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
    ]
    setSyncMessage(parts.join(' · '))
    dispatchInstagramCommentsSynced()
  }, [cfg])

  const configured = Boolean(cfg?.token && cfg?.businessAccountId)

  return (
    <>
      <div className={cn('flex flex-wrap items-center gap-2', className)}>
        <button
          type="button"
          onClick={() => setShowConfig(true)}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(255,255,255,0.12)] bg-[rgba(0,0,0,0.25)] px-2.5 py-1.5 text-[11px] font-medium text-[#E6EDF3] hover:bg-[rgba(255,255,255,0.06)] sm:text-xs"
        >
          <Settings className="h-3.5 w-3.5 shrink-0" aria-hidden />
          Credenciais
        </button>
        <button
          type="button"
          disabled={syncing || loadingCfg}
          onClick={() => void handleSync()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[rgba(218,165,32,0.45)] bg-[rgba(218,165,32,0.15)] px-2.5 py-1.5 text-[11px] font-semibold text-[#E6EDF3] hover:bg-[rgba(218,165,32,0.22)] disabled:opacity-50 sm:text-xs"
        >
          {syncing ? (
            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 shrink-0" aria-hidden />
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
