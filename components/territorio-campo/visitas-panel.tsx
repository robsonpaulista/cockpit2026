'use client'

import dynamic from 'next/dynamic'
import { TseCarregando } from '@/components/tse/tse-ui'

const CampoVisitasPanel = dynamic(
  () => import('./campo-visitas-panel').then((mod) => mod.CampoVisitasPanel),
  {
    ssr: false,
    loading: () => <TseCarregando texto="Carregando Campo & Agenda…" />,
  }
)

export function VisitasPanel() {
  return <CampoVisitasPanel />
}
