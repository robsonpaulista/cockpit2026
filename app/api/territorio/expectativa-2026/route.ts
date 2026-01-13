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

    // Encontrar coluna de expectativa 2026
    const expectativaVotosCol = headers.find((h) => {
      const normalized = h.toLowerCase().trim()
      if (/jadyel|nome|pessoa|candidato/i.test(normalized)) {
        return false
      }
      return /^expectativa\s+de\s+votos\s+2026$/i.test(h) || 
             /expectativa\s+de\s+votos\s+2026/i.test(h) ||
             (/expectativa.*votos.*2026/i.test(h) && !/jadyel|nome|pessoa|candidato/i.test(h))
    })

    if (!expectativaVotosCol) {
      return NextResponse.json({
        total: 0,
        message: 'Coluna "Expectativa de Votos 2026" não encontrada',
      })
    }

    // Calcular soma total
    let totalExpectativaVotos = 0
    const records = rows.slice(1)
    
    records.forEach((row: any[]) => {
      const index = headers.indexOf(expectativaVotosCol)
      if (index >= 0 && row[index]) {
        const value = row[index]
        totalExpectativaVotos += normalizeNumber(value)
      }
    })

    return NextResponse.json({
      total: Math.round(totalExpectativaVotos),
      formatted: totalExpectativaVotos.toLocaleString('pt-BR'),
    })
  } catch (error: any) {
    console.error('Erro ao calcular Expectativa 2026:', error)
    
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

