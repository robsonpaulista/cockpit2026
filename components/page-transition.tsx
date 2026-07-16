'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef, type ReactNode } from 'react'
import { useDashboardFixedChromeActive } from '@/contexts/dashboard-page-chrome-context'
import { cn } from '@/lib/utils'

interface PageTransitionProps {
  children: ReactNode
}

/**
 * Transição suave entre páginas do dashboard.
 * Fade + slide sutil ao trocar de rota — dá ar de produto premium.
 * Curto (350ms), elegante, funcional.
 *
 * Com chrome fixo (`DashboardPageShell`): preenche a coluna e deixa o scroll interno.
 * Sem chrome fixo: cresce com o conteúdo para o `DashboardScrollRegion` rolar.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const fixedChrome = useDashboardFixedChromeActive()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    if (pathname === prevPathRef.current) {
      // Mesmo path, apenas atualiza children normalmente
      setDisplayChildren(children)
      // Se a rota não mudou mas o efeito reexecutou (ex.: nova referência de `children`)
      // enquanto o fade-out ainda estava aguardando o timer, o cleanup cancela o timeout e
      // `isTransitioning` ficaria true para sempre — miolo em branco.
      setIsTransitioning(false)
      return
    }

    // Rota mudou: fade out → troca → fade in
    prevPathRef.current = pathname
    setIsTransitioning(true)

    const timer = setTimeout(() => {
      setDisplayChildren(children)
      setIsTransitioning(false)
    }, 150) // Fade out rápido, então troca

    return () => clearTimeout(timer)
  }, [pathname, children])

  return (
    <div
      className={cn(
        'page-transition flex flex-col',
        fixedChrome
          ? 'min-h-0 flex-1 overflow-hidden'
          : 'w-full min-w-0'
      )}
      style={{
        opacity: isTransitioning ? 0 : 1,
        transform: isTransitioning ? 'translateY(4px)' : 'translateY(0)',
        transition: 'opacity 0.2s ease-out, transform 0.2s ease-out',
      }}
    >
      {displayChildren}
    </div>
  )
}
