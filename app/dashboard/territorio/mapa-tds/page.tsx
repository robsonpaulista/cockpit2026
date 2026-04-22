import { Suspense } from 'react'
import MapaTdsTabsClient from './mapa-tds-tabs-client'

function MapaTdsSuspenseFallback() {
  return (
    <div className="theme-futuristic td-mapa-pagina-ambiente flex h-[calc(100dvh-5.25rem)] min-h-[480px] w-full min-w-0 flex-col items-center justify-center max-lg:h-[calc(100dvh-6.25rem)] bg-[#10161F]">
      <p className="text-sm text-[#AAB4C0]">Carregando mapa TDs…</p>
    </div>
  )
}

export default function MapaTerritoriosDesenvolvimentoPage() {
  return (
    <Suspense fallback={<MapaTdsSuspenseFallback />}>
      <MapaTdsTabsClient />
    </Suspense>
  )
}
