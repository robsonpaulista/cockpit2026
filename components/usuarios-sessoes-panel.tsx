'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Monitor, Radio, RefreshCw, ShieldOff } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  fetchAuthSessions,
  revokeAuthSession,
  revokeUserAuthSessions,
  type AuthSessionRow,
} from '@/lib/services/auth-sessions'

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  const diff = Date.now() - t
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'agora'
  if (min < 60) return `há ${min} min`
  const h = Math.floor(min / 60)
  if (h < 24) return `há ${h} h`
  const d = Math.floor(h / 24)
  return `há ${d} d`
}

function statusLabel(status: AuthSessionRow['status']): string {
  if (status === 'online') return 'Online'
  if (status === 'ausente') return 'Ausente'
  return 'Sem pulso'
}

export function UsuariosSessoesPanel() {
  const [sessions, setSessions] = useState<AuthSessionRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setError(null)
    try {
      const data = await fetchAuthSessions()
      setSessions(data.sessions)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar sessões')
      setSessions([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
    const timer = window.setInterval(() => {
      void load()
    }, 30_000)
    return () => window.clearInterval(timer)
  }, [load])

  const handleRevokeOne = async (row: AuthSessionRow) => {
    const self = row.isCurrent
      ? 'Esta é a sua sessão atual — você será desconectado. Continuar?'
      : `Encerrar sessão de ${row.userName}?`
    if (!window.confirm(self)) return
    setBusyId(row.sessionId)
    try {
      await revokeAuthSession(row.sessionId)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha ao encerrar')
    } finally {
      setBusyId(null)
    }
  }

  const handleRevokeUser = async (row: AuthSessionRow) => {
    if (
      !window.confirm(
        `Encerrar todas as sessões de ${row.userName} (${row.userEmail})?`,
      )
    ) {
      return
    }
    setBusyId(`user:${row.userId}`)
    try {
      await revokeUserAuthSessions(row.userId)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Falha ao encerrar')
    } finally {
      setBusyId(null)
    }
  }

  const onlineCount = sessions.filter((s) => s.status === 'online').length

  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-border-card bg-bg-surface shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-card p-6">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
            <Radio className="h-5 w-5 text-[var(--palette-inst)]" aria-hidden />
            Sessões
          </h2>
          <p className="mt-1 text-xs text-text-secondary">
            Quem está logado, de onde e com qual equipamento. Online = pulso nos últimos 5 min.
            Sessão aberta há mais de 3 dias é encerrada automaticamente.
            {sessions.length > 0
              ? ` ${onlineCount} online · ${sessions.length} sessão${sessions.length === 1 ? '' : 'ões'}.`
              : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setLoading(true)
            void load()
          }}
          className="inline-flex items-center gap-2 rounded-lg border border-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-bg-app"
        >
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden />
          Atualizar
        </button>
      </div>

      {error ? (
        <p className="px-6 py-4 text-sm text-status-error">{error}</p>
      ) : null}

      {loading && sessions.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-12">
          <Loader2 className="h-6 w-6 animate-spin text-[var(--palette-inst)]" />
          <span className="text-sm text-text-secondary">Carregando sessões...</span>
        </div>
      ) : sessions.length === 0 ? (
        <div className="py-12 text-center">
          <Monitor className="mx-auto mb-3 h-12 w-12 text-text-secondary opacity-50" />
          <p className="text-sm text-text-secondary">
            Nenhuma sessão Auth encontrada. Se o SQL ainda não rodou, execute
            create-user-presence-sessions.sql no Supabase.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-border-card bg-bg-app">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Usuário
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Equipamento
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Onde
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                  Tempo
                </th>
                <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary w-40">
                  Ações
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-card">
              {sessions.map((row) => (
                <tr key={row.sessionId} className="hover:bg-bg-app/50">
                  <td className="px-6 py-4">
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium',
                        row.status === 'online' &&
                          'bg-[var(--palette-inst-soft)] text-[var(--palette-inst)]',
                        row.status === 'ausente' && 'bg-bg-app text-text-secondary',
                        row.status === 'sem_pulso' && 'bg-bg-app text-text-muted',
                      )}
                    >
                      {statusLabel(row.status)}
                    </span>
                    {row.isCurrent ? (
                      <span className="mt-1 block text-[10px] font-medium uppercase tracking-wide text-[var(--palette-inst)]">
                        Você
                      </span>
                    ) : null}
                  </td>
                  <td className="px-6 py-4">
                    <div className="font-medium text-text-primary">{row.userName}</div>
                    <div className="text-sm text-text-secondary">{row.userEmail}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    <div>{row.deviceLabel}</div>
                    {row.lastPath ? (
                      <div className="mt-0.5 font-mono text-[11px] text-text-muted">
                        {row.lastPath}
                      </div>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    <div>{row.location}</div>
                    {row.ip ? (
                      <div className="mt-0.5 font-mono text-[11px] text-text-muted">{row.ip}</div>
                    ) : null}
                  </td>
                  <td className="px-6 py-4 text-sm text-text-secondary">
                    <div>Visto {formatWhen(row.lastSeenAt)}</div>
                    <div className="text-[11px] text-text-muted">
                      Login {formatWhen(row.sessionCreatedAt)}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-start gap-1">
                      <button
                        type="button"
                        onClick={() => void handleRevokeOne(row)}
                        disabled={busyId === row.sessionId}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-[var(--palette-reject)] hover:bg-red-50 disabled:opacity-50"
                      >
                        Encerrar
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRevokeUser(row)}
                        disabled={busyId === `user:${row.userId}`}
                        className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] text-text-secondary hover:bg-bg-app disabled:opacity-50"
                        title="Encerrar todas deste usuário"
                      >
                        <ShieldOff className="h-3 w-3" aria-hidden />
                        Todas
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
