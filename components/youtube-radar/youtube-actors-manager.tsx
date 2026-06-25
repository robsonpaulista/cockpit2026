'use client'

import { useCallback, useState } from 'react'
import { Loader2, Plus, Trash2, X } from 'lucide-react'
import { ACTOR_TYPE_OPTIONS, labelActorType } from '@/lib/youtube-radar-labels'
import { parseTermsInput } from '@/lib/youtube-radar-slug'
import type { PoliticalActorType, PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

interface YoutubeActorsManagerProps {
  actors: PoliticalActorWithTerms[]
  onChanged: () => void
  disabled?: boolean
  /** Exibe campo @ Instagram (radar de concorrentes) */
  showInstagramField?: boolean
}

export function YoutubeActorsManager({
  actors,
  onChanged,
  disabled = false,
  showInstagramField = false,
}: YoutubeActorsManagerProps) {
  const [expanded, setExpanded] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [name, setName] = useState('')
  const [actorType, setActorType] = useState<PoliticalActorType>('competitor')
  const [termsText, setTermsText] = useState('')
  const [newTermByActor, setNewTermByActor] = useState<Record<string, string>>({})
  const [instagramByActor, setInstagramByActor] = useState<Record<string, string>>({})
  const [busyId, setBusyId] = useState<string | null>(null)

  const criarCandidato = useCallback(async () => {
    setSaving(true)
    setFormError('')
    try {
      const terms = parseTermsInput(termsText)
      if (!name.trim()) throw new Error('Informe o nome do candidato.')
      if (terms.length === 0) throw new Error('Informe ao menos um termo de busca.')

      const res = await fetch('/api/youtube/actors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim(), actor_type: actorType, terms }),
      })
      const j = (await res.json()) as { error?: string; actor?: PoliticalActorWithTerms }
      if (!res.ok) throw new Error(j.error ?? 'Falha ao criar candidato.')

      setName('')
      setTermsText('')
      setShowForm(false)
      onChanged()
    } catch (e) {
      setFormError(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }, [actorType, name, onChanged, termsText])

  const toggleActive = useCallback(
    async (actor: PoliticalActorWithTerms) => {
      setBusyId(actor.id)
      try {
        const res = await fetch(`/api/youtube/actors/${actor.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ active: !actor.active }),
        })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(j.error ?? 'Falha ao atualizar.')
        onChanged()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Erro ao atualizar candidato.')
      } finally {
        setBusyId(null)
      }
    },
    [onChanged]
  )

  const removerCandidato = useCallback(
    async (actor: PoliticalActorWithTerms) => {
      if (!window.confirm(`Remover "${actor.name}" e todas as menções associadas?`)) return
      setBusyId(actor.id)
      try {
        const res = await fetch(`/api/youtube/actors/${actor.id}`, { method: 'DELETE' })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(j.error ?? 'Falha ao remover.')
        onChanged()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Erro ao remover.')
      } finally {
        setBusyId(null)
      }
    },
    [onChanged]
  )

  const adicionarTermo = useCallback(
    async (actorId: string) => {
      const term = (newTermByActor[actorId] ?? '').trim()
      if (!term) return
      setBusyId(actorId)
      try {
        const res = await fetch(`/api/youtube/actors/${actorId}/terms`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ term }),
        })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(j.error ?? 'Falha ao adicionar termo.')
        setNewTermByActor((prev) => ({ ...prev, [actorId]: '' }))
        onChanged()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Erro ao adicionar termo.')
      } finally {
        setBusyId(null)
      }
    },
    [newTermByActor, onChanged]
  )

  const removerTermo = useCallback(
    async (termId: string) => {
      setBusyId(termId)
      try {
        const res = await fetch(`/api/youtube/search-terms/${termId}`, { method: 'DELETE' })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(j.error ?? 'Falha ao remover termo.')
        onChanged()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Erro ao remover termo.')
      } finally {
        setBusyId(null)
      }
    },
    [onChanged]
  )

  const salvarInstagram = useCallback(
    async (actor: PoliticalActorWithTerms) => {
      const raw = instagramByActor[actor.id] ?? actor.instagram_username ?? ''
      setBusyId(actor.id)
      try {
        const res = await fetch(`/api/youtube/actors/${actor.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instagram_username: raw.trim() || null }),
        })
        const j = (await res.json()) as { error?: string }
        if (!res.ok) throw new Error(j.error ?? 'Falha ao salvar @ Instagram.')
        onChanged()
      } catch (e) {
        window.alert(e instanceof Error ? e.message : 'Erro ao salvar @ Instagram.')
      } finally {
        setBusyId(null)
      }
    },
    [instagramByActor, onChanged]
  )

  const activeCount = actors.filter((a) => a.active).length

  return (
    <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-medium text-text-primary">Candidatos monitorados</p>
          <p className="text-xs text-text-muted">
            {actors.length} cadastrado{actors.length === 1 ? '' : 's'} · {activeCount} ativo
            {activeCount === 1 ? '' : 's'}
          </p>
        </div>
        <span className="text-xs text-[rgb(var(--color-primary))]">{expanded ? 'Recolher' : 'Expandir'}</span>
      </button>

      {expanded ? (
        <div className="border-t border-[rgb(var(--color-border-tertiary)/0.85)] px-4 py-3">
          <ul className="mb-3 space-y-3">
            {actors.map((actor) => (
              <li
                key={actor.id}
                className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.6)] bg-bg-app px-3 py-2.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-text-primary">{actor.name}</p>
                    <p className="text-[11px] text-text-muted">
                      {labelActorType(actor.actor_type)} · slug: {actor.slug}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      disabled={disabled || busyId === actor.id}
                      onClick={() => void toggleActive(actor)}
                      className="rounded-full border border-[rgb(var(--color-border-secondary)/0.85)] px-2.5 py-0.5 text-[10px] text-text-secondary hover:bg-bg-surface"
                    >
                      {actor.active ? 'Desativar' : 'Ativar'}
                    </button>
                    <button
                      type="button"
                      disabled={disabled || busyId === actor.id}
                      onClick={() => void removerCandidato(actor)}
                      className="rounded-full p-1 text-text-muted hover:bg-[#FCEBEB] hover:text-[#A32D2D]"
                      aria-label={`Remover ${actor.name}`}
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex flex-wrap gap-1.5">
                  {(actor.youtube_search_terms ?? [])
                    .sort((a, b) => a.priority - b.priority)
                    .map((t) => (
                      <span
                        key={t.id}
                        className="inline-flex items-center gap-1 rounded-full border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-2 py-0.5 text-[11px] text-text-secondary"
                      >
                        {t.term}
                        <button
                          type="button"
                          disabled={disabled || busyId === t.id}
                          onClick={() => void removerTermo(t.id)}
                          className="text-text-muted hover:text-[#A32D2D]"
                          aria-label={`Remover termo ${t.term}`}
                        >
                          <X className="h-3 w-3" aria-hidden />
                        </button>
                      </span>
                    ))}
                </div>

                <div className="mt-2 flex gap-2">
                  <input
                    type="text"
                    disabled={disabled}
                    value={newTermByActor[actor.id] ?? ''}
                    onChange={(e) =>
                      setNewTermByActor((prev) => ({ ...prev, [actor.id]: e.target.value }))
                    }
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') void adicionarTermo(actor.id)
                    }}
                    placeholder="Novo termo de busca…"
                    className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-2.5 py-1.5 text-xs text-text-primary"
                  />
                  <button
                    type="button"
                    disabled={disabled || busyId === actor.id}
                    onClick={() => void adicionarTermo(actor.id)}
                    className="shrink-0 rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-surface"
                  >
                    Adicionar
                  </button>
                </div>

                {showInstagramField ? (
                  actor.actor_type === 'own_candidate' ? (
                    <p className="mt-2 text-[11px] text-text-muted">
                      @ Instagram do candidato próprio vem da API Graph (Redes &amp; Instagram).
                      {actor.instagram_username ? ` Atual: @${actor.instagram_username}` : ''}
                    </p>
                  ) : (
                    <div className="mt-2 flex gap-2">
                    <input
                      type="text"
                      disabled={disabled || busyId === actor.id}
                      value={
                        instagramByActor[actor.id] !== undefined
                          ? instagramByActor[actor.id]
                          : (actor.instagram_username ?? '')
                      }
                      onChange={(e) =>
                        setInstagramByActor((prev) => ({ ...prev, [actor.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') void salvarInstagram(actor)
                      }}
                      placeholder="@ Instagram (ex.: silviomendes)"
                      className="min-w-0 flex-1 rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-2.5 py-1.5 text-xs text-text-primary"
                    />
                    <button
                      type="button"
                      disabled={disabled || busyId === actor.id}
                      onClick={() => void salvarInstagram(actor)}
                      className="shrink-0 rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] px-2.5 py-1.5 text-xs text-text-secondary hover:bg-bg-surface"
                    >
                      Salvar @
                    </button>
                  </div>
                  )
                ) : null}
              </li>
            ))}
          </ul>

          {showForm ? (
            <div className="rounded-lg border border-[#B5D4F4] bg-[#E6F1FB]/40 p-3">
              <p className="mb-2 text-xs font-medium text-text-primary">Novo candidato</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  type="text"
                  disabled={disabled || saving}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome (ex.: Maria Silva)"
                  className="rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-3 py-2 text-sm"
                />
                <select
                  disabled={disabled || saving}
                  value={actorType}
                  onChange={(e) => setActorType(e.target.value as PoliticalActorType)}
                  className="rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-3 py-2 text-sm"
                >
                  {ACTOR_TYPE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
              <textarea
                disabled={disabled || saving}
                value={termsText}
                onChange={(e) => setTermsText(e.target.value)}
                placeholder={'Termos de busca (um por linha)\nEx.:\nMaria Silva\nDeputada Maria'}
                rows={3}
                className="mt-2 w-full rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-3 py-2 text-sm"
              />
              {formError ? <p className="mt-1 text-xs text-status-danger">{formError}</p> : null}
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={disabled || saving}
                  onClick={() => void criarCandidato()}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[rgb(var(--color-primary))] px-4 py-1.5 text-xs font-medium text-white disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                  Salvar candidato
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => {
                    setShowForm(false)
                    setFormError('')
                  }}
                  className="rounded-full border border-[rgb(var(--color-border-secondary)/0.85)] px-4 py-1.5 text-xs text-text-secondary"
                >
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              disabled={disabled}
              onClick={() => setShowForm(true)}
              className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[rgb(var(--color-border-secondary)/0.85)] px-4 py-2 text-xs font-medium text-[rgb(var(--color-primary))] hover:bg-bg-app"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Incluir candidato
            </button>
          )}
        </div>
      ) : null}
    </div>
  )
}
