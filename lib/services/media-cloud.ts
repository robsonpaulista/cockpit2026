// Serviço para coletar notícias do Media Cloud
// Media Cloud: Projeto acadêmico (MIT/Harvard) para análise de narrativas
// API: https://www.mediacloud.org/documentation/search-api-guide
// Nota: Requer API key (obter em: https://www.mediacloud.org/)

export interface MediaCloudStory {
  stories_id: number
  media_id: number
  media_name: string
  media_url: string
  url: string
  title: string
  publish_date: string
  language: string
  ap_syndicated?: boolean
  guid?: string
  processed_stories_id?: number
}

export interface MediaCloudResponse {
  stories?: MediaCloudStory[]
  total?: number
  link?: string
}

export interface ProcessedMediaCloudNews {
  title: string
  source: string
  source_type: 'media_cloud'
  url?: string
  content?: string
  published_at?: string
  collected_at: string
  publisher?: string
}

/**
 * Busca histórias do Media Cloud baseado em query
 * @param apiKey API Key do Media Cloud (obrigatório)
 * @param query Query de busca (ex: "Nome do Candidato")
 * @param collectionsIds IDs das coleções (opcional, formato: "1,2,3")
 * @param startDate Data de início (formato: YYYY-MM-DD)
 * @param endDate Data de fim (formato: YYYY-MM-DD)
 * @param limit Limite de resultados (padrão: 100, máximo: 250)
 * @returns Array de notícias processadas
 */
export async function fetchMediaCloud(
  apiKey: string,
  query: string,
  collectionsIds?: string,
  startDate?: string,
  endDate?: string,
  limit: number = 100
): Promise<ProcessedMediaCloudNews[]> {
  try {
    if (!apiKey) {
      throw new Error('API key do Media Cloud é obrigatória')
    }

    console.log('🔍 [Media Cloud] Buscando histórias:', { query, collectionsIds, startDate, endDate, limit })

    // Construir URL da API
    const baseUrl = 'https://api.mediacloud.org/api/v2/stories_public/search'
    const params = new URLSearchParams({
      key: apiKey,
      q: query,
      rows: Math.min(limit, 250).toString(), // Máximo 250
    })

    if (collectionsIds) {
      params.append('collections', collectionsIds)
    }

    if (startDate) {
      params.append('publish_date_start', startDate)
    }

    if (endDate) {
      params.append('publish_date_end', endDate)
    }

    const url = `${baseUrl}?${params.toString()}`

    console.log('📡 [Media Cloud] URL da requisição:', url.replace(apiKey, '***'))

    // Criar AbortController para timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 30000) // 30 segundos

    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Accept': 'application/json',
      },
      signal: controller.signal,
    }).finally(() => {
      clearTimeout(timeoutId)
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Media Cloud API retornou status ${response.status}: ${response.statusText}. ${errorText}`)
    }

    const data: MediaCloudResponse = await response.json()

    console.log('✅ [Media Cloud] Resposta recebida:', {
      storiesCount: data.stories?.length || 0,
      total: data.total,
    })

    if (!data.stories || data.stories.length === 0) {
      console.warn('⚠️ [Media Cloud] Nenhuma história encontrada')
      return []
    }

    const news: ProcessedMediaCloudNews[] = data.stories
      .filter(story => story.url && story.title)
      .map((story) => {
        // Extrair domínio/publisher
        let publisher: string | undefined
        try {
          const urlObj = new URL(story.url)
          publisher = urlObj.hostname.replace(/^www\./, '')
        } catch {
          publisher = story.media_name || undefined
        }

        return {
          title: story.title,
          source: story.media_name || 'Media Cloud',
          source_type: 'media_cloud' as const,
          url: story.url,
          content: undefined, // Media Cloud não fornece conteúdo completo na API pública
          published_at: story.publish_date || new Date().toISOString(),
          collected_at: new Date().toISOString(),
          publisher: publisher,
        }
      })

    console.log(`📰 [Media Cloud] Processadas ${news.length} notícias`)
    return news
  } catch (error) {
    console.error('❌ [Media Cloud] Erro ao buscar histórias:', {
      query,
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    })
    
    // Tratar erros específicos
    if (error instanceof Error) {
      if (error.name === 'AbortError' || error.message.includes('timeout')) {
        throw new Error('Timeout ao buscar histórias do Media Cloud (30s)')
      }
      if (error.message.includes('fetch failed') || error.message.includes('ECONNREFUSED')) {
        throw new Error('Erro de conexão com Media Cloud. Verifique sua conexão ou se a API está disponível.')
      }
    }
    
    throw new Error(`Erro ao buscar histórias do Media Cloud: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
  }
}

/**
 * Busca histórias das últimas N dias
 * @param apiKey API Key do Media Cloud
 * @param query Query de busca
 * @param days Número de dias para buscar (padrão: 7)
 * @param limit Limite de resultados
 */
export async function fetchMediaCloudRecent(
  apiKey: string,
  query: string,
  days: number = 7,
  limit: number = 100
): Promise<ProcessedMediaCloudNews[]> {
  const endDate = new Date()
  const startDate = new Date(endDate.getTime() - days * 24 * 60 * 60 * 1000)

  const formatDate = (date: Date): string => {
    return date.toISOString().split('T')[0] // YYYY-MM-DD
  }

  return fetchMediaCloud(
    apiKey,
    query,
    undefined,
    formatDate(startDate),
    formatDate(endDate),
    limit
  )
}

/**
 * Valida se a API key do Media Cloud está configurada
 */
export function validateMediaCloudApiKey(apiKey?: string): boolean {
  return !!apiKey && apiKey.trim().length > 0
}
