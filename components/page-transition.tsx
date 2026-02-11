'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState, useRef, type ReactNode } from 'react'

interface PageTransitionProps {
  children: ReactNode
}

/**
 * Transição suave entre páginas do dashboard.
 * Fade + slide sutil ao trocar de rota — dá ar de produto premium.
 * Curto (350ms), elegante, funcional.
 */
export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname()
  const [displayChildren, setDisplayChildren] = useState(children)
  const [isTransitioning, setIsTransitioning] = useState(false)
  const prevPathRef = useRef(pathname)

  useEffect(() => {
    if (pathname === prevPathRef.current) {
      // Mesmo path, apenas atualiza children normalmente
      setDisplayChildren(children)
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
      className="page-transition"
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
