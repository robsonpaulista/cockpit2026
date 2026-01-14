import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'
import { logError } from '@/lib/logger'
import { google } from 'googleapis'

const demandSchema = z.object({
  visit_id: z.string().uuid().optional(),
  title: z.string().min(1),
  description: z.string().optional(),
  status: z.enum(['nova', 'em-andamento', 'encaminhado', 'resolvido']).optional(),
  theme: z.string().optional(),
  priority: z.enum(['high', 'medium', 'low']).optional(),
  sla_deadline: z.string().optional(),
})

// Função auxiliar para formatar a chave privada
function formatPrivateKey(key: string): string {
  let formattedKey = key.replace(/\\\\n/g, '\n')
  formattedKey = formattedKey.replace(/\\n/g, '\n')
  return formattedKey
}

// Função auxiliar para obter credenciais (prioriza variáveis de ambiente)
function getCredentials() {
  // Prioridade 1: Variáveis específicas para Demandas
  let envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY
  let envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL

  // Prioridade 2: Variáveis genéricas (fallback para compatibilidade)
  if (!envPrivateKey || !envEmail) {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  }

  if (envPrivateKey && envEmail) {
    return {
      type: 'service_account' as const,
      private_key: formatPrivateKey(envPrivateKey),
      client_email: envEmail,
      token_uri: 'https://oauth2.googleapis.com/token',
    }
  }

  return null
}

