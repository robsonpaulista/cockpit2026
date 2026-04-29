'use client'

import dynamic from 'next/dynamic'
import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTheme } from '@/contexts/theme-context'
import { isMapaTdsShellRepublicanosLight } from '@/lib/mapa-tds-shell-light'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { cn } from '@/lib/utils'
import { MapaDigitalIgSyncToolbar } from '@/components/mapa-digital-ig-sync-toolbar'
import { MapaDigitalIgRelatorioCheckExport } from '@/components/mapa-digital-ig-relatorio-check-export'
const MapaTerritoriosDesenvolvimentoLeaflet = dynamic(
  () =>
    import('@/components/mapa-territorios-desenvolvimento-leaflet').then((mod) => ({
      default: mod.MapaTerritoriosDesenvolvimentoLeaflet,
    })),
  { ssr: false, loading: () => <MapaPlaceholder /> }
)

const ABA_QUERY = 'aba'
const TEMA_QUERY = 'tema'
const IG_VIEW_QUERY = 'ig_view'

export type MapaTdsTabId = 'mapa-eleitoral' | 'mapa-digital-ig' | 'pesquisas'
type IgViewMode = 'analise' | 'operacao'

function MapaPlaceholder() {
  return (
    <div
      className="mapa-tds-placeholder h-full min-h-0 w-full animate-pulse rounded-xl bg-bg-surface"
      aria-hidden
    />
  )
}

function parseTab(raw: string | null): MapaTdsTabId {
  if (raw === 'mapa-digital-ig') return 'mapa-digital-ig'
  if (raw === 'pesquisas') return 'pesquisas'
  return 'mapa-eleitoral'
}

function parseIgViewMode(raw: string | null): IgViewMode {
  return raw === 'operacao' ? 'operacao' : 'analise'
}

