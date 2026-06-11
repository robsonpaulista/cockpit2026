import { detectSidebarNavigate } from '@/lib/agent/detect-sidebar-navigate'
import { isGreetingQuery, isHelpQuery } from '@/lib/agent/greeting-reply'
import { parseAgendaDayScopeFromAnswer } from '@/lib/agent/agenda-query'
import { parsePesquisaTipoFromQuery } from '@/lib/agent/format-pesquisas'

function normalize(query: string): string {
  return query
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const CANCEL_PHRASES =
  /\b(cancelar|cancela|esquece|esqueca|deixa pra la|deixa quieto|para com isso|outro assunto|mudar de assunto|nao quero|nao precisa|desistir|voltar atrás|voltar atras)\b/

/** Nova consulta de dados — não é resposta a um follow-up pendente. */
const NEW_DATA_INTENT =
  /\b(expectativa|pesquisa|pesquisas|demanda|demandas|visita|visitas|agenda|compromisso|noticia|noticias|alerta|alertas|chapa|chapas|whatsapp|envia|enviar|envie|mande|briefing|resumo operacional|territorio|territorio|instagram|lideranca|liderancas|intencao|votos|projecao|quantos|quantas|qual a|quais os|quais as|buscar|busque|liste|listar|novamente|de novo)\b/

/**
 * Detecta quando o usuário mudou de assunto e deve sair de um follow-up pendente
 * (ex.: estimulada/espontânea, próximos/todos, detalhe de expectativa).
 */
export function shouldBreakJarvisPendingFlow(
  query: string,
  currentPath?: string
): boolean {
  const raw = query.trim()
  if (!raw) return false

  if (parsePesquisaTipoFromQuery(raw)) return false
  if (parseAgendaDayScopeFromAnswer(raw)) return false

  if (detectSidebarNavigate(raw, currentPath)) return true
  if (isHelpQuery(raw) || isGreetingQuery(raw)) return true

  const q = normalize(raw)
  if (CANCEL_PHRASES.test(q)) return true
  if (NEW_DATA_INTENT.test(q)) return true

  if (/\b(abrir|abra|abre|ir para|mostrar|mostre|navegar|acessar|acesse|entrar|mudar para|trocar para)\b/.test(q)) {
    return true
  }

  return raw.length >= 12 && !/^(sim|nao|não|ok|certo|isso)$/i.test(raw)
}