// Função para buscar demandas do Google Sheets
async function fetchDemandsFromSheets() {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEETS_DEMANDAS_SPREADSHEET_ID
    const sheetName = process.env.GOOGLE_SHEETS_DEMANDAS_NAME || process.env.GOOGLE_SHEETS_DEMANDAS_SHEET_NAME || 'Sheet1'
    const range = process.env.GOOGLE_SHEETS_DEMANDAS_RANGE

    // Se não tiver configuração de demandas, retornar array vazio
    if (!spreadsheetId || !sheetName) {
      return []
    }

    const credentialsObj = getCredentials()
    if (!credentialsObj) {
      console.warn('Credenciais do Google Sheets não configuradas para demandas')
      return []
    }

    // Autenticar usando Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Construir range - aspas simples só são necessárias quando há range de células
    const rangeToRead = range 
      ? (sheetName.includes(' ') ? `'${sheetName}'!${range}` : `${sheetName}!${range}`)
      : sheetName

    // Buscar dados
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeToRead,
    })

    const rows = response.data.values || []
    if (rows.length === 0) {
      return []
    }

    // Primeira linha são os cabeçalhos
    const headers = rows[0].map((h: any) => String(h || '').trim())

    // Mapear nomes de colunas para campos esperados
    const findColumn = (patterns: string[]) => {
      return headers.find(h => patterns.some(pattern => 
        new RegExp(pattern, 'i').test(h)
      ))
    }

    // Buscar título - tentar múltiplas opções
    const titleCol = findColumn(['titulo', 'title', 'título', 'nome', 'solicitação', 'SOLICITAÇÃO', 'solicitacao', 'pauta', 'PAUTA', 'ação/objeto', 'AÇÃO/OBJETO'])
    const descriptionCol = findColumn(['descrição', 'description', 'descricao', 'detalhes', 'detalhe', 'obs status', 'OBS STATUS', 'observação', 'observacao'])
    const statusCol = findColumn(['status', 'situação', 'situacao', 'STATUS'])
    const themeCol = findColumn(['tema', 'theme', 'assunto', 'pauta', 'PAUTA'])
    const priorityCol = findColumn(['prioridade', 'priority', 'urgência', 'urgencia'])
    const liderancaCol = findColumn(['liderança', 'LIDERANÇA', 'lideranca', 'LIDERANCA', 'lider', 'LIDER', 'solicitante', 'SOLICITANTE'])
    // Incluir MUNICIPIO em maiúsculas e outras variações
    const cityCol = findColumn(['cidade', 'city', 'município', 'municipio', 'MUNICIPIO', 'MUNICÍPIO', 'local', 'localidade'])
    const dateCol = findColumn(['data', 'date', 'criado_em', 'created_at', 'data_criação', 'DATA DEMANDA', 'data demanda'])
    
    // Log para debug
    console.log('[DEBUG] Colunas identificadas:', {
      headers,
      cityCol,
      titleCol,
      statusCol,
      descriptionCol,
      liderancaCol
    })

    // Converter linhas em objetos de demanda
    const demandsFromSheets = rows.slice(1)
      .map((row: any[], index: number) => {
        const record: Record<string, any> = {}
        headers.forEach((header, colIndex) => {
          record[header] = row[colIndex] || null
        })

        // Usar status diretamente da planilha (sem mapeamento)
        const status = statusCol && record[statusCol] 
          ? String(record[statusCol]).trim() 
          : null

        // Mapear prioridade
        let priority: 'high' | 'medium' | 'low' = 'medium'
        if (priorityCol && record[priorityCol]) {
          const priorityValue = String(record[priorityCol]).toLowerCase().trim()
          if (priorityValue.includes('alta') || priorityValue.includes('high') || priorityValue.includes('urgente')) {
            priority = 'high'
          } else if (priorityValue.includes('baixa') || priorityValue.includes('low')) {
            priority = 'low'
          }
        }

        // Criar ID único baseado na planilha (não é UUID real, mas serve para identificar)
        const id = `sheets-${spreadsheetId}-${sheetName}-${index}`

        const cidadeValue = cityCol ? (record[cityCol] || null) : null
        
        // Determinar título - usar SOLICITAÇÃO ou PAUTA se titleCol não foi encontrado
        let title = 'Sem título'
        if (titleCol && record[titleCol]) {
          title = String(record[titleCol]).trim()
        } else {
          // Fallback: tentar SOLICITAÇÃO ou PAUTA
          const solicitacaoCol = headers.find(h => /solicitação|solicitacao|SOLICITAÇÃO/i.test(h))
          const pautaCol = headers.find(h => /pauta|PAUTA/i.test(h))
          if (solicitacaoCol && record[solicitacaoCol]) {
            title = String(record[solicitacaoCol]).trim()
          } else if (pautaCol && record[pautaCol]) {
            title = String(record[pautaCol]).trim()
          }
        }
        
        // Se ainda não tem título, usar ID ou primeira coluna não vazia
        if (title === 'Sem título' || title === '') {
          const idCol = headers.find(h => /^id$/i.test(h))
          if (idCol && record[idCol]) {
            title = `Demanda ${record[idCol]}`
          } else {
            // Usar primeira coluna não vazia como título
            const firstNonEmpty = headers.find(h => record[h] && String(record[h]).trim() !== '')
            if (firstNonEmpty) {
              title = String(record[firstNonEmpty]).trim()
            }
          }
        }
        
        // Log para debug das primeiras demandas (após determinar título)
        if (index < 3) {
          console.log(`[DEBUG] Demanda ${index + 1}:`, {
            title,
            cidade: cidadeValue,
            cityCol,
            titleCol,
            recordKeys: Object.keys(record),
            recordCityCol: cityCol ? record[cityCol] : 'N/A',
            recordSolicitacao: record['SOLICITAÇÃO'] || record['SOLICITACAO'] || 'N/A'
          })
        }
        
        return {
          id,
          title,
          description: descriptionCol ? record[descriptionCol] : null,
          status: status || undefined,
          theme: themeCol ? record[themeCol] : null,
          priority,
          lideranca: liderancaCol ? record[liderancaCol] : null,
          visit_id: null, // Demandas do Sheets não têm visit_id
          sla_deadline: dateCol ? record[dateCol] : null,
          created_at: dateCol ? record[dateCol] : new Date().toISOString(),
          // Adicionar informação de origem
          from_sheets: true,
          sheets_data: {
            cidade: cidadeValue,
            ...record
          }
        }
      })
      .filter((demand: any) => {
        // Filtrar apenas linhas completamente vazias (sem título e sem cidade)
        return demand.title && demand.title !== 'Sem título' && demand.title.trim() !== ''
      })

    return demandsFromSheets
  } catch (error: any) {
    console.error('Erro ao buscar demandas do Google Sheets:', error)
    // Retornar array vazio em caso de erro para não quebrar a aplicação
    return []
  }
}