export default function MapaTdsTabsClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { appearance, theme } = useTheme()
  const isCockpit = theme === 'cockpit'

  const tab = useMemo(() => parseTab(searchParams.get(ABA_QUERY)), [searchParams])
  const igViewMode = useMemo(() => parseIgViewMode(searchParams.get(IG_VIEW_QUERY)), [searchParams])
  const isRepublicanosLight = useMemo(
    () => isMapaTdsShellRepublicanosLight(pathname, searchParams.get(TEMA_QUERY), appearance),
    [pathname, searchParams, appearance]
  )
  const mapaShellBrancoForcado =
    appearance === 'dark' && searchParams.get(TEMA_QUERY) === 'republicanos-claro'
  /** Cockpit escuro: mesmo fundo da `.sidebar-cockpit-shell` para não “quebrar” na junção com a sidebar. */
  const mapaShellBgClass =
    mapaShellBrancoForcado || isRepublicanosLight
      ? 'bg-white'
      : isCockpit && appearance === 'dark'
        ? 'bg-[rgba(17,26,40,0.88)]'
        : 'bg-bg-sidebar'

  const tituloPagina =
    tab === 'mapa-digital-ig'
      ? 'Mapa Exército Digital'
      : tab === 'pesquisas'
        ? 'Mapa Pesquisas'
        : 'Mapa de Dominância Eleitoral'
  const subtituloPagina =
    tab === 'mapa-digital-ig'
      ? 'Territórios de desenvolvimento — engajamento digital e mobilização (Instagram).'
      : tab === 'pesquisas'
        ? 'Territórios de desenvolvimento — mesma visão do mapa eleitoral, com coloração e marcadores pela média de intenção (dados da página Pesquisa).'
        : 'Territórios de desenvolvimento — peso eleitoral, planilha e projeções.'

  const tabButtonActiveClass = sidebarPrimaryCTAButtonClass(
    isCockpit,
    'rounded-lg px-3 py-2 text-xs font-semibold sm:text-sm'
  )
  const tabButtonInactiveClass = cn(
    'rounded-lg border border-transparent px-3 py-2 text-xs font-medium text-text-secondary transition-all duration-200 sm:text-sm',
    'hover:bg-accent-gold-soft/35 hover:text-text-primary'
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

  const setIgViewMode = useCallback(
    (next: IgViewMode) => {
      const p = new URLSearchParams(searchParams.toString())
      p.set(IG_VIEW_QUERY, next)
      const q = p.toString()
      router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
    },
    [router, pathname, searchParams]
  )

  return (
    <div
      className={cn(
        'flex h-[calc(100dvh-5.25rem)] min-h-[480px] w-full min-w-0 flex-col text-text-primary max-lg:h-[calc(100dvh-6.25rem)]',
        mapaShellBgClass
      )}
    >
      <header className={cn('shrink-0 border-b border-border-card/80 px-3 pb-2 pt-3 sm:px-5 sm:pb-2.5 sm:pt-3.5 md:px-6', mapaShellBgClass)}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-text-primary sm:text-xl">{tituloPagina}</h1>
            <p className="mt-1 text-xs text-text-secondary sm:text-sm">{subtituloPagina}</p>
          </div>
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <nav
              className="flex min-w-0 shrink-0 flex-wrap gap-1 rounded-xl border border-border-card bg-bg-surface p-1 shadow-sm"
              aria-label="Camadas do mapa TDs"
            >
              <button
                type="button"
                onClick={() => setTab('mapa-eleitoral')}
                className={tab === 'mapa-eleitoral' ? tabButtonActiveClass : tabButtonInactiveClass}
              >
                Mapa Eleitoral
              </button>
              <button
                type="button"
                onClick={() => setTab('mapa-digital-ig')}
                className={tab === 'mapa-digital-ig' ? tabButtonActiveClass : tabButtonInactiveClass}
              >
                Mapa Digital IG
              </button>
              <button
                type="button"
                onClick={() => setTab('pesquisas')}
                className={tab === 'pesquisas' ? tabButtonActiveClass : tabButtonInactiveClass}
              >
                Pesquisas
              </button>
            </nav>
            {tab === 'mapa-digital-ig' ? (
              <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <div className="inline-flex rounded-lg border border-border-card bg-bg-surface p-1">
                  <button
                    type="button"
                    onClick={() => setIgViewMode('analise')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      igViewMode === 'analise'
                        ? 'bg-accent-gold text-white'
                        : 'text-text-secondary hover:bg-accent-gold-soft/35 hover:text-text-primary'
                    )}
                  >
                    Análise
                  </button>
                  <button
                    type="button"
                    onClick={() => setIgViewMode('operacao')}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors',
                      igViewMode === 'operacao'
                        ? 'bg-accent-gold text-white'
                        : 'text-text-secondary hover:bg-accent-gold-soft/35 hover:text-text-primary'
                    )}
                  >
                    Operação
                  </button>
                </div>
                <MapaDigitalIgRelatorioCheckExport
                  exportPiTodas
                  visualPreset="futuristic"
                  visualTheme={isRepublicanosLight ? 'light' : 'dark'}
                />
                <MapaDigitalIgSyncToolbar
                  className="sm:justify-end"
                  visualTheme={isRepublicanosLight ? 'light' : 'dark'}
                />
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div
        className={cn(
          'theme-futuristic relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-y-auto overflow-x-visible rounded-xl border border-border-card',
          mapaShellBgClass,
          isRepublicanosLight && 'theme-futuristic--republicanos-light'
        )}
      >
        {tab === 'mapa-eleitoral' ? (
          <MapaTerritoriosDesenvolvimentoLeaflet
            key="mapa-eleitoral"
            visualPreset="futuristic"
            visualTheme={isRepublicanosLight ? 'light' : 'dark'}
            painelContext="eleitoral"
          />
        ) : tab === 'mapa-digital-ig' ? (
          <MapaTerritoriosDesenvolvimentoLeaflet
            key="mapa-digital-ig"
            visualPreset="futuristic"
            visualTheme={isRepublicanosLight ? 'light' : 'dark'}
            painelContext="digitalIg"
            igViewMode={igViewMode}
          />
        ) : (
          <MapaTerritoriosDesenvolvimentoLeaflet
            key="pesquisas"
            visualPreset="futuristic"
            visualTheme={isRepublicanosLight ? 'light' : 'dark'}
            painelContext="pesquisas"
          />
        )}
      </div>
    </div>
  )
}
