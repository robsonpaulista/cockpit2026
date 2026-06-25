export const RESUMO_ELEICOES_HUB_HREF = '/dashboard/resumo-eleicoes'

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

export function parseResumoEleicoesHubTab(value: string | null): ResumoEleicoesHubTab {
  if (value === RESUMO_ELEICOES_TAB_AGENDA) return RESUMO_ELEICOES_TAB_AGENDA
  if (value === RESUMO_ELEICOES_TAB_SECAO) return RESUMO_ELEICOES_TAB_SECAO
  if (value === RESUMO_ELEICOES_TAB_CHAPA_FEDERAL) return RESUMO_ELEICOES_TAB_CHAPA_FEDERAL
  if (value === RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL) return RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL
  return RESUMO_ELEICOES_TAB_ATENDIMENTO
}

export function resumoEleicoesHubHref(
  tab: ResumoEleicoesHubTab = RESUMO_ELEICOES_TAB_ATENDIMENTO,
  extraParams?: Record<string, string | undefined | null>,
): string {
  const params = new URLSearchParams()
  if (tab !== RESUMO_ELEICOES_TAB_ATENDIMENTO) {
    params.set('tab', tab)
  }
  if (extraParams) {
    for (const [key, val] of Object.entries(extraParams)) {
      if (val != null && val !== '') params.set(key, val)
    }
  }
  const qs = params.toString()
  return qs ? `${RESUMO_ELEICOES_HUB_HREF}?${qs}` : RESUMO_ELEICOES_HUB_HREF
}

/** Converte rotas legadas para a guia equivalente no hub. */
export function resumoEleicoesHubTabFromLegacyPath(pathname: string): ResumoEleicoesHubTab | null {
  if (pathname === '/dashboard/resumo-eleicoes/secao') return RESUMO_ELEICOES_TAB_SECAO
  if (pathname === '/dashboard/agenda') return RESUMO_ELEICOES_TAB_AGENDA
  if (pathname === '/dashboard/chapas') return RESUMO_ELEICOES_TAB_CHAPA_FEDERAL
  if (pathname === '/dashboard/chapas-estaduais') return RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL
  return null
}
