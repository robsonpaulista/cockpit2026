import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const pollSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), // YYYY-MM-DD
  instituto: z.string().min(1),
  candidato_nome: z.string().min(1),
  tipo: z.enum(['estimulada', 'espontanea']),
  cargo: z.enum(['dep_estadual', 'dep_federal', 'governador', 'senador', 'presidente']),
  cidade_id: z.string().optional().nullable(),
  intencao: z.number().min(0).max(100),
  rejeicao: z.number().min(0).max(100),
})

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const cargo = searchParams.get('cargo')
    const tipo = searchParams.get('tipo')
    const limit = parseInt(searchParams.get('limit') || '50')

    let query = supabase
      .from('polls')
      .select(`
        *,
        cities (
          id,
          name
        )
      `)
      .eq('user_id', user.id) // user.id é o mesmo que auth.uid()
      .order('data', { ascending: false })
      .limit(limit)

    if (cargo) {
      query = query.eq('cargo', cargo)
    }

    if (tipo) {
      query = query.eq('tipo', tipo)
    }

    const { data, error } = await query

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
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

    const body = await request.json()
    const validated = pollSchema.parse(body)

    // Validar cidade_id se fornecido
    let cidadeId = null
    if (validated.cidade_id && validated.cidade_id.trim() !== '') {
      const cidadeIdValue = validated.cidade_id.trim()
      
      // Verificar se a cidade existe (tentar com o valor exato e também com prefixo ibge-)
      let { data: cityExists, error: cityError } = await supabase
        .from('cities')
        .select('id')
        .or(`id.eq.${cidadeIdValue},id.eq.ibge-${cidadeIdValue}`)
        .maybeSingle()

      // Se não encontrou e a tabela está vazia, tentar sincronizar
      if (!cityExists) {
        const { count } = await supabase
          .from('cities')
          .select('*', { count: 'exact', head: true })

        if (count === 0) {
          // Tabela vazia, sincronizar do IBGE
          const { fetchMunicipiosPiaui } = await import('@/lib/services/ibge')
          const municipios = await fetchMunicipiosPiaui()
          
          await supabase.from('cities').upsert(
            municipios.map((m) => ({
              id: `ibge-${m.id}`,
              name: m.name,
              state: m.state,
              macro_region: m.mesorregiao,
              priority: 0,
            })),
            { onConflict: 'name,state' }
          )

          // Tentar encontrar novamente
          const { data: cityExistsAfterSync } = await supabase
            .from('cities')
            .select('id')
            .or(`id.eq.${cidadeIdValue},id.eq.ibge-${cidadeIdValue}`)
            .maybeSingle()

          if (cityExistsAfterSync) {
            cidadeId = cityExistsAfterSync.id
          } else {
            return NextResponse.json(
              { 
                error: 'Cidade não encontrada após sincronização',
                details: `ID enviado: ${cidadeIdValue}`
              },
              { status: 400 }
            )
          }
        } else {
          // Cidade realmente não existe
          console.error('Cidade não encontrada:', {
            cidadeIdEnviado: cidadeIdValue,
            error: cityError,
          })
          return NextResponse.json(
            { 
              error: 'Cidade não encontrada',
              details: `ID enviado: ${cidadeIdValue}. Verifique se a cidade foi sincronizada.`
            },
            { status: 400 }
          )
        }
      } else {
        cidadeId = cityExists.id // Usar o ID que realmente existe no banco
      }
    }

    const insertData = {
      ...validated,
      user_id: user.id, // user.id é o mesmo que auth.uid()
      cidade_id: cidadeId,
    }

    const { data, error } = await supabase
      .from('polls')
      .insert(insertData)
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data, { status: 201 })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

