/**
 * Páginas que já foram guias de um hub único. Cada uma tem rota própria, mas os ids
 * continuam sendo as chaves de permissão `resumo-eleicoes:<id>` gravadas por usuário.
 */
export const RESUMO_ELEICOES_TAB_ATENDIMENTO = 'atendimento' as const
export const RESUMO_ELEICOES_TAB_AGENDA = 'agenda' as const
export const RESUMO_ELEICOES_TAB_SECAO = 'secao' as const
export const RESUMO_ELEICOES_TAB_CHAPA_FEDERAL = 'chapa-federal' as const
export const RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL = 'chapa-estadual' as const

export type ResumoEleicoesHubTab =
  | typeof RESUMO_ELEICOES_TAB_ATENDIMENTO
  | typeof RESUMO_ELEICOES_TAB_AGENDA
  | typeof RESUMO_ELEICOES_TAB_SECAO
  | typeof RESUMO_ELEICOES_TAB_CHAPA_FEDERAL
  | typeof RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL

export const ATENDIMENTO_HREF = '/dashboard/resumo-eleicoes'
export const VOTACAO_SECAO_HREF = '/dashboard/resumo-eleicoes/secao'
export const AGENDA_HREF = '/dashboard/agenda'
export const CHAPA_FEDERAL_HREF = '/dashboard/chapas'
export const CHAPA_ESTADUAL_HREF = '/dashboard/chapas-estaduais'

const HREF_POR_PAGINA: Record<ResumoEleicoesHubTab, string> = {
  [RESUMO_ELEICOES_TAB_ATENDIMENTO]: ATENDIMENTO_HREF,
  [RESUMO_ELEICOES_TAB_AGENDA]: AGENDA_HREF,
  [RESUMO_ELEICOES_TAB_SECAO]: VOTACAO_SECAO_HREF,
  [RESUMO_ELEICOES_TAB_CHAPA_FEDERAL]: CHAPA_FEDERAL_HREF,
  [RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL]: CHAPA_ESTADUAL_HREF,
}

export function isResumoEleicoesHubTab(value: string | null): value is ResumoEleicoesHubTab {
  return value != null && value in HREF_POR_PAGINA
}

export function resumoEleicoesHref(
  pagina: ResumoEleicoesHubTab = RESUMO_ELEICOES_TAB_ATENDIMENTO,
  extraParams?: Record<string, string | undefined | null>,
): string {
  const params = new URLSearchParams()
  for (const [key, val] of Object.entries(extraParams ?? {})) {
    if (val != null && val !== '') params.set(key, val)
  }
  const qs = params.toString()
  return qs ? `${HREF_POR_PAGINA[pagina]}?${qs}` : HREF_POR_PAGINA[pagina]
}
