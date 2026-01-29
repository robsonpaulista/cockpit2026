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

    // Preparar dados para inserção
    const obrasToInsert = obras.map((obra: any) => ({
      nome_obra: obra.nome_obra || obra.Nome || obra.nome || '',
      localizacao: obra.localizacao || obra.Localização || obra.localizacao || null,
      cidade: obra.cidade || obra.Cidade || null,
      estado: obra.estado || obra.Estado || null,
      tipo_obra: obra.tipo_obra || obra.Tipo || obra.tipo || null,
      status: obra.status || obra.Status || null,
      data_inicio: obra.data_inicio || obra['Data Início'] || obra.dataInicio || null,
      data_prevista_conclusao: obra.data_prevista_conclusao || obra['Data Prevista'] || obra.dataPrevista || null,
      data_conclusao: obra.data_conclusao || obra['Data Conclusão'] || obra.dataConclusao || null,
      valor_orcado: obra.valor_orcado || obra['Valor Orçado'] || obra.valorOrcado || null,
      valor_executado: obra.valor_executado || obra['Valor Executado'] || obra.valorExecutado || null,
      percentual_execucao: obra.percentual_execucao || obra['% Execução'] || obra.percentualExecucao || null,
      responsavel: obra.responsavel || obra.Responsável || obra.responsavel || null,
      observacoes: obra.observacoes || obra.Observações || obra.observacoes || null,
    })).filter((obra: any) => obra.nome_obra) // Filtrar obras sem nome

    if (obrasToInsert.length === 0) {
      return NextResponse.json(
        { error: 'Nenhuma obra válida para importar' },
        { status: 400 }
      )
    }

    // Inserir obras no banco
    const { data, error } = await supabase
      .from('obras')
      .insert(obrasToInsert)
      .select()

    if (error) {
      console.error('Erro ao importar obras:', error)
      return NextResponse.json(
        { error: 'Erro ao importar obras' },
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
