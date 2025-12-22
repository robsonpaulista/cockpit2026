// Serviço para processar feeds RSS do Google Alerts
// Google Alerts fornece feeds RSS que podem ser consumidos automaticamente

import Parser from 'rss-parser'

// Parser padrão (será sobrescrito em fetchGoogleAlerts com headers)
const parser = new Parser({
  customFields: {
    item: ['media:content', 'dc:creator', 'dc:date'],
  },
})

export interface GoogleAlertItem {
  title: string
  link?: string
  contentSnippet?: string
  content?: string
  pubDate?: string
  isoDate?: string
  creator?: string
  guid?: string
}

export interface ProcessedNews {
  title: string
  source: string
  url?: string
  content?: string
  published_at?: string
  collected_at: string
}

/**
 * Processa um feed RSS do Google Alerts e retorna notícias formatadas
 * @param rssUrl URL do feed RSS do Google Alerts
 * @returns Array de notícias processadas
 */
export async function fetchGoogleAlerts(rssUrl: string): Promise<ProcessedNews[]> {
  try {
    console.log('🔍 Buscando feed RSS:', rssUrl)
    
    // Configurar parser com headers adequados para Google Alerts
    const customParser = new Parser({
      customFields: {
        item: ['media:content', 'dc:creator', 'dc:date'],
      },
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/rss+xml, application/xml, text/xml',
      },
    })

    const feed = await customParser.parseURL(rssUrl)
    
    console.log('✅ Feed parseado:', {
      title: feed.title,
      itemsCount: feed.items?.length || 0,
      items: feed.items?.slice(0, 2).map(item => ({
        title: item.title,
        link: item.link,
        hasContent: !!(item.content || item.contentSnippet),
      })),
    })

    if (!feed.items || feed.items.length === 0) {
      console.warn('⚠️ Feed não contém itens:', feed)
      return []
    }

    const news: ProcessedNews[] = feed.items
      .filter(item => item.title || item.link) // Filtrar itens sem título ou link
      .map((item) => {
        // Extrair fonte do título ou do link
        const source = extractSource(item.link || item.title)
        
        // Para Google Alerts, o link pode ser um redirect do Google
        // Extrair a URL real usando função auxiliar
        const url = extractRealUrl(item.link)
        
        return {
          title: item.title || 'Sem título',
          source: source,
          url: url,
          content: item.contentSnippet || item.content || item.title,
          published_at: item.isoDate || item.pubDate || new Date().toISOString(),
          collected_at: new Date().toISOString(),
        }
      })

    console.log(`📰 Processadas ${news.length} notícias do feed`)
    return news
  } catch (error) {
    console.error('❌ Erro ao processar feed RSS do Google Alerts:', {
      url: rssUrl,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw new Error(`Erro ao processar feed RSS: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}

/**
 * Extrai a URL real de um redirect do Google Alerts
 */
function extractRealUrl(googleUrl?: string): string | undefined {
  if (!googleUrl) return undefined

  try {
    // Se for um redirect do Google Alerts
    if (googleUrl.includes('google.com/url?')) {
      const urlObj = new URL(googleUrl)
      const realUrl = urlObj.searchParams.get('url')
      if (realUrl) {
        return decodeURIComponent(realUrl)
      }
    }
    // Se já for uma URL direta
    return googleUrl
  } catch {
    return googleUrl
  }
}

/**
 * Extrai o nome da fonte da URL ou título
 */
function extractSource(urlOrTitle?: string): string {
  if (!urlOrTitle) return 'Google Alerts'

  try {
    const realUrl = extractRealUrl(urlOrTitle) || urlOrTitle
    const url = new URL(realUrl)
    const hostname = url.hostname
    // Remover www. e extrair domínio principal
    const domain = hostname.replace(/^www\./, '').split('.')[0]
    return domain.charAt(0).toUpperCase() + domain.slice(1)
  } catch {
    // Se não for URL válida, tentar extrair do título
    if (urlOrTitle.includes(' - ')) {
      const parts = urlOrTitle.split(' - ')
      return parts[parts.length - 1] || 'Google Alerts'
    }
    return 'Google Alerts'
  }
}

/**
 * Analisa sentimento básico do texto (simplificado)
 * Em produção, usar serviço de NLP (OpenAI, Google NLP, etc.)
 */
export function analyzeSentiment(text: string): 'positive' | 'negative' | 'neutral' {
  const lowerText = text.toLowerCase()
  
  // Palavras-chave positivas
  const positiveWords = ['sucesso', 'crescimento', 'melhoria', 'avanço', 'vitória', 'conquista', 'progresso', 'aprovado', 'apoiado']
  // Palavras-chave negativas
  const negativeWords = ['fracasso', 'problema', 'crítica', 'acusação', 'escândalo', 'erro', 'falha', 'rejeitado', 'condenado']
  
  const positiveCount = positiveWords.filter(word => lowerText.includes(word)).length
  const negativeCount = negativeWords.filter(word => lowerText.includes(word)).length
  
  if (positiveCount > negativeCount) return 'positive'
  if (negativeCount > positiveCount) return 'negative'
  return 'neutral'
}

/**
 * Analisa nível de risco baseado em palavras-chave
 */
export function analyzeRisk(text: string, sentiment: 'positive' | 'negative' | 'neutral'): 'low' | 'medium' | 'high' {
  const lowerText = text.toLowerCase()
  
  // Palavras de alto risco
  const highRiskWords = ['crise', 'escândalo', 'acusação', 'investigação', 'denúncia', 'irregularidade', 'fraude', 'corrupção']
  // Palavras de médio risco
  const mediumRiskWords = ['polêmica', 'controvérsia', 'questionamento', 'crítica', 'protesto', 'insatisfação']
  
  const hasHighRisk = highRiskWords.some(word => lowerText.includes(word))
  const hasMediumRisk = mediumRiskWords.some(word => lowerText.includes(word))
  
  if (hasHighRisk || (sentiment === 'negative' && hasMediumRisk)) return 'high'
  if (hasMediumRisk || sentiment === 'negative') return 'medium'
  return 'low'
}

/**
 * Extrai tema do texto (simplificado)
 */
export function extractTheme(text: string): string | undefined {
  const lowerText = text.toLowerCase()
  
  const themes: Record<string, string[]> = {
    'Saúde': ['saúde', 'hospital', 'médico', 'medicamento', 'vacina', 'posto de saúde'],
    'Educação': ['educação', 'escola', 'universidade', 'professor', 'ensino', 'aluno'],
    'Infraestrutura': ['obra', 'asfalto', 'ponte', 'estrada', 'construção', 'infraestrutura'],
    'Segurança': ['segurança', 'polícia', 'violência', 'crime', 'assalto', 'homicídio'],
    'Economia': ['economia', 'emprego', 'trabalho', 'salário', 'renda', 'desemprego'],
    'Meio Ambiente': ['meio ambiente', 'ambiental', 'poluição', 'sustentabilidade', 'clima'],
    'Social': ['social', 'assistência', 'benefício', 'bolsa', 'programa social'],
  }
  
  for (const [theme, keywords] of Object.entries(themes)) {
    if (keywords.some(keyword => lowerText.includes(keyword))) {
      return theme
    }
  }
  
  return undefined
}

