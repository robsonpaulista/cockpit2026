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
  panelClassName = 'rounded-[18px] border border-[#ebe8e4] bg-white p-3.5 shadow-[0_1px_2px_rgba(28,25,23,0.03)]',
  emptyMessage = 'Sem dados',
}: ChampionPostCardProps) {
  return (
    <div className={cn(panelClassName, 'overflow-hidden')}>
      <div className="mb-3 flex items-center gap-2 border-b border-[#ebe8e4] pb-2.5">
        <Icon className="h-3.5 w-3.5 shrink-0 text-[#78716c]" strokeWidth={1.75} />
        <span className="text-[12px] font-medium text-[#57534e]">{title}</span>
      </div>

      {!post || metricValue == null || metricValue <= 0 ? (
        <p className="py-6 text-center text-[12px] text-[#a8a29e]">{emptyMessage}</p>
      ) : (
        <div className="space-y-2.5">
          <div className="relative h-24 w-full overflow-hidden rounded-xl bg-[#fafaf8]">
            {post.thumbnail ? (
              <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-[#a8a29e]">
                Sem preview
              </div>
            )}
            <div className="absolute right-1.5 top-1.5 rounded-md bg-white/95 px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[#1c1917] shadow-sm">
              {metricValue.toLocaleString('pt-BR')}
            </div>
          </div>
          <p className="line-clamp-2 text-[12px] leading-snug text-[#57534e]">
            {post.caption || 'Sem legenda'}
          </p>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[12px] font-medium text-[#c27803] hover:text-[#a16207]"
          >
            <ExternalLink className="h-3 w-3" />
            Ver postagem
          </a>
        </div>
      )}
    </div>
  )
}
