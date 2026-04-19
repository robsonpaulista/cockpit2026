import type { Metadata } from 'next'
import { PesquisadorRootShell } from '@/components/pesquisador-root-shell'

export const metadata: Metadata = {
  title: 'Pesquisa de campo — PI 2026',
  description: 'Questionário de campo para pesquisadores',
}

export default function PesquisadorLayout({ children }: { children: React.ReactNode }) {
  return <PesquisadorRootShell>{children}</PesquisadorRootShell>
}
