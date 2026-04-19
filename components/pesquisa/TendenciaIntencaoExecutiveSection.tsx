'use client'

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { isBrancoNuloOuNenhumNome, isNaoSabeOuNaoOpinaNome } from '@/lib/espontanea-normalize'
import {
  shortDataLabelPtBr,
  type CandidatoExecutiveCard,
  type ExecutiveTendenciaModel,
} from '@/lib/pesquisa-tendencia-executive'

const STROKE_ESP = '#1D4ED8'
const STROKE_EST = '#EA580C'

function fmtPctPt(n: number | null): string {
  if (n === null || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`
}

function badgeClasses(variant: CandidatoExecutiveCard['badgeVariant']): string {
  switch (variant) {
    case 'success':
      return 'bg-emerald-50 text-emerald-900 border-emerald-200'
    case 'warning':
      return 'bg-amber-50 text-amber-950 border-amber-200'
    case 'danger':
      return 'bg-red-50 text-red-900 border-red-200'
    case 'neutral':
      return 'bg-slate-100 text-slate-800 border-slate-200'
    case 'muted':
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200'
  }
}

/** 1ª, última e média da série exibida no mini gráfico (uma leitura por data com dado). */
function MetricasSerieCard({
  titulo,
  primeira,
  ultima,
  media,
  compact = false,
}: {
  titulo: string
  primeira: number | null
  ultima: number | null
  media: number | null
  compact?: boolean
}) {
  const tLabel = compact ? 'text-[9px]' : 'text-[10px]'
  const tValor = compact ? 'text-sm font-bold' : 'text-base font-bold sm:text-lg'
  const pad = compact ? 'px-1 py-1' : 'px-1.5 py-2'
  return (
    <div>
      <div className={`grid grid-cols-3 ${compact ? 'gap-0.5' : 'gap-1.5 sm:gap-2'}`}>
        <div className={`rounded-lg border border-card/80 bg-surface/60 text-center ${pad}`}>
          <p className={`${tLabel} font-medium uppercase tracking-wide text-secondary`}>1ª</p>
          <p className={`mt-0.5 tabular-nums text-text-primary ${tValor}`}>{fmtPctPt(primeira)}</p>
        </div>
        <div className={`rounded-lg border border-card/80 bg-surface/60 text-center ${pad}`}>
          <p className={`${tLabel} font-medium uppercase tracking-wide text-secondary`}>Última</p>
          <p className={`mt-0.5 tabular-nums text-text-primary ${tValor}`}>{fmtPctPt(ultima)}</p>
        </div>
        <div className={`rounded-lg border border-card/80 bg-surface/60 text-center ${pad}`}>
          <p className={`${tLabel} font-medium uppercase tracking-wide text-secondary`}>Média</p>
          <p className={`mt-0.5 tabular-nums text-text-primary ${tValor}`}>{fmtPctPt(media)}</p>
        </div>
      </div>
      <p className={`mt-1.5 leading-snug text-secondary ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
        {titulo}
      </p>
    </div>
  )
}

type MiniChartRow = {
  x: string
  esp: number | null
  est: number | null
  institutoEsp?: string
  institutoEst?: string
}

function buildRows(card: CandidatoExecutiveCard, datasOrdenadas: string[]): MiniChartRow[] {
  return datasOrdenadas
    .map((dl) => {
      const pEsp = card.pontosEspAjustada.find((p) => p.dataLabel === dl)
      const pEst = card.pontosEstimulada.find((p) => p.dataLabel === dl)
      const esp = pEsp?.valor ?? null
      const est = pEst?.valor ?? null
      if (esp === null && est === null) return null
      return {
        x: dl,
        esp,
        est,
        ...(pEsp?.instituto?.trim() ? { institutoEsp: pEsp.instituto.trim() } : {}),
        ...(pEst?.instituto?.trim() ? { institutoEst: pEst.instituto.trim() } : {}),
      }
    })
    .filter((row): row is MiniChartRow => row !== null)
}

function ExecutiveMiniTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: ReadonlyArray<{ payload?: MiniChartRow }>
  label?: string
}) {
  if (!active || !payload?.length) return null
  const row = payload[0]?.payload
  if (!row) return null
  return (
    <div className="rounded-lg border border-card bg-white px-2.5 py-2 text-[11px] shadow-md">
      <p className="font-semibold text-text-primary">{label}</p>
      {row.institutoEst ? (
        <p className="mt-1 text-secondary">
          Inst. estimulada: <span className="font-medium text-text-primary">{row.institutoEst}</span>
        </p>
      ) : null}
      {row.institutoEsp ? (
        <p className="mt-0.5 text-secondary">
          Inst. espontânea: <span className="font-medium text-text-primary">{row.institutoEsp}</span>
        </p>
      ) : null}
      <ul className="mt-1 space-y-0.5">
        {typeof row.est === 'number' && Number.isFinite(row.est) ? (
          <li className="tabular-nums text-text-primary">
            <span className="text-[#EA580C]">●</span> Estimulada: {row.est.toFixed(1).replace('.', ',')}%
          </li>
        ) : null}
        {typeof row.esp === 'number' && Number.isFinite(row.esp) ? (
          <li className="tabular-nums text-text-primary">
            <span className="text-[#1D4ED8]">●</span> Esp. ajust.: {row.esp.toFixed(1).replace('.', ',')}%
          </li>
        ) : null}
      </ul>
    </div>
  )
}

function deltaColorClass(delta: number, isNsOuOutros: boolean): string {
  const up = delta > 0
  const down = delta < 0
  if (isNsOuOutros && down) return 'text-emerald-600'
  if (isNsOuOutros && up) return 'text-red-600'
  if (up) return 'text-emerald-600'
  if (down) return 'text-red-600'
  return 'text-secondary'
}

