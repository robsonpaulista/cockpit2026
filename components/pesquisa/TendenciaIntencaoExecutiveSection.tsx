'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { Info, Maximize2, Minimize2 } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { AnimatedBar } from '@/components/animated-bar'
import {
  CIDADE_INTENCAO_TOP_N,
  type CandidatoMediaNaCidade,
  type CidadeIntencaoTopoRow,
  type ExecutiveTendenciaModel,
  type ProjecaoVotoCandidatoRow,
  type ProjecaoVotosEleitoradoRecorte,
  rotuloTendenciaPosicao,
  type TendenciaPosicaoCandidato,
} from '@/lib/pesquisa-tendencia-executive'

/**
 * Mapa do Piauí com a posição e % médio (espontânea/estimulada) por município.
 * Carregado sob demanda porque depende do Leaflet (window/document).
 */
const MapaIntencaoMunicipios = dynamic(
  () => import('./MapaIntencaoMunicipios').then((mod) => mod.MapaIntencaoMunicipios),
  { ssr: false },
)

const ORDINAIS_TOP10 = Array.from({ length: CIDADE_INTENCAO_TOP_N }, (_, i) => `${i + 1}º`)

/** Estilo de tabela alinhado ao panorama de monitoramento (Instagram, etc.). */
const PANORAMA_TABLE = 'w-full table-fixed border-collapse text-left text-[11px]'
const PANORAMA_TABLE_HEAD =
  'border-b border-[rgb(var(--color-border-tertiary)/0.55)] text-[10px] uppercase tracking-wide text-text-muted'
const PANORAMA_TABLE_TH = 'px-2 py-1 font-semibold'
const PANORAMA_TABLE_TD =
  'border-b border-[rgb(var(--color-border-tertiary)/0.35)] px-2 py-1 align-middle'
const PANORAMA_TABLE_TD_STICKY = cn(
  PANORAMA_TABLE_TD,
  'sticky left-0 z-[2] bg-bg-surface shadow-[2px_0_6px_-4px_rgba(0,0,0,0.12)]'
)
const PANORAMA_TABLE_TH_STICKY = cn(
  PANORAMA_TABLE_TH,
  'sticky left-0 top-0 z-[3] bg-bg-surface shadow-[2px_0_6px_-4px_rgba(0,0,0,0.12)]'
)

function formatPctTopo(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

function MetodologiaIntencaoPopover({
  rotulo,
  tituloPopup,
  children,
}: {
  rotulo: string
  tituloPopup: string
  children: ReactNode
}) {
  const [aberto, setAberto] = useState<boolean>(false)
  const containerRef = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    if (!aberto) return
    const fecharAoClicarFora = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setAberto(false)
      }
    }
    const fecharComEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAberto(false)
    }
    document.addEventListener('mousedown', fecharAoClicarFora)
    document.addEventListener('keydown', fecharComEscape)
    return () => {
      document.removeEventListener('mousedown', fecharAoClicarFora)
      document.removeEventListener('keydown', fecharComEscape)
    }
  }, [aberto])

  return (
    <span ref={containerRef} className="relative inline-flex items-center gap-0.5">
      <span>{rotulo}</span>
      <button
        type="button"
        onClick={() => setAberto((v) => !v)}
        className="inline-flex rounded-full p-0.5 text-blue-700/80 transition-colors hover:bg-blue-100 hover:text-blue-900"
        aria-label={`Metodologia: ${tituloPopup}`}
        aria-expanded={aberto}
      >
        <Info className="h-3 w-3" aria-hidden />
      </button>
      {aberto ? (
        <div
          role="dialog"
          aria-label={tituloPopup}
          className="absolute left-0 top-full z-50 mt-1.5 w-[min(20rem,calc(100vw-2rem))] rounded-lg border border-card bg-bg-surface p-3 text-left text-[11px] font-normal normal-case leading-snug tracking-normal text-text-primary shadow-lg"
        >
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-text-muted">{tituloPopup}</p>
          <div className="space-y-2">{children}</div>
        </div>
      ) : null}
    </span>
  )
}

