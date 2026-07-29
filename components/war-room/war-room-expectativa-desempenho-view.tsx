'use client'

import { cn } from '@/lib/utils'
import type { ExpectativaDesempenhoKpi } from '@/lib/war-room/expectativa-desempenho'

type Props = {
  kpis: ExpectativaDesempenhoKpi[]
  className?: string
}

function DesempenhoCard({ kpi }: { kpi: ExpectativaDesempenhoKpi }) {
  return (
    <article className="wr-expectativa-desempenho__card">
      <header className="wr-expectativa-desempenho__head">
        <h3 className="wr-expectativa-desempenho__label">{kpi.label}</h3>
      </header>
      <p className="wr-expectativa-desempenho__total tabular-nums">{kpi.valueLabel}</p>
      {kpi.detail ? (
        <p className="wr-expectativa-desempenho__detail tabular-nums">{kpi.detail}</p>
      ) : null}
      <p className="wr-expectativa-desempenho__legend">{kpi.legend}</p>
    </article>
  )
}

/** KPIs de cobertura / visitas / eleitorado da Expectativa. */
export function WarRoomExpectativaDesempenhoView({ kpis, className }: Props) {
  if (kpis.length === 0) {
    return (
      <p className="wr-decisoes-fila__empty">Sem dados de desempenho ainda.</p>
    )
  }

  return (
    <div
      className={cn('wr-expectativa-desempenho', className)}
      aria-label="Desempenho da expectativa de votos"
    >
      {kpis.map((kpi) => (
        <DesempenhoCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  )
}
