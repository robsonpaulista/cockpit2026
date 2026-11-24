'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { TseCarregando, TseTabs, type TseAba } from '@/components/tse/tse-ui'
import {
  TERRITORIO_LIDERANCAS_SUB_CADASTRO,
  TERRITORIO_LIDERANCAS_SUB_DEP_ESTADUAL_2026,
  parseTerritorioLiderancasSubTab,
  territorioLiderancasHref,
  type TerritorioLiderancasSubTab,
} from '@/lib/territorio-campo-route'

const LiderancasCadastroPanel = dynamic(
  () =>
    import('./liderancas-cadastro-panel').then((mod) => mod.LiderancasCadastroPanel),
  {
    ssr: false,
    loading: () => <TseCarregando texto="Carregando lideranças…" />,
  },
)

const LiderancasDepEstadual2026Panel = dynamic(
  () =>
    import('./liderancas-dep-estadual-2026-panel').then(
      (mod) => mod.LiderancasDepEstadual2026Panel,
    ),
  {
    ssr: false,
    loading: () => <TseCarregando texto="Carregando dep. estadual 2026…" />,
  },
)

const SUB_ABAS: readonly TseAba<TerritorioLiderancasSubTab>[] = [
  { id: TERRITORIO_LIDERANCAS_SUB_CADASTRO, label: 'Cadastro' },
  { id: TERRITORIO_LIDERANCAS_SUB_DEP_ESTADUAL_2026, label: 'Dep. estadual 2026' },
]

export function LiderancasPanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const urlSub = useMemo(
    () => parseTerritorioLiderancasSubTab(searchParams.get('liderancas')),
    [searchParams],
  )
  const [subTab, setSubTab] = useState<TerritorioLiderancasSubTab>(urlSub)

  useEffect(() => {
    setSubTab(urlSub)
  }, [urlSub])

  const onSubChange = useCallback(
    (next: TerritorioLiderancasSubTab) => {
      setSubTab(next)
      router.replace(territorioLiderancasHref(next), { scroll: false })
    },
    [router],
  )

  return (
    <div className="mt-4">
      <TseTabs abas={SUB_ABAS} ativa={subTab} onChange={onSubChange} />
      {subTab === TERRITORIO_LIDERANCAS_SUB_DEP_ESTADUAL_2026 ? (
        <LiderancasDepEstadual2026Panel />
      ) : (
        <div className="mt-4">
          <LiderancasCadastroPanel />
        </div>
      )}
    </div>
  )
}
