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
    <nav className="mb-6 border-b border-border-card pb-4">
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 [scrollbar-width:thin]">
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
              'shrink-0 rounded-full px-4 py-2 text-sm font-medium transition-premium',
              active
                ? 'border border-[#C8900A] bg-[#C8900A] text-white shadow-card'
                : 'border border-border-card bg-bg-surface text-black hover:bg-[#C8900A]/10',
            )}
          >
            {label}
          </Link>
        )
      })}
      </div>
    </nav>
  )
}
