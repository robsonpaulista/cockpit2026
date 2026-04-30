'use client'

import { useEffect, useRef, useState } from 'react'
import { useTheme } from '@/contexts/theme-context'
import {
  CIDADE_INTENCAO_TOP_N,
  type CandidatoMediaNaCidade,
  type CidadeIntencaoTopoRow,
  type ExecutiveTendenciaModel,
  type ProjecaoVotosEleitoradoRecorte,
} from '@/lib/pesquisa-tendencia-executive'

const ORDINAIS_TOP10 = Array.from({ length: CIDADE_INTENCAO_TOP_N }, (_, i) => `${i + 1}º`)

/** Largura mínima do bloco (Pesq. + 10 colunas) para alinhar rolagem horizontal do cabeçalho e das linhas. */
const BLOCO_CIDADE_INTENCAO_MIN_W = 'min-w-[72rem]'

/** Bloco esp./est.: ocupa toda a largura da coluna; rolagem horizontal só dentro (sem barra). */
const blocoCidadeIntencaoOuterClass = 'h-full w-full min-h-0 min-w-0'

type ScrollPorArrastoAxis = 'x' | 'y'

const scrollSyncEsp = new Set<HTMLDivElement>()
const scrollSyncEst = new Set<HTMLDivElement>()

function syncScrollGroupPeers(set: Set<HTMLDivElement>, source: HTMLDivElement) {
  const left = source.scrollLeft
  for (const el of set) {
    if (el !== source && el.scrollLeft !== left) el.scrollLeft = left
  }
}

/** Rolagem sem barra visível: arrastar com o botão principal do mouse (exceto em links/botões). */
function ScrollPorArrasto({
  axis,
  className,
  groupId,
  children,
}: {
  axis: ScrollPorArrastoAxis
  className?: string
  /** Alinha scroll horizontal entre cabeçalho e todas as linhas do mesmo bloco. */
  groupId?: 'esp' | 'est'
  children: React.ReactNode
}) {
  const ref = useRef<HTMLDivElement>(null)
  const drag = useRef({
    active: false,
    moved: false,
    startClient: 0,
    startScroll: 0,
  })
  const bloquearProximoClick = useRef(false)

  /** Em Y, sem overflow-x: evita a tabela deslizar por baixo da coluna fixa “Cidade”. */
  const overflow =
    axis === 'x' ? 'overflow-x-auto overflow-y-hidden' : 'overflow-y-auto overflow-x-hidden'

  useEffect(() => {
    if (axis !== 'x' || !groupId) return
    const el = ref.current
    if (!el) return
    const set = groupId === 'esp' ? scrollSyncEsp : scrollSyncEst
    set.add(el)
    const onScroll = () => syncScrollGroupPeers(set, el)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      el.removeEventListener('scroll', onScroll)
      set.delete(el)
    }
  }, [axis, groupId])

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    const el = ref.current
    if (!el) return
    if ((e.target as HTMLElement).closest('button, a')) return
    drag.current = {
      active: true,
      moved: false,
      startClient: axis === 'x' ? e.clientX : e.clientY,
      startScroll: axis === 'x' ? el.scrollLeft : el.scrollTop,
    }
    el.setPointerCapture(e.pointerId)
  }

  const onPointerMove = (e: React.PointerEvent) => {
    if (!drag.current.active || !ref.current) return
    const pos = axis === 'x' ? e.clientX : e.clientY
    const delta = pos - drag.current.startClient
    if (Math.abs(delta) > 5) drag.current.moved = true
    if (!drag.current.moved) return
    if (axis === 'x') {
      ref.current.scrollLeft = drag.current.startScroll - delta
      if (groupId) syncScrollGroupPeers(groupId === 'esp' ? scrollSyncEsp : scrollSyncEst, ref.current)
    } else ref.current.scrollTop = drag.current.startScroll - delta
  }

  const onPointerEnd = (e: React.PointerEvent) => {
    const el = ref.current
    if (el?.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId)
    if (drag.current.moved) bloquearProximoClick.current = true
    drag.current.active = false
    drag.current.moved = false
  }

  const onClickCapture = (e: React.MouseEvent) => {
    if (!bloquearProximoClick.current) return
    bloquearProximoClick.current = false
    e.preventDefault()
    e.stopPropagation()
  }

  return (
    <div
      ref={ref}
      className={`scrollbar-hide ${overflow} cursor-grab select-none active:cursor-grabbing ${className ?? ''}`}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onClickCapture={onClickCapture}
    >
      {children}
    </div>
  )
}

