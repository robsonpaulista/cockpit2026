'use client'

import dynamic from 'next/dynamic'
import { ResumoEleicoesShell } from '@/components/resumo-eleicoes/resumo-eleicoes-shell'
import { PanelLoader } from '@/components/resumo-eleicoes/panel-loader'
import type { ChapasEscopo } from '@/components/chapas/chapas-panel'

const ChapasPanel = dynamic(
  () => import('@/components/chapas/chapas-panel').then((mod) => mod.ChapasPanel),
  { loading: () => <PanelLoader label="Carregando chapas…" /> },
)

const TEXTOS: Record<ChapasEscopo, { titulo: string; descricao: string }> = {
  federal: {
    titulo: 'Chapa Federal',
    descricao: 'Projeção e simulação de chapas para Deputado Federal.',
  },
  estadual: {
    titulo: 'Chapa Estadual',
    descricao: 'Projeção e simulação de chapas para Deputado Estadual.',
  },
}

export function ChapasPage({ escopo }: { escopo: ChapasEscopo }) {
  const { titulo, descricao } = TEXTOS[escopo]
  return (
    <ResumoEleicoesShell titulo={titulo} descricao={descricao}>
      <ChapasPanel embedded escopoOverride={escopo} />
    </ResumoEleicoesShell>
  )
}
