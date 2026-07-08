import type { ObraFaseMapa, ObraMapaTema } from '@/lib/obras-mapa'
import { cn } from '@/lib/utils'

interface ObraFaseIconProps {
  fase: ObraFaseMapa
  tema?: ObraMapaTema
  size?: number
  className?: string
}

export function ObraFaseIcon({ fase, tema = 'asfalto', size = 18, className }: ObraFaseIconProps) {
  const props = {
    viewBox: '0 0 24 24',
    width: size,
    height: size,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.75,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    className: cn('shrink-0', className),
    'aria-hidden': true,
  }

  if (tema === 'quadras-esportivas') {
    switch (fase) {
      case 'em_andamento':
        return (
          <svg {...props}>
            <rect x="4" y="6" width="16" height="12" rx="1.5" />
            <path d="M12 6v12" />
            <circle cx="12" cy="12" r="2.2" />
            <path d="M4 10h3" />
            <path d="M17 14h3" />
          </svg>
        )
      case 'finalizada':
        return (
          <svg {...props}>
            <rect x="4" y="8" width="12" height="10" rx="1.5" />
            <path d="M10 8V6.5a1.5 1.5 0 0 1 1.5-1.5H14" />
            <circle cx="17.5" cy="7" r="4" fill="currentColor" fillOpacity="0.18" />
            <path d="M16 7l1 1 2-2" />
          </svg>
        )
      case 'a_iniciar':
        return (
          <svg {...props}>
            <rect x="4" y="9" width="16" height="9" rx="1.5" strokeDasharray="3 2" />
            <path d="M12 9v9" strokeDasharray="3 2" />
            <circle cx="17.5" cy="6.5" r="3.5" />
            <path d="M17.5 4.8v2.2" />
          </svg>
        )
      default:
        return (
          <svg {...props}>
            <rect x="5" y="7" width="14" height="11" rx="1.5" />
            <path d="M12 7v11" />
            <circle cx="12" cy="12.5" r="1.5" />
          </svg>
        )
    }
  }

  switch (fase) {
    case 'em_andamento':
      return (
        <svg {...props}>
          <path d="M2 17h20" />
          <path d="M4 17v-2.5c0-.8.6-1.5 1.4-1.5h1.2" />
          <path d="M20 17v-2.5c0-.8-.6-1.5-1.4-1.5h-1.2" />
          <rect x="7" y="8" width="10" height="5.5" rx="1" />
          <path d="M9 8V6.5a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6.5V8" />
          <circle cx="6.5" cy="17.5" r="2" />
          <circle cx="17.5" cy="17.5" r="2" />
          <path d="M10 13.5h4" strokeDasharray="2 1.5" />
        </svg>
      )
    case 'finalizada':
      return (
        <svg {...props}>
          <path d="M3 18h18" />
          <path d="M5 15h14" opacity="0.55" />
          <path d="M7 12h10" opacity="0.35" />
          <circle cx="17" cy="7" r="4.5" fill="currentColor" fillOpacity="0.18" />
          <path d="M15.2 7l1.2 1.2 2.6-2.6" />
        </svg>
      )
    case 'a_iniciar':
      return (
        <svg {...props}>
          <path d="M3 18h18" strokeDasharray="4 3" />
          <circle cx="12" cy="8.5" r="5.5" />
          <path d="M12 6.2v3.1" />
          <path d="M12 11.8v.1" />
        </svg>
      )
    default:
      return (
        <svg {...props}>
          <path d="M3 17h18" />
          <path d="M6 14h12" />
          <path d="M9 11h6" />
          <path d="M12 4v3" />
          <circle cx="12" cy="4" r="1.2" fill="currentColor" />
        </svg>
      )
  }
}
