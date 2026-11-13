'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { Bell } from 'lucide-react'
import { UserMenu } from './user-menu'
import { useTheme } from '@/contexts/theme-context'
import { territorioCampoPageTitle } from '@/lib/territorio-campo-route'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { useDashboardTopbarExtras } from '@/contexts/dashboard-topbar-extras-context'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
import { dashboardMobilePageHeaderClass } from '@/lib/rest-screen-chrome'
import { AGENDA_HREF } from '@/lib/resumo-eleicoes-hub-route'
import { TopbarBrandBlock } from '@/components/dashboard/topbar-brand-block'
import { TopbarSystemSearch } from '@/components/dashboard/topbar-system-search'

const pathToTitle: Record<string, string> = {
  '/dashboard': 'Início',
  '/dashboard/narrativas': 'Estratégia',
  '/dashboard/campo': 'Base Eleitoral · Visitas',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/territorio': 'Base Eleitoral',
  '/dashboard/territorio/ipt': 'Mapa de Diagnóstico da Campanha',
  '/dashboard/chapas': 'Chapa Federal',
  '/dashboard/chapas-estaduais': 'Chapa Estadual',
  '/dashboard/resumo-eleicoes': 'Atendimento',
  '/dashboard/resumo-eleicoes/secao': 'Votação por Seção',
  '/dashboard/resumo-eleicoes/resultado-2026': 'Resultado 2026',
  '/dashboard/conteudo': 'Redes Sociais',
  '/dashboard/noticias': 'Radar eleitoral',
  '/dashboard/noticias/monitoramento': 'Radar eleitoral',
  '/dashboard/radar-224': 'Radar 224',
  '/dashboard/mobilizacao': 'Arena de Apoiadores',
  '/dashboard/mobilizacao/membros': 'Arena · Membros',
  '/dashboard/mobilizacao/painel': 'Arena · Painel',
  '/dashboard/mobilizacao/config': 'Arena · Config legado',
  '/dashboard/whatsapp': 'WhatsApp',
  '/dashboard/war-room': 'Termômetro',
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
  '/dashboard/oportunidades-federais': 'Oportunidades federais',
  '/dashboard/ficha-atendimento': 'Ficha de Atendimento',
}

function getPageTitle(pathname: string, tab: string | null, _view: string | null): string {
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
    return 'Redes Sociais'
  }
  return pathToTitle[pathname] ?? tituloPorCaminho(pathname)
}

function tituloPorCaminho(pathname: string): string {
  const partes = pathname
    .replace(/^\/dashboard\/?/, '')
    .split('/')
    .filter(Boolean)
    .map((p) => p.replace(/-/g, ' '))
  return partes.join(' · ') || 'Visão Geral'
}

export function DashboardHeader() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { theme, appearance } = useTheme()
  const p = pathname ?? ''
  const pageTitle = getPageTitle(p, searchParams.get('tab'), searchParams.get('view'))

  const showTopbar = useDashboardTopbarVisible()
  const topbarExtras = useDashboardTopbarExtras()
  const isRepublicanosPremium = theme === 'republicanos' && appearance === 'light'
  const isGradientHome = useDashboardHomeChrome()
  /** OPÇÃO B: topbar amarelo TSE (Termômetro incluso; sem chrome gelo). */
  const opcaoB = !isGradientHome

  if (!showTopbar && !opcaoB) {
    return null
  }

  const mobileAmberHeader = !isGradientHome
  const lightBrand = isGradientHome

  return (
    <header
      id="cockpit-topbar"
      data-topbar-opcao={opcaoB ? 'b' : undefined}
      className={cn(
        'sticky top-0 z-30',
        isGradientHome
          ? 'bg-transparent backdrop-blur-md'
          : cn(
              'lg:bg-[rgb(var(--bg-sidebar))]',
              isRepublicanosPremium && 'republicanos-premium-header',
              mobileAmberHeader && dashboardMobilePageHeaderClass,
            ),
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 max-lg:pl-[4.5rem] max-lg:pr-2 sm:gap-3 lg:gap-3 lg:px-5',
          isGradientHome ? 'h-12 lg:h-14' : 'h-16',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2.5 sm:gap-3">
          {/* Marca no topbar só quando a zona da sidebar não está à vista */}
          <TopbarBrandBlock className={cn('shrink-0', opcaoB ? 'lg:hidden' : undefined)} />
          <span
            className={cn(
              'hidden h-6 w-px shrink-0 bg-[#333333]/25 sm:block',
              opcaoB ? 'lg:hidden' : undefined,
            )}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            {topbarExtras?.hidePageTitle ? null : (
              <h1
                className={cn(
                  'truncate font-semibold tracking-tight',
                  lightBrand
                    ? 'text-sm text-white max-lg:hidden sm:text-base'
                    : 'text-[15px] text-[#333333] sm:text-base',
                  mobileAmberHeader && 'max-lg:text-[#333333]',
                )}
                title={pageTitle}
              >
                {pageTitle}
              </h1>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
          {topbarExtras?.actions ? (
            <div className="flex items-center gap-1.5 sm:gap-2">{topbarExtras.actions}</div>
          ) : null}
          {opcaoB ? <TopbarSystemSearch /> : null}
          {opcaoB ? (
            <Link
              href={AGENDA_HREF}
              className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[#333333] transition-colors hover:bg-black/10"
              title="Agenda"
              aria-label="Agenda"
            >
              <Bell className="h-4 w-4" strokeWidth={2} aria-hidden />
            </Link>
          ) : null}
          <UserMenu amberMobileChrome={mobileAmberHeader} avatarOnly={opcaoB} />
        </div>
      </div>
    </header>
  )
}
