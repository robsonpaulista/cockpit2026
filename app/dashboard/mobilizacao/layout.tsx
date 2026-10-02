import { Suspense } from 'react'

/** Fontes herdadas do app (Cockpit X) — sem Unbounded/Manrope locais. */
export default function MobilizacaoLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="p-6 text-sm text-[var(--palette-aux,#6B7280)]">Carregando Arena…</div>}>
      {children}
    </Suspense>
  )
}
