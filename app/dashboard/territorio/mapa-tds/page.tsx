import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import MapaTdsTabsClient from './mapa-tds-tabs-client'
import { MONITORAMENTO_LIDERES_HREF } from '@/lib/monitoramento-lideres-route'

function MapaTdsSuspenseFallback() {
  return (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center bg-bg-app py-16">
      <p className="text-sm text-text-secondary">Carregando mapa TDs…</p>
    </div>
  )
}

export default function MapaTerritoriosDesenvolvimentoPage({
  searchParams,
}: {
  searchParams: { aba?: string; tema?: string }
}) {
  if (searchParams?.aba === 'mapa-digital-ig') {
    const q = new URLSearchParams()
    if (searchParams.tema) q.set('tema', searchParams.tema)
    const s = q.toString()
    redirect(s ? `${MONITORAMENTO_LIDERES_HREF}&${s}` : MONITORAMENTO_LIDERES_HREF)
  }

  return (
    <Suspense fallback={<MapaTdsSuspenseFallback />}>
      <MapaTdsTabsClient />
    </Suspense>
  )
}
