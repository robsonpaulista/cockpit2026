'use client'

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PollModal } from '@/components/poll-modal'
import { PollReportModal } from '@/components/poll-report-modal'
import { TendenciaIntencaoExecutiveSection } from '@/components/pesquisa/TendenciaIntencaoExecutiveSection'
import {
  Plus,
  Edit2,
  Trash2,
  Maximize2,
  X,
  ArrowLeft,
  FileText,
  BarChart3,
  Sparkles,
  LayoutGrid,
  ClipboardList,
} from 'lucide-react'
import {
  LineChart,
  Line,
  LabelList,
  ResponsiveContainer,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from 'recharts'
import { formatDate } from '@/lib/utils'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import {
  buildCidadeToRegiaoMap,
  getRegiaoParaCidade,
  REGIOES_PI_ORDER,
  type RegiaoPiaui,
} from '@/lib/piaui-regiao'
import {
  DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE,
  normalizarLinhaEspontanea,
} from '@/lib/espontanea-normalize'
import {
  gerarFeedbackDesempenhoCandidato,
  gerarResumoLegendaSerieGrafico,
  metaTiposFromRowSet,
} from '@/lib/pesquisa-desempenho-feedback'
import { buildExecutiveTendenciaModel } from '@/lib/pesquisa-tendencia-executive'

interface Poll {
  id: string
  data: string
  instituto: string
  candidato_nome: string
  tipo: 'estimulada' | 'espontanea'
  cargo: 'dep_estadual' | 'dep_federal' | 'governador' | 'senador' | 'presidente'
  cidade_id?: string | null
  intencao: number
  rejeicao: number
  created_at?: string
  cities?: {
    id: string
    name: string
  }
}

const cargoLabels: Record<string, string> = {
  dep_estadual: 'Dep. Estadual',
  dep_federal: 'Dep. Federal',
  governador: 'Governador',
  senador: 'Senador',
  presidente: 'Presidente',
}

type TipoGraficoPesquisa = 'todas' | 'estimulada' | 'espontanea'

const tipoLabels: Record<string, string> = {
  estimulada: 'Estimulada',
  espontanea: 'Espontânea',
}

const POLLS_FETCH_LIMIT = 5000

type AbaPesquisaDashboard = 'grafico' | 'tendencia_cards' | 'cadastradas'

/** Metadado interno no objeto da série (removido antes do gráfico): tipos de pesquisa naquela data. */
const META_TIPOS_NA_DATA = '__tiposNaData' as const

function rowSemMetaTipos(row: Record<string, unknown>): Record<string, string | number | undefined> {
  const { [META_TIPOS_NA_DATA]: _tipos, ...rest } = row
  return rest as Record<string, string | number | undefined>
}

/** Linha só espontânea → pode normalizar NS sem misturar com estimulada. */
function linhaSoEspontaneaParaGrafico(tipos: unknown): boolean {
  return tipos instanceof Set && tipos.size === 1 && tipos.has('espontanea')
}

/** Mesmo JSON e faixas latitudinais do gráfico Histórico de pesquisas em /dashboard (cockpit). */
const CIDADE_PARA_REGIAO_PESQUISA = buildCidadeToRegiaoMap(
  municipiosPiaui as ReadonlyArray<{ nome: string; lat: number }>
)

/** Cores saturadas e escuras — boas para linhas e legenda em fundo branco (evita cinzas claros do tema). */
const TENDENCIA_SERIES_COLORS = [
  '#B45309',
  '#1D4ED8',
  '#B91C1C',
  '#047857',
  '#6D28D9',
  '#0E7490',
  '#A16207',
  '#BE185D',
  '#1E3A8A',
  '#92400E',
  '#15803D',
  '#7C2D12',
  '#4338CA',
  '#C2410C',
]

type TendenciaTooltipRow = Record<string, string | number | undefined>

type TendenciaTooltipPayloadItem = {
  dataKey?: string | number
  value?: unknown
  color?: string
  stroke?: string
  payload?: TendenciaTooltipRow
}

function formatTooltipPercent(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) return `${value.toFixed(1)}%`
  if (typeof value === 'string' && value.trim() !== '') return `${value}%`
  return '—'
}

/** Índice da última data em que a série tem valor numérico (para rótulo no fim da linha). */
function lastDatumIndexForSeries(
  data: ReadonlyArray<Record<string, string | number | undefined>>,
  valueKey: string
): number {
  for (let i = data.length - 1; i >= 0; i--) {
    const v = data[i][valueKey]
    if (typeof v === 'number' && Number.isFinite(v)) return i
  }
  return -1
}

/** Índice da primeira data com valor numérico na série. */
function firstDatumIndexForSeries(
  data: ReadonlyArray<Record<string, string | number | undefined>>,
  valueKey: string
): number {
  for (let i = 0; i < data.length; i++) {
    const v = data[i][valueKey]
    if (typeof v === 'number' && Number.isFinite(v)) return i
  }
  return -1
}

/** Último % da série (mesma ordem da legenda). */
function ultimaIntencaoSerie(
  data: ReadonlyArray<Record<string, string | number | undefined>>,
  valueKey: string
): string | null {
  const i = lastDatumIndexForSeries(data, valueKey)
  if (i < 0) return null
  const v = data[i][valueKey]
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : null
}

/** Primeiro % da série (primeira data com dado). */
function primeiraIntencaoSerie(
  data: ReadonlyArray<Record<string, string | number | undefined>>,
  valueKey: string
): string | null {
  const i = firstDatumIndexForSeries(data, valueKey)
  if (i < 0) return null
  const v = data[i][valueKey]
  return typeof v === 'number' && Number.isFinite(v) ? v.toFixed(1) : null
}

function fmtPctPtBR(raw: string): string {
  return raw.replace('.', ',')
}

function parseValorGraficoPonto(raw: unknown): number | null {
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw
  if (typeof raw === 'string') {
    const t = raw.trim()
    if (!t) return null
    const normalized =
      t.includes(',') && t.includes('.')
        ? t.replace(/\./g, '').replace(',', '.')
        : t.includes(',')
          ? t.replace(',', '.')
          : t
    const n = Number(normalized)
    return Number.isFinite(n) ? n : null
  }
  return null
}

/** Instituto abreviado para rótulo no ponto (estilo painel). */
function rotuloInstitutoNoPonto(nome: string): string {
  const t = nome.trim()
  if (t.length <= 14) return t.toUpperCase()
  return `${t.slice(0, 12).trim()}…`
}

