'use client'

import { useCallback, useMemo } from 'react'
import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ResumoEleicoesShell } from '@/components/resumo-eleicoes/resumo-eleicoes-shell'
import {
  parseResumoEleicoesHubTab,
  RESUMO_ELEICOES_TAB_ATENDIMENTO,
  RESUMO_ELEICOES_TAB_AGENDA,
  RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL,
  RESUMO_ELEICOES_TAB_CHAPA_FEDERAL,
  RESUMO_ELEICOES_TAB_SECAO,
  type ResumoEleicoesHubTab,
} from '@/lib/resumo-eleicoes-hub-route'

function PanelLoader({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  )
}

const ResumoEleicoesAtendimentoPanel = dynamic(
  () =>
    import('@/components/resumo-eleicoes/resumo-eleicoes-atendimento-panel').then(
      (mod) => mod.ResumoEleicoesAtendimentoPanel,
    ),
  { loading: () => <PanelLoader label="Carregando atendimento…" /> },
)

const AgendaPanel = dynamic(
  () => import('@/components/agenda/agenda-panel').then((mod) => mod.AgendaPanel),
  { loading: () => <PanelLoader label="Carregando agenda…" /> },
)

const ResumoEleicoesSecaoPanel = dynamic(
  () =>
    import('@/components/resumo-eleicoes/resumo-eleicoes-secao-panel').then(
      (mod) => mod.ResumoEleicoesSecaoPanel,
    ),
  { loading: () => <PanelLoader label="Carregando votação por seção…" /> },
)

const ChapasPanel = dynamic(
  () => import('@/components/chapas/chapas-panel').then((mod) => mod.ChapasPanel),
  { loading: () => <PanelLoader label="Carregando chapas…" /> },
)

export default function ResumoEleicoesHubPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = useMemo(() => parseResumoEleicoesHubTab(searchParams.get('tab')), [searchParams])

  const onTabChange = useCallback(
    (tab: ResumoEleicoesHubTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === RESUMO_ELEICOES_TAB_ATENDIMENTO) {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      if (tab !== RESUMO_ELEICOES_TAB_SECAO) {
        params.delete('anos')
        params.delete('ano')
        params.delete('cargo')
        params.delete('modo')
        params.delete('cargos')
      }
      const qs = params.toString()
      router.replace(qs ? `/dashboard/resumo-eleicoes?${qs}` : '/dashboard/resumo-eleicoes')
    },
    [router, searchParams],
  )

  const trocarEscopoChapas = useCallback(() => {
    onTabChange(
      activeTab === RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL
        ? RESUMO_ELEICOES_TAB_CHAPA_FEDERAL
        : RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL,
    )
  }, [activeTab, onTabChange])

  const tabPanel = (() => {
    switch (activeTab) {
      case RESUMO_ELEICOES_TAB_AGENDA:
        return <AgendaPanel embedded />
      case RESUMO_ELEICOES_TAB_SECAO:
        return <ResumoEleicoesSecaoPanel embedded />
      case RESUMO_ELEICOES_TAB_CHAPA_FEDERAL:
        return (
          <ChapasPanel
            embedded
            escopoOverride="federal"
            onTrocarEscopo={trocarEscopoChapas}
          />
        )
      case RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL:
        return (
          <ChapasPanel
            embedded
            escopoOverride="estadual"
            onTrocarEscopo={trocarEscopoChapas}
          />
        )
      case RESUMO_ELEICOES_TAB_ATENDIMENTO:
      default:
        return <ResumoEleicoesAtendimentoPanel />
    }
  })()

  return (
    <ResumoEleicoesShell activeTab={activeTab} onTabChange={onTabChange}>
      <div className="w-full min-w-0">{tabPanel}</div>
    </ResumoEleicoesShell>
  )
}