function MiniDelta({
  delta,
  isNsOuOutros,
}: {
  delta: number | null
  isNsOuOutros: boolean
}) {
  if (delta === null || !Number.isFinite(delta)) {
    return <span className="text-xs text-secondary">—</span>
  }
  const up = delta > 0
  const down = delta < 0
  const arrow = up ? '↑' : down ? '↓' : '→'
  return (
    <span className={`text-xs font-medium tabular-nums ${deltaColorClass(delta, isNsOuOutros)}`}>
      {arrow} {Math.abs(delta).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p. na
      estimulada
    </span>
  )
}

function MiniVariacaoEstimulada({
  variacaoEst,
  isNsOuOutros,
}: {
  variacaoEst: number | null
  isNsOuOutros: boolean
}) {
  if (variacaoEst === null || !Number.isFinite(variacaoEst)) {
    return <span className="text-xs text-secondary">—</span>
  }
  const up = variacaoEst > 0
  const down = variacaoEst < 0
  const arrow = up ? '↑' : down ? '↓' : '→'
  return (
    <span className={`text-xs font-medium tabular-nums ${deltaColorClass(variacaoEst, isNsOuOutros)}`}>
      {arrow}{' '}
      {Math.abs(variacaoEst).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} p.p. na
      estimulada (1ª → última data)
    </span>
  )
}

function ExecutiveMiniChart({
  card,
  datasOrdenadas,
  temEspontanea,
  temEstimulada,
}: {
  card: CandidatoExecutiveCard
  datasOrdenadas: string[]
  temEspontanea: boolean
  temEstimulada: boolean
}) {
  const data = buildRows(card, datasOrdenadas)
  if (data.length === 0) {
    return (
      <div className="flex h-[120px] items-center justify-center rounded-lg border border-dashed border-card bg-white text-xs text-secondary">
        Sem pontos no período
      </div>
    )
  }

  return (
    <div className="w-full overflow-hidden rounded-lg border border-card bg-white">
      <div className="h-[132px] w-full min-w-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={data}
            margin={{ top: 6, right: 10, left: 8, bottom: 14 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-card))" vertical={false} opacity={0.45} />
            <XAxis
              dataKey="x"
              tickFormatter={(v) => shortDataLabelPtBr(String(v))}
              tick={{ fontSize: 9, fill: 'rgb(var(--text-secondary))' }}
              axisLine={false}
              tickLine={false}
              interval={0}
              padding={{ left: 16, right: 16 }}
            />
            <YAxis hide domain={['auto', 'auto']} />
            <Tooltip content={(props) => <ExecutiveMiniTooltip {...props} />} />
            {temEspontanea ? (
              <Line
                type="monotone"
                dataKey="esp"
                name="esp"
                stroke={STROKE_ESP}
                strokeWidth={2}
                dot={{ r: 3, fill: STROKE_ESP }}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
            {temEstimulada ? (
              <Line
                type="monotone"
                dataKey="est"
                name="est"
                stroke={STROKE_EST}
                strokeWidth={2}
                strokeDasharray={temEspontanea ? '5 4' : undefined}
                dot={{ r: 3, fill: STROKE_EST }}
                connectNulls
                isAnimationActive={false}
              />
            ) : null}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <div className="flex flex-wrap gap-3 border-t border-card/80 px-2 py-1.5 text-[10px] text-secondary">
        {temEspontanea ? (
          <span className="inline-flex items-center gap-1">
            <span className="h-0.5 w-4 rounded-full bg-[#1D4ED8]" />
            Espontânea ajustada
          </span>
        ) : null}
        {temEstimulada ? (
          <span className="inline-flex items-center gap-1">
            <span
              className={`h-0.5 w-4 ${temEspontanea ? 'border-t-2 border-dashed border-[#EA580C]' : 'rounded-full bg-[#EA580C]'}`}
            />
            Estimulada
          </span>
        ) : null}
      </div>
    </div>
  )
}

export type TendenciaIntencaoExecutiveSectionProps = {
  model: ExecutiveTendenciaModel
  loading?: boolean
  subtitulo: string
  ajusteNsPct: number
  tipoGraficoLabel: string
  onVerDetalhesCandidato?: (nome: string) => void
}

export function TendenciaIntencaoExecutiveSection({
  model,
  loading = false,
  subtitulo,
  ajusteNsPct,
  tipoGraficoLabel,
  onVerDetalhesCandidato,
}: TendenciaIntencaoExecutiveSectionProps) {
  const { resumo, cards, temEstimulada, temEspontanea, datasOrdenadas } = model
  const temDadosPainel = temEstimulada || temEspontanea

  const tituloBadge =
    temEspontanea && temEstimulada
      ? 'Espontânea ajustada + estimulada'
      : temEspontanea
        ? 'Espontânea ajustada'
        : 'Estimulada'

  return (
    <div id="painel-executivo-tendencia" className="bg-surface rounded-2xl border border-card p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="min-w-0 flex flex-wrap items-center gap-x-2 gap-y-1">
          <h2 className="text-base font-semibold text-text-primary">Tendência de intenção de voto</h2>
          <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
            {tituloBadge}
          </span>
          <span className="text-xs text-secondary">· {subtitulo}</span>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <span className="rounded-md border border-card bg-background px-2 py-1 text-[11px] text-text-primary tabular-nums">
            {resumo.periodoLabel}
          </span>
          <span className="rounded-md border border-card bg-background px-2 py-1 text-[11px] text-secondary">
            {tipoGraficoLabel}
          </span>
        </div>
      </div>

      <details className="mt-2 text-[11px] text-secondary">
        <summary className="cursor-pointer text-secondary hover:text-text-primary select-none">
          Metodologia (espontânea ajustada e gráfico)
        </summary>
        <div className="mt-1.5 space-y-1.5 border-l-2 border-border-card/50 pl-2 leading-snug">
          {temEspontanea && temEstimulada ? (
            <p>
              Espontânea ajustada: {ajusteNsPct}% do «Não sabe» redistribuído entre citados; estimulada em linha tracejada
              para comparar.
            </p>
          ) : temEspontanea ? (
            <p>
              Espontânea ajustada: {ajusteNsPct}% do «Não sabe» redistribuído; branco/nulo inalterado.
            </p>
          ) : (
            <p>
              Sem espontânea neste recorte: séries e destaque usam a estimulada. Com espontânea cadastrada, o painel passa
              a mostrar o ajuste ({ajusteNsPct}% do «Não sabe») e a comparação com a estimulada.
            </p>
          )}
        </div>
      </details>

      {loading ? (
        <div className="mt-4 flex h-32 items-center justify-center text-sm text-secondary">Carregando…</div>
      ) : !temDadosPainel ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          Não há pesquisas (estimulada ou espontânea) para os filtros atuais.
        </div>
      ) : cards.length === 0 ? (
        <div className="mt-4 text-sm text-secondary">Nenhum candidato no período filtrado.</div>
      ) : (
        <>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-card bg-background p-3">
              <p className="text-[11px] font-medium text-secondary">Total de pesquisas</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{resumo.totalPesquisasUnicas}</p>
              <p className="text-xs text-secondary">no período</p>
            </div>
            <div className="rounded-xl border border-card bg-background p-3">
              <p className="text-[11px] font-medium text-secondary">Líder no período</p>
              {resumo.lider ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-text-primary leading-snug">{resumo.lider.nome}</p>
                  <p className="text-xs text-secondary">
                    {fmtPctPt(resumo.lider.pct)}{' '}
                    <span className="text-secondary/90">
                      (
                      {resumo.lider.base === 'espontanea_ajustada'
                        ? 'espontânea ajustada'
                        : 'estimulada'}
                      )
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-secondary">—</p>
              )}
            </div>
            <div className="rounded-xl border border-card bg-background p-3">
              <p className="text-[11px] font-medium text-secondary">Maior variação</p>
              {resumo.maiorVariacao ? (
                <>
                  <p className="mt-1 text-sm font-semibold text-text-primary leading-snug">
                    {resumo.maiorVariacao.nome}
                  </p>
                  <p
                    className={`text-xs font-medium tabular-nums ${
                      resumo.maiorVariacao.delta >= 0 ? 'text-emerald-600' : 'text-red-600'
                    }`}
                  >
                    {resumo.maiorVariacao.delta >= 0 ? '+' : ''}
                    {resumo.maiorVariacao.delta.toLocaleString('pt-BR', {
                      minimumFractionDigits: 1,
                      maximumFractionDigits: 1,
                    })}{' '}
                    p.p.{' '}
                    <span className="font-normal text-secondary">
                      (
                      {resumo.maiorVariacao.base === 'estimulada'
                        ? 'estimulada'
                        : 'espontânea ajustada'}
                      , 1ª → última data)
                    </span>
                  </p>
                </>
              ) : (
                <p className="mt-1 text-sm text-secondary">—</p>
              )}
            </div>
            <div className="rounded-xl border border-card bg-background p-3">
              <p className="text-[11px] font-medium text-secondary">Indecisos (última esp.)</p>
              <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
                {fmtPctPt(resumo.indecisosUltimaEspPct)}
              </p>
              <p className="text-xs text-secondary">
                {temEspontanea
                  ? 'Não sabe / Não opina (bruto)'
                  : 'Sem espontânea no período para este indicador'}
              </p>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const isNsOuOutros =
                isNaoSabeOuNaoOpinaNome(card.nome) || isBrancoNuloOuNenhumNome(card.nome)
              const partesInstituto: string[] = []
              if (temEstimulada && card.institutoUltimaEst) {
                partesInstituto.push(`Estimulada: ${card.institutoUltimaEst}`)
              }
              if (temEspontanea && card.institutoUltimaEsp) {
                partesInstituto.push(`Espontânea: ${card.institutoUltimaEsp}`)
              }
              const textoInstituto = partesInstituto.join(' · ')
              return (
                <article
                  key={card.nome}
                  className="flex flex-col rounded-xl border border-card bg-background p-4 shadow-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="min-w-0 text-sm font-semibold leading-snug text-text-primary">{card.nome}</h3>
                    <span
                      className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${badgeClasses(card.badgeVariant)}`}
                    >
                      {card.badge}
                    </span>
                  </div>
                  {temEspontanea ? (
                    <MetricasSerieCard
                      titulo="Espontânea ajustada no período (1ª leitura, última e média das ondas com dado)"
                      primeira={card.primeiraEsp}
                      ultima={card.ultimaEsp}
                      media={card.mediaEspAjustada}
                    />
                  ) : (
                    <MetricasSerieCard
                      titulo="Estimulada no período (1ª leitura, última e média das ondas com dado)"
                      primeira={card.primeiraEst}
                      ultima={card.ultimaEst}
                      media={card.mediaEstimulada}
                    />
                  )}
                  {temEspontanea && temEstimulada ? (
                    <div className="mt-3 border-t border-dashed border-card/70 pt-3">
                      <MetricasSerieCard
                        compact
                        titulo="Estimulada no período (mesma lógica — linha tracejada no gráfico)"
                        primeira={card.primeiraEst}
                        ultima={card.ultimaEst}
                        media={card.mediaEstimulada}
                      />
                    </div>
                  ) : null}
                  {textoInstituto ? (
                    <p
                      className="mt-1 text-[10px] leading-snug text-secondary"
                      title={textoInstituto}
                    >
                      <span className="font-semibold text-secondary">Instituto — </span>
                      {textoInstituto}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap items-center gap-1">
                    {temEspontanea && temEstimulada ? (
                      <MiniDelta delta={card.deltaEstVsEsp} isNsOuOutros={isNsOuOutros} />
                    ) : !temEspontanea && temEstimulada ? (
                      <MiniVariacaoEstimulada variacaoEst={card.variacaoEst} isNsOuOutros={isNsOuOutros} />
                    ) : temEspontanea && !temEstimulada ? (
                      <span className="text-xs font-medium tabular-nums text-secondary">
                        {card.variacaoEsp !== null && Number.isFinite(card.variacaoEsp) ? (
                          <span className={deltaColorClass(card.variacaoEsp, isNsOuOutros)}>
                            {card.variacaoEsp > 0 ? '↑' : card.variacaoEsp < 0 ? '↓' : '→'}{' '}
                            {Math.abs(card.variacaoEsp).toLocaleString('pt-BR', {
                              minimumFractionDigits: 1,
                              maximumFractionDigits: 1,
                            })}{' '}
                            p.p. na espontânea ajustada (1ª → última data)
                          </span>
                        ) : (
                          '—'
                        )}
                      </span>
                    ) : (
                      <span className="text-xs text-secondary">—</span>
                    )}
                  </div>
                  <div className="mt-3 min-h-0 flex-1">
                    <ExecutiveMiniChart
                      card={card}
                      datasOrdenadas={datasOrdenadas}
                      temEspontanea={temEspontanea}
                      temEstimulada={temEstimulada}
                    />
                  </div>
                  {onVerDetalhesCandidato ? (
                    <button
                      type="button"
                      onClick={() => onVerDetalhesCandidato(card.nome)}
                      className="mt-3 self-end text-xs font-medium text-blue-700 hover:text-blue-900 hover:underline"
                    >
                      Ver detalhes &gt;
                    </button>
                  ) : null}
                </article>
              )
            })}
          </div>
        </>
      )}

    </div>
  )
}
