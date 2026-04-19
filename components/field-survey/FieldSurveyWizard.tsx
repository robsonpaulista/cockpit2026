'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  buildSurveySteps,
  getCandidatesForMatrix,
  type BuildSurveyStepsOptions,
  type SurveyStep,
} from '@/lib/field-survey-steps'
import type { SurveyConfigLists } from '@/services/field-survey-sync'
import { savePendingInterview } from '@/lib/field-survey-indexeddb'
import { syncPendingFieldInterviews } from '@/services/field-survey-sync'
import { cn } from '@/lib/utils'
import { CheckCircle2, ChevronLeft, ChevronRight, CloudOff, Loader2, RefreshCw, Wifi } from 'lucide-react'

const Q_VERSION = 'pi2026_premium_v1'

const MATRIX_OPTS = [
  { value: 'certeza', label: 'Votaria com certeza' },
  { value: 'poderia', label: 'Poderia votar' },
  { value: 'nao', label: 'Não votaria de jeito nenhum' },
]

function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

function readDual(
  answers: Record<string, unknown>,
  field: string
): { conhece: string; aumenta: string } {
  const v = answers[field]
  if (v && typeof v === 'object' && 'conhece' in v && 'aumenta' in v) {
    const o = v as { conhece?: unknown; aumenta?: unknown }
    return {
      conhece: typeof o.conhece === 'string' ? o.conhece : '',
      aumenta: typeof o.aumenta === 'string' ? o.aumenta : '',
    }
  }
  return { conhece: '', aumenta: '' }
}

function readMatrix(answers: Record<string, unknown>, field: string): Record<string, string> {
  const v = answers[field]
  if (v && typeof v === 'object' && !Array.isArray(v)) {
    const o = v as Record<string, unknown>
    const out: Record<string, string> = {}
    for (const k of Object.keys(o)) {
      if (typeof o[k] === 'string') out[k] = o[k] as string
    }
    return out
  }
  return {}
}

function readMulti(answers: Record<string, unknown>, field: string): string[] {
  const v = answers[field]
  if (!Array.isArray(v)) return []
  return v.filter((x): x is string => typeof x === 'string')
}

function validateStep(
  step: SurveyStep,
  answers: Record<string, unknown>,
  lists: SurveyConfigLists
): string | null {
  switch (step.kind) {
    case 'single': {
      const v = answers[step.field]
      if (v === undefined || v === null || String(v).trim() === '') return 'Selecione uma opção.'
      return null
    }
    case 'text': {
      const v = answers[step.field]
      if (v === undefined || v === null || String(v).trim() === '') return 'Preencha o campo.'
      return null
    }
    case 'number': {
      const v = answers[step.field]
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isNaN(n) || n < step.min || n > step.max) {
        return `Informe uma idade entre ${step.min} e ${step.max}.`
      }
      return null
    }
    case 'scale': {
      const v = answers[step.field]
      const n = typeof v === 'number' ? v : Number(v)
      if (Number.isNaN(n) || n < step.min || n > step.max) {
        return `Marque um valor de ${step.min} a ${step.max}.`
      }
      return null
    }
    case 'dual_attr': {
      const { conhece, aumenta } = readDual(answers, step.field)
      if (!conhece) return 'Responda “Conhece?”.'
      if (!aumenta) return 'Responda sobre o impacto no voto.'
      return null
    }
    case 'matrix_rejection': {
      const rows = getCandidatesForMatrix(step.list, lists)
      const m = readMatrix(answers, step.field)
      for (const r of rows) {
        if (!m[r.id]) return `Marque uma opção para: ${r.label}`
      }
      return null
    }
    case 'multi_nao_votaria':
      return null
    case 'readonly_datetime':
      return null
    default:
      return null
  }
}

interface FieldSurveyWizardProps {
  lists: SurveyConfigLists
  defaultInterviewerHint: string
  stepOptions?: BuildSurveyStepsOptions
}

