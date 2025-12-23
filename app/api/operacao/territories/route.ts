import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const supabase = await createClient()
    const user = await supabase.auth.getUser()

    if (!user.data.user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('territories')
      .select('*')
      .order('name')

    if (error) {
      console.error('Erro ao buscar territórios:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json(data || [])
  } catch (error) {
    console.error('Erro ao buscar territórios:', error)
    return NextResponse.json(
      { error: 'Erro ao buscar territórios' },
      { status: 500 }
    )
  }
}


