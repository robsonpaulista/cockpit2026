/** Política de retenção de dados históricos (dias). */
export const DATA_RETENTION_DAYS = 60

export type RetentionTableId = 'news' | 'google_news_mentions' | 'instagram_comments'

export type RetentionPurgeTarget = {
  id: RetentionTableId
  table: string
  /** Expressão SQL da data de referência para o registro. */
  dateExpr: string
  label: string
}

export const RETENTION_PURGE_TARGETS: RetentionPurgeTarget[] = [
  {
    id: 'news',
    table: 'news',
    dateExpr: 'COALESCE(published_at, collected_at)',
    label: 'Notícias (Google Alerts / feeds)',
  },
  {
    id: 'google_news_mentions',
    table: 'google_news_mentions',
    dateExpr: 'COALESCE(published_at, collected_at)',
    label: 'Menções Google Notícias (radar)',
  },
  {
    id: 'instagram_comments',
    table: 'instagram_comments',
    dateExpr: 'commented_at',
    label: 'Comentários Instagram',
  },
]

export function retentionCutoffIso(days = DATA_RETENTION_DAYS): string {
  const cutoff = new Date()
  cutoff.setUTCDate(cutoff.getUTCDate() - days)
  return cutoff.toISOString()
}

export function retentionCutoffSql(days = DATA_RETENTION_DAYS): string {
  return `NOW() - INTERVAL '${days} days'`
}
