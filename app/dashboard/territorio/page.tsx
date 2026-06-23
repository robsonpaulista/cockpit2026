'use client'

import { useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { TerritorioCampoShell } from '@/components/territorio-campo/territorio-campo-shell'
import { TerritorioCampoPanoramaPanel } from '@/components/territorio-campo/territorio-campo-panorama-panel'
import { VisitasPanel } from '@/components/territorio-campo/visitas-panel'
import {
  TERRITORIO_CAMPO_TAB_BASE,
  TERRITORIO_CAMPO_TAB_PANORAMA,
  TERRITORIO_CAMPO_TAB_VISITAS,
  type TerritorioCampoTab,
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

function parseTab(value: string | null): TerritorioCampoTab {
  if (value === TERRITORIO_CAMPO_TAB_BASE) return TERRITORIO_CAMPO_TAB_BASE
  if (value === TERRITORIO_CAMPO_TAB_VISITAS) return TERRITORIO_CAMPO_TAB_VISITAS
  return TERRITORIO_CAMPO_TAB_PANORAMA
}

export default function TerritorioCampoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = useMemo(() => parseTab(searchParams.get('tab')), [searchParams])

  const onTabChange = useCallback(
    (tab: TerritorioCampoTab) => {
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
      ) : (
        <VisitasPanel />
      )}
    </TerritorioCampoShell>
  )
}
