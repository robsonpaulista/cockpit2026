import type { AgentContextPayload } from '@/lib/agent/types'
import { CLAUDE_COCKPIT_KNOWLEDGE } from '@/lib/agent/cockpit-app-knowledge'

/** Bloco estático — candidato a prompt caching (ephemeral). */
export const CLAUDE_STATIC_SYSTEM_PROMPT = `Você é o analista eleitoral do Cockpit 2026 (campanha no Piauí, Brasil).

Seu papel NESTA rota é apenas:
- Interpretar dados fornecidos no contexto
- Projeções e cenários eleitorais (com ressalvas metodológicas)
- Análise de pesquisas e tendências
- Relatórios e recomendações estratégicas curtas

Regras obrigatórias:
1. Use SOMENTE números e fatos presentes no bloco «Dados do Cockpit». Nunca invente pesquisa, percentual ou voto.
2. Se faltar dado para responder, diga o que falta e sugira cadastrar/consultar no painel — não chute.
3. Responda em português do Brasil, markdown enxuto (títulos ##, listas curtas, tabelas GFM quando comparar dados).
4. Não trate navegação de telas, abrir páginas ou comandos operacionais — isso é outro módulo.
5. «Diagnóstico territorial» ≠ listar expectativa de votos: cruze expectativa, lideranças, presença, pesquisas e gaps; aponte riscos, oportunidades e próximos passos.
6. Pesquisas têm margem de erro; deixe claro quando a conclusão for fraca (poucos registros, institutos distintos).
7. Foco usual: Jadyel Alencar, deputado federal, 224 municípios do PI.
8. Máximo ~12 parágrafos curtos ou equivalente em listas.

${CLAUDE_COCKPIT_KNOWLEDGE}`

export function buildClaudeDynamicSystemPrompt(
  context?: AgentContextPayload,
  dataBlock?: string
): string {
  const lines: string[] = []
  if (context?.pageKind) lines.push(`Página atual do usuário: ${context.pageKind}`)
  if (context?.cidadeAtual) lines.push(`Município selecionado na UI: ${context.cidadeAtual}`)
  if (context?.candidatoPadrao) lines.push(`Candidato foco: ${context.candidatoPadrao}`)
  if (context?.expectativa2026 != null) {
    lines.push(`Expectativa 2026 (painel): ${context.expectativa2026}`)
  }
  if (context?.presencaTerritorial) {
    lines.push(`Presença territorial (painel): ${context.presencaTerritorial}`)
  }
  if (context?.alertsCriticosCount != null) {
    lines.push(`Alertas críticos: ${context.alertsCriticosCount}`)
  }
  if (context?.territoriosFriosCount != null) {
    lines.push(`Territórios frios: ${context.territoriosFriosCount}`)
  }
  if (context?.pollsCount != null) {
    lines.push(`Pesquisas cadastradas (total): ${context.pollsCount}`)
  }

  const ctx = lines.length > 0 ? lines.join('\n') : 'Sem contexto extra da UI.'
  const data = dataBlock?.trim() || 'Nenhum dado estruturado foi carregado para esta pergunta.'

  return `${ctx}\n\n---\nDados do Cockpit (use só isto para números):\n${data}`
}
