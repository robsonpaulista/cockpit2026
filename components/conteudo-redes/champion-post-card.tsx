import type { LucideIcon } from 'lucide-react'
import { ExternalLink } from 'lucide-react'
import { tseLinkAcaoClass } from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'

type ChampionPost = {
  thumbnail?: string
  caption?: string
  url: string
}

type ChampionPostCardProps = {
  title: string
  icon: LucideIcon
  post: ChampionPost | null
  metricValue: number | null
}

export function ChampionPostCard({ title, icon: Icon, post, metricValue }: ChampionPostCardProps) {
  return (
    <div className="overflow-hidden rounded-xl border border-[var(--tse-border)] bg-white">
      <div className="flex items-center gap-2 bg-[var(--tse-bar)] px-3 py-2">
        <Icon className="h-4 w-4 shrink-0 text-[var(--tse-gold-text)]" />
        <span className="text-[12px] font-bold uppercase tracking-wide">{title}</span>
      </div>

      {!post || metricValue == null || metricValue <= 0 ? (
        <p className="py-8 text-center text-[12px] text-[var(--tse-muted)]">Sem dados</p>
      ) : (
        <div className="space-y-2 p-3">
          <div className="relative h-28 w-full overflow-hidden rounded-lg bg-[var(--tse-bar)]">
            {post.thumbnail ? (
              <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full items-center justify-center text-[12px] text-[var(--tse-muted)]">
                Sem preview
              </div>
            )}
            <span className="absolute right-1.5 top-1.5 rounded-full bg-[var(--tse-yellow)] px-2.5 py-0.5 text-[12px] font-black tabular-nums text-white shadow-sm">
              {metricValue.toLocaleString('pt-BR')}
            </span>
          </div>
          <p className="line-clamp-2 text-[12px] leading-snug">{post.caption || 'Sem legenda'}</p>
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className={cn('inline-flex items-center gap-1', tseLinkAcaoClass)}
          >
            <ExternalLink className="h-3 w-3" />
            Ver postagem
          </a>
        </div>
      )}
    </div>
  )
}
