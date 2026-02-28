import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

// Função auxiliar para formatar a chave privada
function formatPrivateKey(key: string): string {
  let formattedKey = key.replace(/\\\\n/g, '\n')
  formattedKey = formattedKey.replace(/\\n/g, '\n')
  return formattedKey
}

// Função auxiliar para obter credenciais (prioriza variáveis de ambiente)
function getCredentials(bodyCredentials?: string, context: 'territorio' | 'demandas' | 'default' = 'default') {
  // Prioridade 1: Credenciais do body (mais alta prioridade)
  if (bodyCredentials) {
    try {
      const parsed = typeof bodyCredentials === 'string' 
        ? JSON.parse(bodyCredentials) 
        : bodyCredentials
      return {
        type: 'service_account',
        private_key: formatPrivateKey(parsed.private_key || parsed.privateKey),
        client_email: parsed.client_email || parsed.clientEmail || parsed.email,
        token_uri: parsed.token_uri || 'https://oauth2.googleapis.com/token',
      }
    } catch (e) {
      // Se falhar, continuar para variáveis de ambiente
    }
  }

  // Prioridade 2: Variáveis de ambiente específicas por contexto
  let envPrivateKey: string | undefined
  let envEmail: string | undefined

  if (context === 'territorio') {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL
  } else if (context === 'demandas') {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL
  }

  // Prioridade 3: Variáveis genéricas (fallback para compatibilidade)
  if (!envPrivateKey || !envEmail) {
    envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
    envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  }

  if (envPrivateKey && envEmail) {
    return {
      type: 'service_account',
      private_key: formatPrivateKey(envPrivateKey),
      client_email: envEmail,
      token_uri: 'https://oauth2.googleapis.com/token',
    }
  }

  return null
}

// Função auxiliar para obter configuração da planilha
function getSheetConfig(body: any) {
  return {
    spreadsheetId: body.spreadsheetId || process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    sheetName: body.sheetName || process.env.GOOGLE_SHEETS_NAME || 'Sheet1',
    range: body.range || process.env.GOOGLE_SHEETS_RANGE,
  }
}

