import { buildGoogleNewsCompareRows } from '@/lib/google-news-aggregate'
import type { GoogleNewsMentionWithActor } from '@/lib/google-news-types'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

export type NoticiasDesempenhoRow = {
  id: string
  slug: string
  nome: string
  qtde: number
  portal: string
  portalCount: number
}

/**
 * Ranking por candidato: Nome, Qtde de matérias e portal mais frequente.
 */
export function buildNoticiasDesempenhoRows(
  actors: PoliticalActorWithTerms[],
  mentions: GoogleNewsMentionWithActor[],
): NoticiasDesempenhoRow[] {
  return buildGoogleNewsCompareRows(actors, mentions)
    .map((row) => {
      const top = row.topSources[0]
      return {
        id: row.actor.id,
        slug: row.actor.slug,
        nome: row.actor.name,
        qtde: row.articleCount,
        portal: top?.source_name ?? '—',
        portalCount: top?.count ?? 0,
      }
    })
    .sort(
      (a, b) =>
        b.qtde - a.qtde || a.nome.localeCompare(b.nome, 'pt-BR'),
    )
}
