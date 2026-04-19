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
      className="h-full min-h-0 w-full animate-pulse bg-white sm:rounded-xl"
      aria-hidden
    />
  )
}

export default function MapaTerritoriosDesenvolvimentoPage() {
  return (
    <div className="td-mapa-pagina-ambiente flex h-[calc(100dvh-5.25rem)] min-h-[480px] w-full min-w-0 flex-col max-lg:h-[calc(100dvh-6.25rem)]">
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto overflow-x-visible sm:rounded-xl">
        <MapaTerritoriosDesenvolvimentoLeaflet />
      </div>
    </div>
  )
}
