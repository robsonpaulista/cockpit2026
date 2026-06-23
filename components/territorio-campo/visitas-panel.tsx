'use client'

import dynamic from 'next/dynamic'
import { Loader2 } from 'lucide-react'

const CampoVisitasPanel = dynamic(
  () => import('./campo-visitas-panel').then((mod) => mod.CampoVisitasPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Carregando Campo &amp; Agenda…
      </div>
    ),
  }
)

export function VisitasPanel() {
  return <CampoVisitasPanel />
}
