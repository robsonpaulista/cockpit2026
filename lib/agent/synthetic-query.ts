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
      if (args.modo === 'por_cargo' || args.agrupamento === 'cargo') {
        return 'resumo lideranças por cargo'
      }
      return cidade ? `lideranças em ${cidade}` : 'resumo lideranças por cargo'
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
    case 'consultar_pesquisa_tendencia': {
      const candidato = args.candidato?.trim()
      if (cidade && candidato) return `como evoluiu a intenção do ${candidato} em ${cidade}`
      if (cidade) return `tendência de intenção em ${cidade}`
      if (candidato) return `como evoluiu a intenção do ${candidato}`
      return 'tendência de pesquisa'
    }
    case 'consultar_ranking_estimulada_federal':
      return 'ranking estimulada dep federal'
    case 'consultar_chapa':
      return 'projeção chapa federal'
    case 'consultar_instagram_metricas':
      return 'métricas do instagram'
    case 'consultar_instagram_seguidores_diario': {
      const dias = args.dias?.trim()
      return dias ? `seguidores por dia ultimos ${dias} dias` : 'seguidores por dia'
    }
    case 'consultar_instagram_posts': {
      const metrica = args.metrica?.trim().toLowerCase()
      if (metrica === 'likes' || metrica === 'curtidas') return 'posts mais curtidos'
      if (metrica === 'comments' || metrica === 'comentarios') return 'posts mais comentados'
      if (metrica === 'views' || metrica === 'visualizacoes') return 'posts mais visualizados'
      if (metrica === 'shares' || metrica === 'compartilhamentos') return 'posts mais compartilhados'
      if (args.modo === 'destaque') return 'post com maior engajamento'
      return 'post com maior engajamento'
    }
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
    case 'consultar_noticias_criticas':
      return 'notícias com alerta crítico'
    case 'consultar_noticias_resumo':
      return 'quantas notícias hoje'
    case 'consultar_noticias_filtradas': {
      if (args.sentimento === 'negative') return 'notícias negativas'
      if (args.sentimento === 'positive') return 'notícias positivas'
      if (args.risco === 'medium') return 'notícias de risco médio'
      if (args.risco === 'low') return 'notícias de risco baixo'
      if (args.termo_busca) return `notícias sobre ${args.termo_busca}`
      return 'últimas notícias'
    }
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
    'consultar_pesquisa_tendencia',
    'consultar_ranking_estimulada_federal',
    'consultar_chapa',
    'consultar_instagram_metricas',
    'consultar_instagram_seguidores_diario',
    'consultar_instagram_posts',
    'consultar_instagram_tipo',
    'consultar_instagram_tema',
    'consultar_territorio',
    'consultar_alertas',
    'consultar_noticias_destaque',
    'consultar_noticias_criticas',
    'consultar_noticias_resumo',
    'consultar_noticias_filtradas',
    'consultar_territorios_frios',
    'ajuda',
    'navegar',
  ].includes(intent)
}
