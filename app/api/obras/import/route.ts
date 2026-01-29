import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

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
    const { obras } = body

    if (!obras || !Array.isArray(obras) || obras.length === 0) {
      return NextResponse.json(
        { error: 'Lista de obras é obrigatória' },
        { status: 400 }
      )
    }

    // Log das primeiras linhas para debug
    console.log('Primeira obra recebida:', obras[0])
    console.log('Colunas disponíveis:', Object.keys(obras[0] || {}))

    // Função auxiliar para normalizar nomes de colunas
    const normalizeColumnName = (key: string): string => {
      return key
        .trim()
        .toLowerCase()
        .replace(/[àáâãäå]/g, 'a')
        .replace(/[èéêë]/g, 'e')
        .replace(/[ìíîï]/g, 'i')
        .replace(/[òóôõö]/g, 'o')
        .replace(/[ùúûü]/g, 'u')
        .replace(/ç/g, 'c')
        .replace(/ñ/g, 'n')
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s]/g, '')
    }

    // Criar mapa de colunas normalizadas para facilitar busca
    const createColumnMap = (obra: any): Record<string, any> => {
      const columnMap: Record<string, any> = {}
      Object.keys(obra).forEach(key => {
        const normalized = normalizeColumnName(key)
        if (!columnMap[normalized]) {
          columnMap[normalized] = []
        }
        columnMap[normalized].push({ original: key, value: obra[key] })
      })
      return columnMap
    }

    // Preparar dados para inserção - mapear colunas do Excel
    const obrasToInsert = obras.map((obra: any, index: number) => {
      const columnMap = createColumnMap(obra)
      
      // Função para buscar valor por várias variações do nome da coluna
      const getValue = (variations: string[]): any => {
        for (const variation of variations) {
          const normalized = normalizeColumnName(variation)
          if (columnMap[normalized] && columnMap[normalized].length > 0) {
            const value = columnMap[normalized][0].value
            if (value !== null && value !== undefined && value !== '') {
              return value
            }
          }
        }
        // Tentar busca parcial (contém)
        for (const variation of variations) {
          const normalized = normalizeColumnName(variation)
          for (const key in columnMap) {
            if (key.includes(normalized) || normalized.includes(key)) {
              const value = columnMap[key][0].value
              if (value !== null && value !== undefined && value !== '') {
                return value
              }
            }
          }
        }
        return null
      }

      // Mapear com várias variações possíveis
      const mapped = {
        municipio: getValue(['Município', 'Municipio', 'município', 'municipio', 'MUNICÍPIO', 'MUNICIPIO']),
        obra: getValue(['Obra', 'obra', 'OBRA', 'Nome', 'nome', 'Nome da Obra', 'nome_obra']) || '',
        orgao: getValue(['Órgão', 'Orgão', 'Orgao', 'orgão', 'orgao', 'ORGÃO', 'ORGAO']),
        sei: getValue(['SEI', 'sei', 'Sei']),
        sei_medicao: getValue(['SEI MEDIÇÃO', 'SEI MEDICAO', 'SEI Medição', 'SEI Medicao', 'sei medição', 'sei medicao', 'SEI_MEDIÇÃO', 'SEI_MEDICAO']),
        status: getValue(['Status', 'status', 'STATUS', 'Situação', 'situação']),
        publicacao_os: getValue(['PUBLICAÇÃO DA OS', 'PUBLICAÇÃO DA OS', 'Publicação da OS', 'publicação da os', 'publicacao da os', 'PUBLICACAO_DA_OS']),
        solicitacao_medicao: getValue(['Solicitação Medição', 'Solicitação Medicao', 'Solicitacao Medição', 'Solicitacao Medicao', 'solicitação medicação', 'solicitacao medicao']),
        data_medicao: getValue(['Data Medição', 'Data Medicao', 'data medicação', 'data medicao', 'Data_Medição', 'Data_Medicao']),
        status_medicao: getValue(['Status Medição', 'Status Medicao', 'status medicação', 'status medicao', 'Status_Medição', 'Status_Medicao']),
        valor_total: getValue(['Valor Total', 'Valor Total', 'valor total', 'Valor_Total', 'valor_total', 'ValorTotal']),
      }

      // Validar obra obrigatória
      if (!mapped.obra || mapped.obra.trim() === '') {
        console.warn(`Obra na linha ${index + 2} sem nome, será ignorada`)
        return null
      }

      return mapped
    }).filter((obra: any) => obra !== null) // Filtrar obras inválidas

    if (obrasToInsert.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma obra válida para importar. Verifique se a coluna "Obra" está presente e preenchida.' },
        { status: 400 }
      )
    }

    console.log(`Preparando para inserir ${obrasToInsert.length} obras`)
    console.log('Exemplo de obra mapeada:', obrasToInsert[0])

    // Inserir obras no banco
    const { data, error } = await supabase
      .from('obras')
      .insert(obrasToInsert)
      .select()

    if (error) {
      console.error('Erro ao importar obras:', error)
      return NextResponse.json(
        { 
          error: `Erro ao importar obras: ${error.message || 'Erro desconhecido'}`,
          details: error.details || null
        },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      imported: data.length,
      obras: data,
    })
  } catch (error: unknown) {
    console.error('Erro ao importar obras:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}
