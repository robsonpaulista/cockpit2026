import { Suspense } from 'react'
import MapaTdsTabsClient from './mapa-tds-tabs-client'

function MapaTdsSuspenseFallback() {
  return (
    <div className="flex h-[calc(100dvh-5.25rem)] min-h-[480px] w-full min-w-0 flex-col items-center justify-center bg-bg-app max-lg:h-[calc(100dvh-6.25rem)]">
      <p className="text-sm text-text-secondary">Carregando mapa TDs…</p>
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
