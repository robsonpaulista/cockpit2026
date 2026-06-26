'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw, Users, Calendar, ClipboardList, Cpu } from 'lucide-react'
import { recfaceApi, type RecfaceEngine, type RecfaceStats } from '@/lib/recface-api'
import { cn } from '@/lib/utils'

export function RecfaceHomeTab() {
  const [stats, setStats] = useState<RecfaceStats | null>(null)
  const [engine, setEngine] = useState<RecfaceEngine | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [s, e] = await Promise.all([recfaceApi.getStats(), recfaceApi.getEngine()])
      setStats(s)
      setEngine(e)
    } catch {
      setStats(null)
      setEngine(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  if (loading) {
    return (
      <div className="flex justify-center py-16 text-text-muted">
        <Loader2 className="h-6 w-6 animate-spin text-[#C8900A]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">FaceAgenda no Cockpit</h2>
          <p className="text-sm text-text-muted">
            Mesmas funções do recface: cadastro facial, agenda, reconhecimento e logs de presença.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-xs text-text-muted hover:bg-bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Visitantes', value: stats?.visitorsCount ?? 0, icon: Users },
          { label: 'Compromissos', value: stats?.agendaCount ?? 0, icon: Calendar },
          { label: 'Registros de presença', value: stats?.logsCount ?? 0, icon: ClipboardList },
          {
            label: 'Motor facial',
            value: engine?.available ? 'Ativo' : 'Indisponível',
            icon: Cpu,
          },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-4 py-3"
          >
            <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-lg bg-[#C8900A]/15">
              <Icon className="h-4 w-4 text-[#C8900A]" />
            </div>
            <p className="text-xs text-text-muted">{label}</p>
            <p className="text-lg font-semibold text-text-primary">{value}</p>
          </div>
        ))}
      </div>

      {engine?.label ? (
        <p
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            engine.available
              ? 'border-status-success/30 bg-status-success/5 text-text-primary'
              : 'border-status-danger/30 bg-status-danger/5 text-status-danger',
          )}
        >
          {engine.label.replace(/\*\*/g, '')}
        </p>
      ) : null}

      <div className="rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-4 py-4 text-sm text-text-muted">
        <p className="font-medium text-text-primary">Fluxo operacional</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5">
          <li>Cadastro — registrar nome + rosto</li>
          <li>Agenda — criar compromissos para nomes cadastrados</li>
          <li>Reconhecimento — conferir identidade e validar horário</li>
          <li>Logs — histórico de presença</li>
        </ol>
      </div>
    </div>
  )
}
