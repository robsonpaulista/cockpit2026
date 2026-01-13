import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { fetchMunicipiosPiaui } from '@/lib/services/ibge'

export async function POST() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar municípios do IBGE
    const municipios = await fetchMunicipiosPiaui()

    console.log(`Sincronizando ${municipios.length} municípios do IBGE...`)

    // Preparar dados para inserção
    const citiesData = municipios.map((m) => ({
      id: `ibge-${m.id}`, // Usar prefixo para evitar conflitos
      name: m.name,
      state: m.state,
      macro_region: m.mesorregiao,
      priority: 0,
      // microrregiao será adicionada via migration se necessário
    }))

    // Inserir/atualizar no banco
    // Como o id é PRIMARY KEY, podemos usar upsert direto
    // Se a constraint UNIQUE(name,state) não existir, vamos inserir e tratar duplicatas
    const { data, error } = await supabase
      .from('cities')
      .upsert(citiesData, {
        onConflict: 'id', // Usar id como chave de conflito (PRIMARY KEY)
      })
      .select()

    if (error) {
      console.error('Erro ao sincronizar municípios:', error)
      console.error('Detalhes do erro:', JSON.stringify(error, null, 2))
      return NextResponse.json({ 
        error: error.message,
        details: error,
        municipiosCount: municipios.length
      }, { status: 500 })
    }

    const insertedCount = data?.length || 0

    return NextResponse.json({
      message: `${insertedCount} municípios sincronizados`,
      count: insertedCount,
      total: municipios.length,
      data: data?.slice(0, 10), // Retornar apenas os primeiros 10 para não sobrecarregar
    })
  } catch (error) {
    console.error('Erro ao sincronizar municípios do IBGE:', error)
    return NextResponse.json(
      { error: 'Erro ao sincronizar municípios' },
      { status: 500 }
    )
  }
}


