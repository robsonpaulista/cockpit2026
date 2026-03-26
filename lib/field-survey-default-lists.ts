import type { SurveyConfigLists } from '@/services/field-survey-sync'

export type SurveyCandidate = { id: string; label: string }

export const DEFAULT_LISTS: SurveyConfigLists = {
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
}

export function parseEnvList(raw: string | undefined, fallback: SurveyCandidate[]): SurveyCandidate[] {
  if (!raw?.trim()) return fallback
  try {
    const arr = JSON.parse(raw) as unknown
    if (!Array.isArray(arr)) return fallback
    return arr
      .map((x) => {
        if (x && typeof x === 'object' && 'id' in x && 'label' in x) {
          const o = x as { id: unknown; label: unknown }
          if (typeof o.id === 'string' && typeof o.label === 'string') {
            return { id: o.id, label: o.label }
          }
        }
        return null
      })
      .filter((x): x is SurveyCandidate => x !== null)
  } catch {
    return fallback
  }
}

function normalizeList(arr: unknown, fallback: SurveyCandidate[]): SurveyCandidate[] {
  if (!Array.isArray(arr) || arr.length === 0) return fallback
  const out: SurveyCandidate[] = []
  for (const x of arr) {
    if (x && typeof x === 'object' && 'id' in x && 'label' in x) {
      const o = x as { id: unknown; label: unknown }
      if (typeof o.id === 'string' && typeof o.label === 'string' && o.id.trim() && o.label.trim()) {
        out.push({ id: o.id.trim(), label: o.label.trim() })
      }
    }
  }
  return out.length ? out : fallback
}

/** DB > env > código padrão */
export function resolveSurveyLists(
  dbPartial: Partial<Record<keyof SurveyConfigLists, unknown>> | undefined
): SurveyConfigLists {
  const depDb = dbPartial?.depFederal
  const govDb = dbPartial?.governador
  const senDb = dbPartial?.senado
  const estDb = dbPartial?.depEstadual

  return {
    depFederal: normalizeList(
      depDb,
      parseEnvList(process.env.FIELD_SURVEY_LIST_DEP_FED, DEFAULT_LISTS.depFederal)
    ),
    governador: normalizeList(
      govDb,
      parseEnvList(process.env.FIELD_SURVEY_LIST_GOV, DEFAULT_LISTS.governador)
    ),
    senado: normalizeList(senDb, parseEnvList(process.env.FIELD_SURVEY_LIST_SENADO, DEFAULT_LISTS.senado)),
    depEstadual: normalizeList(
      estDb,
      parseEnvList(process.env.FIELD_SURVEY_LIST_DEP_EST, DEFAULT_LISTS.depEstadual)
    ),
  }
}
