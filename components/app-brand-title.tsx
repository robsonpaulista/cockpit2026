import { cn } from '@/lib/utils'
import {
  APP_BRAND_TAGLINE,
  brandWordmarkClass,
  brandWordmarkTaglineClass,
  sidebarBrandLogoMarkClass,
} from '@/lib/sidebar-brand-styles'
import { typographyPageLeadClass } from '@/lib/typography-chrome'

export const APP_BRAND_LEAD = 'Gestão integrada de campanha e monitoramento'

/** Cliente / campanha ativa (opcional na sidebar). */
export const APP_ACTIVE_CLIENT_LABEL = ''

export type AppBrandWordmarkSize = 'xs' | 'sm' | 'md' | 'lg' | 'sidebar'

const WORDMARK_SIZE: Record<
  AppBrandWordmarkSize,
  { main: string; tag: string }
> = {
  xs: { main: 'text-[13px]', tag: 'mt-0.5 text-[7px] tracking-[0.2em]' },
  sm: { main: 'text-[15px]', tag: 'mt-0.5 text-[8px] tracking-[0.18em]' },
  md: { main: 'text-[17px] sm:text-[18px]', tag: 'mt-0.5 text-[9px] tracking-[0.16em]' },
  lg: {
    main: 'text-[22px] sm:text-[26px] lg:text-[28px] tracking-[-0.05em]',
    tag: 'mt-1 text-[10px] tracking-[0.14em]',
  },
  sidebar: {
    main: 'text-[1.55rem] leading-[0.95] tracking-[-0.01em]',
    tag: 'mt-2 text-[7px] leading-snug tracking-[0.12em]',
  },
}

type WordmarkTone = 'default' | 'onGradient' | 'onAmber'

function wordmarkTone({
  lightOnGradient,
  lightOnAmber,
}: {
  lightOnGradient?: boolean
  lightOnAmber?: boolean
}): WordmarkTone {
  if (lightOnGradient) return 'onGradient'
  if (lightOnAmber) return 'onAmber'
  return 'default'
}

function wordmarkColors(tone: WordmarkTone) {
  if (tone === 'onGradient') {
    return { cockpit: 'text-white', year: 'text-[#c99a2e]' }
  }
  if (tone === 'onAmber') {
    // Mobile (header âmbar): texto claro. Desktop (header claro / sidebar light): COCKPIT preto + 2026 âmbar.
    return {
      cockpit: 'text-text-primary max-lg:text-white',
      year: 'text-[#c99a2e] max-lg:text-white/90',
    }
  }
  // Sidebar escura / superfícies escuras
  return { cockpit: 'text-[#c99a2e]', year: 'text-white' }
}

/** Wordmark COCK + PIT — tipografia bold, duas cores, sem ícone. */
export function AppBrandWordmark({
  size = 'sm',
  showTagline = false,
  lightOnGradient,
  lightOnAmber,
  compact = false,
  fullWidth = false,
  className,
}: {
  size?: AppBrandWordmarkSize
  showTagline?: boolean
  lightOnGradient?: boolean
  lightOnAmber?: boolean
  /** Monograma CP para sidebar recolhida. */
  compact?: boolean
  /** Ocupa toda a largura do container (sidebar expandida). */
  fullWidth?: boolean
  className?: string
}) {
  const tone = wordmarkTone({ lightOnGradient, lightOnAmber })
  const colors = wordmarkColors(tone)
  const sizes = WORDMARK_SIZE[size]

  if (compact) {
    return (
      <span
        className={cn(sidebarBrandLogoMarkClass, className)}
        aria-label="Cockpit 2026"
      >
        <span className={colors.cockpit}>C</span>
        <span className={colors.year}>P</span>
      </span>
    )
  }

  return (
    <span
      className={cn(
        'min-w-0 flex-col',
        fullWidth ? 'flex w-full' : 'inline-flex',
        className,
      )}
    >
      <span
        className={cn(
          brandWordmarkClass,
          sizes.main,
          fullWidth ? 'block w-full whitespace-nowrap text-center' : 'truncate whitespace-nowrap',
        )}
        aria-label="Cockpit 2026"
      >
        <span className={colors.cockpit}>COCKPIT</span>
        <span className={cn(colors.year, 'font-medium')}> 2026</span>
      </span>
      {showTagline ? (
        <span
          className={cn(
            brandWordmarkTaglineClass,
            sizes.tag,
            fullWidth && 'block w-full text-center',
            tone === 'onGradient' && 'text-white/55',
            tone === 'onAmber' && 'max-lg:text-white/70',
          )}
        >
          {APP_BRAND_TAGLINE}
        </span>
      ) : null}
    </span>
  )
}

/** @deprecated Use AppBrandWordmark compact — mantido para imports existentes. */
export function SidebarBrandMark({
  className,
  lightOnGradient,
}: {
  className?: string
  lightOnGradient?: boolean
}) {
  return (
    <AppBrandWordmark compact lightOnGradient={lightOnGradient} className={className} />
  )
}

export function AppBrandTitle({
  isCockpit: _isCockpit,
  lightOnGradient,
  lightOnAmber,
  showTagline,
  size,
  className,
}: {
  isCockpit: boolean
  lightOnGradient?: boolean
  lightOnAmber?: boolean
  showTagline?: boolean
  size?: AppBrandWordmarkSize
  className?: string
}) {
  return (
    <AppBrandWordmark
      size={size ?? 'md'}
      showTagline={showTagline}
      lightOnGradient={lightOnGradient}
      lightOnAmber={lightOnAmber}
      className={className}
    />
  )
}

/** Bloco de marca na sidebar — wordmark tipográfico. */
export function SidebarBrandHeader({
  clientLabel = APP_ACTIVE_CLIENT_LABEL,
  className,
  lightOnGradient,
}: {
  clientLabel?: string
  className?: string
  lightOnGradient?: boolean
}) {
  return (
    <div className={cn('flex min-w-0 w-full flex-col items-center text-center', className)}>
      <AppBrandWordmark
        size="sidebar"
        showTagline
        fullWidth
        lightOnGradient={lightOnGradient}
        className="items-center text-center"
      />
      {clientLabel ? (
        <p className={cn('mt-1 line-clamp-2', typographyPageLeadClass)}>{clientLabel}</p>
      ) : null}
    </div>
  )
}

/** Título + linha de detalhe (alinha com headers de página). */
export function AppBrandHeader({
  isCockpit: _isCockpit,
  lightOnGradient,
  className,
  lead = APP_BRAND_LEAD,
  variant = 'page',
  clientLabel = APP_ACTIVE_CLIENT_LABEL,
}: {
  isCockpit: boolean
  lightOnGradient?: boolean
  className?: string
  lead?: string
  variant?: 'page' | 'sidebar'
  clientLabel?: string
}) {
  if (variant === 'sidebar' && !lightOnGradient) {
    return (
      <SidebarBrandHeader
        clientLabel={clientLabel}
        className={className}
        lightOnGradient={lightOnGradient}
      />
    )
  }

  return (
    <div className={cn('min-w-0', className)}>
      <AppBrandWordmark
        size={lightOnGradient ? 'md' : 'sm'}
        showTagline={lightOnGradient}
        lightOnGradient={lightOnGradient}
      />
      {lead ? (
        <p
          className={cn(
            'mt-1 line-clamp-2',
            lightOnGradient
              ? 'text-[13px] leading-relaxed text-white/65'
              : typographyPageLeadClass,
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  )
}
