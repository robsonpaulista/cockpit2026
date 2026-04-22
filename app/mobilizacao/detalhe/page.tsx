import { Suspense } from 'react'
import { MobilizacaoDetalheForm } from './mobilizacao-detalhe-form'

function CarregandoFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-8">
      <p className="text-sm text-text-secondary">Carregando…</p>
    </div>
  )
}

export default function MobilizacaoDetalhePage() {
  return (
    <Suspense fallback={<CarregandoFallback />}>
      <MobilizacaoDetalheForm />
    </Suspense>
  )
}
