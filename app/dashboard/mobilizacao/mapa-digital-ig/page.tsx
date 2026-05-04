import { Suspense } from 'react'
import MapaDigitalIgMobilizacaoPageClient from './mapa-digital-ig-page-client'

function MapaDigitalIgSuspenseFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-bg-app py-16">
      <p className="text-sm text-text-secondary">Carregando Mapa Exército Digital…</p>
    </div>
  )
}

export default function MapaDigitalIgMobilizacaoPage() {
  return (
    <Suspense fallback={<MapaDigitalIgSuspenseFallback />}>
      <MapaDigitalIgMobilizacaoPageClient />
    </Suspense>
  )
}
