'use client'

import { Image, Users } from 'lucide-react'
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
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { ARQUIVOS_TAB_FOTOS_DRIVE, ARQUIVOS_TAB_CADASTRO_PESSOAS, type ArquivosTab } from '@/lib/arquivos-hub-route'

const TABS: { id: ArquivosTab; label: string; icon: typeof Image }[] = [
  { id: ARQUIVOS_TAB_FOTOS_DRIVE, label: 'Fotos do Drive', icon: Image },
  { id: ARQUIVOS_TAB_CADASTRO_PESSOAS, label: 'Cadastro de pessoas', icon: Users },
]

const TAB_DESCRIPTIONS: Record<ArquivosTab, string> = {
  'fotos-drive':
    'Galeria sincronizada do Google Drive com busca por pessoa, local, data e tags de evento.',
  'cadastro-pessoas':
    'Cadastre pessoas e fotos de referência do rosto para reconhecimento automático nas fotos.',
}

interface ArquivosShellProps {
  activeTab: ArquivosTab
  onTabChange: (tab: ArquivosTab) => void
  tabActions?: React.ReactNode
  children: React.ReactNode
}

export function ArquivosShell({ activeTab, onTabChange, tabActions, children }: ArquivosShellProps) {
  const topbarVisible = useDashboardTopbarVisible()
  const pageTitle = 'Arquivos'
  const tabDescription = TAB_DESCRIPTIONS[activeTab]

  return (
    <DashboardPageShell>
      <DashboardPageChrome>
        {topbarVisible ? (
          <DashboardPageMetaStrip>
            <span className={typographyPageLeadClass}>{tabDescription}</span>
          </DashboardPageMetaStrip>
        ) : (
          <DashboardPageHeader title={pageTitle} description={tabDescription} />
        )}
        <DashboardHubTabBar
          tabs={TABS}
          activeTab={activeTab}
          onTabChange={(tab) => onTabChange(tab as ArquivosTab)}
          actions={tabActions}
        />
      </DashboardPageChrome>
      <DashboardPageContent className={cn(typographyContentRootClass, 'pt-2 md:pt-3')}>
        {children}
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
