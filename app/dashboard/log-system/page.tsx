'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, RefreshCw, ScrollText, Search } from 'lucide-react'
import { usePermissions } from '@/hooks/use-permissions'
import type { AgentChatLogRow } from '@/lib/agent/agent-chat-log-types'
import { cn } from '@/lib/utils'

function formatWhen(iso: string): string {
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function sourceLabel(source: string): string {
  if (source === 'groq') return 'Groq'
  if (source === 'anthropic') return 'Claude'
  if (source === 'client') return 'Cliente'
  return source
}

function LogEntry({ log }: { log: AgentChatLogRow }) {
  const [expanded, setExpanded] = useState(false)
  const longAnswer = log.assistant_message.length > 280

  return (
    <article className="rounded-xl border border-card bg-surface p-4 shadow-sm">
      <div className="mb-3 flex flex-wrap items-center gap-2 text-[11px] text-text-secondary">
        <time className="font-medium text-text-primary">{formatWhen(log.created_at)}</time>
        {log.user_email ? (
          <span className="rounded-full bg-background px-2 py-0.5">{log.user_email}</span>
        ) : null}
        <span className="rounded-full bg-accent-gold-soft px-2 py-0.5 text-accent-gold">
          {sourceLabel(log.source)}
        </span>
        {log.intent ? (
          <span className="rounded-full bg-background px-2 py-0.5 font-mono">{log.intent}</span>
        ) : null}
        {log.page_path ? (
          <span className="truncate rounded-full bg-background px-2 py-0.5 max-w-[14rem]" title={log.page_path}>
            {log.page_path}
          </span>
        ) : null}
      </div>

      <div className="space-y-3">
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Pergunta
          </p>
          <p className="text-sm leading-relaxed text-text-primary">{log.user_message}</p>
        </div>
        <div>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-secondary">
            Resposta
          </p>
          <p
            className={cn(
              'whitespace-pre-wrap text-sm leading-relaxed text-text-primary',
              !expanded && longAnswer && 'line-clamp-4'
            )}
          >
            {log.assistant_message}
          </p>
          {longAnswer ? (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-2 text-xs font-medium text-accent-gold hover:underline"
            >
              {expanded ? 'Recolher' : 'Ver resposta completa'}
            </button>
          ) : null}
        </div>
      </div>
    </article>
  )
}

export default function LogSystemPage() {
  const router = useRouter()
  const { isAdmin, loading: permLoading } = usePermissions()
  const [logs, setLogs] = useState<AgentChatLogRow[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [searchInput, setSearchInput] = useState('')
  const [offset, setOffset] = useState(0)
  const limit = 40

  const fetchLogs = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        limit: String(limit),
        offset: String(offset),
      })
      if (query.trim()) params.set('q', query.trim())

      const res = await fetch(`/api/agent/logs?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'Erro ao carregar logs')
        setLogs([])
        setTotal(0)
        return
      }
      setLogs(data.logs ?? [])
      setTotal(data.total ?? 0)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar logs')
      setLogs([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [limit, offset, query])

  useEffect(() => {
    if (permLoading) return
    if (!isAdmin) {
      router.replace('/dashboard')
      return
    }
    void fetchLogs()
  }, [fetchLogs, isAdmin, permLoading, router])

  const onSearch = (e: React.FormEvent) => {
    e.preventDefault()
    setOffset(0)
    setQuery(searchInput.trim())
  }

  const page = Math.floor(offset / limit) + 1
  const totalPages = Math.max(1, Math.ceil(total / limit))

  if (permLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-4 py-6 lg:px-6">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-accent-gold-soft text-accent-gold">
              <ScrollText className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-xl font-semibold text-text-primary">Log System</h1>
              <p className="mt-1 text-sm text-text-secondary">
                Perguntas e respostas do Jarvis registradas por usuário e sessão.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void fetchLogs()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-card bg-surface px-3 py-2 text-sm text-text-primary hover:bg-app disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Atualizar
          </button>
        </header>

        <form onSubmit={onSearch} className="mb-5 flex gap-2">
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Buscar por pergunta, resposta ou e-mail…"
              className="w-full rounded-xl border border-card bg-surface py-2.5 pl-9 pr-3 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40"
            />
          </div>
          <button
            type="submit"
            className="shrink-0 rounded-xl bg-accent-gold px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            Buscar
          </button>
        </form>

        {error ? (
          <div className="mb-4 rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
            {error}
          </div>
        ) : null}

        {loading && logs.length === 0 ? (
          <div className="flex h-48 items-center justify-center text-sm text-text-secondary">
            <Loader2 className="mr-2 h-5 w-5 animate-spin text-accent-gold" />
            Carregando registros…
          </div>
        ) : logs.length === 0 ? (
          <div className="rounded-xl border border-card bg-surface px-6 py-12 text-center text-sm text-text-secondary">
            Nenhum registro encontrado. As conversas com o Jarvis passam a aparecer aqui após o uso.
          </div>
        ) : (
          <div className="space-y-3">
            {logs.map((log) => (
              <LogEntry key={log.id} log={log} />
            ))}
          </div>
        )}

        {total > limit ? (
          <div className="mt-6 flex items-center justify-between gap-3 text-sm text-text-secondary">
            <span>
              {total} registro{total === 1 ? '' : 's'} · página {page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={offset <= 0 || loading}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
                className="rounded-lg border border-card bg-surface px-3 py-1.5 disabled:opacity-40"
              >
                Anterior
              </button>
              <button
                type="button"
                disabled={offset + limit >= total || loading}
                onClick={() => setOffset((o) => o + limit)}
                className="rounded-lg border border-card bg-surface px-3 py-1.5 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
