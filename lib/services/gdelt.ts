// Serviço para coletar notícias do GDELT Project
// GDELT: Global Database of Events, Language, and Tone
// API v2: https://api.gdeltproject.org/api/v2/doc/doc
// Documentação: https://blog.gdeltproject.org/gdelt-2-0-api-debuts/

export interface GDELTArticle {
  url: string
  title: string
  urlmobile: string
  domain: string
  language: string
  sourcecountry: string
  socialimage: string
  lastmodified: string
  excerpt?: string
  seendate: string
  socialdata?: any
}

export interface GDELTResponse {
  articles?: GDELTArticle[]
  formatVersion?: string
}

export interface ProcessedGDELTNews {
  title: string
  source: string
  source_type: 'gdelt'
  url?: string
  content?: string
  published_at?: string
  collected_at: string
  publisher?: string
}

/**
 * Busca artigos do GDELT baseado em termos de busca
 * @param query Termos de busca (ex: "Nome do Candidato")
 * @param maxRecords Número máximo de registros (máximo 250)
 * @param startDateTime Data/hora de início (formato: YYYYMMDDHHMMSS)
 * @param endDateTime Data/hora de fim (formato: YYYYMMDDHHMMSS)
 * @returns Array de notícias processadas
 */
export async function fetchGDELT(
  query: string,
  maxRecords: number = 100,
  startDateTime?: string,
  endDateTime?: string,
  sourceCountry?: string // Código do país (ex: 'BR' ou 'brazil')
): Promise<ProcessedGDELTNews[]> {
  try {
    console.log('🔍 [GDELT] Buscando artigos:', { query, maxRecords, startDateTime, endDateTime, sourceCountry })

    // Construir URL da API
    const baseUrl = 'https://api.gdeltproject.org/api/v2/doc/doc'
    const params = new URLSearchParams({
      query: query,
      mode: 'artlist',
      maxrecords: Math.min(maxRecords, 250).toString(), // Máximo 250
      format: 'json',
    })

    // Filtrar por país se especificado
    if (sourceCountry) {
      params.append('sourcecountry', sourceCountry)
    }

    if (startDateTime) {
      params.append('startdatetime', startDateTime)
    }

    if (endDateTime) {
      params.append('enddatetime', endDateTime)
    }

    const url = `${baseUrl}?${params.toString()}`

    console.log('📡 [GDELT] URL da requisição:', url)

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
    })

    if (!response.ok) {
      throw new Error(`GDELT API retornou status ${response.status}: ${response.statusText}`)
    }

    const data: GDELTResponse = await response.json()

    console.log('✅ [GDELT] Resposta recebida:', {
      articlesCount: data.articles?.length || 0,
      formatVersion: data.formatVersion,
    })

    if (!data.articles || data.articles.length === 0) {
      console.warn('⚠️ [GDELT] Nenhum artigo encontrado')
      return []
    }

    const news: ProcessedGDELTNews[] = data.articles
      .filter(article => article.url && article.title)
      .map((article) => {
        // Extrair domínio/publisher
        let publisher: string | undefined
        try {
          const urlObj = new URL(article.url)
          publisher = urlObj.hostname.replace(/^www\./, '')
        } catch {
          publisher = article.domain || undefined
        }

        return {
          title: article.title,
          source: publisher || 'GDELT',
          source_type: 'gdelt' as const,
          url: article.url,
          content: article.excerpt || undefined,
          published_at: article.seendate || article.lastmodified || new Date().toISOString(),
          collected_at: new Date().toISOString(),
          publisher: publisher,
        }
      })

    console.log(`📰 [GDELT] Processadas ${news.length} notícias`)
    return news
  } catch (error) {
    console.error('❌ [GDELT] Erro ao buscar artigos:', {
      query,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    throw new Error(`Erro ao buscar artigos do GDELT: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}

/**
 * Formata data/hora para o formato GDELT (YYYYMMDDHHMMSS)
 * @param date Data/hora
 * @returns String formatada
 */
export function formatGDELTDateTime(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  const hours = String(date.getHours()).padStart(2, '0')
  const minutes = String(date.getMinutes()).padStart(2, '0')
  const seconds = String(date.getSeconds()).padStart(2, '0')
  
  return `${year}${month}${day}${hours}${minutes}${seconds}`
}

/**
 * Busca artigos das últimas N horas
 * @param query Termos de busca
 * @param hours Número de horas para buscar (padrão: 24)
 * @param maxRecords Número máximo de registros
 */
export async function fetchGDELTRecent(
  query: string,
  hours: number = 24,
  maxRecords: number = 100,
  sourceCountry?: string // Código do país (ex: 'BR' ou 'brazil')
): Promise<ProcessedGDELTNews[]> {
  const endDateTime = new Date()
  const startDateTime = new Date(endDateTime.getTime() - hours * 60 * 60 * 1000)

  return fetchGDELT(
    query,
    maxRecords,
    formatGDELTDateTime(startDateTime),
    formatGDELTDateTime(endDateTime),
    sourceCountry
  )
}
