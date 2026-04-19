'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  FIELD_SURVEY_QUESTION_CATALOG,
  catalogById,
  type StimulatedListKey,
} from '@/lib/field-survey-question-catalog'
import {
  normalizeQuestionOrder,
  type FieldSurveyStoredConfig,
} from '@/lib/field-survey-config-schema'
import { defaultListsFallback, type SurveyConfigLists } from '@/services/field-survey-sync'
import { cn } from '@/lib/utils'
import { AlertCircle, ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2 } from 'lucide-react'

const LIST_META: { key: keyof SurveyConfigLists; title: string; hint: string }[] = [
  {
    key: 'depFederal',
    title: 'Deputado Federal',
    hint: 'P18 (estimulada), P21 (matriz de rejeição)',
  },
  { key: 'governador', title: 'Governador', hint: 'P15 (estimulada)' },
  { key: 'senado', title: 'Senado', hint: 'P40 (estimulada), P41 (não votaria)' },
  { key: 'depEstadual', title: 'Deputado Estadual', hint: 'P44 (estimulada), P45 (rejeição)' },
]

function moveOrder(order: string[], index: number, dir: -1 | 1): string[] {
  const j = index + dir
  if (j < 0 || j >= order.length) return order
  const next = [...order]
  const t = next[index]
  const u = next[j]
  if (t === undefined || u === undefined) return order
  next[index] = u
  next[j] = t
  return next
}

function listUsesKey(meta: (typeof FIELD_SURVEY_QUESTION_CATALOG)[number], key: StimulatedListKey): boolean {
  const u = meta.usesCandidateList
  if (!u) return false
  return Array.isArray(u) ? u.includes(key) : u === key
}

