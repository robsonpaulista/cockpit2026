'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'

const MapaTerritoriosDesenvolvimentoLeaflet = dynamic(
  () =>
    import('@/components/mapa-territorios-desenvolvimento-leaflet').then((mod) => ({
      default: mod.MapaTerritoriosDesenvolvimentoLeaflet,
    })),
  { ssr: false, loading: () => <CockpitMapaPlaceholder /> }
)

function CockpitMapaPlaceholder() {
  return (
    <div
      className="flex h-full min-h-[280px] w-full animate-pulse items-center justify-center rounded-lg bg-bg-surface/80"
      aria-hidden
    >
      <p className="text-xs text-text-muted">Carregando mapa…</p>
    </div>
  )
}

type CockpitTerritorioMapEmbedProps = {
  /** Quando false, só o mapa (ex.: modal já tem título). */
  showHeader?: boolean
  /** Altura mínima do bloco do mapa (Tailwind arbitrary). */
  minMapHeightClass?: string
}

/**
 * Mesmo mapa Leaflet da rota Mapa TDs (aba Mapa Eleitoral), embutido no Cockpit.
 */
export function CockpitTerritorioMapEmbed({
  showHeader = true,
  minMapHeightClass = 'min-h-[min(52vh,520px)]',
}: CockpitTerritorioMapEmbedProps) {
  const { appearance } = useTheme()
  const mapLight = appearance === 'light'

  return (
    <div className={cn('flex min-h-0 min-w-0 w-full flex-1 flex-col gap-2', showHeader && 'mt-3')}>
      {showHeader ? (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">
            Mapa de territórios (TDs)
          </p>
          <Link
            href="/dashboard/territorio/mapa-tds"
            className="inline-flex items-center gap-1 text-[10px] font-medium text-accent-gold hover:underline"
          >
            Abrir página do mapa
            <ExternalLink className="h-3 w-3 shrink-0 opacity-80" aria-hidden />
          </Link>
        </div>
      ) : null}
      <div
        className={cn(
          'theme-futuristic relative flex w-full min-w-0 flex-1 flex-col overflow-hidden rounded-lg border border-border-card bg-bg-app',
          minMapHeightClass,
          mapLight && 'theme-futuristic--republicanos-light'
        )}
      >
        <MapaTerritoriosDesenvolvimentoLeaflet
          key="cockpit-mapa-eleitoral"
          visualPreset="futuristic"
          visualTheme={mapLight ? 'light' : 'dark'}
          painelContext="eleitoral"
        />
      </div>
    </div>
  )
}
