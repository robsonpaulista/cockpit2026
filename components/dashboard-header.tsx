'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Moon, Sun } from 'lucide-react'
import { UserMenu } from './user-menu'
import { useTheme } from '@/contexts/theme-context'
import { useCockpitStatus } from '@/contexts/cockpit-status-context'
import { getCockpitPageLabel } from '@/lib/cockpit-page-label'
import { cn } from '@/lib/utils'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
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

const MAPA_TDS_FUTURISTIC_ROUTE = '/dashboard/territorio/mapa-tds'

function mapaTdsHeaderTitleFromSearch(aba: string | null): string {
  if (aba === 'mapa-digital-ig') return 'Mapa Exército Digital'
  if (aba === 'pesquisas') return 'Mapa Pesquisas'
  return 'Mapa de Dominância Eleitoral'
}

/** Mesmo bloco visual do topo da sidebar (C + nome). */
function DashboardAppBrand({ isCockpit }: { isCockpit: boolean }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div
        className={cn(
          'flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-bold text-white shadow-sm',
          isCockpit
            ? 'bg-gradient-to-br from-[#062e52] via-[#0b4a7a] to-[#1368a8]'
            : 'bg-accent-gold',
        )}
      >
        <span>C</span>
      </div>
      <span className="max-w-[9rem] truncate text-sm font-semibold text-text-primary sm:max-w-none">
        Cockpit 2026
      </span>
    </div>
  )
}

export function DashboardHeader() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const { theme, appearance, setAppearance } = useTheme()
  const { metrics } = useCockpitStatus()
  const mapaTdsFuturisticShell = (pathname ?? '').startsWith(MAPA_TDS_FUTURISTIC_ROUTE)
  const mapaTdsTituloContexto = mapaTdsFuturisticShell
    ? mapaTdsHeaderTitleFromSearch(searchParams.get('aba'))
    : null
  const pageTitle = mapaTdsTituloContexto ?? getPageTitle(pathname ?? '')
  const cockpitPageLabel = mapaTdsTituloContexto ?? getCockpitPageLabel(pathname ?? '/dashboard')

  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(t)
  }, [])

  const territorioLinha = metrics?.territorioLabel ?? '—'
  const lugarLinha = metrics?.lugarChapa ?? '—'
  /** Link compartilhado com `tema=republicanos-claro` alinha aparência global para claro. */
  useEffect(() => {
    if (!mapaTdsFuturisticShell) return
    if (searchParams.get('tema') === 'republicanos-claro' && appearance === 'dark') {
      setAppearance('light')
    }
  }, [mapaTdsFuturisticShell, searchParams, appearance, setAppearance])

  const syncMapaTemaQuery = (mode: 'light' | 'dark') => {
    if (!mapaTdsFuturisticShell || !pathname) return
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

  if (!showTopbar) {
    return null
  }

  if (theme === 'cockpit') {
    return (
      <header
        className={cn(
          'sticky top-0 z-30 border-b',
          appearance === 'dark'
            ? 'border-border-card bg-bg-surface'
            : 'border-white/40 bg-white/35 backdrop-blur-md',
        )}
      >
        <div className="flex min-h-[3rem] flex-col gap-2 px-4 py-2 sm:flex-row sm:items-center sm:justify-between lg:px-6">
          <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
            <DashboardAppBrand isCockpit />
            <span className="hidden shrink-0 text-border-card/70 sm:inline" aria-hidden>
              |
            </span>
            <span className="shrink-0 text-sm font-bold tracking-tight text-text-primary" title={pageTitle}>
              {cockpitPageLabel}
            </span>
            <span className="hidden shrink-0 text-border-card/70 sm:inline" aria-hidden>
              |
            </span>
            <div
              className={cn(
                'flex min-w-0 flex-1 flex-wrap items-center gap-x-2.5 gap-y-1 rounded-full border border-border-card/60 px-3 py-1.5 text-[10px] text-text-secondary shadow-[0_4px_20px_rgba(15,70,120,0.08)] sm:max-w-none sm:flex-initial sm:px-4 sm:py-2 sm:text-[11px] cockpit-glass',
              )}
            >
              <span className="inline-flex shrink-0 items-center gap-2 font-semibold text-[rgb(15,45,74)]">
                <span
                  className="cockpit-pulse-dot-brand h-2 w-2 shrink-0 rotate-45 rounded-[2px] bg-gradient-to-br from-[#062e52] via-[#0b4a7a] to-[#1368a8] shadow-[0_0_0_2px_rgba(255,255,255,0.65)]"
                  aria-hidden
                />
                SISTEMA ATIVO
              </span>
              <span className="hidden text-border-card/80 sm:inline" aria-hidden>
                |
              </span>
              <span className="whitespace-nowrap text-text-secondary">{territorioLinha}</span>
              <span className="hidden text-border-card/80 sm:inline" aria-hidden>
                |
              </span>
              <span className="whitespace-nowrap text-text-secondary">{lugarLinha}</span>
              <span className="hidden text-border-card/80 sm:inline" aria-hidden>
                |
              </span>
              <span className="whitespace-nowrap text-text-secondary tabular-nums">
                Atualizado {now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 justify-end sm:ml-2">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  'inline-flex items-center gap-1 rounded-lg border p-1',
                  appearance === 'dark' ? 'border-border-card bg-bg-app' : 'border-border-card bg-bg-surface',
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
                      ? 'bg-accent-gold-soft text-text-primary'
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
                      ? 'bg-accent-gold-soft text-text-primary'
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
    <header className="sticky top-0 z-30 border-b border-border-card bg-bg-surface">
      <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <DashboardAppBrand isCockpit={false} />
          <span className="shrink-0 text-border-card/70" aria-hidden>
            |
          </span>
          <h1 className="truncate text-xl font-semibold text-text-primary">{pageTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
          <div
            className="inline-flex items-center gap-1 rounded-lg border border-border-card bg-bg-app p-1"
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
                  ? 'bg-accent-gold-soft text-text-primary'
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
                  ? 'bg-accent-gold-soft text-text-primary'
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
