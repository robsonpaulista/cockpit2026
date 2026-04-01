'use client'

import { useEffect, useMemo, useState, type ComponentType, type Ref } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bookmark,
  Eye,
  ExternalLink,
  Flame,
  Heart,
  Lightbulb,
  MapPin,
  Maximize2,
  MessageCircle,
  Share2,
  TrendingDown,
  TrendingUp,
  X,
  ThermometerSnowflake,
  ThermometerSun,
} from 'lucide-react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { KPIHeroCard } from '@/components/kpi-hero-card'
import { KPICard } from '@/components/kpi-card'
import { GlassGradientProgressBar } from '@/components/animated-bar'
import type { KPI, NewsItem } from '@/types'
import { cn } from '@/lib/utils'
import {
  formatarTextoDisputaSobraSemDistancia,
  formatarTextoFaltamVotosDisputaSobra,
} from '@/lib/chapas-segunda-vaga-republicanos'
import { useCockpitStatus } from '@/contexts/cockpit-status-context'
import {
  cidadeTrendAlertsParaRegiao,
  regiaoMuitoAbaixoDaMediaEstadual,
} from '@/lib/cockpit-polls-alerts'
import {
  REGIOES_PI_ORDER,
  type HistoricoIntencaoPorRegiaoMap,
  type MediaIntencaoPorRegiao,
  type PesquisasPorRegiaoMap,
  type RegiaoPiaui,
} from '@/lib/piaui-regiao'
import type { InstagramPostChampions, InstagramPostMetricsRow } from '@/lib/instagram-post-champions'

const DASHBOARD_BLUE = '#0E74BC'
const DASHBOARD_GOLD = 'rgb(var(--strategic-yellow))'

function cidadesParaTooltipHistorico(cidade?: string): string[] {
  if (!cidade?.trim()) return []
  return cidade
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s !== 'Estado' && s !== 'Cidade não encontrada')
}

/**
 * Mesma linguagem dos KPIs Cockpit (borda branca + blur + sombra interna),
 * com a projeção do hero / kpi-card cockpit para borda inferior legível em TV/projetor.
 */
const COCKPIT_SECTION_GLASS_CLASS =
  'rounded-2xl border border-white/50 bg-white/24 p-4 backdrop-blur-[10px] supports-[backdrop-filter]:bg-white/18 shadow-[0_12px_40px_rgba(6,46,82,0.35),0_4px_24px_rgba(15,45,74,0.08),inset_0_1px_0_rgba(255,255,255,0.6)]'

/** Mini-KPIs da análise de territórios — vidro fino para destacar sobre o card */
const COCKPIT_TERRITORIO_KPI_GLASS =
  'rounded-xl border border-white/50 bg-white/12 p-2.5 backdrop-blur-md supports-[backdrop-filter]:bg-white/[0.08] shadow-[inset_0_1px_0_rgba(255,255,255,0.48),0_2px_14px_rgba(15,45,74,0.08)]'

/** Cabeçalho (região + média %) dos mini gráficos de histórico de pesquisas */
const COCKPIT_POLLS_REGIAO_HEADER_GLASS = cn(
  'flex shrink-0 items-center justify-between gap-1.5',
  'rounded-lg border border-white/55 bg-white/22 px-2.5 py-1.5',
  'backdrop-blur-[12px] supports-[backdrop-filter]:bg-white/16',
  'shadow-[inset_0_1px_0_rgba(255,255,255,0.62),0_2px_12px_rgba(15,45,74,0.08)]'
)

const COCKPIT_TERR_BADGE_BASE =
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-semibold backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.4),0_2px_12px_rgba(15,45,74,0.06)]'

const COCKPIT_TERR_BADGE_QUENTE = cn(
  COCKPIT_TERR_BADGE_BASE,
  'border-emerald-400/45 bg-emerald-500/15 text-emerald-800 supports-[backdrop-filter]:bg-emerald-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_12px_rgba(16,185,129,0.14)]'
)
const COCKPIT_TERR_BADGE_MORNO = cn(
  COCKPIT_TERR_BADGE_BASE,
  'border-amber-400/45 bg-amber-500/15 text-amber-900 supports-[backdrop-filter]:bg-amber-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_12px_rgba(245,158,11,0.14)]'
)
const COCKPIT_TERR_BADGE_FRIO = cn(
  COCKPIT_TERR_BADGE_BASE,
  'border-red-400/45 bg-red-500/15 text-red-800 supports-[backdrop-filter]:bg-red-500/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.45),0_2px_12px_rgba(239,68,68,0.12)]'
)

export type SegundaVagaInfoCockpit = {
  vagasAtuais: number
  alvoVaga: number
  distancia: number
  distanciaCompetidor: number
  tipo: 'margem' | 'faltam'
  competidorProximo: string | null
  qpRepublicanos: number
  qpCompetidor: number
  rodada: number
} | null

export type PostsInsightsCockpitPayload = (InstagramPostChampions & { username?: string }) | null

/** Linhas de métrica — reutilizável no modal tela cheia do dashboard */
export const COCKPIT_POSTS_INSIGHT_ROWS: Array<{
  key: keyof InstagramPostChampions
  label: string
  Icon: ComponentType<{ className?: string }>
  metric: (p: InstagramPostMetricsRow) => string
}> = [
  { key: 'bestLikes', label: 'Mais curtidas', Icon: Heart, metric: (p) => p.metrics.likes.toLocaleString('pt-BR') },
  { key: 'bestComments', label: 'Mais comentários', Icon: MessageCircle, metric: (p) => p.metrics.comments.toLocaleString('pt-BR') },
  { key: 'bestViews', label: 'Mais visualizações', Icon: Eye, metric: (p) => (p.metrics.views ?? 0).toLocaleString('pt-BR') },
  { key: 'bestShares', label: 'Mais compartilhamentos', Icon: Share2, metric: (p) => (p.metrics.shares ?? 0).toLocaleString('pt-BR') },
  { key: 'bestSaves', label: 'Mais salvamentos', Icon: Bookmark, metric: (p) => (p.metrics.saves ?? 0).toLocaleString('pt-BR') },
  { key: 'bestEngagement', label: 'Maior engajamento', Icon: Activity, metric: (p) => p.metrics.engagement.toLocaleString('pt-BR') },
]

