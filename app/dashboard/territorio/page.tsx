'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TerritorioCampoShell } from '@/components/territorio-campo/territorio-campo-shell'
import { TerritorioCampoPanoramaPanel } from '@/components/territorio-campo/territorio-campo-panorama-panel'
import { VisitasPanel } from '@/components/territorio-campo/visitas-panel'
import {
  TERRITORIO_CAMPO_TAB_BASE,
  TERRITORIO_CAMPO_TAB_MAPA_OBRAS,
  TERRITORIO_CAMPO_TAB_PANORAMA,
  TERRITORIO_CAMPO_TAB_VISITAS,
  type TerritorioCampoTab,
  parseTerritorioCampoTab,
  territorioCampoHref,
} from '@/lib/territorio-campo-route'

const TerritorioBasePanel = dynamic(
  () => import('@/components/territorio-campo/territorio-base-panel').then((mod) => mod.TerritorioBasePanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando base territorial…
      </div>
    ),
  }
)

const MapaObrasPanel = dynamic(
  () => import('@/components/territorio-campo/mapa-obras-panel').then((mod) => mod.MapaObrasPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa de obras…
      </div>
    ),
  }
)

export default function TerritorioCampoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlTab = useMemo(
    () => parseTerritorioCampoTab(searchParams.get('tab')),
    [searchParams]
  )
  const [activeTab, setActiveTab] = useState<TerritorioCampoTab>(urlTab)

  useEffect(() => {
    setActiveTab(urlTab)
  }, [urlTab])

  useEffect(() => {
    const rawTab = searchParams.get('tab')
    if (rawTab === TERRITORIO_CAMPO_TAB_PANORAMA) {
      router.replace(territorioCampoHref(TERRITORIO_CAMPO_TAB_PANORAMA))
    }
  }, [router, searchParams])

  const onTabChange = useCallback(
    (tab: TerritorioCampoTab) => {
      setActiveTab(tab)
      router.replace(territorioCampoHref(tab))
    },
    [router]
  )

  return (
    <TerritorioCampoShell activeTab={activeTab} onTabChange={onTabChange}>
      {activeTab === TERRITORIO_CAMPO_TAB_PANORAMA ? (
        <TerritorioCampoPanoramaPanel />
      ) : activeTab === TERRITORIO_CAMPO_TAB_BASE ? (
        <TerritorioBasePanel />
      ) : activeTab === TERRITORIO_CAMPO_TAB_MAPA_OBRAS ? (
        <MapaObrasPanel />
      ) : (
        <VisitasPanel />
      )}
    </TerritorioCampoShell>
  )
}
