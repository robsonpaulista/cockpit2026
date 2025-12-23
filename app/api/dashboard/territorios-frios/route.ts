import { createClient } from '@/lib/supabase/server'
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
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const { territorioConfig } = body

    // 1. Buscar expectativa de votos por cidade do Território & Base
    let expectativaPorCidade: Record<string, number> = {}

    if (territorioConfig) {
      try {
        const config = territorioConfig
        
        // Validar formato das credenciais JSON
        let credentialsObj
        try {
          credentialsObj = typeof config.credentials === 'string' 
            ? JSON.parse(config.credentials) 
            : config.credentials
        } catch (e) {
          throw new Error('Credenciais JSON inválidas')
        }

        // Importar googleapis dinamicamente
        const { google } = await import('googleapis')

        // Autenticar usando Service Account
        const auth = new google.auth.GoogleAuth({
          credentials: credentialsObj,
          scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
        })

        const sheets = google.sheets({ version: 'v4', auth })
        const rangeToRead = config.range ? `${config.sheetName}!${config.range}` : config.sheetName

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

          if (expectativaVotosCol && cidadeCol) {
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

            // Agrupar por cidade e somar expectativa
            liderancasFiltradas.forEach((lider) => {
              const cidade = String(lider[cidadeCol] || '').trim()
              if (cidade && expectativaVotosCol) {
                const expectativa = normalizeNumber(lider[expectativaVotosCol])
                if (expectativa > 0) {
                  expectativaPorCidade[cidade] = (expectativaPorCidade[cidade] || 0) + expectativa
                }
              }
            })
          }
        }
      } catch (error) {
        console.error('Erro ao buscar dados do Território:', error)
      }
    }

    // 2. Buscar cidades visitadas do Campo & Agenda
    const { data: agendas, error: agendasError } = await supabase
      .from('agendas')
      .select(`
        id,
        city_id,
        status,
        cities (
          id,
          name
        )
      `)
      .eq('status', 'concluida')
      .not('city_id', 'is', null)

    if (agendasError) {
      console.error('Erro ao buscar agendas:', agendasError)
    }

    // Buscar visitas separadamente
    const agendasIds = agendas?.map((a: any) => a.id) || []
    let visitasPorAgenda: Record<string, boolean> = {}
    
    if (agendasIds.length > 0) {
      const { data: visits } = await supabase
        .from('visits')
        .select('agenda_id')
        .in('agenda_id', agendasIds)
      
      visits?.forEach((visit: any) => {
        visitasPorAgenda[visit.agenda_id] = true
      })
    }

    // Contar visitas por cidade
    const visitasPorCidade: Record<string, number> = {}

    agendas?.forEach((agenda: any) => {
      if (agenda.cities && visitasPorAgenda[agenda.id]) {
        const cidadeNome = agenda.cities.name
        visitasPorCidade[cidadeNome] = (visitasPorCidade[cidadeNome] || 0) + 1
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
          demandasPorCidade[cidadeNome] = (demandasPorCidade[cidadeNome] || 0) + 1
        }
      })
    }

    // 4. Identificar territórios frios
    // Critério: Alta expectativa de votos MAS (poucas visitas OU muitas demandas pendentes)
    const territoriosFrios: Array<{
      cidade: string
      expectativaVotos: number
      visitas: number
      demandasPendentes: number
      motivo: string
    }> = []

    Object.keys(expectativaPorCidade).forEach((cidade) => {
      const expectativa = expectativaPorCidade[cidade]
      const visitas = visitasPorCidade[cidade] || 0
      const demandasPendentes = demandasPorCidade[cidade] || 0

      // Considerar "alta expectativa" se for maior que a média ou acima de um threshold
      const mediaExpectativa = Object.values(expectativaPorCidade).reduce((a, b) => a + b, 0) / Object.keys(expectativaPorCidade).length
      const temAltaExpectativa = expectativa > mediaExpectativa || expectativa > 1000

      // Considerar "poucas visitas" se tiver menos de 2 visitas
      const temPoucasVisitas = visitas < 2

      // Considerar "muitas demandas" se tiver mais de 3 demandas pendentes
      const temMuitasDemandas = demandasPendentes > 3

      if (temAltaExpectativa && (temPoucasVisitas || temMuitasDemandas)) {
        const motivos: string[] = []
        if (temPoucasVisitas) {
          motivos.push('Baixa presença')
        }
        if (temMuitasDemandas) {
          motivos.push('Alta demanda pendente')
        }

        territoriosFrios.push({
          cidade,
          expectativaVotos: Math.round(expectativa),
          visitas,
          demandasPendentes,
          motivo: motivos.join(' + '),
        })
      }
    })

    // Ordenar por expectativa de votos (decrescente)
    territoriosFrios.sort((a, b) => b.expectativaVotos - a.expectativaVotos)

    return NextResponse.json({
      territoriosFrios: territoriosFrios.slice(0, 10), // Top 10
    })
  } catch (error: any) {
    console.error('Erro ao calcular Territórios Frios:', error)
    return NextResponse.json(
      { error: error.message || 'Erro ao processar dados' },
      { status: 500 }
    )
  }
}

