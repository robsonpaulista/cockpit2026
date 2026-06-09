import { cn } from '@/lib/utils'

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
        'text-[1.16rem] font-semibold tracking-[0.024em]',
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
