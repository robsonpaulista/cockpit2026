import type { LucideIcon } from 'lucide-react'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  conteudoRedesAmberTextClass,
  conteudoRedesAmberTintBgClass,
  conteudoRedesTextClass,
} from '@/lib/conteudo-redes-styles'

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
        <Icon className={cn('h-3.5 w-3.5 shrink-0', conteudoRedesAmberTextClass)} />
        <span className={cn('text-[12px] font-medium', conteudoRedesTextClass)}>{title}</span>
      </div>

      {!post || metricValue == null || metricValue <= 0 ? (
        <p className={cn('py-6 text-center text-[11px]', conteudoRedesTextClass)}>{emptyMessage}</p>
      ) : (
        <div className="space-y-2">
          <div className="relative h-24 w-full overflow-hidden rounded-lg bg-background">
            {post.thumbnail ? (
              <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className={cn('flex h-full items-center justify-center text-[11px]', conteudoRedesTextClass)}>
                Sem preview
              </div>
            )}
            <div className="absolute right-1 top-1 rounded bg-[#ff9800] px-2 py-0.5 text-[10px] font-medium text-white tabular-nums">
              {metricValue.toLocaleString('pt-BR')}
            </div>
          </div>
          <p className={cn('line-clamp-2 text-[11px]', conteudoRedesTextClass)}>
            {post.caption || 'Sem legenda'}
          </p>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1 text-[11px] font-medium hover:underline', conteudoRedesAmberTextClass)}
          >
            <ExternalLink className="h-3 w-3" />
            Ver postagem
          </a>
        </div>
      )}
    </div>
  )
}
