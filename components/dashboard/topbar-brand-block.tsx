import { cn } from '@/lib/utils'
import { APP_BRAND_MANDATO_SUBTITLE, brandWordmarkClass } from '@/lib/sidebar-brand-styles'

/** Marca OPÇÃO B: selo CX + COCKPIT X / Gestão de Mandato (cabe nos 52px do topo). */
export function TopbarBrandBlock({
  className,
  compact = false,
}: {
  className?: string
  /** Só o selo CX (sidebar recolhida). */
  compact?: boolean
}) {
  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#333333]',
          className,
        )}
        aria-label="Cockpit X"
        data-brand-wordmark="cockpit-x"
        data-topbar-brand="cx"
      >
        <span
          className="text-[11px] leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-michroma), ui-sans-serif, system-ui, sans-serif' }}
        >
          <span data-cx-mark="cockpit" className="text-[var(--cockpit-top-bg,#EBB402)]">
            C
          </span>
          <span data-cx-mark="x" className="text-[var(--cockpit-top-bg,#EBB402)]">
            X
          </span>
        </span>
      </span>
    )
  }

  return (
    <div
      className={cn('flex min-w-0 items-center gap-2', className)}
      data-brand-wordmark="cockpit-x"
      data-topbar-brand="full"
    >
      <span
        className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#333333]"
        aria-hidden
        data-topbar-brand="cx"
      >
        <span
          className="text-[11px] leading-none tracking-tight"
          style={{ fontFamily: 'var(--font-michroma), ui-sans-serif, system-ui, sans-serif' }}
        >
          <span data-cx-mark="cockpit" className="text-[var(--cockpit-top-bg,#EBB402)]">
            C
          </span>
          <span data-cx-mark="x" className="text-[var(--cockpit-top-bg,#EBB402)]">
            X
          </span>
        </span>
      </span>
      <span className="min-w-0 flex flex-col justify-center leading-none">
        <span
          className={cn(brandWordmarkClass, 'truncate text-[13px] text-[#333333]')}
          aria-label="Cockpit X"
          style={{ fontFamily: 'var(--font-michroma), ui-sans-serif, system-ui, sans-serif' }}
        >
          <span data-cx-mark="cockpit">COCKPIT</span>
          <span data-cx-mark="x" className="ml-[0.22em]">
            X
          </span>
        </span>
        <span
          className="mt-0.5 truncate text-[8px] font-semibold uppercase tracking-[0.12em] text-black"
          data-topbar-brand="subtitle"
        >
          {APP_BRAND_MANDATO_SUBTITLE}
        </span>
      </span>
    </div>
  )
}
