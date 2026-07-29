'use client'

import { cn } from '@/lib/utils'
import type { PesquisasDesempenhoKpi } from '@/lib/war-room/pesquisas-desempenho'

type Props = {
  kpis: PesquisasDesempenhoKpi[]
  className?: string
}

function DesempenhoCard({ kpi }: { kpi: PesquisasDesempenhoKpi }) {
  return (
    <article className="wr-pesquisas-desempenho__card">
      <header className="wr-pesquisas-desempenho__head">
        <h3 className="wr-pesquisas-desempenho__label">{kpi.label}</h3>
      </header>
      <p className="wr-pesquisas-desempenho__total tabular-nums">{kpi.valueLabel}</p>
      {kpi.detail ? (
        <p className="wr-pesquisas-desempenho__detail tabular-nums">{kpi.detail}</p>
      ) : null}
      <p className="wr-pesquisas-desempenho__legend">{kpi.legend}</p>
    </article>
  )
}

/** KPIs de cobertura / top 5 / eleitorado das pesquisas. */
export function WarRoomPesquisasDesempenhoView({ kpis, className }: Props) {
  if (kpis.length === 0) {
    return (
      <p className="wr-pesquisas-clean__state">Sem dados de desempenho ainda.</p>
    )
  }

  return (
    <div
      className={cn('wr-pesquisas-desempenho', className)}
      aria-label="Desempenho das pesquisas eleitorais"
    >
      {kpis.map((kpi) => (
        <DesempenhoCard key={kpi.id} kpi={kpi} />
      ))}
    </div>
  )
}
