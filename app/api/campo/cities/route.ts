import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { fetchMunicipiosPiaui } from '@/lib/services/ibge'

export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    // Buscar cidades do banco
    const { data: citiesFromDB, error: dbError } = await supabase
      .from('cities')
      .select('*')
      .order('priority', { ascending: false })
      .order('name', { ascending: true })

    if (dbError) {
      console.error('Erro ao buscar cidades do banco:', dbError)
      // Se houver erro, tentar buscar do IBGE diretamente
      try {
        const municipiosIBGE = await fetchMunicipiosPiaui()
        return NextResponse.json(municipiosIBGE.map(m => ({
          id: m.id,
          name: m.name,
          state: m.state,
          macro_region: m.mesorregiao,
          priority: 0,
        })))
      } catch (ibgeError) {
        return NextResponse.json({ error: dbError.message }, { status: 500 })
      }
    }

    // Se não houver cidades no banco, buscar do IBGE
    if (!citiesFromDB || citiesFromDB.length === 0) {
      try {
        const municipiosIBGE = await fetchMunicipiosPiaui()
        
        // Inserir no banco para próxima vez
        await supabase.from('cities').upsert(
          municipiosIBGE.map((m) => ({
            id: `ibge-${m.id}`,
            name: m.name,
            state: m.state,
            macro_region: m.mesorregiao,
            priority: 0,
          })),
          { onConflict: 'name,state' }
        )

        return NextResponse.json(
          municipiosIBGE.map((m) => ({
            id: `ibge-${m.id}`,
            name: m.name,
            state: m.state,
            macro_region: m.mesorregiao,
            priority: 0,
          }))
        )
      } catch (ibgeError) {
        return NextResponse.json({ error: 'Erro ao buscar municípios' }, { status: 500 })
      }
    }

    return NextResponse.json(citiesFromDB)
  } catch (error) {
    console.error('Erro ao buscar cidades:', error)
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

