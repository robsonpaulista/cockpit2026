'use client'

import { useEffect } from 'react'
import { BarChart3, Calendar, ClipboardList, MapPinned, Vote } from 'lucide-react'
import {
  DashboardHubTabBar,
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import type { ResumoEleicoesHubTab } from '@/lib/resumo-eleicoes-hub-route'
import {
  RESUMO_ELEICOES_TAB_ATENDIMENTO,
  RESUMO_ELEICOES_TAB_AGENDA,
  RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL,
  RESUMO_ELEICOES_TAB_CHAPA_FEDERAL,
  RESUMO_ELEICOES_TAB_SECAO,
} from '@/lib/resumo-eleicoes-hub-route'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import '@/app/dashboard/shared/ipt-page-palette.css'

const TABS: { id: ResumoEleicoesHubTab; label: string; icon: typeof ClipboardList }[] = [
  { id: RESUMO_ELEICOES_TAB_ATENDIMENTO, label: 'Atendimento', icon: ClipboardList },
  { id: RESUMO_ELEICOES_TAB_AGENDA, label: 'Agenda', icon: Calendar },
  { id: RESUMO_ELEICOES_TAB_SECAO, label: 'Votação por Seção', icon: MapPinned },
  { id: RESUMO_ELEICOES_TAB_CHAPA_FEDERAL, label: 'Chapa Federal', icon: Vote },
  { id: RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL, label: 'Chapa Estadual', icon: BarChart3 },
]

const TAB_DESCRIPTIONS: Record<ResumoEleicoesHubTab, string> = {
  [RESUMO_ELEICOES_TAB_ATENDIMENTO]:
    'Resumo por cidade, expectativa de votos, lideranças e simulação de vereadores.',
  [RESUMO_ELEICOES_TAB_AGENDA]:
    'Compromissos do Google Calendar, confirmação de chegada e vínculo com Campo.',
  [RESUMO_ELEICOES_TAB_SECAO]:
    'Matriz comparativa de votação por seção eleitoral (TSE / bweb).',
  [RESUMO_ELEICOES_TAB_CHAPA_FEDERAL]:
    'Projeção e simulação de chapas para Deputado Federal.',
  [RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL]:
    'Projeção e simulação de chapas para Deputado Estadual.',
}

interface ResumoEleicoesShellProps {
  activeTab: ResumoEleicoesHubTab
  onTabChange: (tab: ResumoEleicoesHubTab) => void
  tabActions?: React.ReactNode
  children: React.ReactNode
}

export function ResumoEleicoesShell({
  activeTab,
  onTabChange,
  tabActions,
  children,
}: ResumoEleicoesShellProps) {
  const topbarVisible = useDashboardTopbarVisible()
  const pageTitle = 'Painel de Atendimentos'
  const description = TAB_DESCRIPTIONS[activeTab]

  useEffect(() => {
    document.body.setAttribute('data-ipt-palette', '')
    return () => {
      document.body.removeAttribute('data-ipt-palette')
    }
  }, [])

  return (
    <DashboardPageShell>
      <DashboardPageChrome>
        {topbarVisible ? (
          <DashboardPageMetaStrip>
            <span className={typographyPageLeadClass}>{description}</span>
          </DashboardPageMetaStrip>
        ) : (
          <DashboardPageHeader title={pageTitle} description={description} />
        )}
        <DashboardHubTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as ResumoEleicoesHubTab)}
          actions={tabActions}
        />
      </DashboardPageChrome>
      <DashboardPageContent className={cn(typographyContentRootClass, 'pt-2 md:pt-3')}>
        {children}
      </DashboardPageContent>
    </DashboardPageShell>
  )
}

export type { ResumoEleicoesHubTab }
