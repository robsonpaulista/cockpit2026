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
    const dadosPorData = new Map<string, { 
      intencao: number
      count: number
      institutos: string[]
      cidades: string[]
    }>()

    polls.forEach((poll: any) => {
      // Extrair data sem conversão de timezone para evitar diferença de 1 dia
      let dataStr = poll.data.includes('T') ? poll.data.split('T')[0] : poll.data
      
      // Se a data está no formato YYYY-MM-DD, converter diretamente sem usar Date
      // para evitar problemas de timezone
      let dataFormatada: string
      if (/^\d{4}-\d{2}-\d{2}$/.test(dataStr)) {
        const [ano, mes, dia] = dataStr.split('-')
        dataFormatada = `${dia}/${mes}`
      } else {
        // Se já está em outro formato, tentar parsear
        const partes = dataStr.split(/[-/]/)
        if (partes.length === 3) {
          // Assumir formato YYYY-MM-DD ou DD/MM/YYYY
          if (partes[0].length === 4) {
            // YYYY-MM-DD
            dataFormatada = `${partes[2]}/${partes[1]}`
          } else {
            // DD/MM/YYYY ou DD-MM-YYYY
            dataFormatada = `${partes[0]}/${partes[1]}`
          }
        } else {
          dataFormatada = dataStr
        }
      }

      const cidadeNome = poll.cities?.name || (poll.cidade_id ? 'Cidade não encontrada' : 'Estado')
      const instituto = poll.instituto || 'Não informado'

      if (dadosPorData.has(dataFormatada)) {
        const existente = dadosPorData.get(dataFormatada)!
        existente.intencao += poll.intencao
        existente.count += 1
        if (!existente.institutos.includes(instituto)) {
          existente.institutos.push(instituto)
        }
        if (!existente.cidades.includes(cidadeNome)) {
          existente.cidades.push(cidadeNome)
        }
      } else {
        dadosPorData.set(dataFormatada, {
          intencao: poll.intencao,
          count: 1,
          institutos: [instituto],
          cidades: [cidadeNome],
        })
      }
    })

    // Converter para array e calcular média
    const dadosFormatados = Array.from(dadosPorData.entries())
      .map(([date, { intencao, count, institutos, cidades }]) => ({
        date,
        intencao: Math.round((intencao / count) * 10) / 10, // Arredondar para 1 casa decimal
        instituto: institutos.join(', '), // Se houver múltiplos, separar por vírgula
        cidade: cidades.join(', '), // Se houver múltiplos, separar por vírgula
      }))
      .sort((a, b) => {
        // Ordenar por data (converter DD/MM de volta para comparação)
        const [diaA, mesA] = a.date.split('/').map(Number)
        const [diaB, mesB] = b.date.split('/').map(Number)
        if (mesA !== mesB) return mesA - mesB
        return diaA - diaB
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

