import { NextResponse } from 'next/server'

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

    // Calcular total de expectativa de votos
    let totalExpectativaVotos = 0
    if (expectativaVotosCol) {
      totalExpectativaVotos = dadosParaKPIs.reduce((sum, l) => {
        const value = l[expectativaVotosCol]
        return sum + normalizeNumber(value)
      }, 0)
    }

    // Calcular cidades únicas usando a mesma lógica da página território
    const cidadesUnicas = cidadeCol
      ? new Set(dadosParaKPIs.map((l) => l[cidadeCol]).filter(Boolean)).size
      : 0

    return NextResponse.json({
      liderancas: liderancasFiltradas.length,
      total: liderancas.length,
      expectativa2026: Math.round(totalExpectativaVotos),
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

