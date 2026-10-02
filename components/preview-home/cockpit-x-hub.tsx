'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  BarChart3,
  Building2,
  FileText,
  Map,
  Megaphone,
} from 'lucide-react'
import { UserMenu } from '@/components/user-menu'
import { cn } from '@/lib/utils'
import './cockpit-x-hub.css'

export const HOME_HUB_IMAGE = '/splash/homenova.png'

export type CockpitXHubModuleId =
  | 'atendimentos'
  | 'territorio'
  | 'realizacoes'
  | 'comunicacao'
  | 'relatorios'

export type CockpitXHubModule = {
  id: CockpitXHubModuleId
  title: string
  description: string
  icon: typeof BarChart3
  /** Rota do dashboard; indefinido = ainda sem navegação. */
  href?: string
}

/** Módulos da home — rotas preenchidas conforme forem definidas. */
export const COCKPIT_X_HUB_MODULES: CockpitXHubModule[] = [
  {
    id: 'atendimentos',
    title: 'Atendimentos',
    description: 'Painel das cidades, Agenda, Resultados…',
    icon: BarChart3,
    href: '/dashboard/resumo-eleicoes',
  },
  {
    id: 'territorio',
    title: 'Território',
    description: 'Cobertura e presença de campo.',
    icon: Map,
    href: '/dashboard/territorio',
  },
  {
    id: 'realizacoes',
    title: 'Realizações',
    description: 'Obras e emendas.',
    icon: Building2,
  },
  {
    id: 'comunicacao',
    title: 'Comunicação',
    description: 'Redes sociais e mídia.',
    icon: Megaphone,
  },
  {
    id: 'relatorios',
    title: 'Relatórios',
    description: 'Dados e inteligência.',
    icon: FileText,
  },
]

function formatHubClock(now: Date): string {
  const weekday = now
    .toLocaleDateString('pt-BR', { weekday: 'short', timeZone: 'America/Sao_Paulo' })
    .replace('.', '')
  const day = now.toLocaleDateString('pt-BR', {
    day: '2-digit',
    timeZone: 'America/Sao_Paulo',
  })
  const month = now
    .toLocaleDateString('pt-BR', { month: 'short', timeZone: 'America/Sao_Paulo' })
    .replace('.', '')
  const year = now.toLocaleDateString('pt-BR', {
    year: 'numeric',
    timeZone: 'America/Sao_Paulo',
  })
  const time = now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'America/Sao_Paulo',
  })
  const wd = weekday.charAt(0).toUpperCase() + weekday.slice(1)
  const mo = month.charAt(0).toUpperCase() + month.slice(1)
  return `${wd}, ${day} ${mo} ${year} ${time}`
}

/**
 * Home pós-login (Cockpit X) — hub com módulos no lugar da sidebar.
 * Rotas dos botões serão definidas pelo usuário.
 */
export function CockpitXHub() {
  const router = useRouter()
  const [activeId, setActiveId] = useState<CockpitXHubModuleId>('atendimentos')
  const [now, setNow] = useState(() => new Date())

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 30_000)
    return () => window.clearInterval(id)
  }, [])

  const clockLabel = formatHubClock(now)

  const handleModuleClick = (mod: CockpitXHubModule) => {
    setActiveId(mod.id)
    if (mod.href) router.push(mod.href)
  }

  return (
    <div className="cx-hub">
      <div className="cx-hub__media" aria-hidden>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img className="cx-hub__still" src={HOME_HUB_IMAGE} alt="" decoding="async" />
        <div className="cx-hub__scrim" />
      </div>

      <header className="cx-hub__top">
        <div className="cx-hub__meta-left" aria-hidden />

        <div className="cx-hub__brand" aria-hidden />

        <div className="cx-hub__meta-right">
          <p className="cx-hub__status">
            <span className="cx-hub__status-dot" aria-hidden />
            Online
            <span className="cx-hub__status-sep" aria-hidden>
              ·
            </span>
            <time dateTime={now.toISOString()}>{clockLabel}</time>
          </p>
          <UserMenu variant="hub" className="cx-hub__user-menu" />
        </div>
      </header>

      <div className="cx-hub__dock">
        <nav className="cx-hub__modules" aria-label="Ambientes de trabalho">
          {COCKPIT_X_HUB_MODULES.map((mod) => {
            const Icon = mod.icon
            const isActive = activeId === mod.id
            return (
              <button
                key={mod.id}
                type="button"
                className={cn('cx-hub__module', isActive && 'cx-hub__module--active')}
                aria-pressed={isActive}
                onClick={() => handleModuleClick(mod)}
              >
                <Icon className="cx-hub__module-ico" strokeWidth={1.5} aria-hidden />
                <span className="cx-hub__module-title">{mod.title}</span>
                <span className="cx-hub__module-desc">{mod.description}</span>
              </button>
            )
          })}
        </nav>
      </div>
    </div>
  )
}
