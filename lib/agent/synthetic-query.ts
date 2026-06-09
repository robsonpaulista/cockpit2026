import type { AgentIntent } from '@/lib/agent/types'

/** Converte intenção classificada pela LLM em frase que o agente legado (regex) já entende. */
export function intentToSyntheticQuery(
  intent: AgentIntent,
  args: Record<string, string>
): string | null {
  const cidade = args.cidade?.trim()
  const termo = args.termo?.trim() || cidade

  switch (intent) {
    case 'ajuda':
      return 'ajuda'
    case 'resumo_buscar_cidade':
      return cidade ? `Buscar ${cidade}` : 'atualizar'
    case 'resumo_abrir_demandas':
      return 'abrir demandas'
    case 'resumo_abrir_liderancas':
      return 'ver lideranças'
    case 'resumo_abrir_pesquisas':
      return 'histórico de pesquisas'
    case 'resumo_fechar_modais':
      return 'fechar modais'
    case 'consultar_expectativa':
      return cidade ? `expectativa em ${cidade}` : 'expectativa 2026'
    case 'consultar_liderancas':
      return cidade ? `lideranças em ${cidade}` : 'território e base'
    case 'consultar_demandas':
      return cidade ? `demandas em ${cidade}` : null
    case 'consultar_agendas': {
      const data = args.data?.trim()
      if (cidade && data) return `agenda de ${data} em ${cidade}`
      if (data) return `agenda de ${data}`
      if (cidade) return `agenda em ${cidade}`
      return 'agenda de hoje'
    }
    case 'consultar_pesquisas': {
      const tipo = args.tipo?.trim().toLowerCase()
      const candidato = args.candidato?.trim()
      const mencionaJadyel = candidato ? /jadyel/i.test(candidato) : false
      const alvo = cidade || termo

      if (mencionaJadyel && alvo) {
        if (tipo === 'estimulada' || tipo === 'espontanea') {
          return `pesquisa ${tipo} jadyel em ${alvo}`
        }
        return `pesquisa jadyel em ${alvo}`
      }
      if (mencionaJadyel) return 'pesquisa jadyel'

      if (alvo && (tipo === 'estimulada' || tipo === 'espontanea')) {
        return `pesquisa ${tipo} em ${alvo}`
      }
      return alvo ? `pesquisa em ${alvo}` : 'pesquisas'
    }
    case 'consultar_chapa':
      return 'projeção chapa federal'
    case 'consultar_instagram_metricas':
      return 'métricas do instagram'
    case 'consultar_instagram_posts':
      return 'posts mais curtidos'
    case 'consultar_instagram_tipo':
      return 'publicações por tipo'
    case 'consultar_instagram_tema':
      return 'qual tema tem melhor performance'
    case 'consultar_territorio':
      return 'território e base'
    case 'consultar_alertas':
      return 'alertas críticos'
    case 'consultar_noticias_destaque':
      return 'notícias em destaque'
    case 'consultar_territorios_frios':
      return 'territórios frios'
    default:
      return null
  }
}

export function isClientOnlyIntent(intent: AgentIntent): boolean {
  return [
    'resumo_buscar_cidade',
    'resumo_abrir_demandas',
    'resumo_abrir_liderancas',
    'resumo_abrir_pesquisas',
    'resumo_fechar_modais',
    'consultar_expectativa',
    'consultar_liderancas',
    'consultar_demandas',
    'consultar_agendas',
    'consultar_pesquisas',
    'consultar_chapa',
    'consultar_instagram_metricas',
    'consultar_instagram_posts',
    'consultar_instagram_tipo',
    'consultar_instagram_tema',
    'consultar_territorio',
    'consultar_alertas',
    'consultar_noticias_destaque',
    'consultar_territorios_frios',
    'ajuda',
    'navegar',
  ].includes(intent)
}
