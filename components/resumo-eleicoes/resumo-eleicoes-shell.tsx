'use client'

import { useEffect } from 'react'
import {
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import '@/app/dashboard/shared/ipt-page-palette.css'

interface ResumoEleicoesShellProps {
  titulo: string
  descricao: string
  children: React.ReactNode
}

/** Moldura das páginas eleitorais ainda não migradas para o padrão TSE (Seção, Chapas). */
export function ResumoEleicoesShell({ titulo, descricao, children }: ResumoEleicoesShellProps) {
  const topbarVisible = useDashboardTopbarVisible()

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
            <span className={typographyPageLeadClass}>{descricao}</span>
          </DashboardPageMetaStrip>
        ) : (
          <DashboardPageHeader title={titulo} description={descricao} />
        )}
      </DashboardPageChrome>
      <DashboardPageContent className={cn(typographyContentRootClass, 'pt-2 md:pt-3')}>
        <div className="w-full min-w-0">{children}</div>
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
