import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const updatePollSchema = z.object({
  data: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  instituto: z.string().min(1).optional(),
  candidato_nome: z.string().min(1).optional(),
  tipo: z.enum(['estimulada', 'espontanea']).optional(),
  cargo: z.enum(['dep_estadual', 'dep_federal', 'governador', 'senador', 'presidente']).optional(),
  cidade_id: z.string().optional().nullable(),
  intencao: z.number().min(0).max(100).optional(),
  rejeicao: z.number().min(0).max(100).optional(),
})

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('polls')
      .select(`
        *,
        cities (
          id,
          name
        )
      `)
      .eq('id', params.id)
      .eq('user_id', user.id) // user.id é o mesmo que auth.uid()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Pesquisa não encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = await request.json()
    const validated = updatePollSchema.parse(body)

    // Validar cidade_id se fornecido
    let cidadeId = undefined
    if (validated.cidade_id !== undefined) {
      if (validated.cidade_id && validated.cidade_id.trim() !== '') {
        const cidadeIdValue = validated.cidade_id.trim()
        
        // Verificar se a cidade existe (tentar com o valor exato e também com prefixo ibge-)
        const { data: cityExists, error: cityError } = await supabase
          .from('cities')
          .select('id')
          .or(`id.eq.${cidadeIdValue},id.eq.ibge-${cidadeIdValue}`)
          .maybeSingle()

        if (cityExists) {
          cidadeId = cityExists.id // Usar o ID que realmente existe no banco
        } else {
          // Log para debug
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
        cidadeId = null
      }
    }

    const updateData = {
      ...validated,
      cidade_id: cidadeId,
    }

    const { data, error } = await supabase
      .from('polls')
      .update(updateData)
      .eq('id', params.id)
      .eq('user_id', user.id) // user.id é o mesmo que auth.uid()
      .select()
      .single()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (!data) {
      return NextResponse.json({ error: 'Pesquisa não encontrada' }, { status: 404 })
    }

    return NextResponse.json(data)
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

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { error } = await supabase
      .from('polls')
      .delete()
      .eq('id', params.id)
      .eq('user_id', user.id) // user.id é o mesmo que auth.uid()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Erro interno do servidor' },
      { status: 500 }
    )
  }
}

