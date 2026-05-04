'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import { UserMenu } from './user-menu'
import { useTheme } from '@/contexts/theme-context'
import { useCockpitStatus } from '@/contexts/cockpit-status-context'
import { getCockpitPageLabel } from '@/lib/cockpit-page-label'
import { MAPA_TDS_ROUTE_PREFIX, MOBILIZACAO_MAPA_DIGITAL_IG_ROUTE } from '@/lib/dashboard-mapa-futuristic-chrome'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { AppBrandTitle } from '@/components/app-brand-title'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
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
  '/dashboard/conteudo': 'Presença & Conteúdo',
  '/dashboard/noticias': 'Notícias & Crises',
  '/dashboard/mobilizacao': 'Mobilização',
  '/dashboard/mobilizacao/config': 'Mobilização · Config',
  '/dashboard/mobilizacao/mapa-digital-ig': 'Mobilização · Mapa Exército Digital',
  '/dashboard/whatsapp': 'WhatsApp',
  '/dashboard/pesquisa': 'Pesquisa & Relato',
  '/dashboard/operacao': 'Operação & Equipe',
  '/dashboard/juridico': 'Jurídico',
  '/dashboard/obras': 'Obras',
  '/dashboard/proposicoes': 'Proposições',
  '/dashboard/usuarios': 'Gestão de Usuários',
}

function getPageTitle(pathname: string): string {
  if (pathname.startsWith('/dashboard/conteudo/')) {
    const rest = pathname.slice('/dashboard/conteudo/'.length)
    if (rest.startsWith('redes')) return 'Presença · Instagram'
    if (rest.startsWith('obras')) return 'Presença · Obras (cards)'
    if (rest.startsWith('agenda')) return 'Presença · Agenda campo'
    if (rest.startsWith('cards')) return 'Presença · Cards'
    if (rest.startsWith('referencias')) return 'Presença · Referências visuais'
    if (rest.startsWith('analise')) return 'Presença · Análise'
    if (rest.startsWith('instagram-lideres')) return 'Presença · Instagram líderes'
    return 'Presença & Conteúdo'
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
  const { metrics } = useCockpitStatus()
  const p = pathname ?? ''
  const mapaFuturisticShell =
    p.startsWith(MAPA_TDS_ROUTE_PREFIX) || p.startsWith(MOBILIZACAO_MAPA_DIGITAL_IG_ROUTE)
  const mapaFuturisticTituloContexto = p.startsWith(MOBILIZACAO_MAPA_DIGITAL_IG_ROUTE)
    ? 'Mapa Exército Digital'
    : p.startsWith(MAPA_TDS_ROUTE_PREFIX)
      ? mapaTdsHeaderTitleFromSearch(searchParams.get('aba'))
      : null
  const pageTitle = mapaFuturisticTituloContexto ?? getPageTitle(pathname ?? '')
  const cockpitPageLabel = mapaFuturisticTituloContexto ?? getCockpitPageLabel(pathname ?? '/dashboard')

  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const territorioLinha = metrics?.territorioLabel ?? '—'
  const lugarLinha = metrics?.lugarChapa ?? '—'
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

  if (!showTopbar) {
    return null
  }

  if (theme === 'cockpit') {
    return (
      <header
        className={cn(
          'sticky top-0 z-30',
          isGradientHome ? 'bg-transparent backdrop-blur-md' : 'sidebar-cockpit-shell',
        )}
      >
        <div className="flex min-h-16 flex-col gap-2 py-2 max-lg:pl-[4.5rem] max-lg:pr-3 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <AppBrandTitle
              isCockpit={!isGradientHome}
              lightOnGradient={isGradientHome}
              className="shrink-0 whitespace-nowrap"
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
            <span
              className={cn(
                'min-w-0 flex-1 truncate text-sm font-bold tracking-tight',
                isGradientHome ? 'text-white' : 'text-text-primary',
              )}
              title={pageTitle}
            >
              {cockpitPageLabel}
            </span>
            <span
              className={cn(
                'hidden shrink-0 sm:inline',
                isGradientHome ? 'text-white/35' : 'text-border-card/70',
              )}
              aria-hidden
            >
              |
            </span>
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border px-3 py-1.5 text-[10px] shadow-[0_4px_20px_rgba(15,70,120,0.08)] sm:max-w-none sm:flex-initial sm:px-4 sm:py-2 sm:text-[11px]',
                isGradientHome
                  ? 'border-white/25 bg-white/10 text-white/90 backdrop-blur-sm'
                  : 'border-border-card/60 text-text-secondary cockpit-glass',
              )}
            >
              <span
                className={cn(
                  'inline-flex shrink-0 items-center gap-2 font-semibold',
                  isGradientHome ? 'text-white' : 'text-[rgb(15,45,74)]',
                )}
              >
                <span
                  className="cockpit-pulse-dot-brand h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-gradient-to-br from-[#062e52] via-[#0b4a7a] to-[#1368a8] shadow-[0_0_0_2px_rgba(255,255,255,0.65)]"
                  aria-hidden
                />
                SISTEMA ATIVO
              </span>
              <span
                className={cn('hidden sm:inline', isGradientHome ? 'text-white/40' : 'text-border-card/80')}
                aria-hidden
              >
                |
              </span>
              <span
                className={cn(
                  'whitespace-nowrap',
                  isGradientHome ? 'text-white/85' : 'text-text-secondary',
                )}
              >
                {territorioLinha}
              </span>
              <span
                className={cn('hidden sm:inline', isGradientHome ? 'text-white/40' : 'text-border-card/80')}
                aria-hidden
              >
                |
              </span>
              <span
                className={cn(
                  'whitespace-nowrap',
                  isGradientHome ? 'text-white/85' : 'text-text-secondary',
                )}
              >
                {lugarLinha}
              </span>
              <span
                className={cn('hidden sm:inline', isGradientHome ? 'text-white/40' : 'text-border-card/80')}
                aria-hidden
              >
                |
              </span>
              <span
                className={cn(
                  'whitespace-nowrap tabular-nums',
                  isGradientHome ? 'text-white/85' : 'text-text-secondary',
                )}
              >
                Atualizado {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 justify-end sm:ml-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border p-1',
                  isGradientHome
                    ? 'border-white/25 bg-white/10 backdrop-blur-sm'
                    : appearance === 'dark'
                      ? 'border-border-card bg-bg-app'
                      : 'border-border-card bg-bg-surface',
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
        </div>
      </header>
    )
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
      <div className="flex h-16 items-center justify-between gap-2 max-lg:pl-[4.5rem] max-lg:pr-2 sm:gap-3 lg:gap-3 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
          <AppBrandTitle
            isCockpit={false}
            lightOnGradient={isGradientHome}
            className="shrink-0 whitespace-nowrap"
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
              isGradientHome ? 'text-white' : 'text-text-primary',
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
