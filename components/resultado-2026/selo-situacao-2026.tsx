import { TsePill } from '@/components/tse/tse-ui'
import { cn } from '@/lib/utils'
import { rotuloSituacao2026, siglaSituacao2026 } from '@/lib/resultado-situacao-2026'

/** Letra da situação no turno: E eleito, S suplente, N não eleito. */
export function SeloSituacao2026({ situacao, className }: { situacao?: string; className?: string }) {
  const selo = siglaSituacao2026(situacao)
  const rotulo = rotuloSituacao2026(situacao)
  if (!rotulo || selo.sigla === '—') return null
  return (
    <span title={rotulo} className="inline-flex shrink-0">
      <TsePill tom={selo.tom} className={cn('px-1.5 py-0 text-[10px] leading-4', className)}>
        {selo.sigla}
      </TsePill>
    </span>
  )
}
