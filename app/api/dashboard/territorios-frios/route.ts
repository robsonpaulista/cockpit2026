import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// Função para normalizar nomes de cidades (para comparação)
function normalizeCityName(name: string): string {
  if (!name) return ''
  
  // Converter para minúsculo, remover acentos e espaços extras
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove acentos
    .replace(/\s+/g, ' ')
    .trim()
}

// Função para formatar nome da cidade para exibição (capitalize)
function formatCityName(name: string): string {
  if (!name) return ''
  
  return name
    .toLowerCase()
    .split(' ')
    .map(word => {
      // Palavras que devem ficar em minúsculo (exceto no início)
      const lowercaseWords = ['de', 'da', 'do', 'das', 'dos', 'e']
      if (lowercaseWords.includes(word)) return word
      return word.charAt(0).toUpperCase() + word.slice(1)
    })
    .join(' ')
    // Garantir que a primeira letra seja maiúscula
    .replace(/^./, str => str.toUpperCase())
}

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
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    let { territorioConfig } = body

    // 1. Buscar expectativa de votos por cidade do Território & Base
    // Usar chave normalizada para comparação, manter nome original para exibição
    let expectativaPorCidade: Record<string, number> = {}
    let liderancasPorCidade: Record<string, number> = {}
    let nomeOriginalCidade: Record<string, string> = {} // Mapeia chave normalizada -> nome para exibição

    // Função auxiliar para formatar a chave privada
    const formatPrivateKey = (key: string): string => {
      // Primeiro, substituir \\n (escape duplo) por quebra de linha real
      let formattedKey = key.replace(/\\\\n/g, '\n')
      // Depois, substituir \n literal por quebra de linha real
      formattedKey = formattedKey.replace(/\\n/g, '\n')
      return formattedKey
    }

    // Verificar se há configuração nas variáveis de ambiente
    // Prioridade: variáveis específicas para Território
    let envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_PRIVATE_KEY
    let envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_TERRITORIO_EMAIL
    
    // Fallback: variáveis genéricas (compatibilidade)
    if (!envPrivateKey || !envEmail) {
      envPrivateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY
      envEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
    }
    
    const envSpreadsheetId = process.env.GOOGLE_SHEETS_SPREADSHEET_ID
    const envSheetName = process.env.GOOGLE_SHEETS_NAME || 'Sheet1'
    const envRange = process.env.GOOGLE_SHEETS_RANGE

    const hasEnvConfig = !!(envPrivateKey && envEmail && envSpreadsheetId)

    // Se não tiver config do localStorage mas tiver do servidor, usar do servidor
    if (!territorioConfig && hasEnvConfig && envPrivateKey && envEmail) {
      territorioConfig = {
        spreadsheetId: envSpreadsheetId,
        sheetName: envSheetName,
        range: envRange,
        credentials: {
          type: 'service_account',
          private_key: formatPrivateKey(envPrivateKey),
          client_email: envEmail,
          token_uri: 'https://oauth2.googleapis.com/token',
        },
      }
    }

    if (territorioConfig) {
      try {
        const config = territorioConfig
        
        // Validar formato das credenciais JSON
        let credentialsObj
        if (typeof config.credentials === 'object') {
          credentialsObj = config.credentials
        } else {
          try {
            credentialsObj = typeof config.credentials === 'string' 
              ? JSON.parse(config.credentials) 
              : config.credentials
          } catch (e) {
            throw new Error('Credenciais JSON inválidas')
          }
        }

        // Importar googleapis dinamicamente
        const { google } = await import('googleapis')

        // Autenticar usando Service Account
        const auth = new google.auth.GoogleAuth({
          credentials: credentialsObj,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        })

        const sheets = google.sheets({ version: 'v4', auth })
        // Nomes de abas com espaços precisam estar entre aspas simples
        const safeSheetName = config.sheetName.includes(' ') ? `'${config.sheetName}'` : config.sheetName
        const rangeToRead = config.range ? `${safeSheetName}!${config.range}` : safeSheetName

        const response = await sheets.spreadsheets.values.get({
          spreadsheetId: config.spreadsheetId,
          range: rangeToRead,
        })

        const rows = response.data.values || []

        if (rows.length > 0) {
          const headers = rows[0].map((h: any) => String(h || '').trim())
          
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

          if (cidadeCol) {
            const liderancas = rows.slice(1).map((row: any[]) => {
              const record: Record<string, any> = {}
              headers.forEach((header, index) => {
                record[header] = row[index] || null
              })
              return record
            })

            // Filtrar lideranças
            let liderancasFiltradas = liderancas
            if (liderancaAtualCol || expectativaVotosCol) {
              liderancasFiltradas = liderancas.filter((l) => {
                if (liderancaAtualCol) {
                  const value = String(l[liderancaAtualCol] || '').trim().toUpperCase()
                  if (value === 'SIM' || value === 'YES' || value === 'TRUE' || value === '1') {
                    return true
                  }
                }
                if (expectativaVotosCol) {
                  const expectativaValue = normalizeNumber(l[expectativaVotosCol])
                  if (expectativaValue > 0) {
                    return true
                  }
                }
                return false
              })
            }

            // Agrupar por cidade e somar expectativa + contar lideranças
            liderancasFiltradas.forEach((lider) => {
              const cidadeOriginal = String(lider[cidadeCol] || '').trim()
              if (cidadeOriginal) {
                // Normalizar para usar como chave
                const cidadeKey = normalizeCityName(cidadeOriginal)
                
                // Guardar nome formatado para exibição (só se não existir)
                if (!nomeOriginalCidade[cidadeKey]) {
                  nomeOriginalCidade[cidadeKey] = formatCityName(cidadeOriginal)
                }
                
                // Contar lideranças
                liderancasPorCidade[cidadeKey] = (liderancasPorCidade[cidadeKey] || 0) + 1
                
                // Somar expectativa
                if (expectativaVotosCol) {
                  const expectativa = normalizeNumber(lider[expectativaVotosCol])
                  if (expectativa > 0) {
                    expectativaPorCidade[cidadeKey] = (expectativaPorCidade[cidadeKey] || 0) + expectativa
                  }
                }
              }
            })
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do Território:', error)
      }
    }

    // 2. Buscar TODAS as agendas (não apenas concluídas)
    const { data: todasAgendas, error: agendasError } = await supabase
      .from('agendas')
      .select(`
        id,
        city_id,
        status,
        date,
        type,
        cities (
          id,
          name
        )
      `)
      .not('city_id', 'is', null)
      .order('date', { ascending: false })

    if (agendasError) {
      console.error('Erro ao buscar agendas:', agendasError)
    }

    // Buscar visitas separadamente
    const agendasIds = todasAgendas?.map((a: any) => a.id) || []
    let visitasPorAgenda: Record<string, boolean> = {}
    
    if (agendasIds.length > 0) {
      const { data: visits } = await supabase
        .from('visits')
        .select('agenda_id, checkin_time')
        .in('agenda_id', agendasIds)
      
      visits?.forEach((visit: any) => {
        visitasPorAgenda[visit.agenda_id] = true
      })
    }

    // Contar visitas e agendas por cidade (usando chave normalizada)
    const visitasPorCidade: Record<string, number> = {}
    const agendasPorCidade: Record<string, number> = {}
    const ultimaVisitaPorCidade: Record<string, string> = {}

    todasAgendas?.forEach((agenda: any) => {
      if (agenda.cities) {
        const cidadeOriginal = agenda.cities.name
        const cidadeKey = normalizeCityName(cidadeOriginal)
        
        // Guardar nome formatado (priorizar o do banco IBGE que é mais correto)
        nomeOriginalCidade[cidadeKey] = cidadeOriginal
        
        // Contar agendas totais
        agendasPorCidade[cidadeKey] = (agendasPorCidade[cidadeKey] || 0) + 1
        
        // Contar visitas com checkin
        if (visitasPorAgenda[agenda.id]) {
          visitasPorCidade[cidadeKey] = (visitasPorCidade[cidadeKey] || 0) + 1
          
          // Registrar última visita
          if (!ultimaVisitaPorCidade[cidadeKey] || agenda.date > ultimaVisitaPorCidade[cidadeKey]) {
            ultimaVisitaPorCidade[cidadeKey] = agenda.date
          }
        }
      }
    })

    // 3. Buscar demandas pendentes por cidade
    const { data: demands, error: demandsError } = await supabase
      .from('demands')
      .select(`
        id,
        status,
        visit_id
      `)
      .neq('status', 'resolvido')
      .not('visit_id', 'is', null)

    if (demandsError) {
      console.error('Erro ao buscar demandas:', demandsError)
    }

    // Buscar visitas e agendas das demandas
    const visitIds = demands?.map((d: any) => d.visit_id).filter(Boolean) || []
    let demandasPorCidade: Record<string, number> = {}

    if (visitIds.length > 0) {
      const { data: visits } = await supabase
        .from('visits')
        .select(`
          id,
          agenda_id,
          agendas (
            id,
            city_id,
            cities (
              name
            )
          )
        `)
        .in('id', visitIds)

      visits?.forEach((visit: any) => {
        const cidadeNome = visit.agendas?.cities?.name
        if (cidadeNome) {
          const cidadeKey = normalizeCityName(cidadeNome)
          demandasPorCidade[cidadeKey] = (demandasPorCidade[cidadeKey] || 0) + 1
        }
      })
    }

    // 4. Construir análise completa por cidade
    const todasCidades = new Set([
      ...Object.keys(expectativaPorCidade),
      ...Object.keys(visitasPorCidade),
      ...Object.keys(agendasPorCidade),
    ])

    const analiseCidades: Array<{
      cidade: string
      expectativaVotos: number
      liderancas: number
      visitas: number
      agendas: number
      demandasPendentes: number
      ultimaVisita: string | null
      status: 'quente' | 'morno' | 'frio' | 'sem-dados'
      motivo: string
    }> = []

    const mediaExpectativa = Object.values(expectativaPorCidade).length > 0
      ? Object.values(expectativaPorCidade).reduce((a, b) => a + b, 0) / Object.values(expectativaPorCidade).length
      : 0

    todasCidades.forEach((cidade) => {
      const expectativa = expectativaPorCidade[cidade] || 0
      const liderancas = liderancasPorCidade[cidade] || 0
      const visitas = visitasPorCidade[cidade] || 0
      const agendas = agendasPorCidade[cidade] || 0
      const demandasPendentes = demandasPorCidade[cidade] || 0
      const ultimaVisita = ultimaVisitaPorCidade[cidade] || null

      // Determinar status
      let status: 'quente' | 'morno' | 'frio' | 'sem-dados' = 'sem-dados'
      let motivo = ''

      // Cidades com visitas são classificadas por temperatura
      if (visitas >= 3 || (visitas >= 2 && demandasPendentes === 0)) {
        // QUENTE: 3+ visitas ou 2+ visitas sem demandas pendentes
        status = 'quente'
        motivo = `${visitas} visitas realizadas`
      } else if (visitas >= 1) {
        // MORNO: pelo menos 1 visita
        status = 'morno'
        motivo = `${visitas} visita${visitas > 1 ? 's' : ''} realizada${visitas > 1 ? 's' : ''}`
      } else if (expectativa > 0) {
        // FRIO: tem expectativa de votos mas nenhuma visita
        const temAltaExpectativa = expectativa > mediaExpectativa || expectativa > 500
        
        if (temAltaExpectativa) {
          status = 'frio'
          motivo = 'Baixa presença'
        } else {
          status = 'morno'
          motivo = 'Nenhuma visita ainda'
        }
      } else if (agendas > 0) {
        // Tem agendas mas nenhuma visita concluída
        status = 'morno'
        motivo = `${agendas} agenda${agendas > 1 ? 's' : ''} pendente${agendas > 1 ? 's' : ''}`
      } else {
        // Sem dados
        status = 'sem-dados'
        motivo = 'Sem dados'
      }

      // Ajustar para frio se tiver muitas demandas pendentes
      if (demandasPendentes > 3 && status !== 'quente') {
        status = 'frio'
        motivo = motivo ? `${motivo} + ${demandasPendentes} demandas` : `${demandasPendentes} demandas pendentes`
      }

      // Usar nome formatado para exibição (ou a chave se não tiver)
      const cidadeExibicao = nomeOriginalCidade[cidade] || formatCityName(cidade)
      
      analiseCidades.push({
        cidade: cidadeExibicao,
        expectativaVotos: Math.round(expectativa),
        liderancas,
        visitas,
        agendas,
        demandasPendentes,
        ultimaVisita,
        status,
        motivo,
      })
    })

    // Separar por status
    const territoriosFrios = analiseCidades
      .filter((c) => c.status === 'frio')
      .sort((a, b) => b.expectativaVotos - a.expectativaVotos)
      .slice(0, 10)

    const territoriosQuentes = analiseCidades
      .filter((c) => c.status === 'quente')
      .sort((a, b) => b.visitas - a.visitas)
      .slice(0, 5)

    const territoriosMornos = analiseCidades
      .filter((c) => c.status === 'morno')
      .sort((a, b) => b.expectativaVotos - a.expectativaVotos)
      .slice(0, 5)

    // Cidades não visitadas (0 visitas) ordenadas por expectativa de votos
    const cidadesNaoVisitadasLista = analiseCidades
      .filter((c) => c.visitas === 0 && c.status !== 'sem-dados')
      .sort((a, b) => b.expectativaVotos - a.expectativaVotos)
      .slice(0, 10)
      .map((c) => ({
        cidade: c.cidade,
        expectativaVotos: c.expectativaVotos,
        motivo: 'Ainda não visitada',
      }))

    // Estatísticas gerais
    const totalCidades = analiseCidades.filter((c) => c.status !== 'sem-dados').length
    const totalVisitas = Object.values(visitasPorCidade).reduce((a, b) => a + b, 0)
    const totalExpectativa = Object.values(expectativaPorCidade).reduce((a, b) => a + b, 0)
    const cidadesVisitadas = Object.keys(visitasPorCidade).length
    const cidadesNaoVisitadas = totalCidades - cidadesVisitadas

    return NextResponse.json({
      territoriosFrios,
      territoriosQuentes,
      territoriosMornos,
      cidadesNaoVisitadasLista,
      estatisticas: {
        totalCidades,
        cidadesVisitadas,
        cidadesNaoVisitadas,
        totalVisitas,
        totalExpectativa: Math.round(totalExpectativa),
        percentualCobertura: totalCidades > 0 ? Math.round((cidadesVisitadas / totalCidades) * 100) : 0,
      },
    })
  } catch (error: any) {
    console.error('Erro ao calcular Territórios:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar dados' },
      { status: 500 }
    )
  }
}
