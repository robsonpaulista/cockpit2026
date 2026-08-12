'use client'

import { useEffect } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { UserMenu } from './user-menu'
import { useTheme } from '@/contexts/theme-context'
import { MAPA_TDS_ROUTE_PREFIX } from '@/lib/dashboard-mapa-futuristic-chrome'
import { MONITORAMENTO_TAB_LIDERES } from '@/lib/monitoramento-lideres-route'
import {
  TERRITORIO_CAMPO_PAGE_TITLE,
  territorioCampoPageTitle,
} from '@/lib/territorio-campo-route'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { useDashboardTopbarExtras } from '@/contexts/dashboard-topbar-extras-context'
import { AppBrandTitle } from '@/components/app-brand-title'
import { WarRoomTopbarCountdown } from '@/components/war-room/war-room-topbar-countdown'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
import { isDashboardHomePath } from '@/lib/dashboard-home-chrome'
import { dashboardMobilePageHeaderClass } from '@/lib/rest-screen-chrome'
import { DASHBOARD_TOPBAR_H_CLASS } from '@/lib/dashboard-chrome-layout'
import { isWarRoomCleanRoute } from '@/lib/war-room-clean-route'
const pathToTitle: Record<string, string> = {
  '/dashboard': 'Visão Geral',
  '/dashboard/narrativas': 'Estratégia',
  '/dashboard/campo': 'Base Eleitoral · Visitas',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/territorio': 'Base Eleitoral',
  '/dashboard/territorio/ipt': 'Mapa de Diagnóstico da Campanha',
  '/dashboard/territorio/mapa-tds': 'Mapa — Territórios de desenvolvimento',
  '/dashboard/chapas': 'Chapas',
  '/dashboard/chapas-estaduais': 'Chapas Estaduais',
  '/dashboard/resumo-eleicoes': 'Painel de Atendimentos',
  '/dashboard/conteudo': 'Redes Sociais',
  '/dashboard/noticias': 'Radar eleitoral',
  '/dashboard/noticias/monitoramento': 'Radar eleitoral',
  '/dashboard/radar-224': 'Radar 224',
  '/dashboard/mobilizacao': 'Mobilização',
  '/dashboard/mobilizacao/config': 'Mobilização · Config',
  '/dashboard/mobilizacao/mapa-digital-ig': 'Central de monitoramento · Engajamento Líderes',
  '/dashboard/whatsapp': 'WhatsApp',
  '/dashboard/war-room': 'WAR ROOM',
  '/dashboard/material-campanha': 'Gestão de Material',
  '/dashboard/pesquisa': 'Pesquisa & Relato',
  '/dashboard/operacao': 'Operação & Equipe',
  '/dashboard/juridico': 'Jurídico',
  '/dashboard/emendas': 'Emendas',
  '/dashboard/obras': 'Obras',
  '/dashboard/proposicoes': 'Proposições',
  '/dashboard/usuarios': 'Gestão de Usuários',
  '/dashboard/backup': 'Backup Supabase',
  '/dashboard/log-system': 'Log System',
}

