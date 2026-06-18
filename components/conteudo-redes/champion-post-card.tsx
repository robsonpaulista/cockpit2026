import type { LucideIcon } from 'lucide-react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'

type ChampionPost = {
  thumbnail?: string
  caption?: string
  url: string
  metrics: {
    likes: number
    comments: number
    views?: number
    shares?: number
    saves?: number
    engagement: number
  }
}

type ChampionPostCardProps = {
  title: string
  icon: LucideIcon
  post: ChampionPost | null
  metricValue: number | null
  panelClassName?: string
  emptyMessage?: string
}

export function ChampionPostCard({
  title,
  icon: Icon,
  post,
  metricValue,
  panelClassName = 'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-3',
  emptyMessage = 'Sem dados',
}: ChampionPostCardProps) {
  return (
    <div className={cn(panelClassName, 'overflow-hidden')}>
      <div className="mb-2 flex items-center gap-2 border-b border-[rgb(var(--color-border-tertiary)/0.85)] pb-2">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[rgb(var(--color-primary))]" />
        <span className="text-[12px] font-medium text-text-primary">{title}</span>
      </div>

      {!post || metricValue == null || metricValue <= 0 ? (
        <p className="py-6 text-center text-[11px] text-text-muted">{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          <div className="relative h-24 w-full overflow-hidden rounded-lg bg-background">
            {post.thumbnail ? (
              <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[11px] text-text-muted">
                Sem preview
              </div>
            )}
            <div className="absolute right-1 top-1 rounded bg-[rgb(var(--color-primary))] px-2 py-0.5 text-[10px] font-medium text-white tabular-nums">
              {metricValue.toLocaleString('pt-BR')}
            </div>
          </div>
          <p className="line-clamp-2 text-[11px] text-text-secondary">
            {post.caption || 'Sem legenda'}
          </p>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-medium text-[rgb(var(--color-primary))] hover:underline"
          >
            <ExternalLink className="h-3 w-3" />
            Ver postagem
          </a>
        </div>
      )}
    </div>
  )
}
