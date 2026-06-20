import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createClient } from '@/lib/supabase/server'
import { isYoutubeApiConfigured } from '@/lib/youtube-data-api'
import { parseTermsInput, slugFromPoliticalName } from '@/lib/youtube-radar-slug'
import { normalizeInstagramUsername } from '@/lib/instagram-radar-username'
import type { PoliticalActorType } from '@/lib/youtube-radar-types'

export const dynamic = 'force-dynamic'

const createActorSchema = z.object({
  name: z.string().trim().min(2).max(120),
  actor_type: z.enum(['own_candidate', 'competitor', 'ally', 'other']).default('competitor'),
  terms: z.union([z.array(z.string()), z.string()]).optional(),
  notes: z.string().trim().max(500).optional(),
  instagram_username: z.string().trim().max(80).nullable().optional(),
})

async function uniqueSlug(
  supabase: ReturnType<typeof createClient>,
  base: string
): Promise<string> {
  let slug = base || 'candidato'
  let n = 0
  for (;;) {
    const candidate = n === 0 ? slug : `${slug}-${n}`
    const { data } = await supabase.from('political_actors').select('id').eq('slug', candidate).maybeSingle()
    if (!data) return candidate
    n += 1
  }
}

export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('political_actors')
      .select(
        `
        id,
        name,
        slug,
        actor_type,
        active,
        notes,
        instagram_username,
        created_at,
        updated_at,
        youtube_search_terms (
          id,
          politico_id,
          term,
          active,
          priority,
          created_at,
          updated_at
        )
      `
      )
      .order('name', { ascending: true })

    if (error) {
      if (error.message.includes('does not exist') || error.code === '42P01') {
        return NextResponse.json({
          configured: isYoutubeApiConfigured(),
          actors: [],
          setupRequired: true,
        })
      }
      throw new Error(error.message)
    }

    return NextResponse.json({
      configured: isYoutubeApiConfigured(),
      actors: data ?? [],
      setupRequired: false,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Erro ao carregar atores'
    return NextResponse.json({ error: msg }, { status: 500 })
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

    const body = createActorSchema.parse(await request.json())
    const terms = Array.isArray(body.terms) ? parseTermsInput(body.terms.join('\n')) : parseTermsInput(body.terms ?? body.name)

    if (terms.length === 0) {
      return NextResponse.json({ error: 'Informe ao menos um termo de busca.' }, { status: 400 })
    }

    const slug = await uniqueSlug(supabase, slugFromPoliticalName(body.name))
    const igUser = body.instagram_username !== undefined
      ? normalizeInstagramUsername(body.instagram_username)
      : null

    const { data: actor, error: actorError } = await supabase
      .from('political_actors')
      .insert({
        name: body.name,
        slug,
        actor_type: body.actor_type as PoliticalActorType,
        active: true,
        notes: body.notes ?? null,
        instagram_username: igUser,
      })
      .select('id, name, slug, actor_type, active, notes, instagram_username, created_at, updated_at')
      .single()

    if (actorError) throw new Error(actorError.message)

    const termRows = terms.map((term, i) => ({
      politico_id: actor.id,
      term,
      active: true,
      priority: i + 1,
    }))

    const { data: insertedTerms, error: termsError } = await supabase
      .from('youtube_search_terms')
      .insert(termRows)
      .select('id, politico_id, term, active, priority, created_at, updated_at')

    if (termsError) {
      await supabase.from('political_actors').delete().eq('id', actor.id)
      throw new Error(termsError.message)
    }

    return NextResponse.json({
      actor: { ...actor, youtube_search_terms: insertedTerms ?? [] },
    })
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: e.errors[0]?.message ?? 'Dados inválidos' }, { status: 400 })
    }
    const msg = e instanceof Error ? e.message : 'Erro ao criar candidato'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
