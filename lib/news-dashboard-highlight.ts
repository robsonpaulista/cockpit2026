import type { SupabaseClient } from '@supabase/supabase-js'

/** Mesmo limite usado no resumo operacional e no painel de notícias. */
export const DASHBOARD_HIGHLIGHT_MAX = 5

type HighlightRow = {
  id: string
  collected_at: string | null
  published_at: string | null
}

function highlightSortMs(row: HighlightRow): number {
  const raw = row.collected_at || row.published_at
  if (!raw) return 0
  return new Date(raw).getTime()
}

/**
 * Ao marcar uma nova notícia como destaque do painel, remove o destaque da mais antiga
 * se já houver `DASHBOARD_HIGHLIGHT_MAX` itens (exceto a própria notícia sendo marcada).
 */
export async function enforceDashboardHighlightLimit(
  supabase: SupabaseClient,
  newsIdBeingHighlighted: string
): Promise<{ demotedId: string | null }> {
  const { data, error } = await supabase
    .from('news')
    .select('id, collected_at, published_at')
    .eq('dashboard_highlight', true)

  if (error) {
    if (error.message?.includes('dashboard_highlight')) {
      return { demotedId: null }
    }
    throw error
  }

  const highlighted = (data ?? []) as HighlightRow[]
  const others = highlighted.filter((row) => row.id !== newsIdBeingHighlighted)

  if (others.length < DASHBOARD_HIGHLIGHT_MAX) {
    return { demotedId: null }
  }

  const oldest = [...others].sort((a, b) => highlightSortMs(a) - highlightSortMs(b))[0]
  if (!oldest) return { demotedId: null }

  const { error: updateError } = await supabase
    .from('news')
    .update({ dashboard_highlight: false })
    .eq('id', oldest.id)

  if (updateError) throw updateError

  return { demotedId: oldest.id }
}
