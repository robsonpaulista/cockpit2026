'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { getMapaFuturisticChrome, MOBILIZACAO_MAPA_DIGITAL_IG_ROUTE } from '@/lib/dashboard-mapa-futuristic-chrome'
import { cn } from '@/lib/utils'

const MapaTerritoriosDesenvolvimentoLeaflet = dynamic(
  () =>
    import('@/components/mapa-territorios-desenvolvimento-leaflet').then(
      (mod) => mod.MapaTerritoriosDesenvolvimentoLeaflet,
    ),
  { ssr: false, loading: () => <MapaPlaceholder /> }
)

const ABA_QUERY = 'aba'
const TEMA_QUERY = 'tema'

export type MapaTdsTabId = 'mapa-eleitoral' | 'pesquisas'
function MapaPlaceholder() {
  return (
    <div
      className="mapa-tds-placeholder h-full min-h-0 w-full animate-pulse rounded-xl bg-bg-surface"
      aria-hidden
    />
  )
}

function parseTab(raw: string | null): MapaTdsTabId {
  if (raw === 'pesquisas') return 'pesquisas'
  return 'mapa-eleitoral'
}

export default function MapaTdsTabsClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { appearance, theme } = useTheme()
  const isCockpit = false
  const temaQuery = searchParams.get(TEMA_QUERY)

  /** Mapa Digital IG passou para Mobilização; preserva query string (ex.: `tema`). */
  useEffect(() => {
    if (searchParams.get(ABA_QUERY) !== 'mapa-digital-ig') return
    const p = new URLSearchParams(searchParams.toString())
    p.delete(ABA_QUERY)
    const q = p.toString()
    router.replace(q ? `${MOBILIZACAO_MAPA_DIGITAL_IG_ROUTE}?${q}` : MOBILIZACAO_MAPA_DIGITAL_IG_ROUTE, {
      scroll: false,
    })
  }, [router, searchParams])

  const tab = useMemo(() => parseTab(searchParams.get(ABA_QUERY)), [searchParams])

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

  const tituloPagina =
    tab === 'pesquisas' ? 'Mapa Pesquisas' : 'Mapa de Dominância Eleitoral'
  const subtituloPagina =
    tab === 'pesquisas'
      ? 'Territórios de desenvolvimento — mesma visão do mapa eleitoral, com coloração e marcadores pela média de intenção (dados da página Pesquisa).'
      : 'Territórios de desenvolvimento — peso eleitoral, planilha e projeções.'

  const tabButtonActiveClass = sidebarPrimaryCTAButtonClass(
    isCockpit,
    'rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm'
  )
  const tabButtonInactiveClass = cn(
    'rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-text-secondary transition-all duration-200 sm:text-sm',
    chrome.isChromeIgAligned
      ? 'hover:bg-white/[0.06] hover:text-white/95'
      : 'hover:bg-accent-gold-soft/35 hover:text-text-primary'
  )

  const setTab = useCallback(
    (next: MapaTdsTabId) => {
      const p = new URLSearchParams(searchParams.toString())
      if (next === 'mapa-eleitoral') {
        p.delete(ABA_QUERY)
      } else {
        p.set(ABA_QUERY, next)
      }
      const q = p.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
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
            <h1 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">{tituloPagina}</h1>
            <p className="mt-1 text-xs text-text-secondary sm:text-sm">{subtituloPagina}</p>
          </div>
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <nav className={chrome.tabRailClass} aria-label="Camadas do mapa TDs">
              <button
                type="button"
                onClick={() => setTab('mapa-eleitoral')}
                className={tab === 'mapa-eleitoral' ? tabButtonActiveClass : tabButtonInactiveClass}
              >
                Mapa Eleitoral
              </button>
              <button
                type="button"
                onClick={() => setTab('pesquisas')}
                className={tab === 'pesquisas' ? tabButtonActiveClass : tabButtonInactiveClass}
              >
                Pesquisas
              </button>
            </nav>
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
          {tab === 'mapa-eleitoral' ? (
            <MapaTerritoriosDesenvolvimentoLeaflet
              key="mapa-eleitoral"
              visualPreset="futuristic"
              visualTheme={chrome.visualTheme}
              painelContext="eleitoral"
            />
          ) : (
            <MapaTerritoriosDesenvolvimentoLeaflet
              key="pesquisas"
              visualPreset="futuristic"
              visualTheme={chrome.visualTheme}
              painelContext="pesquisas"
            />
          )}
        </div>
      </div>
    </div>
  )
}
