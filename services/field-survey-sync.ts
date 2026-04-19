import {
  getAllPendingInterviews,
  removePendingInterview,
  type PendingFieldInterview,
} from '@/lib/field-survey-indexeddb'
import type { BuildSurveyStepsOptions } from '@/lib/field-survey-steps'

export interface SyncResult {
  synced: number
  failed: number
  errors: string[]
}

export async function syncPendingFieldInterviews(): Promise<SyncResult> {
  const pending = await getAllPendingInterviews()
  let synced = 0
  let failed = 0
  const errors: string[] = []

  for (const row of pending) {
    try {
      const res = await fetch('/api/campo-pesquisa/responses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localClientId: row.localClientId,
          answers: row.answers,
          questionnaireVersion: row.questionnaireVersion,
          completedAt: row.createdAt,
        }),
      })
      if (res.ok || res.status === 409) {
        await removePendingInterview(row.localClientId)
        synced += 1
      } else {
        const j = (await res.json().catch(() => ({}))) as { error?: string }
        failed += 1
        errors.push(j.error ?? `HTTP ${res.status}`)
      }
    } catch (e) {
      failed += 1
      errors.push(e instanceof Error ? e.message : 'Erro de rede')
    }
  }

  return { synced, failed, errors }
}

export function cacheSurveyConfig(data: unknown): void {
  try {
    localStorage.setItem('field_survey_config_cache', JSON.stringify(data))
    localStorage.setItem('field_survey_config_cache_at', new Date().toISOString())
  } catch {
    /* ignore quota */
  }
}

export function readCachedSurveyConfig(): unknown | null {
  try {
    const raw = localStorage.getItem('field_survey_config_cache')
    return raw ? (JSON.parse(raw) as unknown) : null
  } catch {
    return null
  }
}

export type SurveyConfigLists = {
  depFederal: { id: string; label: string }[]
  governador: { id: string; label: string }[]
  senado: { id: string; label: string }[]
  depEstadual: { id: string; label: string }[]
}

const EMPTY_LISTS: SurveyConfigLists = {
  depFederal: [],
  governador: [],
  senado: [],
  depEstadual: [],
}

export function parseSurveyConfigPayload(payload: unknown): SurveyConfigLists {
  if (!payload || typeof payload !== 'object') return EMPTY_LISTS
  const o = payload as { lists?: unknown }
  const lists = o.lists
  if (!lists || typeof lists !== 'object') return EMPTY_LISTS
  const L = lists as Record<string, unknown>
  const asList = (v: unknown): { id: string; label: string }[] =>
    Array.isArray(v)
      ? v
          .map((x) => {
            if (x && typeof x === 'object' && 'id' in x && 'label' in x) {
              const r = x as { id: unknown; label: unknown }
              if (typeof r.id === 'string' && typeof r.label === 'string') {
                return { id: r.id, label: r.label }
              }
            }
            return null
          })
          .filter((x): x is { id: string; label: string } => x !== null)
      : []
  return {
    depFederal: asList(L.depFederal),
    governador: asList(L.governador),
    senado: asList(L.senado),
    depEstadual: asList(L.depEstadual),
  }
}

export function defaultListsFallback(): SurveyConfigLists {
  return parseSurveyConfigPayload({
    lists: {
      depFederal: [
        { id: 'jadyel_alencar', label: 'Jadyel Alencar' },
        { id: 'cand_regional_2', label: 'Candidato regional B' },
        { id: 'cand_regional_3', label: 'Candidato regional C' },
        { id: 'branco_nulo', label: 'Branco / Nulo' },
        { id: 'ns_nr', label: 'NS / NR' },
      ],
      governador: [
        { id: 'cand_gov_a', label: 'Candidato A' },
        { id: 'cand_gov_b', label: 'Candidato B' },
        { id: 'branco_nulo', label: 'Branco / Nulo' },
        { id: 'ns_nr', label: 'NS / NR' },
      ],
      senado: [
        { id: 'cand_sen_a', label: 'Candidato ao Senado A' },
        { id: 'cand_sen_b', label: 'Candidato ao Senado B' },
        { id: 'jadyel_alencar', label: 'Jadyel Alencar' },
        { id: 'branco_nulo', label: 'Branco / Nulo' },
        { id: 'ns_nr', label: 'NS / NR' },
      ],
      depEstadual: [
        { id: 'cand_depest_a', label: 'Candidato estadual A' },
        { id: 'cand_depest_b', label: 'Candidato estadual B' },
        { id: 'branco_nulo', label: 'Branco / Nulo' },
        { id: 'ns_nr', label: 'NS / NR' },
      ],
    },
  })
}

export function parseSurveyRuntimeOptions(payload: unknown): BuildSurveyStepsOptions | undefined {
  if (!payload || typeof payload !== 'object') return undefined
  const o = payload as { questionOrder?: unknown; disabledQuestionIds?: unknown }
  const questionOrder = Array.isArray(o.questionOrder)
    ? o.questionOrder.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : undefined
  const disabledQuestionIds = Array.isArray(o.disabledQuestionIds)
    ? o.disabledQuestionIds.filter((x): x is string => typeof x === 'string' && x.length > 0)
    : undefined
  if (!questionOrder?.length && !disabledQuestionIds?.length) return undefined
  return {
    ...(questionOrder?.length ? { questionOrder } : {}),
    ...(disabledQuestionIds?.length ? { disabledQuestionIds } : {}),
  }
}
