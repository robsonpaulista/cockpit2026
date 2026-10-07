'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { TerritorioCampoShell } from '@/components/territorio-campo/territorio-campo-shell'
import { TerritorioMunicipioProvider } from '@/components/territorio-campo/territorio-municipio-context'
import { TseCarregando } from '@/components/tse/tse-ui'
import { VisitasPanel } from '@/components/territorio-campo/visitas-panel'
import {
  TERRITORIO_CAMPO_TAB_BASE,
  TERRITORIO_CAMPO_TAB_DEMANDAS,
  TERRITORIO_CAMPO_TAB_LIDERANCAS,
  TERRITORIO_CAMPO_TAB_MAPA_OBRAS_LEGACY,
  TERRITORIO_CAMPO_TAB_VISITAS,
  type TerritorioCampoTab,
  parseTerritorioCampoTab,
  territorioCampoHref,
} from '@/lib/territorio-campo-route'

const TerritorioBasePanel = dynamic(
  () => import('@/components/territorio-campo/territorio-base-panel').then((mod) => mod.TerritorioBasePanel),
  {
    ssr: false,
    loading: () => <TseCarregando texto="Carregando base territorial…" />,
  }
)

const DemandasObrasPanel = dynamic(
  () =>
    import('@/components/territorio-campo/demandas-obras-panel').then(
      (mod) => mod.DemandasObrasPanel,
    ),
  {
    ssr: false,
    loading: () => <TseCarregando texto="Carregando demandas…" />,
  },
)

const LiderancasPanel = dynamic(
  () =>
    import('@/components/territorio-campo/liderancas-panel').then(
      (mod) => mod.LiderancasPanel,
    ),
  {
    ssr: false,
    loading: () => <TseCarregando texto="Carregando lideranças…" />,
  },
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
    // Mapa de Obras ficou só no War Room · Copiloto
    if (rawTab === TERRITORIO_CAMPO_TAB_MAPA_OBRAS_LEGACY) {
      router.replace('/dashboard/war-room')
      return
    }
    if (rawTab && rawTab !== TERRITORIO_CAMPO_TAB_BASE && rawTab !== urlTab) {
      router.replace(territorioCampoHref(urlTab))
    }
  }, [router, searchParams, urlTab])

  const onTabChange = useCallback(
    (tab: TerritorioCampoTab) => {
      setActiveTab(tab)
      router.replace(territorioCampoHref(tab))
    },
    [router]
  )

  return (
    <TerritorioMunicipioProvider>
      <TerritorioCampoShell activeTab={activeTab} onTabChange={onTabChange}>
        {activeTab === TERRITORIO_CAMPO_TAB_LIDERANCAS ? (
          <LiderancasPanel />
        ) : activeTab === TERRITORIO_CAMPO_TAB_DEMANDAS ? (
          <DemandasObrasPanel />
        ) : activeTab === TERRITORIO_CAMPO_TAB_VISITAS ? (
          <VisitasPanel />
        ) : (
          <TerritorioBasePanel />
        )}
      </TerritorioCampoShell>
    </TerritorioMunicipioProvider>
  )
}
