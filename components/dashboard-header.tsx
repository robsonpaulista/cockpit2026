'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import { UserMenu } from './user-menu'
import { useTheme } from '@/contexts/theme-context'
import { MAPA_TDS_ROUTE_PREFIX } from '@/lib/dashboard-mapa-futuristic-chrome'
import { MONITORAMENTO_TAB_LIDERES } from '@/lib/monitoramento-lideres-route'
import {
  TERRITORIO_CAMPO_TAB_BASE,
  TERRITORIO_CAMPO_TAB_VISITAS,
} from '@/lib/territorio-campo-route'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { AppBrandTitle } from '@/components/app-brand-title'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
import { isDashboardHomePath } from '@/lib/dashboard-home-chrome'
const pathToTitle: Record<string, string> = {
  '/dashboard': 'Visão Geral',
  '/dashboard/narrativas': 'Estratégia',
  '/dashboard/campo': 'Território & Campo · Visitas',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/territorio': 'Território & Campo',
  '/dashboard/territorio/mapa-tds': 'Mapa — Territórios de desenvolvimento',
  '/dashboard/chapas': 'Chapas',
  '/dashboard/chapas-estaduais': 'Chapas Estaduais',
  '/dashboard/resumo-eleicoes': 'Resumo Eleições',
  '/dashboard/conteudo': 'Redes Sociais',
  '/dashboard/noticias': 'Radar eleitoral',
  '/dashboard/noticias/monitoramento': 'Radar eleitoral',
  '/dashboard/mobilizacao': 'Mobilização',
  '/dashboard/mobilizacao/config': 'Mobilização · Config',
  '/dashboard/mobilizacao/mapa-digital-ig': 'Central de monitoramento · Engajamento Líderes',
  '/dashboard/whatsapp': 'WhatsApp',
  '/dashboard/pesquisa': 'Pesquisa & Relato',
  '/dashboard/operacao': 'Operação & Equipe',
  '/dashboard/juridico': 'Jurídico',
  '/dashboard/emendas': 'Emendas',
  '/dashboard/obras': 'Obras',
  '/dashboard/proposicoes': 'Proposições',
  '/dashboard/usuarios': 'Gestão de Usuários',
  '/dashboard/log-system': 'Log System',
}

function getPageTitle(pathname: string, tab: string | null, _view: string | null): string {
  if (pathname === '/dashboard/noticias/monitoramento' && tab === MONITORAMENTO_TAB_LIDERES) {
    return 'Radar eleitoral · Eng. líderes'
  }
  if (pathname === '/dashboard/territorio') {
    if (tab === TERRITORIO_CAMPO_TAB_BASE) return 'Território & Campo · Base'
    if (tab === TERRITORIO_CAMPO_TAB_VISITAS) return 'Território & Campo · Visitas'
    return 'Território & Campo'
  }
  if (pathname.startsWith('/dashboard/conteudo/')) {
    const rest = pathname.slice('/dashboard/conteudo/'.length)
    if (rest.startsWith('redes')) return 'Redes Sociais · Instagram'
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
  const router = useRouter()
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

  const syncMapaTemaQuery = (mode: 'light' | 'dark') => {
    if (!mapaFuturisticShell || !pathname) return
    const p = new URLSearchParams(searchParams.toString())
    if (mode === 'light') {
      p.set('tema', 'republicanos-claro')
    } else {
      p.delete('tema')
    }
    const q = p.toString()
    router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false })
  }

  const applyAppearanceMode = (mode: 'light' | 'dark') => {
    setAppearance(mode)
    syncMapaTemaQuery(mode)
  }

  const showTopbar = useDashboardTopbarVisible()
  const isRepublicanosPremium = theme === 'republicanos' && appearance === 'light'
  const isGradientHome = useDashboardHomeChrome()
  const isHome = isDashboardHomePath(p)

  if (!showTopbar || isHome) {
    return null
  }

  return (
    <header
      className={cn(
        'sticky top-0 z-30',
        isGradientHome
          ? 'bg-transparent backdrop-blur-md'
          : cn('bg-[rgb(var(--bg-sidebar))]', isRepublicanosPremium && 'republicanos-premium-header'),
      )}
    >
      <div
        className={cn(
          'flex items-center justify-between gap-2 max-lg:pl-[4.5rem] max-lg:pr-2 sm:gap-3 lg:h-16 lg:gap-3 lg:px-6',
          isGradientHome ? 'h-12' : 'h-16',
        )}
      >
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <AppBrandTitle
            isCockpit={false}
            lightOnGradient={isGradientHome}
            className={cn(
              'min-w-0 truncate',
              isGradientHome ? 'text-[0.95rem] sm:text-[1.16rem]' : 'shrink-0 whitespace-nowrap',
            )}
          />
          <span
            className={cn(
              'hidden shrink-0 sm:inline',
              isGradientHome ? 'text-white/35' : 'text-border-card/70',
            )}
            aria-hidden
          >
            |
          </span>
          <h1
            className={cn(
              'min-w-0 flex-1 truncate text-sm font-bold tracking-tight sm:text-base',
              isGradientHome ? 'text-white max-lg:hidden' : 'text-text-primary',
            )}
            title={pageTitle}
          >
            {pageTitle}
          </h1>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div
            className={cn(
              'inline-flex items-center gap-1 rounded-lg border p-1',
              isGradientHome
                ? 'border-white/25 bg-white/10 backdrop-blur-sm'
                : 'border-border-card bg-bg-app',
            )}
            aria-label="Alternar aparência clara ou escura"
          >
            <button
              type="button"
              onClick={() => applyAppearanceMode('dark')}
              aria-label="Aparência escura"
              title="Escuro"
              className={cn(
                'inline-flex items-center justify-center rounded-md p-1.5 transition-colors duration-200 ease-out',
                appearance === 'dark'
                  ? isGradientHome
                    ? 'bg-white/20 text-white'
                    : 'bg-accent-gold-soft text-text-primary'
                  : isGradientHome
                    ? 'text-white/80 hover:bg-white/15'
                    : 'text-text-secondary hover:bg-accent-gold-soft/60',
              )}
            >
              <Moon className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => applyAppearanceMode('light')}
              aria-label="Aparência clara"
              title="Claro"
              className={cn(
                'inline-flex items-center justify-center rounded-md p-1.5 transition-colors duration-200 ease-out',
                appearance === 'light'
                  ? isGradientHome
                    ? 'bg-white/20 text-white'
                    : 'bg-accent-gold-soft text-text-primary'
                  : isGradientHome
                    ? 'text-white/80 hover:bg-white/15'
                    : 'text-text-secondary hover:bg-accent-gold-soft/60',
              )}
            >
              <Sun className="h-3.5 w-3.5" />
            </button>
          </div>
          <UserMenu />
        </div>
      </div>
    </header>
  )
}