// Função para normalizar números (mesma lógica da página território)
function normalizeNumber(value: any): number {
  if (typeof value === 'number') return value
  
  const str = String(value).trim()
  if (!str) return 0
  
  // Remover espaços e caracteres não numéricos exceto vírgula e ponto
  let cleaned = str.replace(/[^\d.,]/g, '')
  
  // Se tem vírgula e ponto
  if (cleaned.includes(',') && cleaned.includes('.')) {
    // Formato: 1.234,56 ou 1,234.56
    // Se vírgula vem depois do ponto, é separador decimal (BR)
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      // Se ponto vem depois da vírgula, vírgula é separador de milhar
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    // Apenas vírgula: verificar se é separador de milhar ou decimal
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      // Se tem exatamente 3 dígitos após vírgula = separador de milhar (ex: 4,000 = 4000)
      if (parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, '')
      } else if (parts[1].length <= 2) {
        // 1-2 dígitos após vírgula = separador decimal (ex: 4,50 = 4.50)
        cleaned = cleaned.replace(',', '.')
      } else {
        // Mais de 3 dígitos = separador de milhar
        cleaned = cleaned.replace(/,/g, '')
      }
    } else {
      // Múltiplas vírgulas = separador de milhar
      cleaned = cleaned.replace(/,/g, '')
    }
  }
  
  const numValue = parseFloat(cleaned)
  return isNaN(numValue) ? 0 : numValue
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spreadsheetId: bodySpreadsheetId, sheetName: bodySheetName, range, serviceAccountEmail, credentials } = body
    const cenarioVotos = body?.cenarioVotos === 'promessa_lideranca' ? 'promessa_lideranca' : 'aferido_jadyel'
    
    // Obter configuração (prioriza body, depois variáveis de ambiente)
    const { spreadsheetId, sheetName } = getSheetConfig(body)

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { error: 'spreadsheet_id e sheet_name são obrigatórios. Configure nas variáveis de ambiente ou envie no corpo da requisição.' },
        { status: 400 }
      )
    }

    // Obter credenciais (prioriza body, depois variáveis de ambiente)
    const credentialsObj = getCredentials(credentials, 'territorio')

    if (!credentialsObj) {
      return NextResponse.json(
        { error: 'Credenciais não encontradas. Configure GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY e GOOGLE_SERVICE_ACCOUNT_EMAIL nas variáveis de ambiente ou envie no corpo da requisição.' },
        { status: 400 }
      )
    }

    // Importar googleapis dinamicamente
    const { google } = await import('googleapis')

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
      return NextResponse.json({
        liderancas: 0,
        total: 0,
        expectativa2026: 0,
        cidadesUnicas: 0,
        message: 'Planilha vazia',
      })
    }

    // Primeira linha são os cabeçalhos
    const headers = rows[0].map((h: any) => String(h || '').trim())

    // Identificar colunas importantes (mesma lógica da página território)
    const liderancaAtualCol = headers.find((h) =>
      /liderança atual|lideranca atual|atual\?/i.test(h)
    )
    const expectativaJadyelCol = headers.find((h) => {
      const normalized = h.toLowerCase().trim()
      return /expectativa.*jadyel.*2026/i.test(normalized) ||
             /expectativa.*2026.*jadyel/i.test(normalized) ||
             /^expectativa\s+de\s+votos\s+2026$/i.test(h) || 
             /expectativa\s+de\s+votos\s+2026/i.test(h) ||
             (/expectativa.*votos.*2026/i.test(h) && !/promessa/i.test(h))
    })
    const promessaLiderancaCol = headers.find((h) => /promessa.*lideran[cç]a.*2026/i.test(h))
    const votosCenarioCol =
      cenarioVotos === 'promessa_lideranca'
        ? (promessaLiderancaCol || expectativaJadyelCol)
        : (expectativaJadyelCol || promessaLiderancaCol)
    const cidadeCol = headers.find((h) =>
      /cidade|city|município|municipio/i.test(h)
    ) || headers[1] || 'Coluna 2'

    // Converter rows em objetos (mesma estrutura da página território)
    const liderancas = rows.slice(1).map((row: any[]) => {
      const record: Record<string, any> = {}
      headers.forEach((header, index) => {
        record[header] = row[index] || null
      })
      return record
    })

    // Filtrar lideranças: incluir "Liderança Atual?" = SIM OU que tenham valor no cenário ativo
    // (mesma lógica da página território)
    let liderancasFiltradas = liderancas

    if (liderancaAtualCol || votosCenarioCol) {
      liderancasFiltradas = liderancas.filter((l) => {
        // Se tem "Liderança Atual?" = SIM, incluir
        if (liderancaAtualCol) {
          const value = String(l[liderancaAtualCol] || '').trim().toUpperCase()
          if (value === 'SIM' || value === 'YES' || value === 'TRUE' || value === '1') {
            return true
          }
        }

        // Se tem valor no cenário ativo, incluir também
        if (votosCenarioCol) {
          const expectativaValue = normalizeNumber(l[votosCenarioCol])
          if (expectativaValue > 0) {
            return true
          }
        }

        return false
      })
    }

    // Se não há filtros aplicados e não há dados filtrados, usar todos os dados
    const dadosParaKPIs = liderancasFiltradas.length > 0 ? liderancasFiltradas : liderancas

    const totalExpectativaJadyel = expectativaJadyelCol
      ? dadosParaKPIs.reduce((sum, l) => sum + normalizeNumber(l[expectativaJadyelCol]), 0)
      : 0
    const totalPromessaLideranca = promessaLiderancaCol
      ? dadosParaKPIs.reduce((sum, l) => sum + normalizeNumber(l[promessaLiderancaCol]), 0)
      : 0
    const totalCenarioAtivo =
      cenarioVotos === 'promessa_lideranca' ? totalPromessaLideranca : totalExpectativaJadyel

    // Calcular cidades únicas usando a mesma lógica da página território
    const cidadesUnicas = cidadeCol
      ? new Set(dadosParaKPIs.map((l) => l[cidadeCol]).filter(Boolean)).size
      : 0

    return NextResponse.json({
      liderancas: liderancasFiltradas.length,
      total: liderancas.length,
      expectativa2026: Math.round(totalCenarioAtivo),
      expectativaJadyel2026: Math.round(totalExpectativaJadyel),
      promessaLideranca2026: Math.round(totalPromessaLideranca),
      cenarioVotosAplicado: cenarioVotos,
      cidadesUnicas: cidadesUnicas,
    })
  } catch (error: any) {
    console.error('Erro ao calcular KPIs do Território:', error)
    
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Acesso negado. Verifique se a planilha foi compartilhada com o email do Service Account.' },
        { status: 403 }
      )
    }
    
    if (error.code === 404) {
      return NextResponse.json(
        { error: 'Planilha não encontrada. Verifique o ID da planilha.' },
        { status: 404 }
      )
    }

    return NextResponse.json(
      { error: error.message || 'Erro ao processar dados da planilha' },
      { status: 500 }
    )
  }
}