function MetodologiaRankingsProjecao({
  baseIntencaoLabel,
}: {
  baseIntencaoLabel: string
}) {
  return (
    <>
      <p>
        Nos rankings municipais, cada linha é uma <strong>cidade</strong>. A quantidade de{' '}
        <strong>pesquisas distintas</strong> (data + instituto + cidade) aparece no tooltip ao passar o mouse sobre a
        cidade. As colunas 1º a 10º listam os candidatos com maior <strong>média de intenção</strong> naquele tipo
        (exclui «Não sabe» e branco/nulo).
      </p>
      <p>
        Na <strong>projeção estadual ponderada</strong>, somamos, por município com pesquisa, o produto{' '}
        <strong>eleitorado oficial (TRE, cadastro local)</strong> × <strong>média de intenção %</strong> do candidato
        naquele município — priorizando a estimulada na cidade quando existir; senão, a espontânea bruta. O total serve
        para <strong>confrontar ordem de grandeza</strong> com a base na eleição (não é simulação de urna com votos
        exclusivos entre candidatos).
      </p>
      <p className="text-text-muted">{baseIntencaoLabel}</p>
    </>
  )
}

function BadgeMetodologiaIntencao({
  temEspontanea,
  temEstimulada,
  ajusteNsPct,
  baseIntencaoLabel,
}: {
  temEspontanea: boolean
  temEstimulada: boolean
  ajusteNsPct: number
  baseIntencaoLabel: string
}) {
  return (
    <span className="inline-flex flex-wrap items-center gap-x-1 gap-y-0.5 rounded-full border border-blue-200 bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-800">
      {temEspontanea ? (
        <MetodologiaIntencaoPopover rotulo="Espontânea ajustada" tituloPopup="Espontânea ajustada">
          {temEstimulada ? (
            <p>
              {ajusteNsPct}% do «Não sabe» redistribuído entre os citados; branco/nulo inalterado. No gráfico temporal, a
              estimulada aparece em linha tracejada para comparar.
            </p>
          ) : (
            <p>
              {ajusteNsPct}% do «Não sabe» redistribuído entre os citados; branco/nulo inalterado.
            </p>
          )}
          <MetodologiaRankingsProjecao baseIntencaoLabel={baseIntencaoLabel} />
        </MetodologiaIntencaoPopover>
      ) : null}
      {temEspontanea && temEstimulada ? <span className="font-normal text-blue-700/70">+</span> : null}
      {temEstimulada ? (
        <MetodologiaIntencaoPopover rotulo="estimulada" tituloPopup="Estimulada">
          {temEspontanea ? (
            <p>
              Intenção com cartela de nomes. No gráfico, linha sólida para espontânea ajustada e tracejada para
              estimulada, para comparar os dois tipos no mesmo período.
            </p>
          ) : (
            <p>
              Sem espontânea neste recorte: séries e destaque usam a estimulada. Com espontânea cadastrada, o painel
              passa a mostrar o ajuste ({ajusteNsPct}% do «Não sabe») e a comparação com a estimulada.
            </p>
          )}
          <MetodologiaRankingsProjecao baseIntencaoLabel={baseIntencaoLabel} />
        </MetodologiaIntencaoPopover>
      ) : null}
    </span>
  )
}

function primeiroNomeCandidato(nome: string): string {
  const limpo = nome.trim()
  if (!limpo) return nome
  return limpo.split(/\s+/)[0] ?? limpo
}

function estiloIndicadorTendenciaCelula(
  tendencia: TendenciaPosicaoCandidato | null | undefined,
  intensidade: number | undefined
): { barra: string; fundo?: string } | undefined {
  if (!tendencia || tendencia === 'estavel') return undefined
  const forca = 0.55 + Math.min(1, Math.max(0, intensidade ?? 0.45)) * 0.45
  if (tendencia === 'subindo') {
    return {
      barra: `rgba(22, 163, 74, ${forca})`,
      fundo: `rgba(22, 163, 74, ${0.04 + forca * 0.05})`,
    }
  }
  return {
    barra: `rgba(220, 38, 38, ${forca})`,
    fundo: `rgba(220, 38, 38, ${0.04 + forca * 0.05})`,
  }
}

function LegendaIndicadorTendencia() {
  const itens: Array<{ rotulo: string; cor: string }> = [
    { rotulo: 'Melhora', cor: 'rgb(22, 163, 74)' },
    { rotulo: 'Queda', cor: 'rgb(220, 38, 38)' },
  ]
  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-text-muted">
      <span className="font-medium text-text-secondary">Tendência de posição:</span>
      {itens.map((item) => (
        <span key={item.rotulo} className="inline-flex items-center gap-1.5">
          <span
            className="inline-block h-2.5 w-[2px] rounded-full"
            style={{ backgroundColor: item.cor }}
            aria-hidden
          />
          {item.rotulo}
        </span>
      ))}
      <span className="text-text-muted">· sem barra = estável ou poucas pesquisas no município</span>
    </div>
  )
}