function getPageTitle(pathname: string, tab: string | null, _view: string | null): string {
  if (pathname === '/dashboard/noticias/monitoramento' && tab === MONITORAMENTO_TAB_LIDERES) {
    return 'Radar eleitoral · Eng. líderes'
  }
  if (pathname === '/dashboard/territorio') {
    return territorioCampoPageTitle(tab)
  }
  if (pathname.startsWith('/dashboard/conteudo/')) {
    const rest = pathname.slice('/dashboard/conteudo/'.length)
    if (rest.startsWith('redes')) return 'Instagram Pessoal'
    if (rest.startsWith('obras')) return 'Redes Sociais · Obras (cards)'
    if (rest.startsWith('agenda')) return 'Redes Sociais · Agenda campo'
    if (rest.startsWith('cards')) return 'Redes Sociais · Cards'
    if (rest.startsWith('referencias')) return 'Redes Sociais · Referências visuais'
    if (rest.startsWith('analise')) return 'Redes Sociais · Análise'
    if (rest.startsWith('instagram-lideres')) return 'Redes Sociais · Instagram líderes'
    return 'Redes Sociais'
  }
  return pathToTitle[pathname] ?? (pathname.replace(/^\/dashboard\/?/, '').replace(/^\//, '') || 'Visão Geral')
}

function mapaTdsHeaderTitleFromSearch(aba: string | null): string {
  if (aba === 'pesquisas') return 'Mapa Pesquisas'
  return 'Mapa de Dominância Eleitoral'
}

export function DashboardHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { theme, appearance, setAppearance } = useTheme()
  const p = pathname ?? ''
  const mapaFuturisticShell = p.startsWith(MAPA_TDS_ROUTE_PREFIX)
  const mapaFuturisticTituloContexto = p.startsWith(MAPA_TDS_ROUTE_PREFIX)
    ? mapaTdsHeaderTitleFromSearch(searchParams.get('aba'))
    : null
  const pageTitle = mapaFuturisticTituloContexto ?? getPageTitle(pathname ?? '', searchParams.get('tab'), searchParams.get('view'))

  /** Link compartilhado com `tema=republicanos-claro` alinha aparência global para claro. */
  useEffect(() => {
    if (!mapaFuturisticShell) return
    if (searchParams.get('tema') === 'republicanos-claro' && appearance === 'dark') {
      setAppearance('light')
    }
  }, [mapaFuturisticShell, searchParams, appearance, setAppearance])

  const showTopbar = useDashboardTopbarVisible()
  const topbarExtras = useDashboardTopbarExtras()
  const isRepublicanosPremium = theme === 'republicanos' && appearance === 'light'
  const isGradientHome = useDashboardHomeChrome()
  const isHome = isDashboardHomePath(p)
  const isWarRoom = isWarRoomCleanRoute(p)

  /** War Room mantém a top bar mesmo com a sidebar expandida (alinha marca + cronômetro). */
  if ((!showTopbar && !isWarRoom) || isHome) {
    return null
  }

  const mobileAmberHeader = !isGradientHome && !isWarRoom
  const lightBrand = isGradientHome

  return (
    <header
      className={cn(
        'sticky top-0 z-30',
        isWarRoom &&
          'wr-topbar-clean border-b border-[color-mix(in_srgb,var(--wr-slate,#424E5C)_12%,transparent)] bg-[var(--wr-header-bg,#FFFFFF)]',
        isGradientHome
          ? 'bg-transparent backdrop-blur-md'
          : !isWarRoom &&
              cn(
                'lg:bg-[rgb(var(--bg-sidebar))]',
                isRepublicanosPremium && 'republicanos-premium-header',
                mobileAmberHeader && dashboardMobilePageHeaderClass,
              ),
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 max-lg:pl-[4.5rem] max-lg:pr-2 sm:gap-3 lg:gap-3 lg:px-6',
          isWarRoom
            ? cn(
                DASHBOARD_TOPBAR_H_CLASS,
                'box-border overflow-hidden px-3 sm:px-4 lg:px-6',
              )
            : isGradientHome
              ? 'h-12 lg:h-14'
              : 'h-16',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <AppBrandTitle
            isCockpit={false}
            lightOnGradient={lightBrand}
            lightOnAmber={mobileAmberHeader || isWarRoom}
            size="md"
            className={cn(
              'min-w-0',
              isWarRoom && 'lg:hidden',
              isGradientHome ? 'sm:scale-105' : 'shrink-0',
              mobileAmberHeader && 'max-lg:[&_span]:drop-shadow-[0_1px_8px_rgba(0,0,0,0.12)]',
            )}
          />
          <span
            className={cn(
              'hidden shrink-0 sm:inline',
              isWarRoom
                ? 'wr-topbar-clean__sep text-[var(--wr-slate)]/35 lg:hidden'
                : lightBrand
                  ? 'text-white/35'
                  : 'text-border-card/70',
              mobileAmberHeader && 'max-lg:text-white/40',
            )}
            aria-hidden
          >
            |
          </span>
          <div className="min-w-0 flex-1">
            {isWarRoom ? (
              <div className="flex min-w-0 flex-nowrap items-center gap-x-3 overflow-hidden sm:gap-x-4">
                {topbarExtras?.hidePageTitle ? null : (
                  <h1
                    className="wr-topbar-clean__title shrink-0 font-bold uppercase tracking-tight text-base text-[var(--wr-black,#000)] sm:text-lg max-lg:text-[var(--wr-black,#000)]"
                    title={pageTitle}
                  >
                    {pageTitle}
                  </h1>
                )}
                <div className="wr-topbar-clean__countdown-slot min-w-0 shrink truncate leading-none">
                  <WarRoomTopbarCountdown />
                </div>
              </div>
            ) : (
              <div className="flex min-w-0 flex-nowrap items-center gap-x-3 overflow-hidden sm:gap-x-4">
                {topbarExtras?.hidePageTitle ? null : (
                  <h1
                    className={cn(
                      'shrink-0 truncate font-bold uppercase tracking-tight text-sm sm:text-base',
                      lightBrand ? 'text-white max-lg:hidden' : 'text-text-primary',
                      mobileAmberHeader && 'max-lg:text-white/95',
                    )}
                    title={pageTitle}
                  >
                    {pageTitle}
                  </h1>
                )}
                <div
                  className={cn(
                    'min-w-0 shrink truncate leading-none',
                    lightBrand ? 'text-white/65' : 'text-text-muted',
                    mobileAmberHeader && 'max-lg:text-white/75',
                  )}
                >
                  <WarRoomTopbarCountdown />
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          {topbarExtras?.actions ? (
            <div className="flex items-center gap-1.5 sm:gap-2">{topbarExtras.actions}</div>
          ) : null}
          {isWarRoom ? null : <UserMenu amberMobileChrome={mobileAmberHeader} />}
        </div>
      </div>
    </header>
  )
}
