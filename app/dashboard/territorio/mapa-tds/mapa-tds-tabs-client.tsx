'use client'

import dynamic from 'next/dynamic'
import { useCallback, useMemo } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
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

export type MapaTdsTabId = 'mapa-eleitoral' | 'mapa-digital-ig' | 'pesquisas'

function MapaPlaceholder() {
  return (
    <div
      className="mapa-tds-placeholder h-full min-h-0 w-full animate-pulse bg-[#10161F] sm:rounded-xl"
      aria-hidden
    />
  )
}

function parseTab(raw: string | null): MapaTdsTabId {
  if (raw === 'mapa-digital-ig') return 'mapa-digital-ig'
  if (raw === 'pesquisas') return 'pesquisas'
  return 'mapa-eleitoral'
}

export default function MapaTdsTabsClient() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const tab = useMemo(() => parseTab(searchParams.get(ABA_QUERY)), [searchParams])

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
    <div className="theme-futuristic td-mapa-pagina-ambiente flex h-[calc(100dvh-5.25rem)] min-h-[480px] w-full min-w-0 flex-col max-lg:h-[calc(100dvh-6.25rem)]">
      <header className="td-fut-page-head shrink-0 px-3 pb-2 pt-3 sm:px-5 sm:pb-2.5 sm:pt-3.5 md:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
          <div className="min-w-0">
            <h1 className="td-fut-page-head__title">{tituloPagina}</h1>
            <p className="mt-1 text-xs text-[var(--td-fut-text-sec)] sm:text-sm">{subtituloPagina}</p>
          </div>
          <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:items-end">
            <nav
              className="flex shrink-0 gap-1 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(0,0,0,0.22)] p-1"
              aria-label="Camadas do mapa TDs"
            >
              <button
                type="button"
                onClick={() => setTab('mapa-eleitoral')}
                className={
                  tab === 'mapa-eleitoral'
                    ? 'rounded-lg bg-[rgba(255,255,255,0.1)] px-3 py-2 text-xs font-semibold text-[#E6EDF3] sm:text-sm'
                    : 'rounded-lg px-3 py-2 text-xs font-medium text-[#AAB4C0] hover:bg-[rgba(255,255,255,0.05)] sm:text-sm'
                }
              >
                Mapa Eleitoral
              </button>
              <button
                type="button"
                onClick={() => setTab('mapa-digital-ig')}
                className={
                  tab === 'mapa-digital-ig'
                    ? 'rounded-lg bg-[rgba(255,255,255,0.1)] px-3 py-2 text-xs font-semibold text-[#E6EDF3] sm:text-sm'
                    : 'rounded-lg px-3 py-2 text-xs font-medium text-[#AAB4C0] hover:bg-[rgba(255,255,255,0.05)] sm:text-sm'
                }
              >
                Mapa Digital IG
              </button>
              <button
                type="button"
                onClick={() => setTab('pesquisas')}
                className={
                  tab === 'pesquisas'
                    ? 'rounded-lg bg-[rgba(255,255,255,0.1)] px-3 py-2 text-xs font-semibold text-[#E6EDF3] sm:text-sm'
                    : 'rounded-lg px-3 py-2 text-xs font-medium text-[#AAB4C0] hover:bg-[rgba(255,255,255,0.05)] sm:text-sm'
                }
              >
                Pesquisas
              </button>
            </nav>
            {tab === 'mapa-digital-ig' ? (
              <div className="flex w-full min-w-0 flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end">
                <MapaDigitalIgRelatorioCheckExport exportPiTodas visualPreset="futuristic" />
                <MapaDigitalIgSyncToolbar className="sm:justify-end" />
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden overflow-y-auto overflow-x-visible sm:rounded-xl">
        {tab === 'mapa-eleitoral' ? (
          <MapaTerritoriosDesenvolvimentoLeaflet
            key="mapa-eleitoral"
            visualPreset="futuristic"
            painelContext="eleitoral"
          />
        ) : tab === 'mapa-digital-ig' ? (
          <MapaTerritoriosDesenvolvimentoLeaflet
            key="mapa-digital-ig"
            visualPreset="futuristic"
            painelContext="digitalIg"
          />
        ) : (
          <MapaTerritoriosDesenvolvimentoLeaflet key="pesquisas" visualPreset="futuristic" painelContext="pesquisas" />
        )}
      </div>
    </div>
  )
}
