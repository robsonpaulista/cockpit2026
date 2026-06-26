'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, RefreshCw } from 'lucide-react'
import { recfaceApi, type RecfaceLogEntry } from '@/lib/recface-api'

export function RecfaceLogsTab() {
  const [logs, setLogs] = useState<RecfaceLogEntry[]>([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setLogs(await recfaceApi.getLogs(500))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-text-primary">Logs de presença</h2>
          <p className="text-sm text-text-muted">Registros append-only gerados pelo reconhecimento.</p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs text-text-muted hover:bg-bg-muted"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Atualizar
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#C8900A]" />
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)]">
          <table className="min-w-full text-sm">
            <thead className="bg-bg-muted/50 text-left text-xs text-text-muted">
              <tr>
                <th className="px-4 py-2">Data/hora</th>
                <th className="px-4 py-2">Visitante</th>
                <th className="px-4 py-2">Agendado</th>
                <th className="px-4 py-2">Local</th>
                <th className="px-4 py-2">Status</th>
                <th className="px-4 py-2">Confiança</th>
              </tr>
            </thead>
            <tbody>
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-text-muted">
                    Nenhum registro ainda
                  </td>
                </tr>
              ) : (
                [...logs].reverse().map((log, i) => (
                  <tr key={`${log.timestamp}-${i}`} className="border-t border-[rgb(var(--color-border-secondary)/0.5)]">
                    <td className="px-4 py-2 whitespace-nowrap">{log.timestamp}</td>
                    <td className="px-4 py-2">{log.visitor}</td>
                    <td className="px-4 py-2">{log.scheduled_time || '—'}</td>
                    <td className="px-4 py-2">{log.location || '—'}</td>
                    <td className="px-4 py-2">{log.status}</td>
                    <td className="px-4 py-2">{(log.score * 100).toFixed(1)}%</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