function CelulaNomeMediaTopo({
  item,
  onVerDetalhesCandidato,
  tdClass,
  nomeCandidatoClass,
}: {
  item: CandidatoMediaNaCidade | undefined
  onVerDetalhesCandidato?: (nome: string) => void
  tdClass: string
  nomeCandidatoClass: string
}) {
  return (
    <td className={`${tdClass} text-center align-middle`}>
      {item ? (
        <div className="flex min-h-[4.75rem] w-full flex-col items-center justify-center gap-1 px-1 py-2">
          {onVerDetalhesCandidato ? (
            <button
              type="button"
              onClick={() => onVerDetalhesCandidato(item.nome)}
              className={`line-clamp-3 w-full max-w-[min(100%,9.5rem)] text-balance text-center leading-snug ${nomeCandidatoClass}`}
              title={item.nome}
            >
              {item.nome}
            </button>
          ) : (
            <span
              className={`line-clamp-3 w-full max-w-[min(100%,9.5rem)] text-balance text-center leading-snug ${nomeCandidatoClass}`}
              title={item.nome}
            >
              {item.nome}
            </span>
          )}
          <span className="tabular-nums text-xs leading-none text-secondary">
            {item.mediaPct.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
          </span>
        </div>
      ) : (
        <span className="text-secondary">—</span>
      )}
    </td>
  )
}

function TendenciaResumoTabelaCidadesIntencao({
  linhas,
  onVerDetalhesCandidato,
  nomeCandidatoClass,
}: {
  linhas: CidadeIntencaoTopoRow[]
  onVerDetalhesCandidato?: (nome: string) => void
  nomeCandidatoClass: string
}) {
  const thCidade =
    'whitespace-nowrap border-b border-card bg-background px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-wide text-secondary sm:text-xs'
  const innerThPesq =
    'w-14 min-w-[3.5rem] whitespace-nowrap border-b border-card bg-background px-2 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wide text-secondary sm:text-[11px]'
  const innerThOrd =
    'min-w-[6.25rem] whitespace-normal border-b border-card bg-background px-1.5 py-2.5 text-center text-[10px] font-semibold uppercase tracking-wide text-secondary sm:text-[11px]'
  const tdCidade =
    'border-b border-card/80 px-3 py-3 align-middle text-sm font-medium text-text-primary'
  const tdInnerPesq =
    'border-b border-card/80 px-2 py-3 text-right align-middle text-sm tabular-nums text-text-primary'
  const tdInnerCandidato =
    'border-b border-card/80 px-1.5 py-0 align-middle text-sm text-text-primary'

  return (
    <div className="rounded-xl border border-card">
      <ScrollPorArrasto axis="y" className="max-h-[min(72vh,760px)] min-h-0">
        <table className="table-fixed w-full min-w-0 border-collapse text-left">
          <colgroup>
            <col className="w-[12.5rem]" />
            <col />
            <col />
          </colgroup>
          <thead>
            <tr className="align-top">
              <th
                className={`${thCidade} sticky left-0 z-[20] border-b border-r border-card bg-background align-bottom pb-2 shadow-[4px_0_14px_-6px_rgba(0,0,0,0.18)]`}
              >
                Cidade
              </th>
              <th className="h-full border-b border-l border-card/80 bg-background p-0 align-stretch">
                <ScrollPorArrasto axis="x" className={`${blocoCidadeIntencaoOuterClass} h-full`} groupId="esp">
                  <div className={BLOCO_CIDADE_INTENCAO_MIN_W}>
                    <div className="border-b border-card/60 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-primary">
                      Espontânea
                    </div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={innerThPesq} title="Pesquisas distintas (espontânea): data + instituto + cidade">
                            Pesq.
                          </th>
                          {ORDINAIS_TOP10.map((ord) => (
                            <th key={`h-esp-${ord}`} className={innerThOrd} title={`Espontânea — ${ord}`}>
                              {ord}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    </table>
                  </div>
                </ScrollPorArrasto>
              </th>
              <th className="h-full border-b border-l border-card/80 bg-background p-0 align-stretch">
                <ScrollPorArrasto axis="x" className={`${blocoCidadeIntencaoOuterClass} h-full`} groupId="est">
                  <div className={BLOCO_CIDADE_INTENCAO_MIN_W}>
                    <div className="border-b border-card/60 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-primary">
                      Estimulada
                    </div>
                    <table className="w-full border-collapse">
                      <thead>
                        <tr>
                          <th className={innerThPesq} title="Pesquisas distintas (estimulada): data + instituto + cidade">
                            Pesq.
                          </th>
                          {ORDINAIS_TOP10.map((ord) => (
                            <th key={`h-est-${ord}`} className={innerThOrd} title={`Estimulada — ${ord}`}>
                              {ord}
                            </th>
                          ))}
                        </tr>
                      </thead>
                    </table>
                  </div>
                </ScrollPorArrasto>
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((row) => (
              <tr key={row.cidadeChave} className="align-middle hover:bg-background/80">
                <td
                  className={`${tdCidade} sticky left-0 z-[20] border-r border-card bg-background shadow-[4px_0_14px_-6px_rgba(0,0,0,0.18)]`}
                >
                  <span className="line-clamp-3 leading-snug" title={row.cidadeLabel}>
                    {row.cidadeLabel}
                  </span>
                </td>
                <td className="border-b border-l border-card/80 p-0 align-stretch">
                  <ScrollPorArrasto axis="x" className={`${blocoCidadeIntencaoOuterClass} h-full`} groupId="esp">
                    <table className={`${BLOCO_CIDADE_INTENCAO_MIN_W} w-full border-collapse`}>
                      <tbody>
                        <tr className="align-middle">
                          <td className={tdInnerPesq}>{row.pesquisasDistintasEspontanea}</td>
                          {Array.from({ length: CIDADE_INTENCAO_TOP_N }, (_, idx) => (
                            <CelulaNomeMediaTopo
                              key={`esp-${row.cidadeChave}-${idx}`}
                              item={row.top10Espontanea[idx]}
                              onVerDetalhesCandidato={onVerDetalhesCandidato}
                              tdClass={tdInnerCandidato}
                              nomeCandidatoClass={nomeCandidatoClass}
                            />
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </ScrollPorArrasto>
                </td>
                <td className="border-b border-l border-card/80 p-0 align-stretch">
                  <ScrollPorArrasto axis="x" className={`${blocoCidadeIntencaoOuterClass} h-full`} groupId="est">
                    <table className={`${BLOCO_CIDADE_INTENCAO_MIN_W} w-full border-collapse`}>
                      <tbody>
                        <tr className="align-middle">
                          <td className={tdInnerPesq}>{row.pesquisasDistintasEstimulada}</td>
                          {Array.from({ length: CIDADE_INTENCAO_TOP_N }, (_, idx) => (
                            <CelulaNomeMediaTopo
                              key={`est-${row.cidadeChave}-${idx}`}
                              item={row.top10Estimulada[idx]}
                              onVerDetalhesCandidato={onVerDetalhesCandidato}
                              tdClass={tdInnerCandidato}
                              nomeCandidatoClass={nomeCandidatoClass}
                            />
                          ))}
                        </tr>
                      </tbody>
                    </table>
                  </ScrollPorArrasto>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollPorArrasto>
    </div>
  )
}

function TendenciaProjecaoEleitoradoPanel({
  projecao,
  onVerDetalhesCandidato,
  nomeCandidatoClass,
}: {
  projecao: ProjecaoVotosEleitoradoRecorte
  onVerDetalhesCandidato?: (nome: string) => void
  nomeCandidatoClass: string
}) {
  const pctEleitoradoVsProjecao =
    projecao.eleitoradoSomadoRecorte > 0
      ? Math.round((projecao.somaVotosProjetados / projecao.eleitoradoSomadoRecorte) * 1000) / 10
      : null

  return (
    <div className="mt-3 space-y-4">
      <p className="text-xs leading-relaxed text-secondary">{projecao.baseIntencaoLabel}</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <div className="rounded-xl border border-card bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Eleitorado no recorte</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
            {projecao.eleitoradoSomadoRecorte.toLocaleString('pt-BR')}
          </p>
          <p className="mt-0.5 text-[10px] text-secondary">Soma TRE nos municípios ponderados</p>
        </div>
        <div className="rounded-xl border border-card bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Votos projetados (soma)</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
            {projecao.somaVotosProjetados.toLocaleString('pt-BR')}
          </p>
          <p className="mt-0.5 text-[10px] text-secondary">Σ (média % × eleitorado) por cidade</p>
        </div>
        <div className="rounded-xl border border-card bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Municípios ponderados</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">{projecao.municipiosPonderados}</p>
          <p className="mt-0.5 text-[10px] text-secondary">Com cadastro de eleitorado</p>
        </div>
        <div className="rounded-xl border border-card bg-background p-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary">Projeção / eleitorado</p>
          <p className="mt-1 text-lg font-bold tabular-nums text-text-primary">
            {pctEleitoradoVsProjecao !== null ? `${pctEleitoradoVsProjecao.toLocaleString('pt-BR')}%` : '—'}
          </p>
          <p className="mt-0.5 text-[10px] text-secondary">Indicador para confrontar com a base</p>
        </div>
      </div>
      {(projecao.municipiosComPesquisaSemEleitoradoCadastrado > 0 || projecao.municipiosApenasEstadualExcluidos > 0) && (
        <p className="text-[11px] text-amber-900/90 dark:text-amber-200/90">
          {projecao.municipiosApenasEstadualExcluidos > 0
            ? `${projecao.municipiosApenasEstadualExcluidos} recorte(s) só estadual — não entram na projeção por município. `
            : null}
          {projecao.municipiosComPesquisaSemEleitoradoCadastrado > 0
            ? `${projecao.municipiosComPesquisaSemEleitoradoCadastrado} município(s) sem eleitorado no cadastro local — ignorados no peso.`
            : null}
        </p>
      )}
      {projecao.ranking.length === 0 ? (
        <p className="text-sm text-secondary">
          Não há municípios com média de intenção e eleitorado cadastrado para montar o acumulado neste recorte.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-card">
          <table className="w-full min-w-[22rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-card bg-background">
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-secondary">#</th>
                <th className="px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-secondary">Candidato</th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-secondary">
                  Votos proj.
                </th>
                <th className="px-3 py-2 text-right text-[11px] font-semibold uppercase tracking-wide text-secondary">
                  % do total proj.
                </th>
              </tr>
            </thead>
            <tbody>
              {projecao.ranking.map((row) => (
                <tr key={row.nome} className="border-b border-card/70 hover:bg-background/80">
                  <td className="px-3 py-2 tabular-nums text-secondary">{row.rank}</td>
                  <td className="px-3 py-2 font-medium text-text-primary">
                    {onVerDetalhesCandidato ? (
                      <button
                        type="button"
                        onClick={() => onVerDetalhesCandidato(row.nome)}
                        className={`text-left ${nomeCandidatoClass}`}
                      >
                        {row.nome}
                      </button>
                    ) : (
                      <span className={nomeCandidatoClass}>{row.nome}</span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums font-semibold text-text-primary">
                    {row.votosProjetados.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-3 py-2 text-right tabular-nums text-secondary">
                    {row.pctSobreSomaProjetada.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-[10px] leading-snug text-secondary">
        A soma das projeções pode ultrapassar o eleitorado do recorte, pois cada candidato usa sua média isolada por
        cidade (não é simulação de urna com votos mutuamente exclusivos). Use o ranking e o total para comparar ordens
        de grandeza com a base real na eleição.
      </p>
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
  const { appearance } = useTheme()
  const [modoIntencaoVisao, setModoIntencaoVisao] = useState<'geral' | 'projecao'>('geral')
  const { resumo, cidadesIntencaoTop10, projecaoVotosEleitorado, temEstimulada, temEspontanea } = model
  const temDadosPainel = temEstimulada || temEspontanea
  const nomeCandidatoClass =
    appearance === 'light'
      ? 'text-sm font-semibold leading-none text-text-primary transition-colors hover:text-text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/35'
      : 'bg-[linear-gradient(135deg,#22d3ee_0%,#2dd4bf_100%)] bg-clip-text text-sm font-semibold leading-none text-transparent transition-[filter] hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400/35'

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
          Metodologia (visão geral, projeção e espontânea ajustada)
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
          <p>
            Na <strong>visão geral</strong>, cada linha é uma <strong>cidade</strong> (ou o recorte estadual). Há dois
            blocos: <strong>Espontânea</strong> e <strong>Estimulada</strong>. Em cada bloco, «Pesq.» conta só as{' '}
            <strong>pesquisas distintas</strong> daquele tipo (data + instituto + cidade). As colunas 1º a 10º listam os
            candidatos com maior <strong>média de intenção</strong> nas linhas daquele tipo na cidade (exclui «Não sabe»
            e branco/nulo).
          </p>
          <p>
            Na guia <strong>Projeção (eleitorado)</strong>, somamos, por município com pesquisa, o produto{' '}
            <strong>eleitorado oficial (TRE, cadastro local)</strong> × <strong>média de intenção %</strong> do candidato
            naquele município — priorizando a estimulada na cidade quando existir; senão, a espontânea bruta. O total
            serve para <strong>confrontar ordem de grandeza</strong> com a base na eleição (não é simulação de urna com
            votos exclusivos entre candidatos).
          </p>
        </div>
      </details>

      {loading ? (
        <div className="mt-4 flex h-32 items-center justify-center text-sm text-secondary">Carregando…</div>
      ) : !temDadosPainel ? (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-sm text-amber-950">
          Não há pesquisas (estimulada ou espontânea) para os filtros atuais.
        </div>
      ) : (
        <>
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
            <p className="text-xs text-secondary">
              {modoIntencaoVisao === 'geral'
                ? 'Visão geral: por cidade — blocos Espontânea e Estimulada (Pesq. + top 10 por média em cada tipo).'
                : 'Projeção acumulada: média de intenção por município × eleitorado (TRE), ranking e totalizadores para bater com a base na eleição.'}
            </p>
            <div
              className="inline-flex shrink-0 rounded-lg border border-card bg-background/80 p-0.5"
              role="group"
              aria-label="Modo de visualização da intenção de voto"
            >
              <button
                type="button"
                aria-pressed={modoIntencaoVisao === 'geral'}
                onClick={() => setModoIntencaoVisao('geral')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  modoIntencaoVisao === 'geral'
                    ? 'bg-background text-text-primary shadow-sm ring-1 ring-border-card'
                    : 'text-secondary hover:bg-background/60 hover:text-text-primary'
                }`}
              >
                Visão geral
              </button>
              <button
                type="button"
                aria-pressed={modoIntencaoVisao === 'projecao'}
                onClick={() => setModoIntencaoVisao('projecao')}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  modoIntencaoVisao === 'projecao'
                    ? 'bg-background text-text-primary shadow-sm ring-1 ring-border-card'
                    : 'text-secondary hover:bg-background/60 hover:text-text-primary'
                }`}
              >
                Projeção (eleitorado)
              </button>
            </div>
          </div>

          {modoIntencaoVisao === 'geral' ? (
            <div className="mt-3">
              {cidadesIntencaoTop10.length === 0 ? (
                <p className="text-sm text-secondary">
                  Não há linhas de pesquisa com intenção numérica para montar o resumo por cidade neste recorte.
                </p>
              ) : (
                <TendenciaResumoTabelaCidadesIntencao
                  linhas={cidadesIntencaoTop10}
                  onVerDetalhesCandidato={onVerDetalhesCandidato}
                  nomeCandidatoClass={nomeCandidatoClass}
                />
              )}
            </div>
          ) : (
            <TendenciaProjecaoEleitoradoPanel
              projecao={projecaoVotosEleitorado}
              onVerDetalhesCandidato={onVerDetalhesCandidato}
              nomeCandidatoClass={nomeCandidatoClass}
            />
          )}
        </>
      )}

    </div>
  )
}
