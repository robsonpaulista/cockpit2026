import { z } from 'zod'
import type { SurveyConfigLists } from '@/services/field-survey-sync'
import { DEFAULT_FIELD_SURVEY_QUESTION_ORDER } from '@/lib/field-survey-question-catalog'

const candidateSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().min(1).max(512),
})

const listsSchema = z
  .object({
    depFederal: z.array(candidateSchema).optional(),
    governador: z.array(candidateSchema).optional(),
    senado: z.array(candidateSchema).optional(),
    depEstadual: z.array(candidateSchema).optional(),
  })
  .optional()

export const fieldSurveyStoredConfigSchema = z.object({
  lists: listsSchema,
  questionOrder: z.array(z.string().min(1).max(16)).optional(),
  disabledQuestionIds: z.array(z.string().min(1).max(16)).optional(),
})

export type FieldSurveyStoredConfig = z.infer<typeof fieldSurveyStoredConfigSchema>

export function parseStoredConfig(raw: unknown): FieldSurveyStoredConfig {
  const base = fieldSurveyStoredConfigSchema.safeParse(raw ?? {})
  if (!base.success) {
    return {}
  }
  return base.data
}

export function normalizeQuestionOrder(order: string[] | undefined): string[] {
  if (!order?.length) return [...DEFAULT_FIELD_SURVEY_QUESTION_ORDER]
  const seen = new Set<string>()
  const out: string[] = []
  for (const id of order) {
    if (!seen.has(id)) {
      seen.add(id)
      out.push(id)
    }
  }
  for (const id of DEFAULT_FIELD_SURVEY_QUESTION_ORDER) {
    if (!seen.has(id)) out.push(id)
  }
  return out
}

export function listsFromStored(
  stored: FieldSurveyStoredConfig
): Partial<SurveyConfigLists> | undefined {
  const L = stored.lists
  if (!L) return undefined
  return {
    depFederal: L.depFederal,
    governador: L.governador,
    senado: L.senado,
    depEstadual: L.depEstadual,
  }
}
