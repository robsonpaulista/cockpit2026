'use client'

import { useCallback, useEffect, useState } from 'react'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { recfaceApi } from '@/lib/recface-api'

export function RecfaceServiceBanner() {
  const [online, setOnline] = useState<boolean | null>(null)
  const [engineOk, setEngineOk] = useState<boolean | null>(null)

  const check = useCallback(async () => {
    try {
      const health = await recfaceApi.getHealth()
      setOnline(health.ok)
      setEngineOk(health.engine?.available ?? false)
    } catch {
      setOnline(false)
      setEngineOk(false)
    }
  }, [])

  useEffect(() => {
    void check()
    const timer = window.setInterval(() => {
      if (online !== true || engineOk !== true) void check()
    }, 4000)
    return () => window.clearInterval(timer)
  }, [check, online, engineOk])

  if (online === null) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[rgb(var(--color-border-secondary))] px-4 py-3 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" />
        Verificando serviço de reconhecimento facial…
      </div>
    )
  }

  if (!online) {
    return (
      <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
        <p className="flex items-center gap-2 font-medium">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          Serviço de reconhecimento facial offline
        </p>
        <p className="mt-1 text-text-muted">
          Rode <code className="rounded bg-bg-muted px-1.5 py-0.5 text-xs">npm run dev</code> (sobe Next + recface)
          ou apenas <code className="rounded bg-bg-muted px-1.5 py-0.5 text-xs">npm run recface:server</code>
        </p>
      </div>
    )
  }

  if (!engineOk) {
    return (
      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-text-primary">
        <p className="font-medium">Motor facial ainda não carregado</p>
        <p className="mt-1 text-xs text-text-muted">
          Na primeira execução o InsightFace baixa o modelo (~dezenas de MB). Aguarde e recarregue.
        </p>
      </div>
    )
  }

  return null
}
