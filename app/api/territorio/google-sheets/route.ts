import { NextResponse } from 'next/server'
import { google } from 'googleapis'

// Função para buscar dados do Google Sheets usando Service Account
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

    // Autenticar usando Service Account
    const auth = new google.auth.GoogleAuth({
      credentials: credentialsObj,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    // Construir range
    const rangeToRead = range ? `${sheetName}!${range}` : sheetName

    // Buscar dados
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: rangeToRead,
    })

    const rows = response.data.values || []

    if (rows.length === 0) {
      return NextResponse.json({
        headers: [],
        records: [],
        total: 0,
        message: 'Planilha vazia',
      })
    }

    // Primeira linha são os cabeçalhos
    const headers = rows[0].map((h: any) => String(h || '').trim())

    // Resto são os dados
    const records = rows.slice(1).map((row: any[]) => {
      const record: Record<string, any> = {}
      headers.forEach((header, index) => {
        record[header] = row[index] || null
      })
      return record
    })

    return NextResponse.json({
      headers,
      records,
      total: records.length,
    })
  } catch (error: any) {
    console.error('Erro ao buscar dados do Google Sheets:', error)
    
    // Mensagens de erro mais específicas
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

// Manter GET para compatibilidade (mas não funcionará com planilhas privadas)
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const spreadsheetId = searchParams.get('spreadsheet_id')
    const sheetName = searchParams.get('sheet_name') || 'Sheet1'

    if (!spreadsheetId) {
      return NextResponse.json(
        { error: 'spreadsheet_id é obrigatório' },
        { status: 400 }
      )
    }

    // Tentar usar API pública (só funciona para planilhas públicas)
    const url = `https://docs.google.com/spreadsheets/d/${spreadsheetId}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`

    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    })

    if (!response.ok) {
      return NextResponse.json(
        { error: 'Erro ao buscar dados. Use autenticação com Service Account para planilhas privadas.' },
        { status: response.status }
      )
    }

    const text = await response.text()
    const jsonText = text.replace(/^google\.visualization\.Query\.setResponse\(/, '').replace(/\);$/, '')
    const data = JSON.parse(jsonText)

    const rows = data.table?.rows || []
    const columns = data.table?.cols || []

    const headers: string[] = []
    if (rows.length > 0) {
      rows[0].c?.forEach((cell: any, index: number) => {
        headers.push(cell?.v || columns[index]?.label || `Coluna ${index + 1}`)
      })
    }

    const records = rows.slice(1).map((row: any) => {
      const record: Record<string, any> = {}
      row.c?.forEach((cell: any, index: number) => {
        const header = headers[index] || `col_${index}`
        record[header] = cell?.v || cell?.f || null
      })
      return record
    })

    return NextResponse.json({
      headers,
      records,
      total: records.length,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Erro ao processar dados da planilha' },
      { status: 500 }
    )
  }
}
