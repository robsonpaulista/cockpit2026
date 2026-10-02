'use client'

import Link from 'next/link'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils'
import type { ArenaViewerRole } from '@/lib/arena/types'
import '@/app/dashboard/mobilizacao/arena.css'

const NAV = [
  { href: '/dashboard/mobilizacao', label: 'Dashboard', match: (p: string) => p === '/dashboard/mobilizacao' },
  {
    href: '/dashboard/mobilizacao/membros',
    label: 'Membros',
    match: (p: string) => p.startsWith('/dashboard/mobilizacao/membros'),
  },
  {
    href: '/dashboard/mobilizacao/painel',
    label: 'Painel do apoiador',
    match: (p: string) => p.startsWith('/dashboard/mobilizacao/painel'),
  },
  {
    href: '/dashboard/mobilizacao/config',
    label: 'Config legado',
    match: (p: string) => p.startsWith('/dashboard/mobilizacao/config'),
  },
] as const

const ROLE_LABEL: Record<ArenaViewerRole, string> = {
  admin: 'Administrador',
  lideranca: 'Liderança',
  apoiador: 'Apoiador',
}

type Props = {
  children: React.ReactNode
  role: ArenaViewerRole
  onRoleChange?: (role: ArenaViewerRole) => void
  title?: string
  subtitle?: string
}

export function ArenaShell({ children, role, onRoleChange, title, subtitle }: Props) {
  const pathname = usePathname() ?? ''
  const searchParams = useSearchParams()
  const qs = searchParams.toString()
  const suffix = qs ? `?${qs}` : ''

  return (
    <div data-arena className="min-h-full w-full min-w-0">
      <div className="arena-shell">
        <header className="arena-nav">
          <p className="arena-nav__brand">Arena de Apoiadores</p>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={`${item.href}${suffix}`}
              className={cn('arena-nav__link', item.match(pathname) && 'arena-nav__link--on')}
            >
              {item.label}
            </Link>
          ))}
          <span className="arena-role">{ROLE_LABEL[role]}</span>
          {onRoleChange ? (
            <div className="arena-select-role" aria-label="Simular papel">
              {(['admin', 'lideranca', 'apoiador'] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  className={cn('arena-nav__link', role === r && 'arena-nav__link--on')}
                  onClick={() => onRoleChange(r)}
                >
                  {ROLE_LABEL[r]}
                </button>
              ))}
            </div>
          ) : null}
        </header>

        {(title || subtitle) && (
          <div>
            {title ? <h1 className="arena-h1">{title}</h1> : null}
            {subtitle ? <p className="arena-sub">{subtitle}</p> : null}
          </div>
        )}

        {children}
      </div>
    </div>
  )
}

export function ArenaSourcePill({
  kind,
}: {
  kind: 'api_oficial' | 'scraper' | 'interno'
}) {
  const cls =
    kind === 'api_oficial'
      ? 'arena-pill--api'
      : kind === 'scraper'
        ? 'arena-pill--scraper'
        : 'arena-pill--interno'
  const label =
    kind === 'api_oficial'
      ? 'API oficial'
      : kind === 'scraper'
        ? 'Scraper'
        : 'Sistema interno'
  return <span className={cn('arena-pill', cls)}>{label}</span>
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return `${parts[0]![0] ?? ''}${parts[parts.length - 1]![0] ?? ''}`.toUpperCase()
}

export function formatPts(n: number): string {
  return n.toLocaleString('pt-BR')
}
