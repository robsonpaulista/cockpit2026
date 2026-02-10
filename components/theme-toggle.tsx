'use client'

import { useState, useRef, useEffect } from 'react'
import { useTheme } from '@/contexts/theme-context'
import { Palette } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ThemeToggleProps {
  collapsed?: boolean
  mobileOpen?: boolean
}

const themes = [
  {
    id: 'premium' as const,
    label: 'Premium Bege',
    description: 'Tons dourados e bege',
    colors: ['#C6A15B', '#F7F4EF', '#E8D9B8'],
  },
  {
    id: 'agentes' as const,
    label: 'Agentes',
    description: 'Tons laranja e cinza moderno',
    colors: ['#de5a12', '#f8fafc', '#fdecd6'],
  },
]

export function ThemeToggle({ collapsed = false, mobileOpen = false }: ThemeToggleProps) {
  const { theme, setTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  const showLabel = !collapsed || mobileOpen

  // Fechar ao clicar fora
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [open])

  return (
    <div className="relative" ref={containerRef}>
      <button
        onClick={() => setOpen(!open)}
        className={cn(
          'flex items-center gap-3 px-3 py-2.5 rounded-[10px] w-full',
          'transition-all duration-200 ease-out group',
          'hover:bg-accent-gold-soft'
        )}
        title="Trocar tema visual"
      >
        <Palette className="w-5 h-5 flex-shrink-0 text-text-secondary group-hover:text-accent-gold transition-colors" />
        {showLabel && (
          <span className="text-sm text-text-secondary group-hover:text-text-primary transition-colors">
            Tema
          </span>
        )}
      </button>

      {open && (
        <div
          className={cn(
            'absolute z-50 bg-bg-surface border border-border-card rounded-xl shadow-card-hover p-3 min-w-[200px]',
            collapsed && !mobileOpen
              ? 'left-full ml-3 bottom-0'
              : 'bottom-full mb-2 left-0 right-0'
          )}
        >
          <p className="text-xs font-semibold text-text-primary mb-2 px-1">Escolha o tema</p>

          <div className="space-y-1">
            {themes.map((t) => {
              const isActive = theme === t.id
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setTheme(t.id)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex items-center gap-3 w-full px-3 py-2.5 rounded-lg transition-all duration-200',
                    isActive
                      ? 'bg-accent-gold-soft ring-1 ring-accent-gold/30'
                      : 'hover:bg-bg-app'
                  )}
                >
                  {/* Preview de cores */}
                  <div className="flex -space-x-1">
                    {t.colors.map((color, i) => (
                      <div
                        key={i}
                        className="w-4 h-4 rounded-full border-2 border-bg-surface"
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>

                  <div className="flex-1 text-left">
                    <span className="text-xs font-semibold text-text-primary block">{t.label}</span>
                    <span className="text-[10px] text-text-muted">{t.description}</span>
                  </div>

                  {isActive && (
                    <div className="w-4 h-4 rounded-full bg-accent-gold flex items-center justify-center">
                      <svg className="w-2.5 h-2.5 text-white" viewBox="0 0 12 12" fill="none">
                        <path d="M2 6L5 9L10 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
