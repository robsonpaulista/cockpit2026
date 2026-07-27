'use client'

import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  IconBookmark,
  IconEye,
  IconHeart,
  IconMessageCircle,
  IconPhoto,
  IconShare,
  IconX,
} from '@tabler/icons-react'
import { formatWarRoomNumber } from '@/lib/war-room/format'
import { cn } from '@/lib/utils'

export type WarRoomPostagemDiaItem = {
  id: string
  header: string
  theme: string
  timeLabel: string
  views: number
  engagement: number
  likes: number
  comments: number
  shares: number
  saves: number
}

type Props = {
  posts: WarRoomPostagemDiaItem[]
  onClose: () => void
}

/** Modal das postagens do dia — visual clean alinhado ao card Redes sociais. */
export function WarRoomPostagensDiaModal({ posts, onClose }: Props) {
  const tituloId = useId()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className="wr-visita-modal" role="presentation">
      <button
        type="button"
        className="wr-visita-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="wr-visita-modal__panel wr-postagens-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <IconPhoto className="h-4 w-4" stroke={1.75} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">Redes sociais · Instagram</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                Postagens do dia ({posts.length})
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <IconX className="h-4 w-4" stroke={1.75} />
          </button>
        </header>

        <p className="wr-visita-modal__lead">
          Cabeçalho da legenda e números gerais de engajamento de cada publicação de hoje.
        </p>

        {posts.length === 0 ? (
          <p className="wr-visita-modal__state">Nenhuma publicação de hoje.</p>
        ) : (
          <ul className="wr-postagens-modal__list">
            {posts.map((post) => (
              <li key={post.id} className="wr-postagens-modal__item">
                <div className="wr-postagens-modal__item-head">
                  <p className="wr-postagens-modal__header">{post.header}</p>
                  <p className="wr-postagens-modal__meta">
                    {post.theme}
                    {post.timeLabel ? ` · ${post.timeLabel}` : ''}
                  </p>
                </div>
                <dl className="wr-postagens-modal__metrics">
                  <div>
                    <dt>
                      <IconEye className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
                      Visualizações
                    </dt>
                    <dd className="tabular-nums">{formatWarRoomNumber(post.views)}</dd>
                  </div>
                  <div>
                    <dt>
                      <IconHeart className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
                      Curtidas
                    </dt>
                    <dd className="tabular-nums">{formatWarRoomNumber(post.likes)}</dd>
                  </div>
                  <div>
                    <dt>
                      <IconMessageCircle className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
                      Comentários
                    </dt>
                    <dd className="tabular-nums">{formatWarRoomNumber(post.comments)}</dd>
                  </div>
                  <div>
                    <dt>
                      <IconShare className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
                      Compartilhamentos
                    </dt>
                    <dd className="tabular-nums">{formatWarRoomNumber(post.shares)}</dd>
                  </div>
                  <div>
                    <dt>
                      <IconBookmark className="h-3.5 w-3.5" stroke={1.75} aria-hidden />
                      Salvamentos
                    </dt>
                    <dd className="tabular-nums">{formatWarRoomNumber(post.saves)}</dd>
                  </div>
                  <div className={cn(post.engagement > 0 && 'wr-postagens-modal__metric--destaque')}>
                    <dt>Engajamento</dt>
                    <dd className="tabular-nums">{formatWarRoomNumber(post.engagement)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>,
    document.body,
  )
}
