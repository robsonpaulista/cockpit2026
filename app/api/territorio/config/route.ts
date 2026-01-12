import { NextResponse } from 'next/server'

// Endpoint para verificar se a configuração do Google Sheets está disponível no servidor
export async function GET() {
  // Verificar variáveis específicas para Território primeiro
  let hasEnvConfig = !!(
    process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY &&
    process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL &&
    process.env.GOOGLE_SHEETS_SPREADSHEET_ID
  )

  // Fallback: variáveis genéricas (compatibilidade)
  if (!hasEnvConfig) {
    hasEnvConfig = !!(
      process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY &&
      process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL &&
      process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    )
  }

  return NextResponse.json({
    configured: hasEnvConfig,
    spreadsheetId: hasEnvConfig ? process.env.GOOGLE_SHEETS_SPREADSHEET_ID : null,
    sheetName: process.env.GOOGLE_SHEETS_NAME || 'Sheet1',
    // Não expor credenciais sensíveis
  })
}

