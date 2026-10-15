import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { requireMobilizacaoAccess } from '@/lib/mobilizacao-require-access'
import { normalizeInstagramHandle } from '@/lib/mobilizacao-lead-capture'
import { pontuarPerfis, type ComentarioArena } from '@/lib/arena/pontuacao'
import { intervaloDoPeriodo } from '@/lib/arena/periodo'
import type { ArenaIntervalo, ArenaPerfil, ArenaPerfilPapel } from '@/lib/arena/types'

export const dynamic = 'force-dynamic'

const DATA_ISO = /^\d{4}-\d{2}-\d{2}$/
const COMENTARIOS_PAGE = 1000

type PerfilDbRow = {
  id: string
  nome: string
  instagram: string
  papel: ArenaPerfilPapel
  cidade: string | null
  regiao: string | null
}

type ComentarioRow = {
  instagram_comment_id: string
  commenter_username: string | null
  instagram_media_id: string
  comment_text: string | null
  comment_like_count: number | null
  media_posted_at: string | null
  commented_at: string
}

function lerIntervalo(params: URLSearchParams): ArenaIntervalo {
  const inicio = params.get('inicio')
  const fim = params.get('fim')
  if (inicio && fim && DATA_ISO.test(inicio) && DATA_ISO.test(fim) && inicio <= fim) {
    return { inicio, fim }
  }
  return intervaloDoPeriodo('tudo', null, null)
}

/** Comentários do período (dos perfis da Arena) e total de posts publicados no período. */
async function carregarComentarios(
  admin: ReturnType<typeof createAdminClient>,
  intervalo: ArenaIntervalo,
  handles: Set<string>,
): Promise<{ comentarios: ComentarioArena[]; postsNoPeriodo: number }> {
  const desde = `${intervalo.inicio}T00:00:00-03:00`
  const ate = `${intervalo.fim}T23:59:59.999-03:00`
  const desdeMs = new Date(desde).getTime()
  const ateMs = new Date(ate).getTime()
  const comentarios: ComentarioArena[] = []
  const vistos = new Set<string>()
  const posts = new Set<string>()
  let from = 0
  for (;;) {
    const { data, error } = await admin
      .from('instagram_comments')
      .select(
        'instagram_comment_id, commenter_username, instagram_media_id, comment_text, comment_like_count, media_posted_at, commented_at'
      )
      .gte('commented_at', desde)
      .lte('commented_at', ate)
      .order('commented_at', { ascending: true })
      .range(from, from + COMENTARIOS_PAGE - 1)
    if (error) throw error
    const rows = (data ?? []) as ComentarioRow[]
    for (const row of rows) {
      const postadoMs = row.media_posted_at ? new Date(row.media_posted_at).getTime() : NaN
      if (postadoMs >= desdeMs && postadoMs <= ateMs) posts.add(row.instagram_media_id)
      const handle = normalizeInstagramHandle(row.commenter_username)
      if (!handle || !handles.has(handle) || vistos.has(row.instagram_comment_id)) continue
      vistos.add(row.instagram_comment_id)
      comentarios.push({
        id: row.instagram_comment_id,
        handle,
        mediaId: row.instagram_media_id,
        texto: row.comment_text,
        curtidas: row.comment_like_count ?? 0,
        postadoEm: row.media_posted_at,
        comentadoEm: row.commented_at,
      })
    }
    if (rows.length < COMENTARIOS_PAGE) break
    from += COMENTARIOS_PAGE
  }
  return { comentarios, postsNoPeriodo: posts.size }
}

/**
 * Perfis da Arena com a pontuação do período, calculada pelas métricas da Arena
 * sobre os comentários sincronizados do Instagram (atualiza a cada sincronização).
 */
export async function GET(request: Request) {
  const ctx = await requireMobilizacaoAccess()
  if (!ctx.ok) return ctx.response

  const params = new URL(request.url).searchParams
  const papelParam = params.get('papel')
  const papel: ArenaPerfilPapel | null =
    papelParam === 'lideranca' || papelParam === 'liderado' ? papelParam : null
  const intervalo = lerIntervalo(params)

  const admin = createAdminClient()
  const { data, error } = await admin
    .from('arena_perfis')
    .select('id, nome, instagram, papel, cidade, regiao')
    .order('nome', { ascending: true })
  if (error) {
    console.error('[api/arena/perfis]', error)
    return NextResponse.json({ error: 'Erro ao carregar perfis da arena' }, { status: 500 })
  }
  const rows = (data ?? []) as PerfilDbRow[]

  let pontuacao: ReturnType<typeof pontuarPerfis>
  let postsNoPeriodo = 0
  try {
    const handles = rows.map((r) => r.instagram)
    const carregado = await carregarComentarios(admin, intervalo, new Set(handles))
    postsNoPeriodo = carregado.postsNoPeriodo
    pontuacao = pontuarPerfis({
      handles,
      comentarios: carregado.comentarios,
      postsNoPeriodo,
      ate: intervalo.fim,
    })
  } catch (e) {
    console.error('[api/arena/perfis] pontuação', e)
    return NextResponse.json({ error: 'Erro ao calcular a pontuação do período' }, { status: 500 })
  }

  const ranking = rows
    .map((r) => ({ ...r, ...pontuacao.get(r.instagram)! }))
    .sort((a, b) => b.pontos - a.pontos || a.nome.localeCompare(b.nome, 'pt-BR'))
  const perfis: ArenaPerfil[] = ranking
    .map((r, i) => ({ ...r, posicao: i + 1 }))
    .filter((p) => !papel || p.papel === papel)

  return NextResponse.json({ perfis, intervalo, postsNoPeriodo })
}
