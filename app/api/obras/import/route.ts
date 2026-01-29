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

    // Preparar dados para inserção - mapear colunas do Excel
    const obrasToInsert = obras.map((obra: any) => ({
      municipio: obra.Municipio || obra.municipio || null,
      obra: obra.Obra || obra.obra || obra.nome_obra || obra.Nome || '',
      orgao: obra['Orgão'] || obra.Orgão || obra.orgao || obra.Orgao || null,
      sei: obra.SEI || obra.sei || null,
      sei_medicao: obra['SEI MEDIÇÃO'] || obra['SEI MEDICAO'] || obra.sei_medicao || obra.SEI_MEDICAO || null,
      status: obra.Status || obra.status || null,
      publicacao_os: obra['PUBLICAÇÃO DA OS'] || obra['PUBLICAÇÃO DA OS'] || obra.publicacao_os || obra.PUBLICACAO_OS || null,
      solicitacao_medicao: obra['Solicitação Medição'] || obra['Solicitação Medicao'] || obra.solicitacao_medicao || obra.Solicitacao_Medicao || null,
      data_medicao: obra['Data Medição'] || obra['Data Medicao'] || obra.data_medicao || obra.Data_Medicao || null,
      status_medicao: obra['Status Medição'] || obra['Status Medicao'] || obra.status_medicao || obra.Status_Medicao || null,
      valor_total: obra['Valor Total'] || obra.Valor_Total || obra.valor_total || obra.valorTotal || null,
    })).filter((obra: any) => obra.obra) // Filtrar obras sem nome

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
