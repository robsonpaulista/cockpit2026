import { isRankingEstimuladaFederalQuery } from '@/lib/agent/detect-pesquisa-avancada'
import type { AgentContextPayload } from '@/lib/agent/types'
import { queryMentionsJadyelAlencar } from '@/lib/agent/format-pesquisas'
import { CANDIDATO_RESUMO_PESQUISAS } from '@/lib/resumo-operacional-pesquisas'

export function resolveCandidatoParaPesquisa(
  args: Record<string, string>,
  context?: Pick<AgentContextPayload, 'candidatoPadrao'>,
  queryHint?: string
): { candidato: string | null; aviso?: string } {
  const fromArg = args.candidato?.trim()
  if (fromArg) return { candidato: fromArg }

  if (queryHint && queryMentionsJadyelAlencar(queryHint)) {
    return { candidato: CANDIDATO_RESUMO_PESQUISAS }
  }

  const padrao = context?.candidatoPadrao?.trim()
  if (padrao) return { candidato: padrao }

  if (queryHint && isRankingEstimuladaFederalQuery(queryHint)) {
    return { candidato: CANDIDATO_RESUMO_PESQUISAS }
  }

  return {
    candidato: null,
    aviso:
      'Defina o **candidato padrão** em Pesquisa & Relato ou cite o nome na pergunta (ex.: «tendência do Jadyel»).',
  }
}
