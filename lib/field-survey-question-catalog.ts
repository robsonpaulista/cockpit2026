/**
 * Metadados das perguntas do questionário de campo (PI 2026) — UI de gestão e ordem padrão.
 */

export type StimulatedListKey = 'depFederal' | 'governador' | 'senado' | 'depEstadual'

export interface FieldSurveyQuestionMeta {
  id: string
  block: string
  shortLabel: string
  /** Perguntas que só entram se o bloco Jadyel for acionado */
  conditionalJadyel?: boolean
  /** Usa lista de candidatos (estimulada ou matriz) */
  usesCandidateList?: StimulatedListKey | StimulatedListKey[]
  questionType:
    | 'escolha_unica'
    | 'texto_aberto'
    | 'numero'
    | 'escala'
    | 'dupla_atributo'
    | 'matriz_rejeicao'
    | 'multi_rejeicao'
    | 'data_hora'
}

/** Ordem “completa” (inclui bloco Jadyel); no app, passos condicionais são filtrados antes de aplicar ordem. */
export const FIELD_SURVEY_QUESTION_CATALOG: FieldSurveyQuestionMeta[] = [
  { id: 'p01', block: '1', shortLabel: 'Eleitor do Piauí', questionType: 'escolha_unica' },
  { id: 'p02', block: '1', shortLabel: 'Mora no domicílio', questionType: 'escolha_unica' },
  { id: 'p03', block: '1', shortLabel: 'Sexo', questionType: 'escolha_unica' },
  { id: 'p04', block: '1', shortLabel: 'Idade', questionType: 'numero' },
  { id: 'p05', block: '1', shortLabel: 'Escolaridade', questionType: 'escolha_unica' },
  { id: 'p06', block: '1', shortLabel: 'Renda familiar', questionType: 'escolha_unica' },
  { id: 'p07', block: '1', shortLabel: 'Religião', questionType: 'escolha_unica' },
  { id: 'p08', block: '2', shortLabel: 'Interesse pelas eleições', questionType: 'escolha_unica' },
  { id: 'p09', block: '2', shortLabel: 'Governista / oposição', questionType: 'escolha_unica' },
  { id: 'p10', block: '2', shortLabel: 'Piauí no caminho', questionType: 'escolha_unica' },
  { id: 'p11', block: '2', shortLabel: 'Principal problema do Piauí', questionType: 'texto_aberto' },
  { id: 'p12', block: '3', shortLabel: 'Presidente (espontânea)', questionType: 'texto_aberto' },
  { id: 'p13', block: '3', shortLabel: 'Aprovação presidente', questionType: 'escolha_unica' },
  { id: 'p14', block: '3', shortLabel: 'Governador (espontânea)', questionType: 'texto_aberto' },
  {
    id: 'p15',
    block: '3',
    shortLabel: 'Governador (estimulada)',
    questionType: 'escolha_unica',
    usesCandidateList: 'governador',
  },
  { id: 'p16', block: '4', shortLabel: 'Dep. Federal (espontânea)', questionType: 'texto_aberto' },
  { id: 'p17', block: '4', shortLabel: 'Dep. Federal 2ª opção', questionType: 'texto_aberto' },
  {
    id: 'p18',
    block: '4',
    shortLabel: 'Dep. Federal (estimulada)',
    questionType: 'escolha_unica',
    usesCandidateList: 'depFederal',
  },
  { id: 'p19', block: '4', shortLabel: 'Chance de voto (0–10)', questionType: 'escala' },
  { id: 'p20', block: '4', shortLabel: 'Decisão de voto', questionType: 'escolha_unica' },
  {
    id: 'p21',
    block: '4',
    shortLabel: 'Rejeição Dep. Federal (matriz)',
    questionType: 'matriz_rejeicao',
    usesCandidateList: 'depFederal',
  },
  { id: 'p22', block: '5', shortLabel: 'Conhece Jadyel Alencar', questionType: 'escolha_unica', conditionalJadyel: true },
  { id: 'p23', block: '5', shortLabel: 'Imagem de Jadyel', questionType: 'escolha_unica', conditionalJadyel: true },
  { id: 'p24', block: '5', shortLabel: 'Hospital de Amor (atributo)', questionType: 'dupla_atributo', conditionalJadyel: true },
  { id: 'p25', block: '5', shortLabel: 'Causa animal', questionType: 'dupla_atributo', conditionalJadyel: true },
  { id: 'p26', block: '5', shortLabel: 'Recursos ao estado', questionType: 'dupla_atributo', conditionalJadyel: true },
  { id: 'p27', block: '5', shortLabel: 'Obras / asfalto', questionType: 'dupla_atributo', conditionalJadyel: true },
  { id: 'p28', block: '5', shortLabel: 'ECA Digital (conhece)', questionType: 'dupla_atributo', conditionalJadyel: true },
  { id: 'p29', block: '5', shortLabel: 'Relator ECA Digital', questionType: 'dupla_atributo', conditionalJadyel: true },
  { id: 'p30', block: '5', shortLabel: 'Leis crianças na internet', questionType: 'escolha_unica', conditionalJadyel: true },
  { id: 'p31', block: '5', shortLabel: 'Avaliação mandato Jadyel', questionType: 'escolha_unica', conditionalJadyel: true },
  { id: 'p32', block: '6', shortLabel: 'Teste de narrativa', questionType: 'escolha_unica' },
  { id: 'p33', block: '7', shortLabel: 'Dep. confiável → Senado', questionType: 'escolha_unica' },
  { id: 'p34', block: '7', shortLabel: 'Jadyel senador', questionType: 'escolha_unica' },
  { id: 'p35', block: '8', shortLabel: 'Lembra voto senador', questionType: 'escolha_unica' },
  { id: 'p36', block: '8', shortLabel: 'Em quem votou senador', questionType: 'texto_aberto' },
  { id: 'p37', block: '8', shortLabel: 'Senadores atuais PI', questionType: 'texto_aberto' },
  { id: 'p38', block: '8', shortLabel: 'Senador (espontânea)', questionType: 'texto_aberto' },
  { id: 'p39', block: '8', shortLabel: 'Senador 2ª opção', questionType: 'texto_aberto' },
  {
    id: 'p40',
    block: '8',
    shortLabel: 'Senador (estimulada)',
    questionType: 'escolha_unica',
    usesCandidateList: 'senado',
  },
  {
    id: 'p41',
    block: '8',
    shortLabel: 'Não votaria (senado)',
    questionType: 'multi_rejeicao',
    usesCandidateList: 'senado',
  },
  { id: 'p42', block: '8', shortLabel: 'Chance voto senador (0–10)', questionType: 'escala' },
  { id: 'p43', block: '9', shortLabel: 'Dep. estadual (espontânea)', questionType: 'texto_aberto' },
  {
    id: 'p44',
    block: '9',
    shortLabel: 'Dep. estadual (estimulada)',
    questionType: 'escolha_unica',
    usesCandidateList: 'depEstadual',
  },
  {
    id: 'p45',
    block: '9',
    shortLabel: 'Rejeição Dep. estadual',
    questionType: 'matriz_rejeicao',
    usesCandidateList: 'depEstadual',
  },
  { id: 'p46', block: '10', shortLabel: 'Lembra voto vereador', questionType: 'escolha_unica' },
  { id: 'p47', block: '10', shortLabel: 'Em quem votou vereador', questionType: 'texto_aberto' },
  { id: 'p48', block: '10', shortLabel: 'Vereador mais atuante', questionType: 'texto_aberto' },
  { id: 'p49', block: '11', shortLabel: 'Município', questionType: 'texto_aberto' },
  { id: 'p50', block: '11', shortLabel: 'Bairro / localidade', questionType: 'texto_aberto' },
  { id: 'p51', block: '11', shortLabel: 'Zona urbana/rural', questionType: 'escolha_unica' },
  { id: 'p52', block: '11', shortLabel: 'Data e hora', questionType: 'data_hora' },
  { id: 'p53', block: '11', shortLabel: 'Código entrevistador', questionType: 'texto_aberto' },
]

export const DEFAULT_FIELD_SURVEY_QUESTION_ORDER: string[] = FIELD_SURVEY_QUESTION_CATALOG.map((q) => q.id)

export function catalogById(): Map<string, FieldSurveyQuestionMeta> {
  return new Map(FIELD_SURVEY_QUESTION_CATALOG.map((q) => [q.id, q]))
}