function CelulaTopoCompacta({ item }: { item: CandidatoMediaNaCidade | undefined }) {
  if (!item) {
    return <td className={cn(PANORAMA_TABLE_TD, 'text-center text-text-muted')}>—</td>
  }

  const nomeExibicao = primeiroNomeCandidato(item.nome)
  const tooltipBase = `${formatPctTopo(item.mediaPct)}% · ${item.nome}`
  const tooltipTendencia =
    item.tendenciaPosicao && item.ondasTendencia
      ? ` · ${rotuloTendenciaPosicao(item.tendenciaPosicao, item.ondasTendencia)}`
      : ''
  const tooltip = `${tooltipBase}${tooltipTendencia}`
  const indicador = estiloIndicadorTendenciaCelula(item.tendenciaPosicao, item.intensidadeTendencia)

  return (
    <td
      className={cn(PANORAMA_TABLE_TD, 'max-w-[4.25rem] p-0')}
      style={indicador?.fundo ? { backgroundColor: indicador.fundo } : undefined}
    >
      <span className="flex min-w-0 items-center gap-1" title={tooltip}>
        {indicador ? (
          <span
            className="h-2.5 w-[2px] shrink-0 rounded-full"
            style={{ backgroundColor: indicador.barra }}
            aria-hidden
          />
        ) : null}
        <span className="min-w-0 flex-1 truncate py-1 pr-1.5 text-[11px] font-medium text-text-primary">
          {nomeExibicao}
        </span>
      </span>
    </td>
  )
}

/** Altura alinhada aos cards do panorama em /dashboard/noticias/monitoramento. */
const PANORAMA_PANEL_CARD_HEIGHT = 'h-[440px]'

const PANORAMA_PANEL_CARD_CLASS = cn(
  'flex flex-col overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-4',
  PANORAMA_PANEL_CARD_HEIGHT
)

const PANORAMA_SECTION_TITLE_CLASS =
  'mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted'

const PANORAMA_SECTION_CARD_CLASS =
  'rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-4'

type TipoIntencaoTabela = 'espontanea' | 'estimulada'

const TIPO_INTENCAO_CARD_META: Record<TipoIntencaoTabela, { titulo: string; subtitulo: string }> = {
  espontanea: {
    titulo: 'Espontânea',
    subtitulo: 'Zona de competitividade espontânea por município.',
  },
  estimulada: {
    titulo: 'Estimulada',
    subtitulo: 'Zona de competitividade estimulada por município.',
  },
}

