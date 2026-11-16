'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { TseCarregando, TseTabs, type TseAba } from '@/components/tse/tse-ui'
import {
  TERRITORIO_VISITAS_SUB_AGENDA,
  TERRITORIO_VISITAS_SUB_COBERTURA_2026,
  parseTerritorioVisitasSubTab,
  territorioVisitasHref,
  type TerritorioVisitasSubTab,
} from '@/lib/territorio-campo-route'

const CampoVisitasPanel = dynamic(
  () => import('./campo-visitas-panel').then((mod) => mod.CampoVisitasPanel),
  {
    ssr: false,
    loading: () => <TseCarregando texto="Carregando Campo & Agenda…" />,
  },
)

const VisitasCobertura2026Panel = dynamic(
  () =>
    import('./visitas-cobertura-2026-panel').then((mod) => mod.VisitasCobertura2026Panel),
  {
    ssr: false,
    loading: () => <TseCarregando texto="Carregando cobertura 2026…" />,
  },
)

const SUB_ABAS: readonly TseAba<TerritorioVisitasSubTab>[] = [
  { id: TERRITORIO_VISITAS_SUB_AGENDA, label: 'Agenda de campo' },
  { id: TERRITORIO_VISITAS_SUB_COBERTURA_2026, label: 'Cobertura 2026' },
]

export function VisitasPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSub = useMemo(
    () => parseTerritorioVisitasSubTab(searchParams.get('visitas')),
    [searchParams],
  )
  const [subTab, setSubTab] = useState<TerritorioVisitasSubTab>(urlSub)

  useEffect(() => {
    setSubTab(urlSub)
  }, [urlSub])

  const onSubChange = useCallback(
    (next: TerritorioVisitasSubTab) => {
      setSubTab(next)
      router.replace(territorioVisitasHref(next), { scroll: false })
    },
    [router],
  )

  return (
    <div className="mt-4">
      <TseTabs abas={SUB_ABAS} ativa={subTab} onChange={onSubChange} />
      {subTab === TERRITORIO_VISITAS_SUB_COBERTURA_2026 ? (
        <VisitasCobertura2026Panel />
      ) : (
        <div className="mt-4">
          <CampoVisitasPanel />
        </div>
      )}
    </div>
  )
}
