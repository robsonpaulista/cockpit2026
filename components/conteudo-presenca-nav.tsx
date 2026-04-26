'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const links = [
  { href: '/dashboard/conteudo', label: 'Visão' },
  { href: '/dashboard/conteudo/obras', label: 'Obras' },
  { href: '/dashboard/conteudo/agenda', label: 'Agenda' },
  { href: '/dashboard/conteudo/cards', label: 'Cards' },
  { href: '/dashboard/conteudo/referencias', label: 'Referências' },
  { href: '/dashboard/conteudo/analise', label: 'Análise' },
  { href: '/dashboard/conteudo/redes', label: 'Instagram' },
]

export function ConteudoPresencaNav() {
  const pathname = usePathname()

  return (
    <nav className="flex flex-wrap gap-2 border-b border-border-card pb-4 mb-6">
      {links.map(({ href, label }) => {
        const active =
          href === '/dashboard/conteudo'
            ? pathname === href || pathname === `${href}/`
            : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            className={cn(
              'rounded-full px-4 py-2 text-sm font-medium transition-premium',
              active
                ? 'bg-accent-gold text-white shadow-card'
                : 'bg-bg-surface text-text-secondary hover:bg-accent-gold-soft border border-border-card'
            )}
          >
            {label}
          </Link>
        )
      })}
    </nav>
  )
}