function TendenciaResumoTipoIntencaoCard({
  tipo,
  linhas,
  temDadosTipo,
}: {
  tipo: TipoIntencaoTabela
  linhas: CidadeIntencaoTopoRow[]
  temDadosTipo: boolean
}) {
  const meta = TIPO_INTENCAO_CARD_META[tipo]
  const isEspontanea = tipo === 'espontanea'

  return (
    <div className={PANORAMA_PANEL_CARD_CLASS}>
      <div className="mb-2 shrink-0 space-y-0.5">
        <h4 className="text-sm font-semibold text-text-primary">{meta.titulo}</h4>
        <p className="text-[11px] leading-snug text-text-muted">{meta.subtitulo}</p>
      </div>

      {!temDadosTipo || linhas.length === 0 ? (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-lg border border-dashed border-[rgb(var(--color-border-tertiary)/0.6)] text-[11px] text-text-muted">
          Sem pesquisas {isEspontanea ? 'espontâneas' : 'estimuladas'} neste recorte.
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-auto rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)]">
          <table className={cn(PANORAMA_TABLE, 'min-w-[36rem]')}>
            <colgroup>
              <col className="w-[5.5rem]" />
              {ORDINAIS_TOP10.map((ord) => (
                <col key={`col-${tipo}-${ord}`} className="w-[3.25rem]" />
              ))}
            </colgroup>
            <thead>
              <tr className={PANORAMA_TABLE_HEAD}>
                <th className={cn(PANORAMA_TABLE_TH_STICKY, 'text-left')}>Cidade</th>
                {ORDINAIS_TOP10.map((ord) => (
                  <th key={`h-${tipo}-${ord}`} className={cn(PANORAMA_TABLE_TH, 'text-left')} title={`${ord} colocado`}>
                    {ord}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {linhas.map((row) => {
                const pesquisas = isEspontanea
                  ? row.pesquisasDistintasEspontanea
                  : row.pesquisasDistintasEstimulada
                const top10 = isEspontanea ? row.top10Espontanea : row.top10Estimulada
                const tooltipCidade = `${row.cidadeLabel} · ${pesquisas} pesquisa${pesquisas === 1 ? '' : 's'} distinta${pesquisas === 1 ? '' : 's'}`
                return (
                  <tr key={`${tipo}-${row.cidadeChave}`} className="hover:bg-background/40">
                    <td className={PANORAMA_TABLE_TD_STICKY}>
                      <span className="line-clamp-2 leading-snug" title={tooltipCidade}>
                        {row.cidadeLabel}
                      </span>
                    </td>
                    {Array.from({ length: CIDADE_INTENCAO_TOP_N }, (_, idx) => (
                      <CelulaTopoCompacta
                        key={`${tipo}-${row.cidadeChave}-${idx}`}
                        item={top10[idx]}
                      />
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function IndicadorProjecao({
  rotulo,
  descricao,
  valor,
}: {
  rotulo: string
  descricao: string
  valor: string
}) {
  return (
    <div className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)] px-2 py-1.5">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">{rotulo}</p>
      <p className="mt-0.5 text-[9px] leading-snug text-text-secondary">{descricao}</p>
      <p className="mt-1 text-sm font-semibold tabular-nums text-text-primary">{valor}</p>
    </div>
  )
}

function pillVisaoProjecaoClass(active: boolean): string {
  return cn(
    'rounded-[99px] border px-2.5 py-1 text-[11px] transition-colors',
    active
      ? 'border-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] font-medium text-[rgb(var(--color-primary))]'
      : 'border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent text-text-secondary hover:text-text-primary'
  )
}

function formatPctProjecao(value: number): string {
  return value.toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
}

const PANORAMA_TABLE_TH_NUM = cn(PANORAMA_TABLE_TH, 'text-right pl-2 pr-4')
const PANORAMA_TABLE_TD_NUM = cn(PANORAMA_TABLE_TD, 'text-right pl-2 pr-4 tabular-nums')

function ProjecaoRankingTabela({ ranking }: { ranking: ProjecaoVotoCandidatoRow[] }) {
  return (
    <table className={PANORAMA_TABLE}>
      <colgroup>
        <col className="w-[2.5rem]" />
        <col />
        <col className="w-[7rem]" />
        <col className="w-[6rem]" />
      </colgroup>
      <thead>
        <tr className={PANORAMA_TABLE_HEAD}>
          <th className={cn(PANORAMA_TABLE_TH, 'text-left')}>#</th>
          <th className={cn(PANORAMA_TABLE_TH, 'text-left')}>Candidato</th>
          <th className={PANORAMA_TABLE_TH_NUM}>Votos</th>
          <th className={PANORAMA_TABLE_TH_NUM}>% total</th>
        </tr>
      </thead>
      <tbody>
        {ranking.map((row) => (
          <tr key={row.nome} className="hover:bg-background/40">
            <td className={cn(PANORAMA_TABLE_TD, 'tabular-nums text-text-muted')}>{row.rank}</td>
            <td className={PANORAMA_TABLE_TD}>
              <span className="font-medium text-text-primary">{row.nome}</span>
            </td>
            <td className={cn(PANORAMA_TABLE_TD_NUM, 'font-medium text-text-primary')}>
              {row.votosProjetados.toLocaleString('pt-BR')}
            </td>
            <td className={cn(PANORAMA_TABLE_TD_NUM, 'text-text-secondary')}>
              {formatPctProjecao(row.pctSobreSomaProjetada)}%
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

function ProjecaoRankingBarras({ ranking }: { ranking: ProjecaoVotoCandidatoRow[] }) {
  return (
    <ul className="space-y-1.5 pr-3 sm:pr-4">
      {ranking.map((row) => (
        <li key={row.nome}>
          <div className="mb-0.5 flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-1.5">
              <span className="w-4 shrink-0 tabular-nums text-[10px] font-semibold text-text-muted">
                {row.rank}º
              </span>
              <span className="truncate text-[11px] font-medium text-text-primary">{row.nome}</span>
            </div>
            <span className="shrink-0 pr-0.5 tabular-nums text-[10px] text-text-secondary sm:pr-1">
              <span className="font-semibold text-text-primary">
                {formatPctProjecao(row.pctSobreSomaProjetada)}%
              </span>
              <span className="mx-1 text-text-muted">·</span>
              <span className="font-medium text-text-primary">
                {row.votosProjetados.toLocaleString('pt-BR')}
              </span>
            </span>
          </div>
          <AnimatedBar
            percentage={row.pctSobreSomaProjetada}
            barClassName="bg-[rgb(var(--color-primary))]"
            height="h-1.5"
            className="bg-[rgb(var(--color-border-tertiary)/0.35)]"
          />
        </li>
      ))}
    </ul>
  )
}

function TendenciaProjecaoEleitoradoPanel({
  projecao,
}: {
  projecao: ProjecaoVotosEleitoradoRecorte
}) {
  const [visaoRanking, setVisaoRanking] = useState<'tabela' | 'barras'>('barras')

  const pctEleitoradoVsProjecao =
    projecao.eleitoradoSomadoRecorte > 0
      ? Math.round((projecao.somaVotosProjetados / projecao.eleitoradoSomadoRecorte) * 1000) / 10
      : null

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
        <IndicadorProjecao
          rotulo="Eleitorado"
          descricao="Total de eleitores cobertos pelas pesquisas consideradas."
          valor={projecao.eleitoradoSomadoRecorte.toLocaleString('pt-BR')}
        />
        <IndicadorProjecao
          rotulo="Votos projetados"
          descricao="Estimativa agregada obtida a partir da posição dos candidatos nos municípios pesquisados."
          valor={projecao.somaVotosProjetados.toLocaleString('pt-BR')}
        />
        <IndicadorProjecao
          rotulo="Municípios"
          descricao="Quantidade de cidades consideradas na consolidação."
          valor={projecao.municipiosPonderados.toLocaleString('pt-BR')}
        />
        <IndicadorProjecao
          rotulo="Cobertura"
          descricao="Percentual do eleitorado estadual representado na amostra territorial."
          valor={
            pctEleitoradoVsProjecao !== null ? `${pctEleitoradoVsProjecao.toLocaleString('pt-BR')}%` : '—'
          }
        />
      </div>
      {(projecao.municipiosComPesquisaSemEleitoradoCadastrado > 0 || projecao.municipiosApenasEstadualExcluidos > 0) && (
        <p className="text-[10px] text-amber-800">
          {projecao.municipiosApenasEstadualExcluidos > 0
            ? `${projecao.municipiosApenasEstadualExcluidos} recorte(s) só estadual — não entram na projeção por município. `
            : null}
          {projecao.municipiosComPesquisaSemEleitoradoCadastrado > 0
            ? `${projecao.municipiosComPesquisaSemEleitoradoCadastrado} município(s) sem eleitorado no cadastro local — ignorados no peso.`
            : null}
        </p>
      )}
      {projecao.ranking.length === 0 ? (
        <p className="text-[11px] text-text-muted">
          Não há municípios com média de intenção e eleitorado cadastrado para montar o acumulado neste recorte.
        </p>
      ) : (
        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-[11px] leading-snug text-text-muted">
              Posição consolidada considerando todas as cidades pesquisadas e seus respectivos pesos eleitorais.
            </p>
            <div className="flex shrink-0 items-center gap-1">
              <button
                type="button"
                onClick={() => setVisaoRanking('tabela')}
                className={pillVisaoProjecaoClass(visaoRanking === 'tabela')}
              >
                Tabela
              </button>
              <button
                type="button"
                onClick={() => setVisaoRanking('barras')}
                className={pillVisaoProjecaoClass(visaoRanking === 'barras')}
              >
                Barras
              </button>
            </div>
          </div>
          {visaoRanking === 'tabela' ? (
            <div className="overflow-x-auto pr-1 sm:pr-2">
              <ProjecaoRankingTabela ranking={projecao.ranking} />
            </div>
          ) : (
            <ProjecaoRankingBarras ranking={projecao.ranking} />
          )}
        </div>
      )}
      <p className="text-[10px] leading-snug text-text-muted">
        A soma das projeções pode ultrapassar o eleitorado do recorte (médias isoladas por candidato). Use o ranking para
        comparar ordens de grandeza com a base real.
      </p>
    </div>
  )
}

export type TendenciaIntencaoExecutiveSectionProps = {
  model: ExecutiveTendenciaModel
  loading?: boolean
  ajusteNsPct: number
  /**
   * Candidato em foco para o mapa por município: marcadores ficam coloridos
   * pela posição dele em cada município. 1º lugar usa azul para destacar
   * "onde o nosso candidato lidera"; top 3 verde-claro, 4º-5º âmbar, 6º+
   * vermelho. Quando omitido, o mapa colore por densidade de pesquisas.
   */
  candidatoFoco?: string | null
}

export function TendenciaIntencaoExecutiveSection({
  model,
  loading = false,
  ajusteNsPct,
  candidatoFoco = null,
}: TendenciaIntencaoExecutiveSectionProps) {
  const { appearance } = useTheme()
  const { resumo, cidadesIntencaoTop10, projecaoVotosEleitorado, temEstimulada, temEspontanea } = model

  /**
   * Container do mapa de intenção: usado pelo botão "Tela cheia". A Fullscreen
   * API nativa preserva os event listeners do Leaflet (ResizeObserver +
   * `invalidateSize`) já implementados em MapaIntencaoMunicipios.
   */
  const mapaContainerRef = useRef<HTMLDivElement>(null)
  const [mapaEmTelaCheia, setMapaEmTelaCheia] = useState<boolean>(false)

  useEffect(() => {
    const onFullscreenChange = () => {
      setMapaEmTelaCheia(
        Boolean(document.fullscreenElement && document.fullscreenElement === mapaContainerRef.current),
      )
    }
    document.addEventListener('fullscreenchange', onFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', onFullscreenChange)
  }, [])

  /**
   * Alterna a tela cheia do container do mapa. Quando o navegador não suportar
   * `requestFullscreen` (raro hoje), faz um fallback silencioso — sem quebrar.
   */
  const alternarMapaTelaCheia = useCallback(async () => {
    const el = mapaContainerRef.current
    if (!el) return
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen()
      } else if (typeof el.requestFullscreen === 'function') {
        await el.requestFullscreen()
      }
    } catch {
      // Permissão negada / não suportado: mantém o mapa no fluxo normal.
    }
  }, [])
  const temDadosPainel = temEstimulada || temEspontanea

  return (
    <div id="painel-executivo-tendencia" className="flex flex-col gap-4">
      <div className={PANORAMA_SECTION_CARD_CLASS}>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-md border border-card bg-background px-2 py-1 text-[11px] text-text-primary tabular-nums">
            {resumo.periodoLabel}
          </span>
          <BadgeMetodologiaIntencao
            temEspontanea={temEspontanea}
            temEstimulada={temEstimulada}
            ajusteNsPct={ajusteNsPct}
            baseIntencaoLabel={projecaoVotosEleitorado.baseIntencaoLabel}
          />
        </div>
      </div>

      {loading ? (
        <div className={cn(PANORAMA_SECTION_CARD_CLASS, 'flex h-32 items-center justify-center text-sm text-secondary')}>
          Carregando…
        </div>
      ) : !temDadosPainel ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 text-sm text-amber-950">
          Não há pesquisas (estimulada ou espontânea) para os filtros atuais.
        </div>
      ) : (
        <>
          <section>
            <h3 className={PANORAMA_SECTION_TITLE_CLASS}>Visão territorial da disputa</h3>
            <p className="mb-1 text-[11px] leading-relaxed text-text-muted">
              Os rankings representam os candidatos dentro da faixa competitiva das vagas disponíveis na eleição
              proporcional.
            </p>
            <LegendaIndicadorTendencia />
            {cidadesIntencaoTop10.length === 0 ? (
              <div className={PANORAMA_PANEL_CARD_CLASS}>
                <p className="flex min-h-0 flex-1 items-center justify-center text-sm text-secondary">
                  Não há linhas de pesquisa com intenção numérica para montar o resumo por cidade neste recorte.
                </p>
              </div>
            ) : (
              <div className="grid items-start gap-4 xl:grid-cols-2">
                <TendenciaResumoTipoIntencaoCard
                  tipo="espontanea"
                  linhas={cidadesIntencaoTop10}
                  temDadosTipo={temEspontanea}
                />
                <TendenciaResumoTipoIntencaoCard
                  tipo="estimulada"
                  linhas={cidadesIntencaoTop10}
                  temDadosTipo={temEstimulada}
                />
              </div>
            )}
          </section>

          <section>
            <div className="grid items-start gap-4 xl:grid-cols-2">
              <div className="min-w-0">
                <h3 className={PANORAMA_SECTION_TITLE_CLASS}>Projeção estadual ponderada</h3>
                <p className="mb-3 text-[11px] leading-relaxed text-text-muted">
                  Consolidação das pesquisas municipais ponderadas pelo eleitorado de cada cidade.
                </p>
                <div className={PANORAMA_PANEL_CARD_CLASS}>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    <TendenciaProjecaoEleitoradoPanel projecao={projecaoVotosEleitorado} />
                  </div>
                </div>
              </div>

              <div className="min-w-0">
                <h3 className={PANORAMA_SECTION_TITLE_CLASS}>Competitividade territorial</h3>
                <p className="mb-3 text-[11px] leading-relaxed text-text-muted">
                  Representação geográfica da posição dos candidatos em cada município pesquisado.
                  {candidatoFoco
                    ? ` Cor e número refletem a posição de ${candidatoFoco} no ranking de cada cidade.`
                    : ' Selecione um candidato acima para colorir o mapa pela posição competitiva em cada município.'}
                </p>
                <div className={PANORAMA_PANEL_CARD_CLASS}>
                  {cidadesIntencaoTop10.length === 0 ? (
                    <p className="flex min-h-0 flex-1 items-center justify-center text-[11px] text-text-muted">
                      Não há municípios com pesquisas registradas neste recorte para montar o mapa.
                    </p>
                  ) : (
                    <>
                      <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1 rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)] bg-background/50 px-2 py-1.5 text-[9px] text-text-muted">
                    {candidatoFoco ? (
                      <>
                        <span className="font-semibold uppercase tracking-wide text-text-primary">
                          Legenda — posição de {candidatoFoco}
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#2563eb' }} />
                          1º lugar · liderança local
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#65a30d' }} />
                          Top 3 · zona altamente competitiva
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#f59e0b' }} />
                          4º a 5º · competitividade intermediária
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#dc2626' }} />
                          6º ou pior · baixa competitividade
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(148,163,184,0.55)' }} />
                          Sem dados · município sem pesquisa
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-semibold uppercase tracking-wide text-text-primary">
                          Legenda — densidade de pesquisas
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#3b82f6' }} />
                          1–2 pesquisas
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#2563eb' }} />
                          3–4 pesquisas
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: '#1d4ed8' }} />
                          5 ou mais
                        </span>
                        <span className="inline-flex items-center gap-1.5">
                          <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: 'rgba(148,163,184,0.55)' }} />
                          Sem pesquisa
                        </span>
                      </>
                    )}
                  </div>
                  <div
                    ref={mapaContainerRef}
                    className={
                      mapaEmTelaCheia
                        ? 'relative h-screen w-screen overflow-hidden bg-background'
                        : 'relative min-h-0 flex-1 overflow-hidden rounded-lg border border-card bg-background'
                    }
                  >
                    <MapaIntencaoMunicipios
                      cidades={cidadesIntencaoTop10}
                      candidatoFoco={candidatoFoco}
                      appearance={appearance}
                    />
                    <button
                      type="button"
                      onClick={alternarMapaTelaCheia}
                      className="absolute right-3 top-3 z-[500] inline-flex items-center gap-1.5 rounded-md border border-card bg-surface/95 px-2.5 py-1.5 text-xs font-medium text-text-primary shadow-sm transition-colors hover:bg-background focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-gold/40"
                      aria-label={mapaEmTelaCheia ? 'Sair da tela cheia' : 'Abrir mapa em tela cheia'}
                      title={mapaEmTelaCheia ? 'Sair da tela cheia (Esc)' : 'Abrir mapa em tela cheia'}
                    >
                      {mapaEmTelaCheia ? (
                        <>
                          <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                          <span>Sair</span>
                        </>
                      ) : (
                        <>
                          <Maximize2 className="h-3.5 w-3.5" aria-hidden />
                          <span>Tela cheia</span>
                        </>
                      )}
                    </button>
                  </div>
                  <p className="mt-1.5 shrink-0 text-[10px] leading-snug text-text-muted">
                    O mapa permite identificar áreas de concentração, continuidade territorial e zonas de influência
                    eleitoral dos candidatos. Clique na cidade para ver o top 3 e detalhes.
                  </p>
                </>
              )}
                </div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
