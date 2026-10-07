'use client'

import { useEffect } from 'react'
import dynamic from 'next/dynamic'
import { useRouter, useSearchParams } from 'next/navigation'
import { PanelLoader } from '@/components/resumo-eleicoes/panel-loader'
import {
  isResumoEleicoesHubTab,
  RESUMO_ELEICOES_TAB_ATENDIMENTO,
  resumoEleicoesHref,
} from '@/lib/resumo-eleicoes-hub-route'

const ResumoEleicoesAtendimentoPanel = dynamic(
  () =>
    import('@/components/resumo-eleicoes/resumo-eleicoes-atendimento-panel').then(
      (mod) => mod.ResumoEleicoesAtendimentoPanel,
    ),
  { loading: () => <PanelLoader label="Carregando atendimento…" /> },
)

export default function AtendimentoPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tabLegada = searchParams.get('tab')
  const redirecionar = isResumoEleicoesHubTab(tabLegada) && tabLegada !== RESUMO_ELEICOES_TAB_ATENDIMENTO

  useEffect(() => {
    if (!isResumoEleicoesHubTab(tabLegada) || tabLegada === RESUMO_ELEICOES_TAB_ATENDIMENTO) return
    const extra = Object.fromEntries(searchParams.entries())
    delete extra.tab
    router.replace(resumoEleicoesHref(tabLegada, extra))
  }, [router, searchParams, tabLegada])

  if (redirecionar) return null

  return <ResumoEleicoesAtendimentoPanel />
}
