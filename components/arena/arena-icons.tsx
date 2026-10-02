'use client'

import {
  Award,
  Crown,
  Heart,
  Lock,
  MessageSquare,
  Shield,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ArenaSourcePill } from '@/components/arena/arena-shell'

export type ArenaScoreKind = 'comentario' | 'cedo' | 'curtida' | 'fidelidade'

const SCORE_META: Record<
  ArenaScoreKind,
  { label: string; Icon: LucideIcon }
> = {
  comentario: { label: 'Comentários', Icon: MessageSquare },
  cedo: { label: 'Comentar cedo', Icon: Zap },
  curtida: { label: 'Curtidas', Icon: Heart },
  fidelidade: { label: 'Fidelidade', Icon: Shield },
}

export function ArenaScoreIcon({
  kind,
  className,
}: {
  kind: ArenaScoreKind
  className?: string
}) {
  const { Icon } = SCORE_META[kind]
  return <Icon className={cn('h-4 w-4', className)} strokeWidth={1.5} aria-hidden />
}

export function ArenaBreakdownRow({
  kind,
  label,
  subtitle,
  trailing,
  source,
}: {
  kind: ArenaScoreKind
  label?: string
  subtitle: string
  trailing?: React.ReactNode
  source?: 'api_oficial' | 'scraper' | 'interno'
}) {
  const meta = SCORE_META[kind]
  return (
    <li>
      <span className="arena-breakdown__icon">
        <ArenaScoreIcon kind={kind} />
      </span>
      <div>
        <p className="arena-breakdown__label">{label ?? meta.label}</p>
        <p className="arena-breakdown__sub">{subtitle}</p>
      </div>
      {trailing ?? (source ? <ArenaSourcePill kind={source} /> : null)}
    </li>
  )
}

export function ArenaCrownIcon({ className }: { className?: string }) {
  return (
    <Crown
      className={cn('mx-auto h-5 w-5 text-[var(--cx-amber,#e8a825)]', className)}
      strokeWidth={1.5}
      aria-hidden
    />
  )
}

export function ArenaBadgeGlyph({ unlocked }: { unlocked: boolean }) {
  const Icon = unlocked ? Award : Lock
  return (
    <Icon
      className={cn(
        'mx-auto h-5 w-5',
        unlocked ? 'text-[var(--cx-ink,#14161a)]' : 'text-[var(--cx-label,#969692)]',
      )}
      strokeWidth={1.5}
      aria-hidden
    />
  )
}
