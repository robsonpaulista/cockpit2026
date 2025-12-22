import { createClient } from '@/lib/supabase/server'
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

    // Inserir/atualizar no banco
    const { data, error } = await supabase
      .from('cities')
      .upsert(
        municipios.map((m) => ({
          id: `ibge-${m.id}`, // Usar prefixo para evitar conflitos
          name: m.name,
          state: m.state,
          macro_region: m.mesorregiao,
        })),
        {
          onConflict: 'name,state',
          ignoreDuplicates: false,
        }
      )
      .select()

    if (error) {
      console.error('Erro ao sincronizar municípios:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({
      message: `${municipios.length} municípios sincronizados`,
      count: municipios.length,
      data,
    })
  } catch (error) {
    console.error('Erro ao sincronizar municípios do IBGE:', error)
    return NextResponse.json(
      { error: 'Erro ao sincronizar municípios' },
      { status: 500 }
    )
  }
}


