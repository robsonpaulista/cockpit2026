'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarPlus, Loader2, Trash2 } from 'lucide-react'
import { recfaceApi, type RecfaceAgendaEntry, type RecfaceVisitor } from '@/lib/recface-api'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

export function RecfaceAgendaTab() {
  const [entries, setEntries] = useState<Array<RecfaceAgendaEntry & { presence?: string }>>([])
  const [visitors, setVisitors] = useState<RecfaceVisitor[]>([])
  const [selectedName, setSelectedName] = useState('')
  const [time, setTime] = useState('')
  const [location, setLocation] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const [agenda, visitorList] = await Promise.all([
        recfaceApi.getAgendaWithPresence(),
        recfaceApi.listVisitors(),
      ])
      setEntries(agenda)
      setVisitors(visitorList)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao carregar agenda')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const addEntry = async () => {
    if (!selectedName || !time.trim() || !location.trim()) {
      setMessage('Preencha visitante, horário e local.')
      return
    }
    try {
      setSaving(true)
      await recfaceApi.appendAgenda({ name: selectedName, time, location })
      setTime('')
      setLocation('')
      setMessage('Compromisso incluído.')
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao incluir')
    } finally {
      setSaving(false)
    }
  }

  const removeForName = async (name: string) => {
    try {
      await recfaceApi.removeAgendaForName(name)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao remover')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#C8900A]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Agenda</h2>
        <p className="text-sm text-text-muted">
          Compromissos locais. Só visitantes já cadastrados aparecem na lista.
        </p>
      </div>

      <div className="grid gap-3 rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-4 sm:grid-cols-2 lg:grid-cols-4">
        <select
          value={selectedName}
          onChange={(e) => setSelectedName(e.target.value)}
          className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
        >
          <option value="">Visitante…</option>
          {visitors.map((v) => (
            <option key={v.id} value={v.name}>
              {v.name}
            </option>
          ))}
        </select>
        <input
          value={time}
          onChange={(e) => setTime(e.target.value)}
          placeholder="Horário (ex.: 10:30)"
          className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
        />
        <input
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="Local"
          className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={saving}
          onClick={() => void addEntry()}
          className={cn(sidebarPrimaryCTAButtonClass, 'flex items-center justify-center gap-2 py-2 text-sm')}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarPlus className="h-4 w-4" />}
          Incluir
        </button>
      </div>

      {message ? <p className="text-sm text-text-muted">{message}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)]">
        <table className="min-w-full text-sm">
          <thead className="bg-bg-muted/50 text-left text-xs text-text-muted">
            <tr>
              <th className="px-4 py-2">Nome</th>
              <th className="px-4 py-2">Horário</th>
              <th className="px-4 py-2">Local</th>
              <th className="px-4 py-2">Presença na entrada</th>
              <th className="px-4 py-2" />
            </tr>
          </thead>
          <tbody>
            {entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-text-muted">
                  Agenda vazia
                </td>
              </tr>
            ) : (
              entries.map((e, i) => (
                <tr key={`${e.name}-${e.time}-${i}`} className="border-t border-[rgb(var(--color-border-secondary)/0.5)]">
                  <td className="px-4 py-2">{e.name}</td>
                  <td className="px-4 py-2">{e.time}</td>
                  <td className="px-4 py-2">{e.location}</td>
                  <td className="px-4 py-2 text-text-muted">{e.presence ?? 'Sem registro'}</td>
                  <td className="px-4 py-2">
                    <button
                      type="button"
                      onClick={() => void removeForName(e.name)}
                      className="rounded p-1 text-text-muted hover:bg-bg-muted hover:text-status-danger"
                      title="Remover compromissos deste nome"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