export interface DashboardCockpitVivoLayoutProps {
  loading: boolean
  kpisComMedia: KPI[]
  VOTOS_ELEICAO_ANTERIOR: number
  rankingExpectativa: { posicao: number; totalCandidatos: number } | null
  rankingPesquisas: {
    posicao: number
    totalCandidatos: number
    mediaCandidato: number | null
    projecaoVotos: number | null
    cidadesComPesquisa: number
  } | null
  rankingPesquisasTop10: Array<{ posicao: number; nome: string; media: number }>
  setShowRankingPesquisasModal: (open: boolean) => void
  cenarioVotosDashboard: 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'
  setCenarioVotosDashboard: (c: 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior') => void
  segundaVagaInfo: SegundaVagaInfoCockpit
  segundaVagaInfoEstadual: SegundaVagaInfoCockpit
  loadingTerritorios: boolean
  territorioStats: {
    totalCidades: number
    cidadesVisitadas: number
    cidadesNaoVisitadas: number
    totalVisitas: number
    totalExpectativa: number
    percentualCobertura: number
  } | null
  cidadesComLiderancas: string[]
  eleitoresPorCidade: Record<string, number>
  territoriosQuentes: Array<{ cidade: string; motivo: string; expectativaVotos?: number; visitas?: number }>
  territoriosMornos: Array<{ cidade: string; motivo: string; expectativaVotos?: number; visitas?: number }>
  territoriosFrios: Array<{ cidade: string; motivo: string; expectativaVotos?: number; visitas?: number }>
  loadingPolls: boolean
  pollsData: Array<{ date: string; intencao: number; instituto?: string; cidade?: string }>
  /** Média de intenção por região do PI (mesmas faixas do mapa de território) */
  pollsMediasRegiao: MediaIntencaoPorRegiao[]
  /** Série temporal por região (média por data, só municípios mapeados no PI) */
  pollsHistoricoPorRegiao: HistoricoIntencaoPorRegiaoMap
  /** Pesquisas individuais por região (modal ao duplo clique na média %) */
  pollsPesquisasPorRegiao: PesquisasPorRegiaoMap
  candidatoPadrao: string
  picoIntencaoGrafico: number
  loadingPostsInsights: boolean
  postsInsights: PostsInsightsCockpitPayload
  loadingAlerts: boolean
  monitorNewsOrdenadas: NewsItem[]
  monitorInsight: {
    headline: string
    tone: 'positive' | 'negative' | 'warning' | 'neutral'
  } | null
  monitorHeaderContext: string
  monitorFeaturedNewsIds: string[]
  setInsightTelaCheia: (v: boolean) => void
  setAnaliseTerritoriosTelaCheia: (v: boolean) => void
  setGraficoPollsTelaCheia: (v: boolean) => void
  setBandeirasTelaCheia: (v: boolean) => void
  setAlertasTelaCheia: (v: boolean) => void
  getContextoMonitor: (item: NewsItem) => string
  getLinhaSemanticaClass: (item: NewsItem) => string | null
  /** Mesmo ref/effect do Monitor compacto: auto-scroll + pausa no hover. */
  monitorScrollRef: Ref<HTMLDivElement>
  onMonitorScrollMouseEnter: () => void
  onMonitorScrollMouseLeave: () => void
  monitorActiveNewsId: string | null
}

export function DashboardCockpitVivoLayout(props: DashboardCockpitVivoLayoutProps) {
  const { setCockpitStatusMetrics } = useCockpitStatus()
  const [modalRegiaoPesquisas, setModalRegiaoPesquisas] = useState<RegiaoPiaui | null>(null)

  const presencaKpi = props.kpisComMedia.find((k) => k.id === 'presenca')
  const baseKpi = props.kpisComMedia.find((k) => k.id === 'base')
  const varTerritorio =
    presencaKpi?.variation !== undefined && presencaKpi.variation > 0
      ? `+${presencaKpi.variation}% território`
      : 'Território estável'

  const lugarChapa =
    props.rankingExpectativa && props.rankingExpectativa.posicao > 0
      ? `${props.rankingExpectativa.posicao}º lugar projetado`
      : 'Posição em definição'

  useEffect(() => {
    setCockpitStatusMetrics({
      territorioLabel: varTerritorio,
      lugarChapa,
    })
    return () => setCockpitStatusMetrics(null)
  }, [varTerritorio, lugarChapa, setCockpitStatusMetrics])

  const cockpitUsaMiniGraficosRegiao = useMemo(
    () => REGIOES_PI_ORDER.some((r) => props.pollsHistoricoPorRegiao[r].length > 0),
    [props.pollsHistoricoPorRegiao]
  )

  const cockpitPollsMiniAlertasPorRegiao = useMemo(() => {
    const medias = props.pollsMediasRegiao
    return REGIOES_PI_ORDER.reduce(
      (acc, regiao) => {
        const trends = cidadeTrendAlertsParaRegiao(props.pollsPesquisasPorRegiao[regiao] ?? [])
        const mediaRow = medias.find((m) => m.regiao === regiao)
        acc[regiao] = {
          trends,
          regiaoAbaixo: regiaoMuitoAbaixoDaMediaEstadual(mediaRow?.media, medias),
        }
        return acc
      },
      {} as Record<
        RegiaoPiaui,
        {
          trends: ReturnType<typeof cidadeTrendAlertsParaRegiao>
          regiaoAbaixo: boolean
        }
      >
    )
  }, [props.pollsPesquisasPorRegiao, props.pollsMediasRegiao])

  /** Melhor / pior média regional (mini-gráficos) para borda sutil no card. */
  const melhorEPiorRegiaoPesquisas = useMemo(() => {
    if (!cockpitUsaMiniGraficosRegiao) {
      return { melhor: null as RegiaoPiaui | null, pior: null as RegiaoPiaui | null }
    }
    const rows = REGIOES_PI_ORDER.map((regiao) => {
      const m = props.pollsMediasRegiao.find((x) => x.regiao === regiao)
      return m ? { regiao, media: m.media } : null
    }).filter((x): x is { regiao: RegiaoPiaui; media: number } => x !== null)
    if (rows.length < 2) {
      return { melhor: null as RegiaoPiaui | null, pior: null as RegiaoPiaui | null }
    }
    const maxM = Math.max(...rows.map((r) => r.media))
    const minM = Math.min(...rows.map((r) => r.media))
    if (maxM === minM) {
      return { melhor: null as RegiaoPiaui | null, pior: null as RegiaoPiaui | null }
    }
    return {
      melhor: rows.find((r) => r.media === maxM)?.regiao ?? null,
      pior: rows.find((r) => r.media === minM)?.regiao ?? null,
    }
  }, [cockpitUsaMiniGraficosRegiao, props.pollsMediasRegiao])

  useEffect(() => {
    if (!modalRegiaoPesquisas) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setModalRegiaoPesquisas(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modalRegiaoPesquisas])

  const pulsoTexto = useMemo(() => {
    const linhas: string[] = []
    if (presencaKpi?.variation && presencaKpi.variation > 0) {
      linhas.push(`Território avançou ${presencaKpi.variation}% no último mês`)
    }
    if (baseKpi?.value) {
      linhas.push(`Base ativa com ${baseKpi.value} lideranças mapeadas`)
    }
    if (presencaKpi && typeof presencaKpi.value === 'string' && presencaKpi.value.includes('/')) {
      const [c, t] = presencaKpi.value.split('/').map((v) => parseInt(v.trim(), 10) || 0)
      if (t > 0) {
        linhas.push(`Cobertura atual alcança ${Math.round((c / t) * 100)}% do estado`)
      }
    }
    if (linhas.length === 0) {
      return 'Leitura estratégica em tempo real dos indicadores de performance.'
    }
    return linhas.slice(0, 3).join('. ') + '.'
  }, [presencaKpi, baseKpi])

  const destaqueRadar = useMemo(() => {
    const featured = props.monitorNewsOrdenadas.find((n) => props.monitorFeaturedNewsIds.includes(n.id))
    return featured ?? props.monitorNewsOrdenadas[0] ?? null
  }, [props.monitorNewsOrdenadas, props.monitorFeaturedNewsIds])

  const listaRadarSecundaria = useMemo(() => {
    if (!destaqueRadar) return props.monitorNewsOrdenadas.slice(0, 5)
    return props.monitorNewsOrdenadas.filter((n) => n.id !== destaqueRadar.id).slice(0, 4)
  }, [props.monitorNewsOrdenadas, destaqueRadar])

  /** Mesma lógica compacta do antigo “Momento atual”: lista bolinha + texto (sem cards). */
  const itensCockpitRadar = useMemo(() => {
    if (!destaqueRadar) return []
    return [destaqueRadar, ...listaRadarSecundaria]
  }, [destaqueRadar, listaRadarSecundaria])

  const heroKpi = props.kpisComMedia.find((k) => k.id === 'ife')
  const heroForCockpit = heroKpi ? { ...heroKpi, label: 'EXPECTATIVA DE VOTOS' } : null

  /** Variação vs eleição anterior: exibida ao lado de "Hoje" no hero (posição na chapa ficou no KPI dedicado). */
  const heroVariacaoInline = useMemo(() => {
    if (!heroKpi) return { text: undefined as string | undefined, tone: 'neutral' as const }
    const valorAtual =
      typeof heroKpi.value === 'string'
        ? parseFloat(heroKpi.value.replace(/[^\d]/g, '')) || 0
        : typeof heroKpi.value === 'number'
          ? heroKpi.value
          : 0
    if (valorAtual > 0 && props.VOTOS_ELEICAO_ANTERIOR > 0) {
      const pct = ((valorAtual - props.VOTOS_ELEICAO_ANTERIOR) / props.VOTOS_ELEICAO_ANTERIOR) * 100
      const sinal = pct >= 0 ? '+' : ''
      return {
        text: `${sinal}${pct.toFixed(1).replace('.', ',')}% vs eleição anterior (${props.VOTOS_ELEICAO_ANTERIOR.toLocaleString('pt-BR')} votos)`,
        tone: pct >= 0 ? ('neutral' as const) : ('negative' as const),
      }
    }
    return { text: undefined, tone: 'neutral' as const }
  }, [heroKpi, props.VOTOS_ELEICAO_ANTERIOR])

  const kpiSecondary = props.kpisComMedia.filter((k) => k.id !== 'ife')
  const presenca = kpiSecondary.find((k) => k.id === 'presenca')
  const base = kpiSecondary.find((k) => k.id === 'base')
  const sentimento = kpiSecondary.find((k) => k.id === 'sentimento')
  const projecao = kpiSecondary.find((k) => k.id === 'projecao')
  const posicaoChapa = kpiSecondary.find((k) => k.id === 'posicao_chapa')

  const kpiHrefMap: Partial<Record<KPI['id'], string>> = {
    presenca: '/dashboard/territorio',
    base: '/dashboard/territorio',
    projecao: '/dashboard/chapas',
    posicao_chapa: '/dashboard/chapas',
    sentimento: '/dashboard/pesquisa',
  }

  /** Mesma lógica dos KPIs secundários do dashboard clássico (subtítulo + linhas). */
  const secondaryKpiDetails = useMemo(() => {
    type Detail = {
      subtitle?: string
      subtitleType?: 'positive' | 'negative' | 'neutral'
      infoLines?: Array<{ text: string; type?: 'positive' | 'negative' | 'neutral' }>
    }
    const m = new Map<KPI['id'], Detail>()

    const pk = props.kpisComMedia.find((k) => k.id === 'presenca')
    let cidadesCobertasPresenca = 0
    if (pk && typeof pk.value === 'string' && pk.value.includes('/')) {
      const [cidades, total] = pk.value.split('/').map((v) => parseInt(v.trim(), 10) || 0)
      cidadesCobertasPresenca = cidades
      if (total > 0) {
        const percentual = Math.round((cidades / total) * 100)
        m.set('presenca', {
          subtitle: `${percentual}% de cobertura`,
          subtitleType: percentual >= 50 ? 'positive' : percentual >= 30 ? 'neutral' : 'negative',
        })
      }
    }

    const bk = props.kpisComMedia.find((k) => k.id === 'base')
    if (bk && cidadesCobertasPresenca > 0) {
      let liderancas = 0
      if (typeof bk.value === 'number') liderancas = bk.value
      else {
        const s = String(bk.value).replace(/\./g, '').replace(/,/g, '.')
        liderancas = Math.round(parseFloat(s) || 0)
      }
      if (liderancas >= 0) {
        const media = liderancas / cidadesCobertasPresenca
        const mediaType: 'positive' | 'negative' | 'neutral' =
          media >= 2 ? 'positive' : media >= 1 ? 'neutral' : 'negative'
        m.set('base', {
          infoLines: [
            {
              text: `≈ ${media.toFixed(1).replace('.', ',')} lideranças/cidade`,
              type: mediaType,
            },
            {
              text: `${liderancas.toLocaleString('pt-BR')} ÷ ${cidadesCobertasPresenca} cidades (cobertura)`,
              type: 'neutral',
            },
          ],
        })
      }
    }

    if (props.rankingPesquisas && props.rankingPesquisas.posicao > 0) {
      const rp = props.rankingPesquisas
      const lines: Detail['infoLines'] = []
      const rankType: 'positive' | 'negative' | 'neutral' =
        rp.posicao <= 3 ? 'positive' : rp.posicao <= 5 ? 'neutral' : 'negative'
      lines.push({
        text: `${rp.posicao}º de ${rp.totalCandidatos} candidatos`,
        type: rankType,
      })
      if (rp.projecaoVotos && rp.projecaoVotos > 0) {
        lines.push({
          text: `≈ ${rp.projecaoVotos.toLocaleString('pt-BR')} votos (${rp.cidadesComPesquisa} cid.)`,
          type: 'neutral',
        })
      }
      m.set('sentimento', { infoLines: lines })
    }

    if (props.segundaVagaInfo) {
      const sv = props.segundaVagaInfo
      const competidor = sv.competidorProximo || '?'
      if (sv.tipo === 'margem') {
        m.set('projecao', {
          subtitle: `Margem: ${Math.max(0, sv.distancia).toLocaleString('pt-BR')} votos`,
          subtitleType:
            sv.distancia > 20000 ? 'positive' : sv.distancia > 5000 ? 'neutral' : 'negative',
        })
      } else if (sv.distancia > 0) {
        m.set('projecao', {
          subtitle: formatarTextoFaltamVotosDisputaSobra(sv.distancia, sv.rodada, competidor),
          subtitleType: 'negative',
        })
      }
    }

    if (props.segundaVagaInfoEstadual) {
      const se = props.segundaVagaInfoEstadual
      const competidor = se.competidorProximo || '?'
      if (se.tipo === 'margem') {
        const margem = se.distancia
        const margemType: 'positive' | 'negative' | 'neutral' =
          margem > 20000 ? 'positive' : margem > 5000 ? 'neutral' : 'negative'
        const lines: NonNullable<Detail['infoLines']> = []
        if (margem > 0) {
          lines.push({
            text: `Margem: ${margem.toLocaleString('pt-BR')} votos`,
            type: margemType,
          })
        } else {
          lines.push({
            text: `Margem crítica para manter ${se.vagasAtuais} vaga(s)`,
            type: 'negative',
          })
        }
        if (se.distanciaCompetidor > 0) {
          lines.push({
            text: `${competidor} precisa +${se.distanciaCompetidor.toLocaleString('pt-BR')} votos`,
            type: 'negative',
          })
        }
        m.set('projecao_estadual', { infoLines: lines })
      } else {
        if (se.distancia > 0) {
          m.set('projecao_estadual', {
            subtitle: formatarTextoFaltamVotosDisputaSobra(se.distancia, se.rodada, competidor),
            subtitleType: 'negative',
          })
        } else {
          m.set('projecao_estadual', {
            subtitle: formatarTextoDisputaSobraSemDistancia(se.rodada, competidor),
            subtitleType: 'neutral',
          })
        }
      }
    }
    if (props.rankingExpectativa?.posicao && props.rankingExpectativa.posicao > 0) {
      const nome = props.candidatoPadrao?.trim()
      const n = props.rankingExpectativa.totalCandidatos
      m.set('posicao_chapa', {
        subtitle: nome
          ? `${nome} — ${n} candidatos eleição`
          : `${n} candidatos eleição`,
        subtitleType: 'neutral',
      })
    }

    return m
  }, [
    props.kpisComMedia,
    props.rankingPesquisas,
    props.segundaVagaInfo,
    props.segundaVagaInfoEstadual,
    props.rankingExpectativa,
    props.candidatoPadrao,
  ])

  const territorioBlock = useMemo(() => {
    const pk = props.kpisComMedia.find((k) => k.id === 'presenca')
    let cidadesAtivas = 0
    let totalCidades = 224
    if (pk && typeof pk.value === 'string' && pk.value.includes('/')) {
      const [c, t] = pk.value.split('/').map((v) => parseInt(v.trim(), 10) || 0)
      cidadesAtivas = c
      totalCidades = t || 224
    }
    const cidadesVisitadas = props.territorioStats?.cidadesVisitadas ?? 0
    const percentualCobertura = cidadesAtivas > 0 ? Math.round((cidadesVisitadas / cidadesAtivas) * 100) : 0
    const normalizeName = (name: string) =>
      name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
    const comLider = new Set(props.cidadesComLiderancas.map(normalizeName))
    let eleitoradoTotal = 0
    let eleitoradoComPresenca = 0
    let eleitoradoSemPresenca = 0
    Object.entries(props.eleitoresPorCidade).forEach(([cidade, eleitorado]) => {
      eleitoradoTotal += eleitorado
      if (comLider.has(normalizeName(cidade))) eleitoradoComPresenca += eleitorado
      else eleitoradoSemPresenca += eleitorado
    })
    const pctEleitorado = eleitoradoTotal > 0 ? Math.round((eleitoradoComPresenca / eleitoradoTotal) * 100) : 0
    return {
      cidadesAtivas,
      totalCidades,
      cidadesVisitadas,
      percentualCobertura,
      eleitoradoTotal,
      eleitoradoComPresenca,
      eleitoradoSemPresenca,
      pctEleitorado,
    }
  }, [props.kpisComMedia, props.territorioStats, props.cidadesComLiderancas, props.eleitoresPorCidade])

  const leituraCoberturaEleitoral = useMemo(() => {
    const pct = territorioBlock.pctEleitorado
    if (pct >= 70) return 'acima da média ideal'
    if (pct >= 50) return 'cobertura sólida'
    if (pct >= 35) return 'nível moderado'
    return 'abaixo do ideal'
  }, [territorioBlock.pctEleitorado])

  const riscoSemCoberturaPct = Math.max(0, 100 - territorioBlock.pctEleitorado)
  const tooltipCoberturaEleitoral = `Cobertura atual: ${territorioBlock.pctEleitorado}%\nCidades sem presença: ${Math.max(0, territorioBlock.totalCidades - territorioBlock.cidadesAtivas)}\nPotencial estimado: +${territorioBlock.eleitoradoSemPresenca.toLocaleString('pt-BR')} eleitores`

  return (
    <div className="px-4 py-4 lg:px-6 lg:py-5 space-y-4 animate-cockpit-fade-in">
      {/* Expectativa de votos + Radar de movimento no mesmo card (referência Cockpit) */}
      <section className="min-w-0">
        {props.loading || !heroForCockpit ? (
          <div className="h-52 min-h-[13rem] rounded-2xl border border-slate-200/80 bg-slate-200/70 animate-pulse" />
        ) : (
          <KPIHeroCard
            kpi={heroForCockpit}
            inlineVariacaoEleicao={heroVariacaoInline.text}
            inlineVariacaoEleicaoTone={heroVariacaoInline.tone}
            hideValueByDefault
            cenarioVotos={props.cenarioVotosDashboard}
            onChangeCenarioVotos={props.setCenarioVotosDashboard}
            variant="cockpit"
            shellClassName="flex flex-col min-h-0 outline-none rounded-[14px] focus-visible:ring-2 focus-visible:ring-white/40"
            cockpitRadarScrollRef={props.monitorScrollRef}
            onCockpitRadarScrollMouseEnter={props.onMonitorScrollMouseEnter}
            onCockpitRadarScrollMouseLeave={props.onMonitorScrollMouseLeave}
            cockpitRadarFixedHeader={
              <>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/55">
                      Radar de movimento
                    </p>
                    <span className="inline-flex items-center gap-1 text-[9px] font-normal tracking-normal text-white/50">
                      <span
                        className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500 radar-pulse"
                        aria-hidden
                      />
                      Ao vivo
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => props.setAlertasTelaCheia(true)}
                    className="-mt-0.5 shrink-0 rounded-lg p-1 text-white/70 hover:bg-white/10 hover:text-white"
                    title="Ver radar completo"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </>
            }
            cockpitMomentoAtual={
              <>
                {props.loadingAlerts ? (
                  <>
                    {[1, 2, 3].map((i) => (
                      <div key={i} className="flex items-start gap-2">
                        <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-white/20" />
                        <span className="h-3 flex-1 animate-pulse rounded bg-white/15" />
                      </div>
                    ))}
                  </>
                ) : itensCockpitRadar.length > 0 ? (
                  itensCockpitRadar.map((item, idx) => {
                    const sem = props.getLinhaSemanticaClass(item)
                    const dotClass =
                      idx === 0
                        ? 'bg-[rgb(var(--cockpit-cyan))]'
                        : sem
                          ? sem
                          : 'bg-white/40'
                    const isActive = props.monitorActiveNewsId === item.id
                    return (
                      <Link
                        key={item.id}
                        href={item.url || '/dashboard/noticias'}
                        data-news-id={item.id}
                        target={item.url ? '_blank' : undefined}
                        rel={item.url ? 'noopener noreferrer' : undefined}
                        className={cn(
                          'flex items-start gap-2 text-left transition-colors duration-200',
                          'text-white/90 hover:text-white',
                          isActive && 'text-white'
                        )}
                      >
                        <span
                          className={cn('mt-1 h-2 w-2 shrink-0 rounded-full', dotClass)}
                          aria-hidden
                        />
                        <div className="min-w-0 flex-1">
                          <span
                            className={cn(
                              'line-clamp-2 text-xs font-medium leading-snug',
                              isActive && 'text-white'
                            )}
                          >
                            {item.title}
                          </span>
                          {(item.source || props.getContextoMonitor(item)) && (
                            <p className="mt-0 text-[9px] leading-tight text-white/45">
                              {props.getContextoMonitor(item)}
                              {item.source && props.getContextoMonitor(item) ? ' · ' : ''}
                              {item.source}
                            </p>
                          )}
                        </div>
                      </Link>
                    )
                  })
                ) : (
                  <p className="text-xs leading-snug text-white/55">Sem itens no radar</p>
                )}
              </>
            }
          />
        )}
      </section>

      {/* KPIs — grade 2 colunas no mobile (evita corte por overflow); 5 colunas no lg */}
      <section className="min-w-0">
        {props.loading ? (
          <div className="grid grid-cols-2 gap-3 lg:grid lg:grid-cols-5">
            {[1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className="h-32 min-h-0 w-full min-w-0 rounded-xl border border-white/35 bg-white/10 backdrop-blur-md animate-pulse"
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 lg:grid lg:grid-cols-5 lg:gap-3">
            {[presenca, base, sentimento, projecao, posicaoChapa].map((kpi, index) => {
              if (!kpi) return null
              const d = secondaryKpiDetails.get(kpi.id)
              return (
                <div
                  key={kpi.id}
                  className={cn(
                    'flex h-full min-h-0 w-full min-w-0 flex-col p-0',
                    'transition-transform hover:scale-[1.01] animate-cockpit-fade-in'
                  )}
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <div className="flex min-h-0 h-full min-w-0 flex-1 flex-col">
                    <KPICard
                      kpi={kpi}
                      href={kpiHrefMap[kpi.id] ?? '#'}
                      variant="cockpit"
                      subtitle={d?.subtitle}
                      subtitleType={d?.subtitleType}
                      infoLines={d?.infoLines}
                      cockpitFooter={
                        kpi.id === 'sentimento' && props.rankingPesquisasTop10.length > 0 ? (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              props.setShowRankingPesquisasModal(true)
                            }}
                            className="w-full text-center text-[10px] font-medium text-[rgb(14,116,188)] hover:underline"
                          >
                            Ver top 10 pesquisas
                          </button>
                        ) : undefined
                      }
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Pulso estratégico — mesmo vidro fino dos demais cards de seção */}
      {!props.loading && (
        <section
          className={cn(
            COCKPIT_SECTION_GLASS_CLASS,
            'flex items-start gap-2 px-4 py-2'
          )}
        >
          <span
            className="inline-flex shrink-0 rounded-full p-1"
            style={{ backgroundColor: 'rgba(234, 179, 8, 0.2)' }}
          >
            <Lightbulb className="h-4 w-4 text-[rgb(var(--strategic-yellow))]" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="mb-0.5 text-xs font-bold uppercase tracking-wide text-text-primary">
              Pulso estratégico
            </p>
            <p className="text-sm text-text-secondary leading-relaxed">{pulsoTexto}</p>
          </div>
          <button
            type="button"
            onClick={() => props.setInsightTelaCheia(true)}
            className="shrink-0 rounded-lg p-1 text-accent-gold/85 hover:bg-white/40 hover:text-accent-gold"
            title="Expandir"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
        </section>
      )}

      {/* Duas colunas: território + pesquisas — mesma altura no desktop; histórico usa flex-1 nos gráficos */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 lg:items-stretch">
        <div className={cn(COCKPIT_SECTION_GLASS_CLASS, 'flex h-full min-h-0 flex-col')}>
          <div className="mb-3 flex shrink-0 items-center justify-between">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-accent-gold" />
              <h2 className="text-base font-semibold text-text-primary">Análise de territórios</h2>
            </div>
            <button
              type="button"
              onClick={() => props.setAnaliseTerritoriosTelaCheia(true)}
              className="p-1.5 rounded-lg hover:bg-white/40 text-accent-gold/85 hover:text-accent-gold"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          </div>
          {props.loadingTerritorios ? (
            <div className="h-40 animate-pulse bg-white/20 rounded-xl" />
          ) : (
            <>
              <div className="mb-2 grid grid-cols-3 gap-2">
                <div className={COCKPIT_TERRITORIO_KPI_GLASS}>
                  <p className="flex items-center gap-1 text-[10px] text-text-muted">
                    <MapPin className="h-3 w-3 shrink-0 text-accent-gold" /> Presença
                  </p>
                  <p className="text-lg font-bold text-text-primary">{territorioBlock.cidadesAtivas}</p>
                  <p className="text-[10px] text-secondary">de {territorioBlock.totalCidades}</p>
                </div>
                <div className={COCKPIT_TERRITORIO_KPI_GLASS}>
                  <p className="flex items-center gap-1 text-[10px] text-text-muted">
                    <Activity className="h-3 w-3 shrink-0 text-accent-gold" /> Visitadas
                  </p>
                  <p className="text-lg font-bold text-text-primary">{territorioBlock.cidadesVisitadas}</p>
                  <p className="text-[10px] text-secondary">cidades</p>
                </div>
                <div className={COCKPIT_TERRITORIO_KPI_GLASS}>
                  <p className="flex items-center gap-1 text-[10px] text-text-muted">
                    <TrendingUp className="h-3 w-3 shrink-0 text-accent-gold" /> Cobertura
                  </p>
                  <p className="text-lg font-bold text-text-primary">{territorioBlock.percentualCobertura}%</p>
                  <p className="text-[10px] text-secondary">das ativas</p>
                </div>
              </div>
              {territorioBlock.eleitoradoTotal > 0 && (
                <div className="mb-2 space-y-2 rounded-xl border border-white/45 bg-white/30 p-3">
                  <div className="flex flex-wrap items-end justify-between gap-x-3 gap-y-1">
                    <p className="text-xs leading-snug text-text-secondary">
                      <span className="block text-[10px] font-medium uppercase tracking-wide text-text-muted">
                        Eleitorado total (PI)
                      </span>
                      <span className="font-bold tabular-nums text-text-primary">
                        {territorioBlock.eleitoradoTotal.toLocaleString('pt-BR')}
                      </span>{' '}
                      <span className="text-text-muted">eleitores</span>
                    </p>
                    <p className="text-right text-[11px] leading-snug text-text-secondary">
                      <span className="tabular-nums text-text-primary">
                        {territorioBlock.eleitoradoComPresenca.toLocaleString('pt-BR')}
                      </span>{' '}
                      com presença ·{' '}
                      <span className="font-semibold text-accent-gold">
                        {territorioBlock.eleitoradoSemPresenca.toLocaleString('pt-BR')}
                      </span>{' '}
                      <span className="text-text-muted">em expansão</span>
                    </p>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[10px] uppercase tracking-wide text-text-muted">
                        Cobertura eleitoral (presença sobre o total)
                      </p>
                      <p className="text-[11px] font-medium text-text-secondary">
                        <span className="tabular-nums font-semibold text-text-primary">
                          {territorioBlock.pctEleitorado}%
                        </span>{' '}
                        <span className="text-text-muted">•</span>{' '}
                        <span className="font-medium text-accent-gold">{leituraCoberturaEleitoral}</span>
                      </p>
                    </div>
                    <GlassGradientProgressBar
                      percentage={territorioBlock.pctEleitorado}
                      heightClass="h-3.5"
                      glow
                      title={tooltipCoberturaEleitoral}
                    />
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {props.territoriosQuentes.length > 0 && (
                        <span className={COCKPIT_TERR_BADGE_QUENTE}>
                          <Flame className="h-3 w-3 shrink-0" /> {props.territoriosQuentes.length} quentes
                        </span>
                      )}
                      {props.territoriosMornos.length > 0 && (
                        <span className={COCKPIT_TERR_BADGE_MORNO}>
                          <ThermometerSun className="h-3 w-3 shrink-0" /> {props.territoriosMornos.length} mornos
                        </span>
                      )}
                      {props.territoriosFrios.length > 0 && (
                        <span className={COCKPIT_TERR_BADGE_FRIO}>
                          <ThermometerSnowflake className="h-3 w-3 shrink-0" /> {props.territoriosFrios.length} frios
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              )}
              <div className="mt-1 rounded-lg border border-white/35 bg-white/20 px-2.5 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-wide text-text-muted">Foco de crescimento</p>
                <p className="text-[11px] font-medium text-text-primary">
                  Prioridade: expandir presença nas cidades ainda não consolidadas.
                </p>
              </div>
              <p className="mt-1 flex items-center gap-1.5 text-[11px] font-medium text-amber-900/90">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-700" />
                {riscoSemCoberturaPct}% do eleitorado ainda sem cobertura
              </p>
            </>
          )}
        </div>

        <div className={cn(COCKPIT_SECTION_GLASS_CLASS, 'flex h-full min-h-0 flex-col')}>
          <div className="mb-2 flex shrink-0 items-center justify-between">
            <h2 className="text-base font-semibold text-text-primary">Histórico de pesquisas</h2>
            <div className="flex items-center gap-2">
              {(props.pollsData.length > 0 || cockpitUsaMiniGraficosRegiao) && (
                <button
                  type="button"
                  onClick={() => props.setGraficoPollsTelaCheia(true)}
                  className="p-1.5 rounded-lg hover:bg-white/40 text-accent-gold/85 hover:text-accent-gold"
                >
                  <Maximize2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
          {!cockpitUsaMiniGraficosRegiao && props.pollsMediasRegiao.length > 0 ? (
            <div className="mb-2 flex shrink-0 flex-wrap items-center gap-x-1.5 gap-y-1.5 text-[10px] sm:text-[11px]">
              <span className="w-full font-medium text-text-secondary sm:w-auto">
                Média por região (mapa):
              </span>
              {props.pollsMediasRegiao.map((r) => (
                <span
                  key={r.regiao}
                  title={`${r.n} pesquisa(s) com município nesta região`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-white/45 bg-white/12 px-2.5 py-0.5 tabular-nums backdrop-blur-sm shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]"
                >
                  <span className="text-text-secondary">{r.regiao}</span>
                  <span className="font-semibold text-text-primary">{r.media}%</span>
                </span>
              ))}
            </div>
          ) : !cockpitUsaMiniGraficosRegiao && props.pollsData.length > 0 && !props.loadingPolls ? (
            <p className="mb-2 shrink-0 text-[11px] leading-snug italic text-text-muted">
              Cada ponto do gráfico é a média de <span className="font-medium not-italic">todas as pesquisas daquela data</span>
              , não de um único município. A média por região usa o município de <span className="font-medium not-italic">cada</span>{' '}
              registro no banco; se o nome não estiver no cadastro IBGE do PI ou o vínculo com a tabela de cidades falhar, a
              região não entra no cálculo.
            </p>
          ) : null}
          <div className="flex min-h-[12rem] flex-1 flex-col">
            {props.loadingPolls ? (
              <div className="min-h-0 flex-1 rounded-xl bg-white/20 animate-pulse" />
            ) : cockpitUsaMiniGraficosRegiao ? (
              <div className="grid h-full min-h-0 flex-1 grid-cols-2 grid-rows-2 gap-x-2 gap-y-1">
                {REGIOES_PI_ORDER.map((regiao, idx) => {
                  const series = props.pollsHistoricoPorRegiao[regiao]
                  const mediaRow = props.pollsMediasRegiao.find((m) => m.regiao === regiao)
                  const miniAlerts = cockpitPollsMiniAlertasPorRegiao[regiao]
                  const picoRegiao =
                    series.length > 0 ? Math.max(...series.map((p) => Number(p.intencao) || 0)) : 0
                  const gradId = `cockpitRegiaoGrad-${idx}`
                  const mostrarAlertas =
                    miniAlerts.regiaoAbaixo || miniAlerts.trends.length > 0
                  const isMelhorRegiao = melhorEPiorRegiaoPesquisas.melhor === regiao
                  const isPiorRegiao = melhorEPiorRegiaoPesquisas.pior === regiao
                  return (
                    <div
                      key={regiao}
                      className={cn(
                        'flex h-full min-h-0 min-w-0 flex-col gap-0.5 rounded-xl p-0.5 transition-colors',
                        isMelhorRegiao &&
                          'border border-emerald-400/55 bg-gradient-to-b from-emerald-500/25 via-emerald-500/12 to-emerald-700/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_1px_10px_-3px_rgba(16,185,129,0.22)]',
                        isPiorRegiao &&
                          'border border-rose-400/55 bg-[linear-gradient(180deg,rgba(244,63,94,0.26)_0%,rgba(225,29,72,0.14)_48%,rgba(190,24,93,0.11)_100%)] shadow-[inset_0_1px_0_rgba(255,255,255,0.38),0_1px_10px_-3px_rgba(244,63,94,0.22)]'
                      )}
                    >
                      <div className={COCKPIT_POLLS_REGIAO_HEADER_GLASS}>
                        <span className="min-w-0 truncate text-xs font-semibold leading-tight tracking-tight text-text-primary drop-shadow-[0_1px_0_rgba(255,255,255,0.35)]">
                          {regiao}
                        </span>
                        {mediaRow != null ? (
                          <button
                            type="button"
                            onDoubleClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              setModalRegiaoPesquisas(regiao)
                            }}
                            className="shrink-0 cursor-pointer select-none rounded-md border border-white/40 bg-white/25 px-2 py-0.5 tabular-nums text-xs font-bold leading-none text-accent-gold backdrop-blur-sm supports-[backdrop-filter]:bg-white/18 shadow-[inset_0_1px_0_rgba(255,255,255,0.5)] outline-none transition hover:bg-white/35 focus-visible:ring-2 focus-visible:ring-accent-gold/50"
                            title={`Média ${mediaRow.media}% · ${mediaRow.n} pesquisa(s). Duplo clique para listar todas.`}
                          >
                            {mediaRow.media}%
                          </button>
                        ) : (
                          <span className="shrink-0 rounded-md border border-white/30 bg-white/10 px-2 py-0.5 text-xs font-semibold tabular-nums text-text-muted backdrop-blur-sm">
                            —
                          </span>
                        )}
                      </div>
                      {mostrarAlertas ? (
                        <div className="max-h-[3.25rem] shrink-0 overflow-auto rounded-md border border-white/30 bg-white/[0.14] px-1.5 py-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]">
                          <ul className="space-y-0.5 text-[12px] leading-tight text-text-primary">
                            {miniAlerts.regiaoAbaixo && (
                              <li className="flex items-start gap-1 text-amber-950/90">
                                <AlertTriangle
                                  className="mt-px h-2.5 w-2.5 shrink-0 text-amber-700"
                                  aria-hidden
                                />
                                <span className="line-clamp-1">
                                  Na região <strong className="font-semibold">{regiao}</strong> a média
                                  está bem abaixo da média estadual ponderada — priorizar diagnóstico.
                                </span>
                              </li>
                            )}
                            {miniAlerts.trends.map((t, i) => (
                              <li
                                key={`${t.cidadeLabel}-${i}`}
                                className={cn(
                                  'flex items-start gap-1',
                                  t.direcao === 'subiu' ? 'text-emerald-900/95' : 'text-rose-900/95'
                                )}
                              >
                                {t.direcao === 'subiu' ? (
                                  <TrendingUp
                                    className="mt-px h-2.5 w-2.5 shrink-0 text-emerald-700"
                                    aria-hidden
                                  />
                                ) : (
                                  <TrendingDown
                                    className="mt-px h-2.5 w-2.5 shrink-0 text-rose-700"
                                    aria-hidden
                                  />
                                )}
                                <span className="line-clamp-1">
                                  <strong className="font-semibold">{t.cidadeLabel}</strong>{' '}
                                  {t.direcao === 'subiu' ? 'teve aumento' : 'teve queda'} de intenção (
                                  {t.de.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 1,
                                  })}
                                  % →{' '}
                                  {t.para.toLocaleString('pt-BR', {
                                    minimumFractionDigits: 0,
                                    maximumFractionDigits: 1,
                                  })}
                                  %).
                                </span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="min-h-0 flex-1 w-full min-w-0">
                        {series.length === 0 ? (
                          <div className="flex h-full min-h-[2.5rem] items-center justify-center rounded-lg border border-white/30 bg-white/10 text-xs text-text-muted">
                            Sem dados
                          </div>
                        ) : (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={series} margin={{ top: 0, right: 2, left: -18, bottom: 0 }}>
                              <defs>
                                <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={DASHBOARD_BLUE} stopOpacity={0.32} />
                                  <stop offset="95%" stopColor={DASHBOARD_BLUE} stopOpacity={0.04} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-card))" opacity={0.35} />
                              <XAxis
                                dataKey="date"
                                stroke="rgb(var(--text-muted))"
                                tick={{ fontSize: 8 }}
                                interval="preserveStartEnd"
                                height={22}
                              />
                              <YAxis hide domain={[0, 100]} width={0} />
                              <Tooltip
                                contentStyle={{
                                  backgroundColor: 'rgba(255,255,255,0.95)',
                                  border: '1px solid rgb(var(--border-card))',
                                  borderRadius: 6,
                                  fontSize: 11,
                                }}
                                content={({ active, payload, label }) => {
                                  if (!active || !payload?.length) return null
                                  const row = payload[0].payload as {
                                    intencao: number
                                    cidade?: string
                                    instituto?: string
                                  }
                                  const cidades = cidadesParaTooltipHistorico(row.cidade)
                                  return (
                                    <div className="max-w-[min(240px,70vw)] p-1.5 text-[11px]">
                                      <p className="font-semibold text-text-primary">{label}</p>
                                      <p className="text-text-primary">Intenção: {row.intencao}%</p>
                                      {row.instituto &&
                                        row.instituto !== 'Não informado' &&
                                        row.instituto.trim().length > 0 && (
                                          <p className="text-[10px] text-text-secondary">{row.instituto}</p>
                                        )}
                                      {cidades.length > 0 ? (
                                        <div className="mt-1.5 border-t border-[rgb(var(--border-card))]/50 pt-1.5">
                                          <p className="mb-0.5 text-[10px] font-medium uppercase tracking-wide text-text-muted">
                                            {cidades.length > 1 ? 'Municípios' : 'Município'}
                                          </p>
                                          {cidades.length === 1 ? (
                                            <p className="leading-snug text-text-secondary">{cidades[0]}</p>
                                          ) : (
                                            <ul className="list-inside list-disc space-y-0.5 text-text-secondary">
                                              {cidades.map((c, i) => (
                                                <li key={`${c}-${i}`} className="leading-snug">
                                                  {c}
                                                </li>
                                              ))}
                                            </ul>
                                          )}
                                        </div>
                                      ) : (
                                        <p className="mt-1.5 text-[10px] italic text-text-muted">
                                          Município não disponível neste ponto
                                        </p>
                                      )}
                                    </div>
                                  )
                                }}
                              />
                              <Area
                                type="monotone"
                                dataKey="intencao"
                                stroke={DASHBOARD_BLUE}
                                strokeWidth={1.75}
                                fillOpacity={1}
                                fill={`url(#${gradId})`}
                                dot={(dotProps: {
                                  cx?: number
                                  cy?: number
                                  payload?: { intencao?: number }
                                }) => {
                                  const { cx, cy, payload } = dotProps
                                  const v = payload?.intencao ?? 0
                                  const isPeak = v === picoRegiao && v > 0
                                  const fill = isPeak ? DASHBOARD_GOLD : DASHBOARD_BLUE
                                  return (
                                    <circle
                                      cx={cx}
                                      cy={cy}
                                      r={isPeak ? 5 : 3}
                                      fill={fill}
                                      stroke="#fff"
                                      strokeWidth={1}
                                    />
                                  )
                                }}
                              />
                            </AreaChart>
                          </ResponsiveContainer>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : props.pollsData.length > 0 ? (
              <div className="h-full min-h-0 w-full min-w-0 flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={props.pollsData}>
                    <defs>
                      <linearGradient id="cockpitIntencao" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={DASHBOARD_BLUE} stopOpacity={0.35} />
                        <stop offset="95%" stopColor={DASHBOARD_BLUE} stopOpacity={0.05} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-card))" opacity={0.45} />
                    <XAxis dataKey="date" stroke="rgb(var(--text-muted))" fontSize={11} />
                    <YAxis stroke="rgb(var(--text-muted))" fontSize={11} domain={[0, 100]} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'rgba(255,255,255,0.95)',
                        border: '1px solid rgb(var(--border-card))',
                        borderRadius: 8,
                      }}
                      content={({ active, payload, label }) => {
                        if (!active || !payload?.length) return null
                        const row = payload[0].payload as { intencao: number; cidade?: string }
                        return (
                          <div className="p-2 text-xs">
                            <p className="font-semibold">{label}</p>
                            <p>Intenção: {row.intencao}%</p>
                          </div>
                        )
                      }}
                    />
                    <Area
                      type="monotone"
                      dataKey="intencao"
                      stroke={DASHBOARD_BLUE}
                      strokeWidth={2.5}
                      fillOpacity={1}
                      fill="url(#cockpitIntencao)"
                      dot={(dotProps: { cx?: number; cy?: number; payload?: { intencao?: number } }) => {
                        const { cx, cy, payload } = dotProps
                        const v = payload?.intencao ?? 0
                        const isPeak = v === props.picoIntencaoGrafico && v > 0
                        const fill = isPeak ? DASHBOARD_GOLD : DASHBOARD_BLUE
                        return (
                          <circle
                            cx={cx}
                            cy={cy}
                            r={isPeak ? 6 : 4}
                            fill={fill}
                            stroke="#fff"
                            strokeWidth={1}
                          />
                        )
                      }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <p className="flex flex-1 items-center justify-center px-4 text-center text-sm text-secondary">
                {props.candidatoPadrao
                  ? 'Nenhuma pesquisa para o candidato padrão'
                  : 'Defina candidato padrão em Pesquisa & Relato'}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Posts & Insights — alinhado à aba homônima em Conteúdo */}
      <div className="pb-4">
        <div className={COCKPIT_SECTION_GLASS_CLASS}>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div className="min-w-0 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 shrink-0 text-accent-gold" aria-hidden />
              <h2 className="text-base font-semibold text-text-primary">Posts &amp; Insights</h2>
              <span className="shrink-0 text-[10px] text-secondary">30 dias</span>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Link
                href="/dashboard/conteudo"
                className="rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-accent-gold/90 hover:bg-white/35 hover:text-accent-gold"
              >
                Conteúdo
              </Link>
              <button
                type="button"
                onClick={() => props.setBandeirasTelaCheia(true)}
                className="rounded-lg p-1.5 text-accent-gold/85 hover:bg-white/40 hover:text-accent-gold"
                title="Ver em tela cheia"
              >
                <Maximize2 className="h-4 w-4" />
              </button>
            </div>
          </div>
          {props.postsInsights?.username ? (
            <p className="mb-2 line-clamp-1 text-[10px] text-secondary">
              @{props.postsInsights.username}
            </p>
          ) : null}
          {props.loadingPostsInsights ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="h-24 animate-pulse rounded-xl bg-white/25" />
              ))}
            </div>
          ) : props.postsInsights ? (
            (() => {
              const insights = props.postsInsights
              return (
                <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {COCKPIT_POSTS_INSIGHT_ROWS.map(({ key, label, Icon, metric }) => {
                    const post = insights[key]
                    const value = metric(post)
                    return (
                      <li
                        key={key}
                        className="flex min-h-0 gap-2 rounded-xl border border-white/50 bg-white/[0.35] p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.55)] backdrop-blur-[10px] transition-transform hover:scale-[1.01]"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-white/45 bg-white/20">
                          {post.thumbnail ? (
                            <img src={post.thumbnail} alt="" className="h-full w-full object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[9px] text-text-muted">—</div>
                          )}
                          <span className="absolute bottom-0.5 right-0.5 rounded bg-[rgb(15,45,74)]/75 px-1 py-0.5 text-[9px] font-bold tabular-nums text-white">
                            {value}
                          </span>
                        </div>
                        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-accent-gold/95">
                            <Icon className="h-3 w-3 shrink-0" aria-hidden />
                            {label}
                          </span>
                          <p className="line-clamp-2 text-[10px] leading-snug text-text-primary">{post.caption || 'Sem legenda'}</p>
                          <a
                            href={post.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-[9px] font-medium text-accent-gold/90 hover:underline"
                          >
                            <ExternalLink className="h-2.5 w-2.5 shrink-0" /> Abrir
                          </a>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )
            })()
          ) : (
            <p className="rounded-xl border border-white/40 bg-white/15 px-3 py-4 text-center text-[11px] leading-relaxed text-secondary shadow-[inset_0_1px_0_rgba(255,255,255,0.4)]">
              Conecte o Instagram em{' '}
              <Link href="/dashboard/conteudo" className="font-semibold text-accent-gold hover:underline">
                Conteúdo
              </Link>{' '}
              para ver postagens mais curtidas, comentadas e visualizadas.
            </p>
          )}
        </div>
      </div>

      {modalRegiaoPesquisas && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="cockpit-modal-pesquisas-regiao-titulo"
        >
          <button
            type="button"
            className="absolute inset-0 bg-[rgb(15,45,74)]/40 backdrop-blur-[2px]"
            aria-label="Fechar"
            onClick={() => setModalRegiaoPesquisas(null)}
          />
          <div
            className="relative z-10 flex max-h-[min(420px,72vh)] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-white/55 bg-white/85 shadow-[0_20px_50px_rgba(15,45,74,0.18),inset_0_1px_0_rgba(255,255,255,0.9)] backdrop-blur-xl supports-[backdrop-filter]:bg-white/78"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[rgb(var(--border-card))]/40 px-3 py-2.5">
              <div className="min-w-0">
                <h3
                  id="cockpit-modal-pesquisas-regiao-titulo"
                  className="text-sm font-semibold text-text-primary"
                >
                  Pesquisas — {modalRegiaoPesquisas}
                </h3>
                {props.candidatoPadrao ? (
                  <p className="mt-0.5 truncate text-[11px] text-text-secondary">{props.candidatoPadrao}</p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setModalRegiaoPesquisas(null)}
                className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:bg-black/5 hover:text-text-primary"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto px-2 py-2">
              {props.pollsPesquisasPorRegiao[modalRegiaoPesquisas].length === 0 ? (
                <p className="py-6 text-center text-xs text-text-muted">Nenhuma pesquisa nesta região.</p>
              ) : (
                <table className="w-full border-collapse text-left text-[11px]">
                  <thead>
                    <tr className="sticky top-0 border-b border-[rgb(var(--border-card))]/50 bg-white/90 backdrop-blur-sm">
                      <th className="py-1.5 pr-2 font-semibold text-text-muted">Data</th>
                      <th className="py-1.5 pr-2 font-semibold text-text-muted">Cidade</th>
                      <th className="py-1.5 pr-2 font-semibold text-text-muted">Instituto</th>
                      <th className="py-1.5 text-right font-semibold text-text-muted">%</th>
                    </tr>
                  </thead>
                  <tbody>
                    {props.pollsPesquisasPorRegiao[modalRegiaoPesquisas].map((linha, i) => (
                      <tr
                        key={`${linha.dateOriginal}-${linha.cidade}-${i}`}
                        className="border-b border-[rgb(var(--border-card))]/30 last:border-0"
                      >
                        <td className="py-1.5 pr-2 align-top tabular-nums text-text-primary">
                          {linha.dataExibicao}
                        </td>
                        <td className="max-w-[120px] py-1.5 pr-2 align-top leading-snug text-text-primary">
                          {linha.cidade}
                        </td>
                        <td className="max-w-[100px] py-1.5 pr-2 align-top leading-snug text-text-secondary">
                          {linha.instituto}
                        </td>
                        <td className="py-1.5 text-right align-top font-semibold tabular-nums text-accent-gold">
                          {linha.intencao}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