export function FieldSurveyWizard({ lists, defaultInterviewerHint, stepOptions }: FieldSurveyWizardProps) {
  const [localClientId] = useState(() =>
    typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now()}`
  )
  const [answers, setAnswers] = useState<Record<string, unknown>>({})
  const [index, setIndex] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [finishing, setFinishing] = useState(false)
  const [done, setDone] = useState(false)
  const [online, setOnline] = useState(true)
  const [queueInfo, setQueueInfo] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)

  const steps = useMemo(
    () => buildSurveySteps(answers, lists, stepOptions),
    [answers, lists, stepOptions]
  )
  const step = steps[index] ?? null
  const progress = steps.length ? Math.round(((index + 1) / steps.length) * 100) : 0

  useEffect(() => {
    setOnline(isOnline())
    const up = (): void => setOnline(true)
    const down = (): void => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  useEffect(() => {
    setIndex((i) => Math.min(Math.max(0, i), Math.max(0, steps.length - 1)))
  }, [steps.length])

  useEffect(() => {
    if (!defaultInterviewerHint || answers.p53) return
    setAnswers((a) => ({ ...a, p53: defaultInterviewerHint }))
  }, [defaultInterviewerHint, answers.p53])

  useEffect(() => {
    if (step?.kind === 'readonly_datetime') {
      const iso = new Date().toISOString()
      setAnswers((a) => (a.p52 === iso ? a : { ...a, p52: iso }))
    }
  }, [step])

  const setField = useCallback((field: string, value: unknown) => {
    setAnswers((a) => ({ ...a, [field]: value }))
    setErrorMsg(null)
  }, [])

  const finishInterview = useCallback(async () => {
    const finalAnswers = {
      ...answers,
      p52: new Date().toISOString(),
    }
    setFinishing(true)
    setErrorMsg(null)
    try {
      const res = await fetch('/api/campo-pesquisa/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localClientId,
          answers: finalAnswers,
          questionnaireVersion: Q_VERSION,
          completedAt: finalAnswers.p52 as string,
        }),
      })
      if (res.ok) {
        setDone(true)
        setQueueInfo(null)
        return
      }
      if (res.status === 409) {
        setDone(true)
        setQueueInfo('Esta entrevista já havia sido enviada.')
        return
      }
      await savePendingInterview({
        localClientId,
        answers: finalAnswers,
        questionnaireVersion: Q_VERSION,
        createdAt: (finalAnswers.p52 as string) ?? new Date().toISOString(),
      })
      setDone(true)
      setQueueInfo('Sem conexão ou servidor indisponível — entrevista guardada neste aparelho. Será enviada automaticamente quando voltar a internet.')
    } catch {
      await savePendingInterview({
        localClientId,
        answers: { ...finalAnswers, p52: new Date().toISOString() },
        questionnaireVersion: Q_VERSION,
        createdAt: new Date().toISOString(),
      })
      setDone(true)
      setQueueInfo('Guardada localmente para envio posterior.')
    } finally {
      setFinishing(false)
    }
  }, [answers, localClientId])

  const goNext = useCallback(() => {
    if (!step) return
    const err = validateStep(step, answers, lists)
    if (err) {
      setErrorMsg(err)
      return
    }
    setErrorMsg(null)
    if (index < steps.length - 1) setIndex((i) => i + 1)
    else void finishInterview()
  }, [step, answers, lists, index, steps.length, finishInterview])

  const goPrev = useCallback(() => {
    setErrorMsg(null)
    setIndex((i) => Math.max(0, i - 1))
  }, [])

  const handleSyncQueue = useCallback(async () => {
    setSyncing(true)
    setQueueInfo(null)
    try {
      const r = await syncPendingFieldInterviews()
      if (r.synced > 0) {
        setQueueInfo(`${r.synced} entrevista(s) enviada(s).`)
      } else if (r.failed > 0) {
        setQueueInfo(`Ainda na fila: ${r.failed}. ${r.errors[0] ?? ''}`)
      } else {
        setQueueInfo('Nada na fila pendente.')
      }
    } finally {
      setSyncing(false)
    }
  }, [])

  const startNew = useCallback(() => {
    window.location.reload()
  }, [])

  if (done) {
    return (
      <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center gap-6 px-4 py-8 text-center">
        <CheckCircle2 className="h-16 w-16 text-emerald-500" aria-hidden />
        <h2 className="text-xl font-semibold text-zinc-900 dark:text-zinc-50">Entrevista registrada</h2>
        {queueInfo && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">{queueInfo}</p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row">
          <button
            type="button"
            onClick={handleSyncQueue}
            disabled={syncing}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 px-5 py-3 text-sm font-medium text-white shadow hover:bg-orange-700 disabled:opacity-60"
          >
            {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            Sincronizar fila
          </button>
          <button
            type="button"
            onClick={startNew}
            className="rounded-xl border border-zinc-300 bg-white px-5 py-3 text-sm font-medium text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-100"
          >
            Nova entrevista
          </button>
        </div>
      </div>
    )
  }

  if (!step) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
      </div>
    )
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-3 pb-28 pt-4 sm:px-4 md:pb-8">
      <header className="sticky top-0 z-10 -mx-3 border-b border-zinc-200/80 bg-zinc-50/95 px-3 py-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:-mx-4 sm:px-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400">
            {online ? (
              <Wifi className="h-4 w-4 text-emerald-600" aria-label="Online" />
            ) : (
              <CloudOff className="h-4 w-4 text-amber-600" aria-label="Offline" />
            )}
            <span>{online ? 'Online' : 'Offline — respostas serão guardadas'}</span>
          </div>
          <button
            type="button"
            onClick={handleSyncQueue}
            disabled={syncing || !online}
            className="text-xs font-medium text-orange-700 hover:underline disabled:opacity-40 dark:text-orange-400"
          >
            {syncing ? 'Sincronizando…' : 'Enviar pendentes'}
          </button>
        </div>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800">
          <div
            className="h-full bg-orange-500 transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1 text-center text-xs text-zinc-500">
          Passo {index + 1} de {steps.length} · Bloco {step.block}
        </p>
      </header>

      <section className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:p-6">
        <h1 className="text-base font-semibold leading-snug text-zinc-900 dark:text-zinc-50 sm:text-lg">
          {step.title}
        </h1>
        {'subtitle' in step && step.subtitle && (
          <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">{step.subtitle}</p>
        )}

        <div className="mt-6 space-y-4">
          {step.kind === 'single' && (
            <div className="grid gap-2 sm:grid-cols-2">
              {step.options.map((opt) => (
                <label
                  key={opt.value}
                  className={cn(
                    'flex cursor-pointer items-center gap-3 rounded-xl border p-3 text-sm transition',
                    answers[step.field] === opt.value
                      ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/40'
                      : 'border-zinc-200 hover:border-zinc-300 dark:border-zinc-700'
                  )}
                >
                  <input
                    type="radio"
                    name={step.field}
                    value={opt.value}
                    checked={answers[step.field] === opt.value}
                    onChange={() => setField(step.field, opt.value)}
                    className="h-4 w-4 accent-orange-600"
                  />
                  <span>{opt.label}</span>
                </label>
              ))}
            </div>
          )}

          {step.kind === 'text' && (
            <textarea
              value={typeof answers[step.field] === 'string' ? (answers[step.field] as string) : ''}
              onChange={(e) => setField(step.field, e.target.value)}
              placeholder={step.placeholder}
              rows={4}
              className="w-full resize-y rounded-xl border border-zinc-300 bg-white p-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-orange-500 focus:outline-none focus:ring-2 focus:ring-orange-500/30 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-100"
            />
          )}

          {step.kind === 'number' && (
            <input
              type="number"
              inputMode="numeric"
              min={step.min}
              max={step.max}
              value={answers[step.field] !== undefined ? String(answers[step.field]) : ''}
              onChange={(e) => {
                const n = e.target.value === '' ? '' : Number(e.target.value)
                setField(step.field, n === '' ? '' : n)
              }}
              className="w-full max-w-xs rounded-xl border border-zinc-300 bg-white p-3 text-lg dark:border-zinc-600 dark:bg-zinc-950"
            />
          )}

          {step.kind === 'scale' && (
            <div className="flex flex-wrap gap-2">
              {Array.from({ length: step.max - step.min + 1 }, (_, i) => step.min + i).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setField(step.field, n)}
                  className={cn(
                    'min-h-[44px] min-w-[44px] rounded-lg border text-sm font-medium transition',
                    answers[step.field] === n
                      ? 'border-orange-600 bg-orange-600 text-white'
                      : 'border-zinc-300 bg-zinc-50 dark:border-zinc-600 dark:bg-zinc-800'
                  )}
                >
                  {n}
                </button>
              ))}
            </div>
          )}

          {step.kind === 'dual_attr' && (
            <DualAttrFields
              step={step}
              value={readDual(answers, step.field)}
              onChange={(next) => setField(step.field, next)}
            />
          )}

          {step.kind === 'matrix_rejection' && (
            <MatrixTable
              candidates={getCandidatesForMatrix(step.list, lists)}
              value={readMatrix(answers, step.field)}
              onChange={(next) => setField(step.field, next)}
            />
          )}

          {step.kind === 'multi_nao_votaria' && (
            <MultiNaoVotaria
              candidates={getCandidatesForMatrix(step.list, lists)}
              value={readMulti(answers, step.field)}
              onChange={(ids) => setField(step.field, ids)}
            />
          )}

          {step.kind === 'readonly_datetime' && (
            <p className="rounded-xl bg-zinc-100 px-4 py-3 font-mono text-sm dark:bg-zinc-800">
              {typeof answers[step.field] === 'string'
                ? new Date(answers[step.field] as string).toLocaleString('pt-BR')
                : '—'}
            </p>
          )}
        </div>

        {errorMsg && (
          <p className="mt-4 text-sm font-medium text-red-600 dark:text-red-400" role="alert">
            {errorMsg}
          </p>
        )}
      </section>

      <nav className="fixed bottom-0 left-0 right-0 z-20 border-t border-zinc-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:static md:border-0 md:bg-transparent md:p-0">
        <div className="mx-auto flex max-w-2xl gap-3">
          <button
            type="button"
            onClick={goPrev}
            disabled={index === 0 || finishing}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-zinc-300 py-3.5 text-sm font-medium disabled:opacity-40 dark:border-zinc-600"
          >
            <ChevronLeft className="h-5 w-5" />
            Voltar
          </button>
          <button
            type="button"
            onClick={goNext}
            disabled={finishing}
            className="flex flex-[2] items-center justify-center gap-2 rounded-xl bg-orange-600 py-3.5 text-sm font-medium text-white shadow hover:bg-orange-700 disabled:opacity-60"
          >
            {finishing ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : index === steps.length - 1 ? (
              'Finalizar'
            ) : (
              <>
                Avançar
                <ChevronRight className="h-5 w-5" />
              </>
            )}
          </button>
        </div>
      </nav>
    </div>
  )
}

function DualAttrFields({
  step,
  value,
  onChange,
}: {
  step: Extract<SurveyStep, { kind: 'dual_attr' }>
  value: { conhece: string; aumenta: string }
  onChange: (v: { conhece: string; aumenta: string }) => void
}) {
  return (
    <div className="space-y-6">
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">{step.labelA}</p>
        <div className="flex flex-wrap gap-2">
          {step.optionsA.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...value, conhece: opt.value })}
              className={cn(
                'min-h-[44px] rounded-lg border px-3 text-sm',
                value.conhece === opt.value
                  ? 'border-orange-600 bg-orange-600 text-white'
                  : 'border-zinc-300 dark:border-zinc-600'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">{step.labelB}</p>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {step.optionsB.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange({ ...value, aumenta: opt.value })}
              className={cn(
                'min-h-[44px] rounded-lg border px-3 py-2 text-left text-sm sm:text-center',
                value.aumenta === opt.value
                  ? 'border-orange-600 bg-orange-600 text-white'
                  : 'border-zinc-300 dark:border-zinc-600'
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

function MatrixTable({
  candidates,
  value,
  onChange,
}: {
  candidates: { id: string; label: string }[]
  value: Record<string, string>
  onChange: (v: Record<string, string>) => void
}) {
  return (
    <div className="space-y-4">
      {candidates.map((c) => (
        <div key={c.id} className="rounded-xl border border-zinc-200 p-3 dark:border-zinc-700">
          <p className="mb-2 text-sm font-medium text-zinc-800 dark:text-zinc-200">{c.label}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {MATRIX_OPTS.map((opt) => (
              <label
                key={opt.value}
                className={cn(
                  'flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                  value[c.id] === opt.value
                    ? 'border-orange-500 bg-orange-50 dark:bg-orange-950/30'
                    : 'border-transparent bg-zinc-50 dark:bg-zinc-800/80'
                )}
              >
                <input
                  type="radio"
                  name={`m-${c.id}`}
                  checked={value[c.id] === opt.value}
                  onChange={() => onChange({ ...value, [c.id]: opt.value })}
                  className="accent-orange-600"
                />
                {opt.label}
              </label>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function MultiNaoVotaria({
  candidates,
  value,
  onChange,
}: {
  candidates: { id: string; label: string }[]
  value: string[]
  onChange: (ids: string[]) => void
}) {
  const toggle = (id: string): void => {
    if (value.includes(id)) onChange(value.filter((x) => x !== id))
    else onChange([...value, id])
  }
  return (
    <div className="space-y-2">
      <p className="text-xs text-zinc-500">Marque um ou mais nomes (pode deixar em branco se não se aplica).</p>
      {candidates.map((c) => (
        <label
          key={c.id}
          className="flex cursor-pointer items-center gap-3 rounded-xl border border-zinc-200 p-3 dark:border-zinc-700"
        >
          <input
            type="checkbox"
            checked={value.includes(c.id)}
            onChange={() => toggle(c.id)}
            className="h-5 w-5 accent-orange-600"
          />
          <span className="text-sm">{c.label}</span>
        </label>
      ))}
    </div>
  )
}
