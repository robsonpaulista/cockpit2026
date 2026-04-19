import type { SurveyConfigLists } from '@/services/field-survey-sync'

const JADYEL_ID = 'jadyel_alencar'

function textMentionsJadyel(text: unknown): boolean {
  if (typeof text !== 'string' || !text.trim()) return false
  return /jadyel/i.test(text) || /jadyel\s+alencar/i.test(text)
}

/** Bloco 5: abrir se Jadyel citado (espontânea) ou selecionado nas listas estimuladas. */
export function shouldShowJadyelBlock(
  answers: Record<string, unknown>,
  lists: SurveyConfigLists
): boolean {
  if (answers.p18 === JADYEL_ID) return true
  if (answers.p15 === JADYEL_ID) return true
  if (answers.p40 === JADYEL_ID) return true
  if (textMentionsJadyel(answers.p12)) return true
  if (textMentionsJadyel(answers.p16)) return true
  if (textMentionsJadyel(answers.p17)) return true

  const checkOpenTextAgainstList = (openVal: unknown, candidates: { id: string; label: string }[]) => {
    if (typeof openVal !== 'string' || !openVal.trim()) return false
    const t = openVal.toLowerCase()
    const jadyelRow = candidates.find((c) => c.id === JADYEL_ID)
    if (jadyelRow && t.includes(jadyelRow.label.toLowerCase().split(' ')[0] ?? '')) return true
    return false
  }

  if (checkOpenTextAgainstList(answers.p16, lists.depFederal)) return true
  if (checkOpenTextAgainstList(answers.p17, lists.depFederal)) return true

  return false
}
