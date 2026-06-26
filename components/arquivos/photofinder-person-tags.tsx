import {
  PHOTOFINDER_PERSON_TAG_SEPARATOR,
  splitPersonTags,
} from '@/lib/photofinder/person-tags'
import { cn } from '@/lib/utils'

interface PhotofinderPersonTagsProps {
  value: string | null | undefined
  className?: string
  badgeClassName?: string
  emptyLabel?: string
  /** inline = badges lado a lado; stack = um nome por linha (melhor em cards estreitos) */
  layout?: 'inline' | 'stack'
  /** Estilo claro para overlay sobre a imagem */
  variant?: 'default' | 'on-image'
}

export function PhotofinderPersonTags({
  value,
  className,
  badgeClassName,
  emptyLabel,
  layout = 'inline',
  variant = 'default',
}: PhotofinderPersonTagsProps) {
  const names = splitPersonTags(value)

  if (names.length === 0) {
    return emptyLabel ? <span className={className}>{emptyLabel}</span> : null
  }

  const isOnImage = variant === 'on-image'
  const multi = names.length > 1

  return (
    <span
      className={cn(
        multi && layout === 'stack'
          ? 'flex w-full flex-col items-start gap-0.5'
          : 'inline-flex min-w-0 flex-wrap gap-1',
        className,
      )}
      title={names.join(PHOTOFINDER_PERSON_TAG_SEPARATOR)}
    >
      {names.map((name, index) => (
        <span
          key={`${name}-${index}`}
          className={cn(
            multi || isOnImage
              ? cn(
                  'inline-flex max-w-full break-words rounded-md px-1.5 py-0.5 text-[11px] font-medium',
                  isOnImage
                    ? 'bg-black/55 text-white'
                    : 'bg-[#C8900A]/10 text-[#C8900A]',
                )
              : 'break-words font-medium text-text-primary',
            badgeClassName,
          )}
        >
          {name}
        </span>
      ))}
    </span>
  )
}
