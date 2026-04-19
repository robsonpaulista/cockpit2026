'use client'

import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { UserMenu } from './user-menu'
import { useTheme } from '@/contexts/theme-context'
import { useCockpitStatus } from '@/contexts/cockpit-status-context'
import { getCockpitPageLabel } from '@/lib/cockpit-page-label'
import { cn } from '@/lib/utils'

const pathToTitle: Record<string, string> = {
  '/dashboard': 'Visão Geral',
  '/dashboard/narrativas': 'Estratégia',
  '/dashboard/campo': 'Campo & Agenda',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/territorio': 'Território & Base',
  '/dashboard/territorio/mapa-tds': 'Mapa — Territórios de desenvolvimento',
  '/dashboard/chapas': 'Chapas',
  '/dashboard/chapas-estaduais': 'Chapas Estaduais',
  '/dashboard/resumo-eleicoes': 'Resumo Eleições',
  '/dashboard/conteudo': 'Conteúdo & Redes',
  '/dashboard/noticias': 'Notícias & Crises',
  '/dashboard/mobilizacao': 'Mobilização',
  '/dashboard/whatsapp': 'WhatsApp',
  '/dashboard/pesquisa': 'Pesquisa & Relato',
  '/dashboard/operacao': 'Operação & Equipe',
  '/dashboard/juridico': 'Jurídico',
  '/dashboard/obras': 'Obras',
  '/dashboard/proposicoes': 'Proposições',
  '/dashboard/usuarios': 'Gestão de Usuários',
}

function getPageTitle(pathname: string): string {
  return pathToTitle[pathname] ?? (pathname.replace(/^\/dashboard\/?/, '').replace(/^\//, '') || 'Visão Geral')
}

export function DashboardHeader() {
  const pathname = usePathname()
  const { theme } = useTheme()
  const { metrics } = useCockpitStatus()
  const pageTitle = getPageTitle(pathname ?? '')
  const cockpitPageLabel = getCockpitPageLabel(pathname ?? '/dashboard')

  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const territorioLinha = metrics?.territorioLabel ?? '—'
  const lugarLinha = metrics?.lugarChapa ?? '—'

  if (theme === 'cockpit') {
    return (
      <header className="sticky top-0 z-30 border-b border-white/40 bg-white/35 backdrop-blur-md">
        <div className="min-h-[3rem] flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 lg:px-6 py-2">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <span
              className="text-sm font-bold tracking-tight text-[rgb(15,45,74)] shrink-0"
              title={pageTitle}
            >
              {cockpitPageLabel}
            </span>
            <span className="text-border-card/70 shrink-0 hidden sm:inline" aria-hidden>
              |
            </span>
            <div
              className={cn(
                'cockpit-glass flex flex-wrap items-center gap-x-2.5 gap-y-1 px-3 py-1.5 sm:px-4 sm:py-2',
                'rounded-full text-[10px] sm:text-[11px] text-text-secondary',
                'shadow-[0_4px_20px_rgba(15,70,120,0.08)] border-white/80',
                'min-w-0 flex-1 sm:flex-initial sm:max-w-none'
              )}
            >
              <span className="inline-flex items-center gap-2 font-semibold text-[rgb(15,45,74)] shrink-0">
                <span
                  className="cockpit-pulse-dot-brand h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-gradient-to-br from-[#062e52] via-[#0b4a7a] to-[#1368a8] shadow-[0_0_0_2px_rgba(255,255,255,0.65)]"
                  aria-hidden
                />
                SISTEMA ATIVO
              </span>
              <span className="text-border-card/80 hidden sm:inline" aria-hidden>
                |
              </span>
              <span className="whitespace-nowrap">{territorioLinha}</span>
              <span className="text-border-card/80 hidden sm:inline" aria-hidden>
                |
              </span>
              <span className="whitespace-nowrap">{lugarLinha}</span>
              <span className="text-border-card/80 hidden sm:inline" aria-hidden>
                |
              </span>
              <span className="tabular-nums whitespace-nowrap">
                Atualizado {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 justify-end sm:ml-2">
            <UserMenu />
          </div>
        </div>
      </header>
    )
  }

  return (
    <header className="sticky top-0 z-30 bg-bg-surface border-b border-border-card">
      <div className="h-16 flex items-center justify-between px-4 lg:px-6">
        <h1 className="text-xl font-semibold text-text-primary">
          Cockpit 2026<span className="text-text-secondary font-normal"> &gt; </span>
          {pageTitle}
        </h1>
        <UserMenu />
      </div>
    </header>
  )
}