function TendenciaTooltip({
  active,
  payload,
  label,
  executive = false,
}: {
  active?: boolean
  payload?: TendenciaTooltipPayloadItem[]
  label?: ReactNode
  executive?: boolean
}) {
  if (!active || !payload?.length) return null

  const row = payload[0]?.payload
  if (!row) return null

  const intencaoItems = payload.filter((item) => String(item.dataKey ?? '').startsWith('intencao_'))
  const institutosUnicos = new Set<string>()
  intencaoItems.forEach((item) => {
    const dataKey = item.dataKey != null ? String(item.dataKey) : ''
    const slug = dataKey.replace(/^intencao_/, '')
    const raw = row[`instituto_${slug}`]
    if (raw !== undefined && raw !== null && String(raw).trim() !== '') {
      institutosUnicos.add(String(raw).trim())
    }
  })
  const listaInst = [...institutosUnicos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const institutoNoHeader =
    listaInst.length === 0
      ? null
      : listaInst.length === 1
        ? `Instituto: ${listaInst[0]}`
        : `Institutos: ${listaInst.join(', ')}`

  const box = executive
    ? 'max-w-sm rounded-lg border border-slate-600 bg-slate-900 px-3 py-2.5 text-xs shadow-xl'
    : 'max-w-sm rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs shadow-lg'
  const title = executive
    ? 'mb-2 border-b border-slate-600 pb-1.5 text-sm font-semibold leading-snug text-white'
    : 'mb-2 border-b border-gray-100 pb-1.5 text-sm font-semibold leading-snug text-gray-900'
  const sub = executive ? 'font-medium text-slate-300' : 'font-medium text-gray-700'
  const nameC = executive ? 'font-semibold leading-tight text-slate-100' : 'font-semibold leading-tight text-gray-900'
  const pctC = executive ? 'font-semibold tabular-nums text-white' : 'font-semibold tabular-nums text-gray-900'

  return (
    <div className={box}>
      <p className={title}>
        <span>{label}</span>
        {institutoNoHeader ? (
          <span className={sub}>
            {' '}
            — {institutoNoHeader}
          </span>
        ) : null}
      </p>
      <ul className="max-h-64 space-y-2 overflow-y-auto pr-0.5">
        {intencaoItems.map((item, i) => {
          const dataKey = item.dataKey != null ? String(item.dataKey) : ''
          const slug = dataKey.replace(/^intencao_/, '')
          const nome = slug.replace(/_/g, ' ')
          const pct = formatTooltipPercent(item.value)
          const mark = item.color || item.stroke || '#111827'
          return (
            <li key={`${dataKey}-${i}`} className="flex items-center gap-2">
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white/30"
                style={{ backgroundColor: mark }}
              />
              <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2">
                <span className={nameC}>{nome}</span>
                <span className={pctC}>{pct}</span>
              </div>
            </li>
          )
        })}
      </ul>
    </div>
  )
}

type LabelListPropsRecharts = {
  x?: number
  y?: number
  value?: unknown
  index?: number
  payload?: TendenciaTooltipRow
}

/** Gráfico (fundo claro padrão) + legenda à direita: linhas suaves, rótulos nos pontos e no fim da série. */
function TendenciaLineChart({
  pesquisaData,
  candidatos,
  cores,
  chartClassName,
  resumoLegendaPorCandidato,
}: {
  pesquisaData: Record<string, string | number | undefined>[]
  candidatos: string[]
  cores: string[]
  chartClassName: string
  resumoLegendaPorCandidato: Record<string, string>
}) {
  const maiorNome =
    candidatos.length > 0 ? Math.max(...candidatos.map((c) => Math.min(c.length, 28))) : 12
  const marginRight = Math.min(280, Math.max(160, 32 + maiorNome * 5.5))

  return (
    <div
      className={`flex min-h-0 w-full flex-col gap-3 overflow-hidden md:flex-row md:items-stretch md:gap-3 ${chartClassName}`.trim()}
    >
      <div className="min-h-[200px] min-w-0 flex-1 h-full md:min-h-[220px] overflow-hidden rounded-lg border border-card bg-white">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={pesquisaData}
            margin={{ top: 28, right: marginRight, left: 6, bottom: 44 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgb(var(--border-card))"
              vertical={false}
            />
            <XAxis
              dataKey="data"
              angle={-32}
              textAnchor="end"
              height={58}
              fontSize={11}
              stroke="rgb(var(--text-muted))"
              tick={{ fill: 'rgb(var(--text-muted))' }}
            />
            <YAxis
              domain={[0, 100]}
              width={40}
              fontSize={11}
              stroke="rgb(var(--text-muted))"
              tick={{ fill: 'rgb(var(--text-muted))' }}
              tickFormatter={(v) => `${v}`}
            />
            <Tooltip
              content={(props) => (
                <TendenciaTooltip
                  active={props.active}
                  label={props.label}
                  payload={props.payload as TendenciaTooltipPayloadItem[] | undefined}
                />
              )}
            />
            {candidatos.map((candidato, index) => {
              const key = `intencao_${candidato.replace(/\s+/g, '_')}`
              const slug = candidato.replace(/\s+/g, '_')
              const cor = cores[index % cores.length]
              const lastIdx = lastDatumIndexForSeries(pesquisaData, key)
              const nomeCurto = candidato.length > 24 ? `${candidato.slice(0, 22)}…` : candidato
              return (
                <Line
                  key={key}
                  type="basis"
                  dataKey={key}
                  name={candidato}
                  stroke={cor}
                  strokeWidth={2.5}
                  isAnimationActive={false}
                  connectNulls={false}
                  dot={{ r: 4, fill: '#ffffff', stroke: cor, strokeWidth: 2 }}
                  activeDot={{ r: 6, fill: '#ffffff', stroke: cor, strokeWidth: 2 }}
                >
                  <LabelList
                    dataKey={key}
                    content={(rawProps: unknown) => {
                      const props = rawProps as LabelListPropsRecharts
                      const x = props.x
                      const y = props.y
                      const idx = props.index
                      const payload = props.payload
                      if (typeof x !== 'number' || typeof y !== 'number' || typeof idx !== 'number') {
                        return null
                      }
                      const val = parseValorGraficoPonto(props.value ?? payload?.[key])
                      if (val === null) return null
                      const instKey = `instituto_${slug}` as const
                      const instRaw = payload?.[instKey]
                      const inst =
                        typeof instRaw === 'string' && instRaw.trim() !== ''
                          ? rotuloInstitutoNoPonto(instRaw)
                          : ''

                      if (lastIdx >= 0 && idx === lastIdx) {
                        const texto = `${nomeCurto} ${val.toFixed(1).replace('.', ',')}%`
                        return (
                          <text
                            x={x}
                            y={y}
                            dx={12}
                            dy={0}
                            fill="#111827"
                            fontSize={11}
                            fontWeight={700}
                            dominantBaseline="middle"
                            stroke="#ffffff"
                            strokeWidth={4}
                            paintOrder="stroke fill"
                          >
                            {texto}
                          </text>
                        )
                      }

                      return (
                        <g>
                          <text
                            x={x}
                            y={y}
                            dy={-16}
                            textAnchor="middle"
                            fill="#111827"
                            fontSize={10}
                            fontWeight={700}
                            stroke="#ffffff"
                            strokeWidth={3}
                            paintOrder="stroke fill"
                          >
                            {val.toFixed(1).replace('.', ',')}%
                          </text>
                          {inst ? (
                            <text
                              x={x}
                              y={y}
                              dy={-4}
                              textAnchor="middle"
                              fill="#4b5563"
                              fontSize={8}
                              fontWeight={600}
                              style={{ textTransform: 'uppercase' }}
                            >
                              {inst}
                            </text>
                          ) : null}
                        </g>
                      )
                    }}
                  />
                </Line>
              )
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <aside
        className="max-h-[340px] w-full shrink-0 overflow-y-auto rounded-lg border border-card bg-background/95 px-2 py-2.5 text-left md:max-h-none md:w-[min(100%,308px)] md:border-l md:px-3"
        aria-label="Legenda: candidatos, primeira e última leitura da série, texto automático"
      >
        <p className="text-[10px] font-semibold uppercase tracking-wide text-secondary mb-2 px-0.5">
          Candidatos · 1ª → última % · leitura
        </p>
        <ul className="flex flex-col gap-3 list-none m-0 p-0">
          {candidatos.map((candidato, index) => {
            const key = `intencao_${candidato.replace(/\s+/g, '_')}`
            const pctPrimeira = primeiraIntencaoSerie(pesquisaData, key)
            const pctUltima = ultimaIntencaoSerie(pesquisaData, key)
            const i0 = firstDatumIndexForSeries(pesquisaData, key)
            const i1 = lastDatumIndexForSeries(pesquisaData, key)
            const cor = cores[index % cores.length]
            const resumo = resumoLegendaPorCandidato[candidato] ?? ''
            const blocoPct =
              pctPrimeira != null && pctUltima != null ? (
                i0 >= 0 && i1 >= 0 && i0 === i1 ? (
                  <span className="font-bold tabular-nums text-accent-gold">
                    {fmtPctPtBR(pctUltima)}%
                    <span className="font-normal text-secondary"> (uma data)</span>
                  </span>
                ) : (
                  <span className="font-bold tabular-nums text-accent-gold">
                    {fmtPctPtBR(pctPrimeira)}% → {fmtPctPtBR(pctUltima)}%
                  </span>
                )
              ) : pctUltima != null ? (
                <span className="font-bold tabular-nums text-accent-gold">{fmtPctPtBR(pctUltima)}%</span>
              ) : null
            return (
              <li key={key} className="text-[11px] leading-snug">
                <div className="flex items-start gap-2">
                  <span
                    className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-white"
                    style={{ backgroundColor: cor }}
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-1.5 gap-y-0">
                      <span className="font-semibold text-text-primary">{candidato}</span>
                      {blocoPct}
                    </div>
                    {resumo ? (
                      <p className="mt-1 text-[10px] leading-relaxed text-secondary">{resumo}</p>
                    ) : null}
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
        <p className="mt-3 text-[9px] leading-snug text-secondary px-0.5 border-t border-card/80 pt-2">
          Com «Todas», se a série cruza estimulada e espontânea, o texto alerta efeito de indecisão — não só «queda» ou
          «alta» de voto. Posição na última onda quando houver comparativo.
        </p>
      </aside>
    </div>
  )
}

function BlocoFeedbackAutomatico({
  titulo,
  subtitulo,
  bullets,
  avisos,
  mostrarCabecalhoInterno = true,
}: {
  titulo: string
  subtitulo?: string
  bullets: string[]
  avisos: string[]
  mostrarCabecalhoInterno?: boolean
}) {
  if (bullets.length === 0 && avisos.length === 0) return null
  return (
    <div className="rounded-xl border border-accent-gold-soft/50 bg-background/90 p-4">
      {mostrarCabecalhoInterno ? (
        <div className="flex items-start gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-accent-gold shrink-0 mt-0.5" aria-hidden />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-text-primary">{titulo}</h3>
            {subtitulo ? <p className="text-xs text-secondary mt-0.5 leading-snug">{subtitulo}</p> : null}
          </div>
        </div>
      ) : null}
      {bullets.length > 0 ? (
        <ul className="list-disc pl-5 space-y-1.5 text-sm text-text-primary leading-relaxed">
          {bullets.map((b, i) => (
            <li key={i}>{b}</li>
          ))}
        </ul>
      ) : null}
      {avisos.length > 0 ? (
        <ul className="mt-3 space-y-1.5 text-xs text-amber-900 dark:text-amber-100/90 border-l-2 border-amber-500 pl-3">
          {avisos.map((a, i) => (
            <li key={i}>{a}</li>
          ))}
        </ul>
      ) : null}
      <p className="mt-3 text-[10px] text-secondary leading-snug">
        Leitura automática por regras (sem IA), usando só os números cadastrados e o filtro atual. Não substitui análise de
        método amostral ou margem de erro.
      </p>
    </div>
  )
}

export default function PesquisaPage() {
  const searchParams = useSearchParams()
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [editingPoll, setEditingPoll] = useState<Poll | null>(null)
  const [tipoGrafico, setTipoGrafico] = useState<TipoGraficoPesquisa>('todas')
  const [filtroCargo, setFiltroCargo] = useState<string>('')
  const [filtroCidade, setFiltroCidade] = useState<string>('')
  const [filtroRegiao, setFiltroRegiao] = useState<'' | RegiaoPiaui>('')
  const [cities, setCities] = useState<Array<{ id: string; name: string }>>([])
  const [candidatoPadrao, setCandidatoPadrao] = useState<string>('')
  const [graficoTelaCheia, setGraficoTelaCheia] = useState(false)
  const [pollParaRelatorio, setPollParaRelatorio] = useState<Poll | null>(null)
  const [openedReportFromQuery, setOpenedReportFromQuery] = useState<string | null>(null)
  const [abaPesquisa, setAbaPesquisa] = useState<AbaPesquisaDashboard>('grafico')
  const tendenciaGraficoRef = useRef<HTMLDivElement>(null)
  const scrollParaGraficoAposTrocaAbaRef = useRef(false)

  const normalizeCityName = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
      .toUpperCase()

  const cidadeSelecionadaNome =
    cities.find((city) => city.id === filtroCidade)?.name || searchParams.get('cidade') || ''

  const hrefResumoEleicoes = cidadeSelecionadaNome
    ? `/dashboard/resumo-eleicoes?cidade=${encodeURIComponent(cidadeSelecionadaNome)}&returnFromPesquisa=1`
    : '/dashboard/resumo-eleicoes?returnFromPesquisa=1'

  useEffect(() => {
    fetchPolls()
    fetchCities()
    
    // Carregar candidato padrão do localStorage
    const candidatoSalvo = localStorage.getItem('candidatoPadraoPesquisa')
    if (candidatoSalvo) {
      setCandidatoPadrao(candidatoSalvo)
    }
  }, [])

  useEffect(() => {
    if (cities.length === 0) return

    const cidadeIdParam = searchParams.get('cidade_id')
    if (cidadeIdParam) {
      const cityExists = cities.some((city) => city.id === cidadeIdParam)
      if (cityExists) {
        setFiltroCidade(cidadeIdParam)
        return
      }
    }

    const cidadeParam = searchParams.get('cidade')
    if (!cidadeParam) return

    const cidadeNormalizada = normalizeCityName(cidadeParam)
    const matched = cities.find((city) => normalizeCityName(city.name) === cidadeNormalizada)
    if (matched) {
      setFiltroCidade(matched.id)
    }
  }, [cities, searchParams])

  useEffect(() => {
    const pollIdParam = searchParams.get('open_report_poll_id')
    if (!pollIdParam) return
    if (openedReportFromQuery === pollIdParam) return
    if (polls.length === 0) return

    const targetPoll = polls.find((poll) => poll.id === pollIdParam) || null
    if (targetPoll) {
      setPollParaRelatorio(targetPoll)
      setOpenedReportFromQuery(pollIdParam)
    }
  }, [polls, searchParams, openedReportFromQuery])

  useEffect(() => {
    if (!graficoTelaCheia) return
    const prevOverflow = document.body.style.overflow
    const scrollY = window.scrollY
    document.body.style.overflow = 'hidden'
    window.scrollTo(0, 0)
    return () => {
      document.body.style.overflow = prevOverflow
      window.scrollTo(0, scrollY)
    }
  }, [graficoTelaCheia])

  useEffect(() => {
    if (abaPesquisa !== 'grafico' || !scrollParaGraficoAposTrocaAbaRef.current) return
    scrollParaGraficoAposTrocaAbaRef.current = false
    const t = window.setTimeout(() => {
      tendenciaGraficoRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 0)
    return () => clearTimeout(t)
  }, [abaPesquisa])
  
  // Atualizar candidatos disponíveis quando polls mudarem
  useEffect(() => {
    if (polls.length > 0) {
      const candidatosDisponiveis = Array.from(new Set(polls.map(p => p.candidato_nome).filter(Boolean)))
      if (candidatosDisponiveis.length > 0) {
        const candidatoSalvo = localStorage.getItem('candidatoPadraoPesquisa')
        if (candidatoSalvo && candidatosDisponiveis.includes(candidatoSalvo)) {
          setCandidatoPadrao(candidatoSalvo)
        } else if (!candidatoSalvo && !candidatoPadrao) {
          // Se não há salvamento e não há candidato selecionado, usar o primeiro candidato
          setCandidatoPadrao(candidatosDisponiveis[0])
        }
      }
    }
  }, [polls])

  const fetchCities = async () => {
    try {
      const response = await fetch('/api/campo/cities')
      if (response.ok) {
        const data = await response.json()
        const sorted = data.sort((a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name))
        setCities(sorted)
      }
    } catch (error) {
      console.error('Erro ao buscar cidades:', error)
    }
  }

  const fetchPolls = async (options?: { silent?: boolean }) => {
    const silent = Boolean(options?.silent)
    if (!silent) setLoading(true)
    try {
      const response = await fetch(`/api/pesquisa?limit=${POLLS_FETCH_LIMIT}`)
      if (response.ok) {
        const data = await response.json()
        setPolls(data)
      }
    } catch (error) {
      console.error('Erro ao buscar pesquisas:', error)
    } finally {
      if (!silent) setLoading(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta pesquisa?')) return

    try {
      const response = await fetch(`/api/pesquisa/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        fetchPolls()
      } else {
        const error = await response.json()
        alert(error.error || 'Erro ao excluir pesquisa')
      }
    } catch (error) {
      alert('Erro ao excluir pesquisa')
    }
  }

  // Preparar dados para o gráfico (filtrar por tipo, cargo, cidade e região — região = cockpit / Histórico de pesquisas)
  // Agrupar por candidato para criar uma linha por candidato
  const pollsFiltrados = polls
    .filter((poll) => {
      if (tipoGrafico !== 'todas' && poll.tipo !== tipoGrafico) return false
      if (filtroCargo && poll.cargo !== filtroCargo) return false
      if (filtroCidade && poll.cidade_id !== filtroCidade) return false
      if (filtroRegiao) {
        const nomeCidade = poll.cities?.name?.trim()
        if (!nomeCidade) return false
        const regiaoPoll = getRegiaoParaCidade(nomeCidade, CIDADE_PARA_REGIAO_PESQUISA)
        if (regiaoPoll !== filtroRegiao) return false
      }
      return true
    })
    .slice()
    .reverse()

  const candidatosUnicos = Array.from(new Set(pollsFiltrados.map((p) => p.candidato_nome).filter(Boolean)))

  // Criar estrutura de dados: agrupar por data única, cada data tem valores de todos os candidatos
  // Primeiro, criar um mapa de datas únicas
  const datasUnicas = new Map<string, any>()
  
  pollsFiltrados.forEach((poll) => {
    // Tratar data como local para evitar problemas de timezone
    const dateStr = poll.data
    let formattedDate: string
    if (dateStr.includes('T')) {
      formattedDate = new Date(dateStr).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric'
      })
    } else {
      const [year, month, day] = dateStr.split('-').map(Number)
      formattedDate = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { 
        day: '2-digit', 
        month: '2-digit',
        year: 'numeric'
      })
    }
    
    // Se a data ainda não existe no mapa, criar
    if (!datasUnicas.has(formattedDate)) {
      datasUnicas.set(formattedDate, {
        data: formattedDate,
        dataOriginal: formattedDate,
        [META_TIPOS_NA_DATA]: new Set<Poll['tipo']>(),
      })
    }

    const dataObj = datasUnicas.get(formattedDate)!
    ;(dataObj[META_TIPOS_NA_DATA] as Set<Poll['tipo']>).add(poll.tipo)
    const key = `intencao_${poll.candidato_nome.replace(/\s+/g, '_')}`
    const keyRejeicao = `rejeicao_${poll.candidato_nome.replace(/\s+/g, '_')}`
    
    // Adicionar valor do candidato nesta data
    dataObj[key] = poll.intencao
    dataObj[keyRejeicao] = poll.rejeicao
    dataObj[`instituto_${poll.candidato_nome.replace(/\s+/g, '_')}`] = poll.instituto
  })
  
  // Converter mapa para array e ordenar por data
  const pesquisaDataBruta = Array.from(datasUnicas.values()).sort((a, b) => {
    const dateA = new Date(a.dataOriginal.split('/').reverse().join('-'))
    const dateB = new Date(b.dataOriginal.split('/').reverse().join('-'))
    return dateA.getTime() - dateB.getTime()
  })

  /**
   * Gráfico: ajuste de NS na espontânea; com «Todas», o mesmo ajuste nas datas em que só há espontânea
   * (evita misturar % de estimulada e espontânea na mesma barra). Tabela/resumo seguem brutos.
   */
  const pesquisaData = pesquisaDataBruta.map((row) => {
    const tipos = (row as Record<string, unknown>)[META_TIPOS_NA_DATA]
    const plain = rowSemMetaTipos(row as Record<string, unknown>)
    const aplicarNorm =
      tipoGrafico === 'espontanea' ||
      (tipoGrafico === 'todas' && linhaSoEspontaneaParaGrafico(tipos))
    return aplicarNorm
      ? normalizarLinhaEspontanea(plain, DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE)
      : plain
  })

  /** Ordenação das linhas: pela última data exibida no gráfico (após normalização, se houver). */
  const candidatos =
    pesquisaData.length === 0
      ? [...candidatosUnicos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      : (() => {
          const last = pesquisaData[pesquisaData.length - 1] as Record<string, string | number | undefined>
          const scored = candidatosUnicos.map((nome) => {
            const k = `intencao_${nome.replace(/\s+/g, '_')}`
            const v = last[k]
            const intencao = typeof v === 'number' && Number.isFinite(v) ? v : -1
            return { nome, intencao }
          })
          return scored.sort((a, b) => b.intencao - a.intencao).map((x) => x.nome)
        })()

  const subtituloModalTelaCheia =
    pesquisaData.length === 0
      ? 'Mesmos filtros da página'
      : (() => {
          const row = pesquisaData[pesquisaData.length - 1]
          const dataLabel = row.data != null ? String(row.data) : ''
          const inst = new Set<string>()
          Object.keys(row).forEach((k) => {
            if (!k.startsWith('instituto_')) return
            const v = row[k]
            if (v != null && String(v).trim() !== '') inst.add(String(v).trim())
          })
          const arr = [...inst].sort((a, b) => a.localeCompare(b, 'pt-BR'))
          const pctNs = Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)
          const sufixoAjuste =
            tipoGrafico === 'espontanea'
              ? ` · Espontânea no gráfico: ${pctNs}% do «Não sabe» redistribuído (branco/nulo inalterado)`
              : tipoGrafico === 'todas'
                ? ` · «Todas»: nas datas só espontânea, gráfico com mesmo ajuste de NS (${pctNs}% redistribuído); datas só estimulada ou com os dois tipos ficam brutas`
                : ''
          if (arr.length === 0) {
            return dataLabel
              ? `${dataLabel} · mesmos filtros da página${sufixoAjuste}`
              : `Mesmos filtros da página${sufixoAjuste}`
          }
          return (
            (arr.length === 1
              ? `${dataLabel} — Instituto: ${arr[0]}`
              : `${dataLabel} — Institutos: ${arr.join(', ')}`) + sufixoAjuste
          )
        })()

  const pesquisasResumoCandidato = (() => {
    if (!candidatoPadrao) return []
    return pollsFiltrados.filter((poll) => poll.candidato_nome === candidatoPadrao)
  })()

  const toDateMs = (dateStr: string): number => {
    if (!dateStr) return 0
    if (dateStr.includes('T')) return new Date(dateStr).getTime()
    const [year, month, day] = dateStr.split('-').map(Number)
    if (!year || !month || !day) return 0
    return new Date(year, month - 1, day).getTime()
  }

  const resumoDesempenho = (() => {
    if (pesquisasResumoCandidato.length === 0) return null

    const ordenadas = [...pesquisasResumoCandidato].sort((a, b) => toDateMs(a.data) - toDateMs(b.data))
    const primeira = ordenadas[0]
    const ultima = ordenadas[ordenadas.length - 1]
    const mediaIntencao =
      ordenadas.reduce((sum, item) => sum + (item.intencao || 0), 0) / Math.max(ordenadas.length, 1)
    const mediaRejeicao =
      ordenadas.reduce((sum, item) => sum + (item.rejeicao || 0), 0) / Math.max(ordenadas.length, 1)
    const melhor = [...ordenadas].sort((a, b) => (b.intencao || 0) - (a.intencao || 0))[0]
    const pior = [...ordenadas].sort((a, b) => (a.intencao || 0) - (b.intencao || 0))[0]
    const institutosUnicos = new Set(ordenadas.map((item) => item.instituto).filter(Boolean))
    const cidadesUnicas = new Set(ordenadas.map((item) => item.cities?.name).filter(Boolean))
    const pesquisasUnicas = new Set(
      ordenadas.map((item) => {
        const dataNormalizada = item.data.includes('T') ? item.data.split('T')[0] : item.data
        return `${dataNormalizada}_${item.instituto}`
      })
    )

    return {
      totalRegistros: ordenadas.length,
      totalPesquisasUnicas: pesquisasUnicas.size,
      mediaIntencao,
      mediaRejeicao,
      evolucaoIntencao: (ultima.intencao || 0) - (primeira.intencao || 0),
      melhor,
      pior,
      institutos: institutosUnicos.size,
      cidades: cidadesUnicas.size,
      primeiraData: primeira.data,
      ultimaData: ultima.data,
    }
  })()

  const linhasTabelaResumo = [...pesquisasResumoCandidato]
    .sort((a, b) => toDateMs(b.data) - toDateMs(a.data))
    .map((poll) => ({
      cidade: poll.cities?.name || 'Estado',
      instituto: poll.instituto || '-',
      intencao: poll.intencao || 0,
      data: formatDate(poll.data),
    }))

  const pollsParaFeedback = pollsFiltrados.map((p) => ({
    data: p.data,
    instituto: p.instituto,
    candidato_nome: p.candidato_nome,
    tipo: p.tipo,
    cidade_id: p.cidade_id ?? null,
    intencao: p.intencao ?? 0,
    rejeicao: p.rejeicao ?? 0,
    cities: p.cities,
  }))

  const metaPorLinhaGrafico = pesquisaDataBruta.map((row) =>
    metaTiposFromRowSet((row as Record<string, unknown>)[META_TIPOS_NA_DATA])
  )

  const resumoLegendaPorCandidato: Record<string, string> = {}
  for (const nome of candidatos) {
    resumoLegendaPorCandidato[nome] = gerarResumoLegendaSerieGrafico(
      nome,
      pesquisaData,
      pollsParaFeedback,
      metaPorLinhaGrafico
    )
  }

  const feedbackDesempenhoCandidato =
    candidatoPadrao && pesquisasResumoCandidato.length > 0
      ? gerarFeedbackDesempenhoCandidato(
          candidatoPadrao,
          pollsParaFeedback.filter((x) => x.candidato_nome === candidatoPadrao),
          pollsParaFeedback
        )
      : null

  const pollsPainelExecutivo = useMemo(() => {
    return polls
      .filter((poll) => {
        if (filtroCargo && poll.cargo !== filtroCargo) return false
        if (filtroCidade && poll.cidade_id !== filtroCidade) return false
        if (filtroRegiao) {
          const nomeCidade = poll.cities?.name?.trim()
          if (!nomeCidade) return false
          const regiaoPoll = getRegiaoParaCidade(nomeCidade, CIDADE_PARA_REGIAO_PESQUISA)
          if (regiaoPoll !== filtroRegiao) return false
        }
        return true
      })
      .slice()
      .reverse()
  }, [polls, filtroCargo, filtroCidade, filtroRegiao])

  const modeloExecutivoTendencia = useMemo(
    () =>
      buildExecutiveTendenciaModel(
        pollsPainelExecutivo.map((p) => ({
          data: p.data,
          tipo: p.tipo,
          candidato_nome: p.candidato_nome,
          intencao: p.intencao,
          instituto: p.instituto ?? '',
        }))
      ),
    [pollsPainelExecutivo]
  )

  const subtituloPainelExecutivoTendencia = [
    cidadeSelecionadaNome.trim() || (filtroRegiao ? `Região ${filtroRegiao}` : 'Estado / todas as cidades'),
    filtroCargo ? cargoLabels[filtroCargo] : 'Todos os cargos',
  ].join(' • ')

  const labelTipoGraficoContexto =
    tipoGrafico === 'todas' ? 'Gráfico: todas' : `Gráfico: ${tipoLabels[tipoGrafico]}`

  const handleVerDetalhesPainelExecutivo = (nome: string) => {
    setCandidatoPadrao(nome)
    localStorage.setItem('candidatoPadraoPesquisa', nome)
    scrollParaGraficoAposTrocaAbaRef.current = true
    setAbaPesquisa('grafico')
  }

  return (
    <div className="min-h-screen bg-background">

      <div className="px-4 py-6 lg:px-6">
        {/* Seletor de Candidato Padrão e Botão Nova Pesquisa */}
        <div className="bg-surface rounded-2xl border border-card p-4 mb-6">
          <div className="flex items-center gap-4 flex-wrap">
            <Link
              href={hrefResumoEleicoes}
              className="px-3 py-2 text-xs font-medium border border-card rounded-lg hover:bg-background transition-colors inline-flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para Resumo Eleições
            </Link>
            <label className="text-sm font-semibold text-text-primary whitespace-nowrap">
              Candidato para resumo:
            </label>
            <select
              value={candidatoPadrao}
              onChange={(e) => {
                const novoCandidato = e.target.value
                setCandidatoPadrao(novoCandidato)
                localStorage.setItem('candidatoPadraoPesquisa', novoCandidato)
              }}
              className="flex-1 max-w-xs px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
            >
              <option value="">Selecione um candidato</option>
              {Array.from(new Set(polls.map(p => p.candidato_nome).filter(Boolean)))
                .sort()
                .map((candidato) => (
                  <option key={candidato} value={candidato}>
                    {candidato}
                  </option>
                ))}
            </select>
            <button
              onClick={() => {
                setEditingPoll(null)
                setShowModal(true)
              }}
              className="ml-auto px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Nova Pesquisa
            </button>
          </div>
        </div>

        {/* Filtros — uma linha (scroll horizontal em telas estreitas) */}
        <div id="filtros" className="bg-surface rounded-xl border border-card px-3 py-2 mb-4">
          <div className="flex flex-nowrap items-center gap-x-2 sm:gap-3 overflow-x-auto pb-0.5 [scrollbar-width:thin]">
            <span className="text-xs font-semibold text-text-primary shrink-0">Filtros</span>
            <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

            <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
              <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                Tipo
              </span>
              <div className="flex items-center gap-x-2 sm:gap-x-3">
                <label
                  className="flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title={`No gráfico: nas datas em que só há pesquisa espontânea, ${Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)}% do «Não sabe» é redistribuído entre candidatos. Datas só estimulada ou com os dois tipos permanecem sem esse ajuste.`}
                >
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="todas"
                    checked={tipoGrafico === 'todas'}
                    onChange={(e) => setTipoGrafico(e.target.value as TipoGraficoPesquisa)}
                    className="h-3.5 w-3.5 shrink-0 text-accent-gold focus:ring-accent-gold"
                  />
                  <span className="text-xs text-text-primary">Todas</span>
                </label>
                <label className="flex items-center gap-1 cursor-pointer whitespace-nowrap">
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="estimulada"
                    checked={tipoGrafico === 'estimulada'}
                    onChange={(e) => setTipoGrafico(e.target.value as TipoGraficoPesquisa)}
                    className="h-3.5 w-3.5 shrink-0 text-accent-gold focus:ring-accent-gold"
                  />
                  <span className="text-xs text-text-primary">Estimulada</span>
                </label>
                <label
                  className="flex items-center gap-1 cursor-pointer whitespace-nowrap"
                  title={`No gráfico: ${Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)}% do «Não sabe» redistribuído; branco/nulo inalterado. Com «Todas», o mesmo nas datas só espontânea. Tabela com valores brutos.`}
                >
                  <input
                    type="radio"
                    name="tipoGrafico"
                    value="espontanea"
                    checked={tipoGrafico === 'espontanea'}
                    onChange={(e) => setTipoGrafico(e.target.value as TipoGraficoPesquisa)}
                    className="h-3.5 w-3.5 shrink-0 text-accent-gold focus:ring-accent-gold"
                  />
                  <span className="text-xs text-text-primary">Espontânea</span>
                </label>
              </div>
            </div>

            <span className="hidden sm:block h-4 w-px shrink-0 bg-border-card opacity-60" aria-hidden />

            <label className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                Cargo
              </span>
              <select
                value={filtroCargo}
                onChange={(e) => setFiltroCargo(e.target.value)}
                className="min-w-[6.5rem] max-w-[9rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todos</option>
                <option value="dep_estadual">Dep. Estadual</option>
                <option value="dep_federal">Dep. Federal</option>
                <option value="governador">Governador</option>
                <option value="senador">Senador</option>
                <option value="presidente">Presidente</option>
              </select>
            </label>

            <label className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                Cidade
              </span>
              <select
                value={filtroCidade}
                onChange={(e) => setFiltroCidade(e.target.value)}
                className="min-w-[6.5rem] max-w-[10rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todas</option>
                {cities.map((city) => (
                  <option key={city.id} value={city.id}>
                    {city.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-medium uppercase tracking-wide text-secondary whitespace-nowrap">
                Região
              </span>
              <select
                value={filtroRegiao}
                onChange={(e) => setFiltroRegiao(e.target.value as '' | RegiaoPiaui)}
                title="Mesma lógica do cockpit: município mapeado por latitude (Norte, Centro-Norte, Centro-Sul, Sul)."
                className="min-w-[5.5rem] max-w-[8rem] rounded-lg border border-card bg-surface px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Todas</option>
                {REGIOES_PI_ORDER.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <div className="bg-surface rounded-2xl border border-card mb-6 overflow-hidden">
          <div
            role="tablist"
            aria-label="Visualizações da pesquisa"
            className="flex flex-wrap gap-1 border-b border-card px-2 pt-2 sm:px-3"
          >
            <button
              type="button"
              role="tab"
              id="pesquisa-tab-grafico"
              aria-selected={abaPesquisa === 'grafico'}
              aria-controls="pesquisa-panel-grafico"
              tabIndex={abaPesquisa === 'grafico' ? 0 : -1}
              onClick={() => setAbaPesquisa('grafico')}
              className={`inline-flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                abaPesquisa === 'grafico'
                  ? 'bg-background text-text-primary shadow-[inset_0_-2px_0_0_rgb(var(--accent-gold))]'
                  : 'text-secondary hover:bg-background/60 hover:text-text-primary'
              }`}
            >
              <BarChart3 className="h-4 w-4 shrink-0" aria-hidden />
              Tendência temporal
            </button>
            <button
              type="button"
              role="tab"
              id="pesquisa-tab-tendencia-cards"
              aria-selected={abaPesquisa === 'tendencia_cards'}
              aria-controls="pesquisa-panel-tendencia-cards"
              tabIndex={abaPesquisa === 'tendencia_cards' ? 0 : -1}
              onClick={() => setAbaPesquisa('tendencia_cards')}
              className={`inline-flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                abaPesquisa === 'tendencia_cards'
                  ? 'bg-background text-text-primary shadow-[inset_0_-2px_0_0_rgb(var(--accent-gold))]'
                  : 'text-secondary hover:bg-background/60 hover:text-text-primary'
              }`}
            >
              <LayoutGrid className="h-4 w-4 shrink-0" aria-hidden />
              Intenção de voto (cards)
            </button>
            <button
              type="button"
              role="tab"
              id="pesquisa-tab-cadastradas"
              aria-selected={abaPesquisa === 'cadastradas'}
              aria-controls="pesquisa-panel-cadastradas"
              tabIndex={abaPesquisa === 'cadastradas' ? 0 : -1}
              onClick={() => setAbaPesquisa('cadastradas')}
              className={`inline-flex items-center gap-2 rounded-t-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                abaPesquisa === 'cadastradas'
                  ? 'bg-background text-text-primary shadow-[inset_0_-2px_0_0_rgb(var(--accent-gold))]'
                  : 'text-secondary hover:bg-background/60 hover:text-text-primary'
              }`}
            >
              <ClipboardList className="h-4 w-4 shrink-0" aria-hidden />
              Pesquisas cadastradas
            </button>
          </div>

          <div className="p-3 sm:p-4">
            {abaPesquisa === 'grafico' ? (
              <div
                ref={tendenciaGraficoRef}
                id="pesquisa-panel-grafico"
                role="tabpanel"
                aria-labelledby="pesquisa-tab-grafico"
                className="rounded-xl border border-card bg-surface p-4"
              >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <BarChart3 className="w-5 h-5 text-accent-gold shrink-0" />
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-text-primary">
                  Tendência temporal de intenção (todos os candidatos)
                </h2>
                <p className="text-[11px] text-secondary mt-0.5">
                  Uma linha por candidato; legenda à direita.{' '}
                  <span className="whitespace-nowrap">Tela cheia para mais espaço.</span>
                </p>
                {tipoGrafico === 'espontanea' || tipoGrafico === 'todas' ? (
                  <details className="mt-1 text-[11px] text-secondary">
                    <summary className="cursor-pointer text-secondary hover:text-text-primary select-none">
                      Ajuste de espontânea no gráfico
                    </summary>
                    <p className="mt-1.5 border-l-2 border-border-card/50 pl-2 leading-snug">
                      {tipoGrafico === 'espontanea' ? (
                        <>
                          {Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)}% do «Não sabe» redistribuído entre
                          candidatos (branco/nulo inalterado). Na aba «Pesquisas cadastradas», os valores permanecem brutos.
                        </>
                      ) : (
                        <>
                          Nas datas em que <strong>só</strong> há espontânea, o mesmo ajuste; nas demais, valores brutos no
                          gráfico. Na aba «Pesquisas cadastradas», sempre brutos.
                        </>
                      )}
                    </p>
                  </details>
                ) : null}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setGraficoTelaCheia(true)}
              className="shrink-0 inline-flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border border-card bg-background hover:bg-background/80 transition-colors"
              title="Visualizar em tela cheia"
            >
              <Maximize2 className="w-4 h-4 text-secondary" />
              Tela cheia
            </button>
          </div>
          <div className="rounded-xl border border-card p-4 mt-4">
            {loading ? (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-secondary">Carregando...</p>
              </div>
            ) : pesquisaData.length === 0 ? (
              <div className="h-[280px] flex items-center justify-center">
                <p className="text-secondary text-center px-4">
                  {polls.length === 0
                    ? 'Nenhuma pesquisa cadastrada'
                    : 'Nenhum registro com os filtros atuais (incluindo região).'}
                </p>
              </div>
            ) : (
              <TendenciaLineChart
                pesquisaData={pesquisaData}
                candidatos={candidatos}
                cores={TENDENCIA_SERIES_COLORS}
                chartClassName="h-[280px] bg-white rounded-lg"
                resumoLegendaPorCandidato={resumoLegendaPorCandidato}
              />
            )}
          </div>
              </div>
            ) : abaPesquisa === 'tendencia_cards' ? (
              <div
                id="pesquisa-panel-tendencia-cards"
                role="tabpanel"
                aria-labelledby="pesquisa-tab-tendencia-cards"
                className="space-y-6"
              >
                <TendenciaIntencaoExecutiveSection
                  model={modeloExecutivoTendencia}
                  loading={loading}
                  subtitulo={subtituloPainelExecutivoTendencia}
                  ajusteNsPct={Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)}
                  tipoGraficoLabel={labelTipoGraficoContexto}
                  onVerDetalhesCandidato={handleVerDetalhesPainelExecutivo}
                />

                <div className="rounded-xl border border-card bg-surface p-4 sm:p-6">
                  <h2 className="text-lg font-semibold text-text-primary mb-6">Resumo de Desempenho</h2>
          {!candidatoPadrao ? (
            <p className="text-sm text-secondary">
              Selecione um candidato acima para visualizar o resumo consolidado (respeita os filtros).
            </p>
          ) : !resumoDesempenho ? (
            <p className="text-sm text-secondary">
              Não há pesquisas registradas para <strong>{candidatoPadrao}</strong>.
            </p>
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary">Pesquisas únicas</p>
                  <p className="text-xl font-bold text-text-primary">{resumoDesempenho.totalPesquisasUnicas}</p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary">Média de intenção</p>
                  <p className="text-xl font-bold text-accent-gold">{resumoDesempenho.mediaIntencao.toFixed(1)}%</p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary">Média de rejeição</p>
                  <p className="text-xl font-bold text-status-error">{resumoDesempenho.mediaRejeicao.toFixed(1)}%</p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary">Evolução (1ª → última)</p>
                  <p className={`text-xl font-bold ${resumoDesempenho.evolucaoIntencao >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                    {resumoDesempenho.evolucaoIntencao >= 0 ? '+' : ''}{resumoDesempenho.evolucaoIntencao.toFixed(1)} p.p.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary mb-1">Melhor desempenho</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {resumoDesempenho.melhor.intencao.toFixed(1)}% • {formatDate(resumoDesempenho.melhor.data)}
                  </p>
                  <p className="text-xs text-secondary">
                    {resumoDesempenho.melhor.instituto} {resumoDesempenho.melhor.cities?.name ? `• ${resumoDesempenho.melhor.cities.name}` : ''}
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-background border border-card">
                  <p className="text-xs text-secondary mb-1">Menor desempenho</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {resumoDesempenho.pior.intencao.toFixed(1)}% • {formatDate(resumoDesempenho.pior.data)}
                  </p>
                  <p className="text-xs text-secondary">
                    {resumoDesempenho.pior.instituto} {resumoDesempenho.pior.cities?.name ? `• ${resumoDesempenho.pior.cities.name}` : ''}
                  </p>
                </div>
              </div>

              <p className="text-xs text-secondary">
                Cobertura: {resumoDesempenho.institutos} instituto(s), {resumoDesempenho.cidades} cidade(s) e {resumoDesempenho.totalRegistros} registro(s) do candidato {candidatoPadrao}.
              </p>

              {feedbackDesempenhoCandidato &&
              (feedbackDesempenhoCandidato.bullets.length > 0 || feedbackDesempenhoCandidato.avisos.length > 0) ? (
                <BlocoFeedbackAutomatico
                  titulo={`Feedback automático — ${candidatoPadrao}`}
                  subtitulo="Série temporal e posição relativa nas mesmas ondas (data, instituto, cidade e tipo de pesquisa)."
                  bullets={feedbackDesempenhoCandidato.bullets}
                  avisos={feedbackDesempenhoCandidato.avisos}
                />
              ) : null}

              <div className="rounded-xl border border-card overflow-hidden">
                <div className="px-3 py-2 bg-background border-b border-card">
                  <p className="text-xs font-medium text-text-secondary">Detalhamento das pesquisas do candidato</p>
                </div>
                <div className="max-h-56 overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr>
                        <th className="text-left py-2 px-3 bg-background">Cidade</th>
                        <th className="text-left py-2 px-3 bg-background">Instituto</th>
                        <th className="text-right py-2 px-3 bg-background">%</th>
                        <th className="text-right py-2 px-3 bg-background">Data</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linhasTabelaResumo.map((linha, index) => (
                        <tr key={`${linha.data}-${linha.instituto}-${index}`} className="border-b border-card last:border-b-0">
                          <td className="py-1.5 px-3 text-text-primary">{linha.cidade}</td>
                          <td className="py-1.5 px-3 text-text-primary">{linha.instituto}</td>
                          <td className="py-1.5 px-3 text-right font-semibold text-accent-gold">{linha.intencao.toFixed(1)}%</td>
                          <td className="py-1.5 px-3 text-right text-text-secondary">{linha.data}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
                </div>
              </div>
            ) : (
              <div
                id="pesquisa-panel-cadastradas"
                role="tabpanel"
                aria-labelledby="pesquisa-tab-cadastradas"
                className="rounded-xl border border-card bg-surface p-4 sm:p-6"
              >
          <h2 className="text-lg font-semibold text-text-primary mb-6">Pesquisas Cadastradas</h2>
          {loading ? (
            <div className="text-center py-8">
              <p className="text-secondary">Carregando...</p>
            </div>
          ) : polls.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-secondary mb-4">Nenhuma pesquisa cadastrada ainda</p>
              <button
                type="button"
                onClick={() => {
                  setEditingPoll(null)
                  setShowModal(true)
                }}
                className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors"
              >
                Adicionar Primeira Pesquisa
              </button>
            </div>
          ) : pollsFiltrados.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-secondary mb-2">Nenhuma pesquisa corresponde aos filtros atuais.</p>
              <p className="text-xs text-secondary">Ajuste tipo, cargo, cidade ou região, ou limpe os filtros.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-card">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Data</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Instituto</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Candidato</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Cidade</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Tipo</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">Cargo</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-primary">Intenção</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-primary">Rejeição</th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-text-primary">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pollsFiltrados.map((poll) => (
                    <tr key={poll.id} className="border-b border-card hover:bg-background/50 transition-colors">
                      <td className="py-3 px-4 text-sm text-text-primary">
                        {(() => {
                          // Tratar data como local para evitar problemas de timezone
                          const dateStr = poll.data
                          if (dateStr.includes('T')) {
                            // Se tem hora, usar new Date normalmente
                            return new Date(dateStr).toLocaleDateString('pt-BR')
                          } else {
                            // Se é só data (YYYY-MM-DD), parsear como local
                            const [year, month, day] = dateStr.split('-').map(Number)
                            return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
                          }
                        })()}
                      </td>
                      <td className="py-3 px-4 text-sm text-text-primary">{poll.instituto}</td>
                      <td className="py-3 px-4 text-sm font-semibold text-text-primary">
                        {poll.candidato_nome}
                      </td>
                      <td className="py-3 px-4 text-sm text-secondary">
                        {poll.cities?.name || '-'}
                      </td>
                      <td className="py-3 px-4 text-sm text-secondary">{tipoLabels[poll.tipo]}</td>
                      <td className="py-3 px-4 text-sm text-secondary">{cargoLabels[poll.cargo]}</td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-accent-gold">
                        {poll.intencao.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4 text-sm text-right font-semibold text-status-error">
                        {poll.rejeicao.toFixed(1)}%
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-center gap-2">
                          <button
                            onClick={() => setPollParaRelatorio(poll)}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                            title="Anexar PDF e gerar análise"
                          >
                            <FileText className="w-4 h-4 text-blue-600" />
                          </button>
                          <button
                            onClick={() => {
                              setEditingPoll(poll)
                              setShowModal(true)
                            }}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4 text-secondary" />
                          </button>
                          <button
                            onClick={() => handleDelete(poll.id)}
                            className="p-2 rounded-lg hover:bg-background transition-colors"
                            title="Excluir"
                          >
                            <Trash2 className="w-4 h-4 text-status-error" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal de Pesquisa */}
      {showModal && (
        <PollModal
          poll={editingPoll}
          onClose={() => {
            setShowModal(false)
            setEditingPoll(null)
          }}
          onUpdate={fetchPolls}
        />
      )}

      {pollParaRelatorio && (
        <PollReportModal
          poll={{
            id: pollParaRelatorio.id,
            instituto: pollParaRelatorio.instituto,
            candidato_nome: pollParaRelatorio.candidato_nome,
            data: pollParaRelatorio.data,
            cidade: pollParaRelatorio.cities?.name || undefined,
          }}
          onClose={() => setPollParaRelatorio(null)}
        />
      )}

      {/* Tela cheia no document.body: evita PageTransition (transform), que quebra fixed e cria vão branco gigante */}
      {graficoTelaCheia &&
        createPortal(
          <div
            className="fixed inset-0 z-[200] flex h-[100dvh] max-h-[100dvh] w-full flex-col bg-background"
            role="dialog"
            aria-modal="true"
            aria-labelledby="pesquisa-tendencia-tela-cheia-titulo"
          >
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-card bg-surface px-3 py-3 sm:px-4">
              <div className="flex min-w-0 items-start gap-2">
                <BarChart3 className="mt-0.5 h-5 w-5 shrink-0 text-accent-gold" />
                <div>
                  <h2
                    id="pesquisa-tendencia-tela-cheia-titulo"
                    className="text-base font-semibold text-text-primary"
                  >
                    Tendência temporal de intenção — tela cheia
                  </h2>
                  <p className="mt-0.5 text-xs text-secondary">{subtituloModalTelaCheia}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setGraficoTelaCheia(false)}
                className="shrink-0 rounded-lg p-2 transition-colors hover:bg-background"
                title="Fechar tela cheia"
              >
                <X className="h-6 w-6 text-secondary" />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
              {loading ? (
                <div className="flex h-full items-center justify-center">
                  <p className="text-secondary">Carregando...</p>
                </div>
              ) : pesquisaData.length === 0 ? (
                <div className="flex h-full items-center justify-center px-4 text-center">
                  <p className="text-secondary">
                    {polls.length === 0
                      ? 'Nenhuma pesquisa cadastrada'
                      : 'Nenhum registro com os filtros atuais (incluindo região).'}
                  </p>
                </div>
              ) : (
                <div className="flex h-full min-h-0 flex-1 flex-col overflow-visible rounded-xl border border-card bg-white p-2 sm:p-3">
                  <TendenciaLineChart
                    pesquisaData={pesquisaData}
                    candidatos={candidatos}
                    cores={TENDENCIA_SERIES_COLORS}
                    chartClassName="min-h-0 w-full flex-1 basis-0"
                    resumoLegendaPorCandidato={resumoLegendaPorCandidato}
                  />
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

