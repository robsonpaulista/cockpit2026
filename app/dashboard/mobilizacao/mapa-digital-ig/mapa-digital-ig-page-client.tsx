'use client'

import dynamic from 'next/dynamic'
import { useMemo } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { getMapaFuturisticChrome } from '@/lib/dashboard-mapa-futuristic-chrome'
import { MapaDigitalIgSyncToolbar } from '@/components/mapa-digital-ig-sync-toolbar'
import { MapaDigitalIgRelatorioCheckExport } from '@/components/mapa-digital-ig-relatorio-check-export'
import { cn } from '@/lib/utils'

const MapaTerritoriosDesenvolvimentoLeaflet = dynamic(
  () =>
    import('@/components/mapa-territorios-desenvolvimento-leaflet').then((mod) => ({
      default: mod.MapaTerritoriosDesenvolvimentoLeaflet,
    })),
  { ssr: false, loading: () => <MapaPlaceholder /> }
)

const TEMA_QUERY = 'tema'

function MapaPlaceholder() {
  return (
    <div
      className="mapa-tds-placeholder h-full min-h-0 w-full animate-pulse rounded-xl bg-bg-surface"
      aria-hidden
    />
  )
}

export default function MapaDigitalIgMobilizacaoPageClient() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { appearance, theme } = useTheme()
  const temaQuery = searchParams.get(TEMA_QUERY)

  const chrome = useMemo(
    () =>
      getMapaFuturisticChrome({
        pathname: pathname ?? null,
        theme,
        appearance,
        temaQuery,
      }),
    [pathname, theme, appearance, temaQuery]
  )

  return (
    <div
      className={cn(
        'flex min-h-0 w-full min-w-0 flex-1 flex-col text-text-primary',
        chrome.mapaShellBgClass
      )}
    >
      <header
        className={cn(
          'shrink-0 border-b px-3 pb-2 pt-3 sm:px-5 sm:pb-2.5 sm:pt-3.5 md:px-6',
          chrome.headerDividerClass,
          chrome.mapaShellBgClass
        )}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">
              Mapa Exército Digital
            </h1>
            <p className="mt-1 text-xs text-text-secondary sm:text-sm">
              Territórios de desenvolvimento — engajamento digital e mobilização (Instagram).
            </p>
          </div>
          <div className={chrome.igToolsRailClass}>
            <MapaDigitalIgRelatorioCheckExport
              exportPiTodas
              visualPreset="futuristic"
              visualTheme={chrome.visualTheme}
              className={chrome.isChromeIgAligned ? 'border-0 bg-transparent p-0 shadow-none' : undefined}
            />
            <MapaDigitalIgSyncToolbar className="sm:justify-end" visualTheme={chrome.visualTheme} />
          </div>
        </div>
      </header>
      <div
        className={cn(
          'theme-futuristic relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-x-visible',
          chrome.mapaShellBgClass,
          chrome.isRepublicanosLight && 'theme-futuristic--republicanos-light'
        )}
      >
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-visible">
          <MapaTerritoriosDesenvolvimentoLeaflet
            key="mapa-digital-ig-mobilizacao"
            visualPreset="futuristic"
            visualTheme={chrome.visualTheme}
            painelContext="digitalIg"
            igViewMode="operacao"
          />
        </div>
      </div>
    </div>
  )
}
