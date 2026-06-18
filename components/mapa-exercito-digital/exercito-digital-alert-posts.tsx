'use client'

import { IconCheck, IconX } from '@tabler/icons-react'
import type { ExercitoDigitalAlertPost } from '@/lib/mapa-exercito-digital-types'
import type { ExercitoDigitalAudience } from '@/lib/mandatos-instagram-piaui'
import { formatInt } from '@/lib/mapa-exercito-digital-aggregator'
import {
  exercitoAlertCardClass,
  exercitoAlertGridClass,
  exercitoSectionCardClass,
  exercitoSectionSubtitleClass,
  exercitoSectionTitleClass,
} from '@/lib/mapa-exercito-digital-layout'
import { cn } from '@/lib/utils'

interface ExercitoDigitalAlertPostsProps {
  posts: ExercitoDigitalAlertPost[]
  audience: ExercitoDigitalAudience
}

const badgeClass: Record<ExercitoDigitalAlertPost['status'], string> = {
  Crítico: 'border border-[#F09595] bg-[#FCEBEB] text-[#A32D2D]',
  Atenção: 'border border-[#FAC775] bg-[#FAEEDA] text-[#854F0B]',
}

export function ExercitoDigitalAlertPosts({ posts, audience }: ExercitoDigitalAlertPostsProps) {
  if (posts.length === 0) return null

  const visible = posts.slice(0, 4)

  return (
    <section className={exercitoSectionCardClass}>
      <h2 className={exercitoSectionTitleClass}>Publicações que precisam de atenção</h2>
      <p className={cn(exercitoSectionSubtitleClass, 'mb-3')}>
        {visible.length} publicação{visible.length === 1 ? '' : 'ões'} com ativação abaixo do esperado
      </p>
      <div className={exercitoAlertGridClass}>
        {visible.map((post) => (
          <div key={post.id} className={exercitoAlertCardClass('px-3.5 py-3')}>
            <div className="flex items-start gap-2.5">
              <span
                className={cn(
                  'mt-px shrink-0 rounded-[99px] px-[7px] py-0.5 text-[10px] font-medium',
                  badgeClass[post.status]
                )}
              >
                {post.status}
              </span>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-xs font-medium leading-[1.4] text-text-primary">{post.title}</p>
                <p className="mt-0.5 text-[11px] text-text-muted">{post.meta}</p>
              </div>
            </div>
            <div className="mt-auto flex flex-wrap items-center gap-2 pt-2">
              <span className="inline-flex items-center gap-1 text-[11px] text-[#3B6D11]">
                <IconCheck className="h-3 w-3" stroke={1.5} aria-hidden />
                {formatInt(post.ativados)}{' '}
                {audience === 'mandatos'
                  ? post.ativados === 1
                    ? 'mandatário ativou'
                    : 'mandatários ativaram'
                  : post.ativados === 1
                    ? 'líder ativou'
                    : 'líderes ativaram'}
              </span>
              <span className="inline-flex items-center gap-1 text-[11px] text-[#A32D2D]">
                <IconX className="h-3 w-3" stroke={1.5} aria-hidden />
                {formatInt(post.naoAtivados)} não ativaram
              </span>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
