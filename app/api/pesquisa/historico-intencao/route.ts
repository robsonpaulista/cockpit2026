import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar candidato padrão do localStorage (será passado via query param)
    const { searchParams } = new URL(request.url)
    const candidatoPadrao = searchParams.get('candidato')

    if (!candidatoPadrao) {
      return NextResponse.json({
        data: [],
        message: 'Candidato padrão não especificado',
      })
    }

    // Buscar todas as pesquisas do candidato padrão com join na tabela cities
    const { data: polls, error } = await supabase
      .from('polls')
      .select(`
        *,
        cities (
          name
        )
      `)
      .eq('user_id', user.id)
      .eq('candidato_nome', candidatoPadrao)
      .order('data', { ascending: true })

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!polls || polls.length === 0) {
      return NextResponse.json({
        data: [],
        message: 'Nenhuma pesquisa encontrada',
      })
    }

    // Agrupar por data e manter informações de instituto e cidade
    // Usar a data completa (YYYY-MM-DD) como chave para garantir ordenação correta
    const dadosPorData = new Map<string, { 
      intencao: number
      count: number
      institutos: string[]
      cidades: string[]
      dataOriginal: string // Manter data original para ordenação
    }>()

    polls.forEach((poll: any) => {
      // Extrair data sem conversão de timezone para evitar diferença de 1 dia
      let dataStr = poll.data.includes('T') ? poll.data.split('T')[0] : poll.data
      
      // Normalizar para formato YYYY-MM-DD para ordenação correta
      let dataNormalizada: string
      let dataFormatada: string
      
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        // Já está no formato YYYY-MM-DD
        dataNormalizada = dataStr
        const [ano, mes, dia] = dataStr.split('-')
        dataFormatada = `${dia}/${mes}/${ano}` // Incluir ano na formatação
      } else {
        // Tentar parsear outros formatos
        const partes = dataStr.split(/[-/]/)
        if (partes.length === 3) {
          if (partes[0].length === 4) {
            // YYYY-MM-DD ou YYYY/MM/DD
            dataNormalizada = `${partes[0]}-${partes[1]}-${partes[2]}`
            dataFormatada = `${partes[2]}/${partes[1]}/${partes[0]}`
          } else {
            // DD/MM/YYYY ou DD-MM-YYYY
            dataNormalizada = `${partes[2]}-${partes[1]}-${partes[0]}`
            dataFormatada = `${partes[0]}/${partes[1]}/${partes[2]}`
          }
        } else {
          // Formato desconhecido, usar como está
          dataNormalizada = dataStr
          dataFormatada = dataStr
        }
      }

      const cidadeNome = poll.cities?.name || (poll.cidade_id ? 'Cidade não encontrada' : 'Estado')
      const instituto = poll.instituto || 'Não informado'

      if (dadosPorData.has(dataNormalizada)) {
        const existente = dadosPorData.get(dataNormalizada)!
        existente.intencao += poll.intencao
        existente.count += 1
        if (!existente.institutos.includes(instituto)) {
          existente.institutos.push(instituto)
        }
        if (!existente.cidades.includes(cidadeNome)) {
          existente.cidades.push(cidadeNome)
        }
      } else {
        dadosPorData.set(dataNormalizada, {
          intencao: poll.intencao,
          count: 1,
          institutos: [instituto],
          cidades: [cidadeNome],
          dataOriginal: dataNormalizada,
        })
      }
    })

    // Converter para array e calcular média
    const dadosFormatados = Array.from(dadosPorData.entries())
      .map(([dataNormalizada, { intencao, count, institutos, cidades, dataOriginal }]) => {
        // Formatar data para exibição (DD/MM apenas, sem ano para manter visual limpo)
        const [ano, mes, dia] = dataOriginal.split('-')
        const dataExibicao = `${dia}/${mes}`
        
        return {
          date: dataExibicao,
          dateOriginal: dataOriginal, // Manter para ordenação correta
          intencao: Math.round((intencao / count) * 10) / 10, // Arredondar para 1 casa decimal
          instituto: institutos.join(', '), // Se houver múltiplos, separar por vírgula
          cidade: cidades.join(', '), // Se houver múltiplos, separar por vírgula
        }
      })
      .sort((a, b) => {
        // Ordenar usando a data original completa (YYYY-MM-DD) para garantir ordem cronológica correta
        return a.dateOriginal.localeCompare(b.dateOriginal)
      })

    return NextResponse.json({
      data: dadosFormatados,
      candidato: candidatoPadrao,
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

