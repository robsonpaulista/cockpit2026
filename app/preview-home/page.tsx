import type { Metadata } from 'next'
import { Outfit } from 'next/font/google'
import { PreviewHomeScreen } from '@/components/preview-home/preview-home-screen'
import '@/app/dashboard/war-room/war-room-fonts.css'

const outfit = Outfit({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  display: 'swap',
  variable: '--font-preview-home',
})

export const metadata: Metadata = {
  title: 'Cockpit 2026 — Prévia da home',
  description: 'Prévia da futura home do Cockpit 2026',
  robots: { index: false, follow: false },
}

/** Prévia da futura home (não substitui `/`). */
export default function PreviewHomePage() {
  return (
    <div className={outfit.variable} style={{ fontFamily: 'var(--font-preview-home), Outfit, sans-serif' }}>
      <PreviewHomeScreen />
    </div>
  )
}