export async function GET(request: Request) {
  let userId: string | undefined

  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    userId = user.id

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const cidade = searchParams.get('cidade')

    let query = supabase
      .from('demands')
      .select(`
        *,
        visits (
          id,
          agendas (
            id,
            cities (
              name,
              state
            )
          )
        )
      `)
      .order('created_at', { ascending: false })

    if (status) {
      query = query.eq('status', status)
    }

    const { data: demandsFromDb, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    // Buscar demandas do Google Sheets
    const demandsFromSheets = await fetchDemandsFromSheets()
    console.log(`[DEBUG] Total de demandas do Google Sheets carregadas: ${demandsFromSheets.length}`)

    // Função auxiliar para normalizar nome de cidade
    const normalizeCityName = (city: string): string => {
      return city
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .trim()
    }

    // Filtrar demandas do banco por cidade se necessário
    let filteredDbDemands = demandsFromDb || []
    if (cidade) {
      const cidadeNormalizada = normalizeCityName(cidade)
      filteredDbDemands = filteredDbDemands.filter((demand: any) => {
        // Verificar se a demanda está associada a uma cidade através de visits -> agendas -> cities
        // visits pode ser um objeto único ou um array
        const visits = demand.visits
        if (!visits) return false

        // Se visits é um array, verificar cada um
        if (Array.isArray(visits)) {
          return visits.some((visit: any) => {
            const agendas = visit?.agendas
            if (!agendas) return false
            
            // agendas pode ser um objeto único ou um array
            const agendasArray = Array.isArray(agendas) ? agendas : [agendas]
            return agendasArray.some((agenda: any) => {
              const cities = agenda?.cities
              if (!cities) return false
              
              // cities pode ser um objeto único ou um array
              const citiesArray = Array.isArray(cities) ? cities : [cities]
              return citiesArray.some((city: any) => {
                const cityName = city?.name
                if (!cityName) return false
                const cityNameNormalized = normalizeCityName(cityName)
                return cityNameNormalized === cidadeNormalizada ||
                       cityNameNormalized.includes(cidadeNormalizada) ||
                       cidadeNormalizada.includes(cityNameNormalized)
              })
            })
          })
        } else {
          // visits é um objeto único
          const agendas = visits?.agendas
          if (!agendas) return false
          
          const agendasArray = Array.isArray(agendas) ? agendas : [agendas]
          return agendasArray.some((agenda: any) => {
            const cities = agenda?.cities
            if (!cities) return false
            
            const citiesArray = Array.isArray(cities) ? cities : [cities]
            return citiesArray.some((city: any) => {
              const cityName = city?.name
              if (!cityName) return false
              const cityNameNormalized = normalizeCityName(cityName)
              return cityNameNormalized === cidadeNormalizada ||
                     cityNameNormalized.includes(cidadeNormalizada) ||
                     cidadeNormalizada.includes(cityNameNormalized)
            })
          })
        }
      })
    }

    // Aplicar filtros nas demandas do Sheets
    let filteredSheetsDemands = demandsFromSheets
    if (status) {
      filteredSheetsDemands = filteredSheetsDemands.filter(d => d.status === status)
    }
    if (cidade) {
      const cidadeNormalizada = normalizeCityName(cidade)
      console.log(`[DEBUG] Filtrando demandas por cidade: "${cidade}" (normalizada: "${cidadeNormalizada}")`)
      console.log(`[DEBUG] Total de demandas do Sheets antes do filtro: ${filteredSheetsDemands.length}`)
      
      // Se não houver demandas, logar para debug
      if (filteredSheetsDemands.length === 0) {
        console.log('[DEBUG] Nenhuma demanda do Sheets encontrada. Verifique se as variáveis de ambiente estão configuradas.')
      }
      
      filteredSheetsDemands = filteredSheetsDemands.filter((d: any) => {
        // Tentar múltiplas formas de acessar a cidade
        // Primeiro verificar sheets_data (que contém todos os dados da planilha)
        let demandCity: string | null = null
        
        if (d.sheets_data) {
          // Procurar em todas as chaves que possam conter cidade (case-insensitive)
          const possibleCityKeys = Object.keys(d.sheets_data).filter(key => 
            /cidade|city|município|municipio|MUNICIPIO|MUNICÍPIO|local|localidade/i.test(key)
          )
          
          if (possibleCityKeys.length > 0) {
            demandCity = d.sheets_data[possibleCityKeys[0]]
          }
          
          // Se não encontrou, tentar acessar diretamente com diferentes variações
          if (!demandCity) {
            demandCity = d.sheets_data.cidade || d.sheets_data.Cidade || d.sheets_data.CIDADE || 
                         d.sheets_data.municipio || d.sheets_data.Municipio || d.sheets_data.MUNICIPIO ||
                         d.sheets_data.município || d.sheets_data.Município || d.sheets_data.MUNICÍPIO || null
          }
        }
        
        // Fallback: tentar acessar diretamente no objeto
        if (!demandCity) {
          demandCity = d.cidade || d.Cidade || d.CIDADE || null
        }
        
        if (!demandCity || String(demandCity).trim() === '') {
          // Log apenas para as primeiras 3 demandas para não poluir o log
          if (filteredSheetsDemands.indexOf(d) < 3) {
            console.log(`[DEBUG] Demanda sem cidade: "${d.title}"`, {
              sheets_data_keys: d.sheets_data ? Object.keys(d.sheets_data) : [],
              demand_keys: Object.keys(d).filter(k => !k.startsWith('_'))
            })
          }
          return false
        }
        
        const demandCityStr = String(demandCity).trim()
        const demandCityNormalized = normalizeCityName(demandCityStr)
        const matches = demandCityNormalized === cidadeNormalizada ||
                        demandCityNormalized.includes(cidadeNormalizada) ||
                        cidadeNormalizada.includes(demandCityNormalized)
        
        if (matches && filteredSheetsDemands.indexOf(d) < 5) {
          console.log(`[DEBUG] Match encontrado: "${demandCityStr}" (normalizada: "${demandCityNormalized}") === "${cidade}" (normalizada: "${cidadeNormalizada}")`)
        }
        
        return matches
      })
      
      console.log(`[DEBUG] Total de demandas do Sheets após filtro: ${filteredSheetsDemands.length}`)
    }

    // Combinar demandas do banco com as do Sheets
    const allDemands = [
      ...filteredDbDemands,
      ...filteredSheetsDemands
    ]

    // Ordenar por data de criação (mais recentes primeiro)
    allDemands.sort((a, b) => {
      const dateA = new Date(a.created_at || 0).getTime()
      const dateB = new Date(b.created_at || 0).getTime()
      return dateB - dateA
    })

    return NextResponse.json(allDemands)
  } catch (error) {
    logError('Erro ao buscar demandas', error, {
      userId,
      endpoint: '/api/campo/demands',
    })
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = demandSchema.parse(body)

    const { data, error } = await supabase
      .from('demands')
      .insert({
        ...validated,
        status: validated.status || 'nova',
        priority: validated.priority || 'medium',
      })
      .select(`
        *,
        visits (
          id,
          agendas (
            id,
            cities (
              name,
              state
            )
          )
        )
      `)
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

