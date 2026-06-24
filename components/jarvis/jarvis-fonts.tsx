'use client'

import { JetBrains_Mono, Orbitron } from 'next/font/google'
import { cn } from '@/lib/utils'
import { APP_FONT_BODY_CLASS } from '@/lib/app-font-stack'

const orbitron = Orbitron({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-jarvis-display',
  display: 'swap',
})

const jetbrains = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-jarvis-mono',
  display: 'swap',
})

export function JarvisFontScope({
  children,
  className,
  style,
}: {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}) {
  return (
    <div
      className={cn(orbitron.variable, jetbrains.variable, APP_FONT_BODY_CLASS, className)}
      style={style}
    >
      {children}
    </div>
  )
}
