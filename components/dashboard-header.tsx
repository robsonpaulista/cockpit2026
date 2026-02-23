'use client'

import { usePathname } from 'next/navigation'
import { UserMenu } from './user-menu'

const pathToTitle: Record<string, string> = {
  '/dashboard': 'Visão Geral',
  '/dashboard/fases': 'Fases da Campanha',
  '/dashboard/narrativas': 'Bandeiras de Campanha',
  '/dashboard/campo': 'Campo & Agenda',
  '/dashboard/agenda': 'Agenda',
  '/dashboard/territorio': 'Território & Base',
  '/dashboard/chapas': 'Chapas',
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
  const pageTitle = getPageTitle(pathname ?? '')

  return (
    <header className="sticky top-0 z-30 bg-bg-surface border-b border-border-card">
      <div className="h-16 flex items-center justify-between px-4 lg:px-6">
        <h1 className="text-xl font-semibold text-text-primary">
          Cockpit 2026<span className="text-text-secondary font-normal"> &gt; </span>{pageTitle}
        </h1>
        <UserMenu />
      </div>
    </header>
  )
}