export function FieldSurveyConfigPage() {
  const catMap = useMemo(() => catalogById(), [])
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [okMsg, setOkMsg] = useState<string | null>(null)
  const [lists, setLists] = useState<SurveyConfigLists>(() => defaultListsFallback())
  const [questionOrder, setQuestionOrder] = useState<string[]>(() =>
    FIELD_SURVEY_QUESTION_CATALOG.map((q) => q.id)
  )
  const [disabledIds, setDisabledIds] = useState<Set<string>>(() => new Set())

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/field-survey-settings')
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Erro ${res.status}`)
      }
      const data = (await res.json()) as {
        config?: FieldSurveyStoredConfig
        defaultQuestionOrder?: string[]
      }
      const cfg = data.config ?? {}
      const defs = defaultListsFallback()
      setLists({
        depFederal: cfg.lists?.depFederal ?? defs.depFederal,
        governador: cfg.lists?.governador ?? defs.governador,
        senado: cfg.lists?.senado ?? defs.senado,
        depEstadual: cfg.lists?.depEstadual ?? defs.depEstadual,
      })
      setQuestionOrder(
        normalizeQuestionOrder(
          cfg.questionOrder?.length ? cfg.questionOrder : data.defaultQuestionOrder
        )
      )
      setDisabledIds(new Set(cfg.disabledQuestionIds ?? []))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const save = async (): Promise<void> => {
    setSaving(true)
    setError(null)
    setOkMsg(null)
    try {
      const config: FieldSurveyStoredConfig = {
        lists: {
          depFederal: lists.depFederal,
          governador: lists.governador,
          senado: lists.senado,
          depEstadual: lists.depEstadual,
        },
        questionOrder,
        disabledQuestionIds: [...disabledIds],
      }
      const res = await fetch('/api/field-survey-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config }),
      })
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        throw new Error(j.error ?? `Erro ${res.status}`)
      }
      setOkMsg('Configurações salvas. Pesquisadores verão na próxima sincronização / abertura do app.')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const updateListRow = (
    listKey: keyof SurveyConfigLists,
    index: number,
    field: 'id' | 'label',
    value: string
  ): void => {
    setLists((prev) => {
      const copy = { ...prev, [listKey]: [...prev[listKey]] }
      const row = copy[listKey][index]
      if (!row) return prev
      copy[listKey][index] = { ...row, [field]: value }
      return copy
    })
  }

  const addListRow = (listKey: keyof SurveyConfigLists): void => {
    setLists((prev) => ({
      ...prev,
      [listKey]: [...prev[listKey], { id: `c_${Date.now()}`, label: 'Novo candidato' }],
    }))
  }

  const removeListRow = (listKey: keyof SurveyConfigLists, index: number): void => {
    setLists((prev) => ({
      ...prev,
      [listKey]: prev[listKey].filter((_, i) => i !== index),
    }))
  }

  const toggleDisabled = (id: string): void => {
    setDisabledIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center gap-2 text-secondary">
        <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
        <span>Carregando…</span>
      </div>
    )
  }

  return (
    <div className="space-y-10 pb-16">
      <div>
        <h1 className="text-2xl font-bold text-text-primary">Configurações — Pesquisa de campo</h1>
        <p className="mt-1 text-sm text-secondary max-w-3xl">
          Listas de nomes para perguntas estimuladas, ordem das perguntas no tablet e desativação de
          itens. Alterações afetam o questionário em{' '}
          <code className="rounded bg-bg-muted px-1 text-xs">/pesquisador</code>.
        </p>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-xl border border-status-danger/40 bg-status-danger/10 p-4 text-sm text-text-primary">
          <AlertCircle className="h-5 w-5 shrink-0 text-status-danger" />
          {error}
        </div>
      )}
      {okMsg && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-text-primary">
          {okMsg}
        </div>
      )}

      <section className="rounded-2xl border border-border-card bg-bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold text-text-primary">Candidatos (listas estimuladas)</h2>
        <p className="mt-1 text-sm text-secondary">
          Código interno (id) deve ser único; use slugs sem acentos (ex.:{' '}
          <code className="text-xs">jadyel_alencar</code>).
        </p>
        <div className="mt-6 space-y-10">
          {LIST_META.map(({ key, title, hint }) => (
            <div key={key}>
              <h3 className="font-medium text-text-primary">{title}</h3>
              <p className="text-xs text-secondary">{hint}</p>
              <div className="mt-3 overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-border-card text-secondary">
                      <th className="py-2 pr-2 font-medium">Id</th>
                      <th className="py-2 pr-2 font-medium">Nome exibido</th>
                      <th className="w-10 py-2" />
                    </tr>
                  </thead>
                  <tbody>
                    {lists[key].map((row, idx) => (
                      <tr key={`${key}-${idx}`} className="border-b border-border-card/60">
                        <td className="py-2 pr-2 align-top">
                          <input
                            value={row.id}
                            onChange={(e) => updateListRow(key, idx, 'id', e.target.value)}
                            className="w-full rounded-lg border border-border-card bg-bg-muted px-2 py-1.5 text-text-primary"
                          />
                        </td>
                        <td className="py-2 pr-2 align-top">
                          <input
                            value={row.label}
                            onChange={(e) => updateListRow(key, idx, 'label', e.target.value)}
                            className="w-full rounded-lg border border-border-card bg-bg-muted px-2 py-1.5 text-text-primary"
                          />
                        </td>
                        <td className="py-2 align-top">
                          <button
                            type="button"
                            onClick={() => removeListRow(key, idx)}
                            className="rounded-lg p-2 text-status-danger hover:bg-status-danger/10"
                            aria-label="Remover linha"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                type="button"
                onClick={() => addListRow(key)}
                className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-accent-gold hover:underline"
              >
                <Plus className="h-4 w-4" />
                Adicionar candidato
              </button>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-border-card bg-bg-surface p-6 shadow-card">
        <h2 className="text-lg font-semibold text-text-primary">Ordem e uso das perguntas</h2>
        <p className="mt-1 text-sm text-secondary">
          Desmarque para ocultar uma pergunta no app. Use setas para mudar a ordem (entre as que
          estiverem ativas no fluxo; bloco Jadyel continua condicional).
        </p>
        <ul className="mt-4 max-h-[min(70vh,560px)] space-y-2 overflow-y-auto pr-1">
          {questionOrder.map((qid, idx) => {
            const meta = catMap.get(qid)
            if (!meta) return null
            const enabled = !disabledIds.has(qid)
            return (
              <li
                key={qid}
                className={cn(
                  'flex flex-wrap items-center gap-2 rounded-xl border px-3 py-2',
                  enabled ? 'border-border-card bg-bg-muted/40' : 'border-dashed border-border-card opacity-60'
                )}
              >
                <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
                  <input
                    type="checkbox"
                    checked={enabled}
                    onChange={() => toggleDisabled(qid)}
                    className="h-4 w-4 accent-accent-gold"
                  />
                  <span className="font-mono text-xs text-secondary">{qid}</span>
                  <span className="truncate text-sm text-text-primary">{meta.shortLabel}</span>
                  {meta.conditionalJadyel && (
                    <span className="rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-amber-700 dark:text-amber-400">
                      Jadyel
                    </span>
                  )}
                </label>
                <div className="flex flex-wrap gap-1 text-xs text-secondary">
                  {LIST_META.filter((L) => listUsesKey(meta, L.key as StimulatedListKey)).map((L) => (
                    <span key={L.key} className="rounded bg-accent-gold/10 px-1.5 py-0.5 text-accent-gold">
                      {L.title}
                    </span>
                  ))}
                </div>
                <div className="ml-auto flex gap-1">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => setQuestionOrder((o) => moveOrder(o, idx, -1))}
                    className="rounded-lg border border-border-card p-2 hover:bg-accent-gold-soft disabled:opacity-30"
                    aria-label="Subir"
                  >
                    <ArrowUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={idx >= questionOrder.length - 1}
                    onClick={() => setQuestionOrder((o) => moveOrder(o, idx, 1))}
                    className="rounded-lg border border-border-card p-2 hover:bg-accent-gold-soft disabled:opacity-30"
                    aria-label="Descer"
                  >
                    <ArrowDown className="h-4 w-4" />
                  </button>
                </div>
              </li>
            )
          })}
        </ul>
      </section>

      <div className="sticky bottom-4 flex justify-end">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="inline-flex items-center gap-2 rounded-xl bg-accent-gold px-6 py-3 text-sm font-semibold text-white shadow-lg hover:opacity-95 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          Salvar configurações
        </button>
      </div>
    </div>
  )
}
