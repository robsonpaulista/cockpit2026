import { cn } from '@/lib/utils'
import { APP_BRAND_MANDATO_SUBTITLE, brandWordmarkClass } from '@/lib/sidebar-brand-styles'

/** Marca OPÇÃO B: selo CX + COCKPIT X / Gestão de Mandato (cabe nos 52px do topo). */
export function TopbarBrandBlock({
  className,
  compact = false,
  size = 'sm',
}: {
  className?: string
  /** Só o selo CX (sidebar recolhida). */
  compact?: boolean
  /** `lg` para hero (ex.: boas-vindas). */
  size?: 'sm' | 'lg'
}) {
  const grande = size === 'lg'

  if (compact) {
    return (
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-[#333333]',
          grande ? 'h-10 w-10' : 'h-7 w-7',
          className,
        )}
        aria-label="Cockpit X"
        data-brand-wordmark="cockpit-x"
        data-topbar-brand="cx"
      >
        <span
          className={cn('leading-none tracking-tight', grande ? 'text-[13px]' : 'text-[10px]')}
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
      className={cn('flex min-w-0 items-center', grande ? 'gap-3' : 'gap-2', className)}
      data-brand-wordmark="cockpit-x"
      data-topbar-brand="full"
    >
      <span
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-full bg-[#333333]',
          grande ? 'h-12 w-12' : 'h-8 w-8',
        )}
        aria-hidden
        data-topbar-brand="cx"
      >
        <span
          className={cn('leading-none tracking-tight', grande ? 'text-[15px]' : 'text-[11px]')}
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
      <span className="min-w-0 flex flex-col justify-center leading-none text-left">
        <span
          className={cn(
            brandWordmarkClass,
            'truncate text-[#333333]',
            grande ? 'text-[22px] sm:text-[26px]' : 'text-[13px]',
          )}
          aria-label="Cockpit X"
          style={{ fontFamily: 'var(--font-michroma), ui-sans-serif, system-ui, sans-serif' }}
        >
          <span data-cx-mark="cockpit">COCKPIT</span>
          <span data-cx-mark="x" className="ml-[0.22em]">
            X
          </span>
        </span>
        <span
          className={cn(
            'truncate font-semibold uppercase tracking-[0.12em] text-black',
            grande ? 'mt-1.5 text-[10px] sm:text-[11px]' : 'mt-0.5 text-[8px]',
          )}
          data-topbar-brand="subtitle"
        >
          {APP_BRAND_MANDATO_SUBTITLE}
        </span>
      </span>
    </div>
  )
}
