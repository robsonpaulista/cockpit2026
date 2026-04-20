'use client'

import dynamic from 'next/dynamic'

const MapaTerritoriosDesenvolvimentoLeaflet = dynamic(
  () =>
    import('@/components/mapa-territorios-desenvolvimento-leaflet').then((mod) => ({
      default: mod.MapaTerritoriosDesenvolvimentoLeaflet,
    })),
  { ssr: false, loading: () => <MapaPlaceholder /> }
)

function MapaPlaceholder() {
  return (
    <div
      className="mapa-tds-placeholder h-full min-h-0 w-full animate-pulse bg-[#10161F] sm:rounded-xl"
      aria-hidden
    />
  )
}

export default function MapaTerritoriosDesenvolvimentoPage() {
  return (
    <div className="theme-futuristic td-mapa-pagina-ambiente flex h-[calc(100dvh-5.25rem)] min-h-[480px] w-full min-w-0 flex-col max-lg:h-[calc(100dvh-6.25rem)]">
      <header className="td-fut-page-head shrink-0 px-3 pb-3 pt-4 sm:px-5 md:px-6">
        <h1 className="td-fut-page-head__title">Mapa de Dominância Eleitoral</h1>
        <p className="td-fut-page-head__subtitle">Piauí • Territórios de Desenvolvimento</p>
      </header>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-visible sm:rounded-xl">
        <MapaTerritoriosDesenvolvimentoLeaflet visualPreset="futuristic" />
      </div>
    </div>
  )
}
