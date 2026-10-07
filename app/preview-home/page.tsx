import type { Metadata } from 'next'
import { CockpitHome } from '@/components/home/cockpit-home'

export const metadata: Metadata = {
  title: 'Entrar',
  description: 'Cockpit X — assuma o controle do seu mandato',
  robots: { index: false, follow: false },
}

/** Alias da home pública — preferir `/`. */
export default function PreviewHomePage() {
  return <CockpitHome />
}
