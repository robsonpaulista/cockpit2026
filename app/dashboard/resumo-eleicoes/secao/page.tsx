'use client'

import dynamic from 'next/dynamic'
import { ResumoEleicoesShell } from '@/components/resumo-eleicoes/resumo-eleicoes-shell'
import { PanelLoader } from '@/components/resumo-eleicoes/panel-loader'

const ResumoEleicoesSecaoPanel = dynamic(
  () =>
    import('@/components/resumo-eleicoes/resumo-eleicoes-secao-panel').then(
      (mod) => mod.ResumoEleicoesSecaoPanel,
    ),
  { loading: () => <PanelLoader label="Carregando votação por seção…" /> },
)

export default function VotacaoSecaoPage() {
  return (
    <ResumoEleicoesShell
      titulo="Votação por Seção"
      descricao="Matriz comparativa de votação por seção eleitoral (TSE / bweb)."
    >
      <ResumoEleicoesSecaoPanel embedded />
    </ResumoEleicoesShell>
  )
}
