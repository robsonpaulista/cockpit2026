import { NextResponse } from 'next/server'

// Função para normalizar números (mesma lógica da página território)
function normalizeNumber(value: any): number {
  if (typeof value === 'number') return value
  
  const str = String(value).trim()
  if (!str) return 0
  
  let cleaned = str.replace(/[^\d.,]/g, '')
  
  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      if (parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, '')
      } else if (parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.')
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }
  
  const numValue = parseFloat(cleaned)
  return isNaN(numValue) ? 0 : numValue
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { spreadsheetId, sheetName, range, serviceAccountEmail, credentials } = body

    if (!spreadsheetId || !sheetName) {
      return NextResponse.json(
        { error: 'spreadsheet_id e sheet_name são obrigatórios' },
        { status: 400 }
      )
    }

    if (!serviceAccountEmail || !credentials) {
      return NextResponse.json(
        { error: 'Email do Service Account e credenciais são obrigatórios' },
        { status: 400 }
      )
    }

    // Validar formato das credenciais JSON
    let credentialsObj
    try {
      credentialsObj = typeof credentials === 'string' ? JSON.parse(credentials) : credentials
    } catch (e) {
      return NextResponse.json(
        { error: 'Credenciais JSON inválidas' },
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
        total: 0,
        message: 'Planilha vazia',
      })
    }

    // Primeira linha são os cabeçalhos
    const headers = rows[0].map((h: any) => String(h || '').trim())

    // Identificar colunas importantes (mesma lógica da página território)
    const liderancaAtualCol = headers.find((h) =>
      /liderança atual|lideranca atual|atual\?/i.test(h)
    )
    const expectativaVotosCol = headers.find((h) => {
      const normalized = h.toLowerCase().trim()
      if (/jadyel|nome|pessoa|candidato/i.test(normalized)) {
        return false
      }
      return /^expectativa\s+de\s+votos\s+2026$/i.test(h) || 
             /expectativa\s+de\s+votos\s+2026/i.test(h) ||
             (/expectativa.*votos.*2026/i.test(h) && !/jadyel|nome|pessoa|candidato/i.test(h))
    })
    const cidadeCol = headers.find((h) =>
      /cidade|city|município|municipio/i.test(h)
    ) || headers[1] || 'Coluna 2'

    if (!cidadeCol) {
      return NextResponse.json({
        total: 0,
        message: 'Coluna de cidade não encontrada',
      })
    }

    // Converter rows em objetos (mesma estrutura da página território)
    const liderancas = rows.slice(1).map((row: any[]) => {
      const record: Record<string, any> = {}
      headers.forEach((header, index) => {
        record[header] = row[index] || null
      })
      return record
    })

    // Filtrar lideranças: incluir "Liderança Atual?" = SIM OU que tenham "Expectativa de Votos 2026"
    // (mesma lógica da página território)
    let liderancasFiltradas = liderancas

    if (liderancaAtualCol || expectativaVotosCol) {
      liderancasFiltradas = liderancas.filter((l) => {
        // Se tem "Liderança Atual?" = SIM, incluir
        if (liderancaAtualCol) {
          const value = String(l[liderancaAtualCol] || '').trim().toUpperCase()
          if (value === 'SIM' || value === 'YES' || value === 'TRUE' || value === '1') {
            return true
          }
        }

        // Se tem "Expectativa de Votos 2026" com valor, incluir também
        if (expectativaVotosCol) {
          const expectativaValue = normalizeNumber(l[expectativaVotosCol])
          if (expectativaValue > 0) {
            return true
          }
        }

        return false
      })
    }

    // Se não há filtros aplicados e não há dados filtrados, usar todos os dados
    const dadosParaKPIs = liderancasFiltradas.length > 0 ? liderancasFiltradas : liderancas

    // Calcular cidades únicas usando a mesma lógica da página território
    const cidadesUnicas = cidadeCol
      ? new Set(dadosParaKPIs.map((l) => l[cidadeCol]).filter(Boolean)).size
      : 0

    return NextResponse.json({
      total: cidadesUnicas,
      cidades: Array.from(new Set(dadosParaKPIs.map((l) => l[cidadeCol]).filter(Boolean))).sort(),
    })
  } catch (error: any) {
    console.error('Erro ao calcular Cidades Únicas:', error)
    
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

