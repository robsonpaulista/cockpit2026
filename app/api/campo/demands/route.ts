import { createClient } from '@/lib/supabase/server'
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

    const titleCol = findColumn(['titulo', 'title', 'título', 'nome'])
    const descriptionCol = findColumn(['descrição', 'description', 'descricao', 'detalhes', 'detalhe'])
    const statusCol = findColumn(['status', 'situação', 'situacao'])
    const themeCol = findColumn(['tema', 'theme', 'assunto'])
    const priorityCol = findColumn(['prioridade', 'priority', 'urgência', 'urgencia'])
    const cityCol = findColumn(['cidade', 'city', 'município', 'municipio'])
    const dateCol = findColumn(['data', 'date', 'criado_em', 'created_at', 'data_criação'])

    // Converter linhas em objetos de demanda
    const demandsFromSheets = rows.slice(1)
      .map((row: any[], index: number) => {
        const record: Record<string, any> = {}
        headers.forEach((header, colIndex) => {
          record[header] = row[colIndex] || null
        })

        // Mapear status do Sheets para o formato esperado
        let status = 'nova'
        if (statusCol && record[statusCol]) {
          const statusValue = String(record[statusCol]).toLowerCase().trim()
          if (statusValue.includes('andamento') || statusValue.includes('progresso')) {
            status = 'em-andamento'
          } else if (statusValue.includes('encaminhado') || statusValue.includes('encaminhada')) {
            status = 'encaminhado'
          } else if (statusValue.includes('resolvido') || statusValue.includes('resolvida') || statusValue.includes('concluído') || statusValue.includes('concluido')) {
            status = 'resolvido'
          }
        }

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

        return {
          id,
          title: titleCol ? (record[titleCol] || 'Sem título') : 'Sem título',
          description: descriptionCol ? record[descriptionCol] : null,
          status,
          theme: themeCol ? record[themeCol] : null,
          priority,
          visit_id: null, // Demandas do Sheets não têm visit_id
          sla_deadline: dateCol ? record[dateCol] : null,
          created_at: dateCol ? record[dateCol] : new Date().toISOString(),
          // Adicionar informação de origem
          from_sheets: true,
          sheets_data: {
            cidade: cityCol ? record[cityCol] : null,
            ...record
          }
        }
      })
      .filter((demand: any) => demand.title && demand.title !== 'Sem título') // Filtrar linhas vazias

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

    // Aplicar filtro de status nas demandas do Sheets se necessário
    let filteredSheetsDemands = demandsFromSheets
    if (status) {
      filteredSheetsDemands = demandsFromSheets.filter(d => d.status === status)
    }

    // Combinar demandas do banco com as do Sheets
    const allDemands = [
      ...(demandsFromDb || []),
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

