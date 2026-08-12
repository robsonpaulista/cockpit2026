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
  title: 'Cockpit 2026 — Entrar',
  description: 'Home cinematográfica do Cockpit 2026 (login)',
  robots: { index: false, follow: false },
}

/** Alias da home pública — preferir `/`. */
export default function PreviewHomePage() {
  return (
    <div className={outfit.variable} style={{ fontFamily: 'var(--font-preview-home), Outfit, sans-serif' }}>
      <PreviewHomeScreen />
    </div>
  )
}
