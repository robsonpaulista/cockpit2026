import { LayoutDashboard } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sidebarBrandLogoMarkClass } from '@/lib/sidebar-brand-styles'
import { typographyPageLeadClass, typographyPageTitleClass } from '@/lib/typography-chrome'

export const APP_BRAND_LEAD = 'Gestão integrada de campanha e monitoramento'

/** Cliente / campanha ativa (opcional na sidebar). */
export const APP_ACTIVE_CLIENT_LABEL = ''

export function SidebarBrandMark({ className }: { className?: string }) {
  return (
    <span className={cn(sidebarBrandLogoMarkClass, className)} aria-hidden>
      <LayoutDashboard className="h-3.5 w-3.5" strokeWidth={2.25} />
    </span>
  )
}

/** Mesmo bloco tipográfico do topo da sidebar (nome da aplicação). */
export function AppBrandTitle({
  isCockpit,
  lightOnGradient,
  className,
}: {
  isCockpit: boolean
  /** Texto claro sobre o gradiente dourado da home (sidebar/header). */
  lightOnGradient?: boolean
  className?: string
}) {
  return (
    <span
      className={cn(
        typographyPageTitleClass,
        lightOnGradient &&
          'text-[#00D4FF] drop-shadow-[0_0_14px_rgba(0,212,255,0.35)]',
        !lightOnGradient &&
          isCockpit &&
          'bg-[linear-gradient(135deg,#6c7bff_0%,#8e6cfd_35%,#5ed3ff_75%,#3fbac2_100%)] bg-clip-text text-transparent [text-shadow:0_6px_18px_rgba(10,18,28,0.22)]',
        !lightOnGradient && !isCockpit && 'text-text-primary',
        className,
      )}
    >
      Cockpit 2026
    </span>
  )
}

/** Bloco de marca na sidebar — logo mark + nome. */
export function SidebarBrandHeader({
  clientLabel = APP_ACTIVE_CLIENT_LABEL,
  className,
}: {
  clientLabel?: string
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-start gap-2.5', className)}>
      <SidebarBrandMark />
      <div className="min-w-0 flex-1">
        <h1 className={typographyPageTitleClass}>Cockpit 2026</h1>
        {clientLabel ? (
          <p className={cn('mt-1 line-clamp-2', typographyPageLeadClass)}>{clientLabel}</p>
        ) : null}
      </div>
    </div>
  )
}

/** Título + linha de detalhe (alinha com headers de página). */
export function AppBrandHeader({
  isCockpit,
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
    return <SidebarBrandHeader clientLabel={clientLabel} className={className} />
  }

  return (
    <div className={cn('min-w-0', className)}>
      <AppBrandTitle isCockpit={isCockpit} lightOnGradient={lightOnGradient} />
      {lead ? (
        <p
          className={cn(
            'mt-1 line-clamp-2',
            lightOnGradient
              ? 'text-[13px] leading-relaxed text-white/65'
              : typographyPageLeadClass
          )}
        >
          {lead}
        </p>
      ) : null}
    </div>
  )
}
