'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { PollModal } from '@/components/poll-modal'
import { PollReportModal } from '@/components/poll-report-modal'
import { TendenciaIntencaoExecutiveSection } from '@/components/pesquisa/TendenciaIntencaoExecutiveSection'
import { TendenciaTemporalPanel } from '@/components/pesquisa/TendenciaTemporalPanel'
import { PesquisaShell, type PesquisaTab } from '@/components/pesquisa/pesquisa-shell'
import {
  Edit2,
  Trash2,
  X,
  ArrowUp,
  ArrowDown,
  ArrowUpDown,
  FileText,
  Sparkles,
} from 'lucide-react'
import { IconArrowLeft, IconChevronDown, IconPlus, IconX } from '@tabler/icons-react'
import { cn, formatDate } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
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
import type { AIAgentPageContext } from '@/components/ai-agent'
import { useRegisterJarvisHostProps } from '@/contexts/jarvis-host-props-context'

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

function parsePesquisaTab(value: string | null): PesquisaTab {
  if (value === 'tendencia') return 'tendencia'
  if (value === 'cadastradas') return 'cadastradas'
  return 'panorama'
}

type ChaveOrdenacaoPesquisasCadastradas =
  | 'data'
  | 'instituto'
  | 'candidato'
  | 'cidade'
  | 'tipo'
  | 'cargo'
  | 'intencao'
  | 'rejeicao'

type DirecaoOrdenacao = 'asc' | 'desc'

interface ConfiguracaoOrdenacaoPesquisasCadastradas {
  chave: ChaveOrdenacaoPesquisasCadastradas
  direcao: DirecaoOrdenacao
}

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
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = useMemo(() => parsePesquisaTab(searchParams.get('tab')), [searchParams])
  const { theme } = useTheme()
  const isCockpit = false
  const sectionShellClass = isCockpit
    ? 'border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.82)_0%,rgba(18,30,38,0.86)_100%)] shadow-[0_10px_32px_rgba(3,12,20,0.28)]'
    : 'border-card bg-surface shadow-card'
  const innerPanelClass = isCockpit
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)]'
    : 'border-card bg-background/50'
  const inputShellClass = isCockpit
    ? 'border-white/12 bg-white/[0.03]'
    : 'border-card bg-surface'
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
  const [filtroTextoCandidatoCadastradas, setFiltroTextoCandidatoCadastradas] = useState<string>('')
  const [ordenacaoCadastradas, setOrdenacaoCadastradas] =
    useState<ConfiguracaoOrdenacaoPesquisasCadastradas | null>(null)
  const tendenciaGraficoRef = useRef<HTMLDivElement>(null)

  const onTabChange = useCallback(
    (tab: PesquisaTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'panorama') {
        params.delete('tab')
      } else {
        params.set('tab', tab)
      }
      params.delete('view')
      const qs = params.toString()
      router.replace(qs ? `/dashboard/pesquisa?${qs}` : '/dashboard/pesquisa')
    },
    [router, searchParams]
  )

  const contextoAgentePesquisa = useMemo<AIAgentPageContext>(
    () => ({
      kind: 'pesquisa',
      candidatoPadrao: candidatoPadrao || undefined,
      pollsCount: polls.length,
    }),
    [candidatoPadrao, polls.length]
  )

  useRegisterJarvisHostProps({
    pageContext: contextoAgentePesquisa,
    loadingPolls: loading,
    pollsCount: polls.length,
    candidatoPadrao: candidatoPadrao || undefined,
  })

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

  const normalizarTextoBuscaCandidato = (value: string): string =>
    value
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim()

  const obterValorOrdenacaoPoll = (
    poll: Poll,
    chave: ChaveOrdenacaoPesquisasCadastradas
  ): string | number => {
    switch (chave) {
      case 'data': {
        const dateStr = poll.data || ''
        if (!dateStr) return 0
        if (dateStr.includes('T')) {
          const t = new Date(dateStr).getTime()
          return Number.isFinite(t) ? t : 0
        }
        const [year, month, day] = dateStr.split('-').map(Number)
        const t = new Date(year, (month || 1) - 1, day || 1).getTime()
        return Number.isFinite(t) ? t : 0
      }
      case 'instituto':
        return (poll.instituto || '').toLocaleLowerCase('pt-BR')
      case 'candidato':
        return (poll.candidato_nome || '').toLocaleLowerCase('pt-BR')
      case 'cidade':
        return (poll.cities?.name || '').toLocaleLowerCase('pt-BR')
      case 'tipo':
        return (tipoLabels[poll.tipo] || poll.tipo || '').toLocaleLowerCase('pt-BR')
      case 'cargo':
        return (cargoLabels[poll.cargo] || poll.cargo || '').toLocaleLowerCase('pt-BR')
      case 'intencao':
        return Number.isFinite(poll.intencao) ? poll.intencao : 0
      case 'rejeicao':
        return Number.isFinite(poll.rejeicao) ? poll.rejeicao : 0
      default:
        return ''
    }
  }

  const alternarOrdenacaoCadastradas = (chave: ChaveOrdenacaoPesquisasCadastradas) => {
    setOrdenacaoCadastradas((prev) => {
      if (!prev || prev.chave !== chave) return { chave, direcao: 'asc' }
      if (prev.direcao === 'asc') return { chave, direcao: 'desc' }
      return null
    })
  }

  const pollsCadastradasExibicao = useMemo(() => {
    const q = normalizarTextoBuscaCandidato(filtroTextoCandidatoCadastradas)
    const base = !q
      ? pollsFiltrados
      : pollsFiltrados.filter((p) =>
          normalizarTextoBuscaCandidato(p.candidato_nome || '').includes(q)
        )

    if (!ordenacaoCadastradas) return base

    const { chave, direcao } = ordenacaoCadastradas
    const ordenadas = [...base].sort((a, b) => {
      const va = obterValorOrdenacaoPoll(a, chave)
      const vb = obterValorOrdenacaoPoll(b, chave)
      let cmp: number
      if (typeof va === 'number' && typeof vb === 'number') {
        cmp = va - vb
      } else {
        cmp = String(va).localeCompare(String(vb), 'pt-BR', { sensitivity: 'base' })
      }
      return direcao === 'asc' ? cmp : -cmp
    })
    return ordenadas
  }, [pollsFiltrados, filtroTextoCandidatoCadastradas, ordenacaoCadastradas])

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
    return polls.filter((poll) => poll.candidato_nome === candidatoPadrao)
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

  const pollsParaFeedbackGrafico = pollsFiltrados.map((p) => ({
    data: p.data,
    instituto: p.instituto,
    candidato_nome: p.candidato_nome,
    tipo: p.tipo,
    cidade_id: p.cidade_id ?? null,
    intencao: p.intencao ?? 0,
    rejeicao: p.rejeicao ?? 0,
    cities: p.cities,
  }))

  const pollsParaFeedbackPanorama = polls.map((p) => ({
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
      pollsParaFeedbackGrafico,
      metaPorLinhaGrafico
    )
  }

  const feedbackDesempenhoCandidato =
    candidatoPadrao && pesquisasResumoCandidato.length > 0
      ? gerarFeedbackDesempenhoCandidato(
          candidatoPadrao,
          pollsParaFeedbackPanorama.filter((x) => x.candidato_nome === candidatoPadrao),
          pollsParaFeedbackPanorama
        )
      : null

  const pollsPanorama = useMemo(() => [...polls].reverse(), [polls])

  const modeloExecutivoTendencia = useMemo(
    () =>
      buildExecutiveTendenciaModel(
        pollsPanorama.map((p) => ({
          data: p.data,
          tipo: p.tipo,
          candidato_nome: p.candidato_nome,
          intencao: p.intencao,
          instituto: p.instituto ?? '',
          cidadeId: p.cidade_id ?? null,
          cidadeNome: p.cities?.name?.trim() || null,
        }))
      ),
    [pollsPanorama]
  )

  const candidatosDisponiveis = useMemo(
    () =>
      Array.from(new Set(polls.map((poll) => poll.candidato_nome).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR')
      ),
    [polls]
  )

  const tipoPillClass = (active: boolean) =>
    cn(
      'cursor-pointer rounded-[99px] border px-2.5 py-1 text-[11.5px] transition-colors',
      active
        ? 'border-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] font-medium text-[rgb(var(--color-primary))]'
        : 'border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent text-text-secondary'
    )

  const filterSelectWrapClass = 'relative inline-flex items-center'
  const filterSelectClass =
    'appearance-none rounded-[99px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent py-1 pl-2.5 pr-7 text-[11.5px] text-text-primary focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary)/0.25)]'

  const emptyGraficoMessage =
    polls.length === 0
      ? 'Nenhuma pesquisa cadastrada'
      : 'Nenhum registro com os filtros atuais (incluindo região).'

  const barraFiltrosPesquisa = (
    <div
      id="filtros"
      className="flex flex-row flex-wrap items-center gap-2 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-2"
    >
      <span className="text-[11px] font-medium text-text-muted">Filtros</span>

      <div className="flex flex-wrap items-center gap-1.5">
        {(
          [
            { value: 'todas' as const, label: 'Todas' },
            { value: 'estimulada' as const, label: 'Estimulada' },
            { value: 'espontanea' as const, label: 'Espontânea' },
          ] as const
        ).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => setTipoGrafico(option.value)}
            className={tipoPillClass(tipoGrafico === option.value)}
            title={
              option.value === 'todas'
                ? `No gráfico: nas datas em que só há pesquisa espontânea, ${Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)}% do «Não sabe» é redistribuído entre candidatos.`
                : option.value === 'espontanea'
                  ? `No gráfico: ${Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)}% do «Não sabe» redistribuído; branco/nulo inalterado.`
                  : undefined
            }
          >
            {option.label}
          </button>
        ))}
      </div>

      <span className="hidden h-4 w-px shrink-0 bg-[rgb(var(--color-border-tertiary))] sm:block" aria-hidden />

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-text-muted">Cargo</span>
        <div className={filterSelectWrapClass}>
          <select
            value={filtroCargo}
            onChange={(e) => setFiltroCargo(e.target.value)}
            className={cn(filterSelectClass, 'min-w-[6.5rem] max-w-[9rem]')}
          >
            <option value="">Todos</option>
            <option value="dep_estadual">Dep. Estadual</option>
            <option value="dep_federal">Dep. Federal</option>
            <option value="governador">Governador</option>
            <option value="senador">Senador</option>
            <option value="presidente">Presidente</option>
          </select>
          <IconChevronDown
            className="pointer-events-none absolute right-2 h-[11px] w-[11px] text-text-secondary"
            stroke={1.75}
            aria-hidden
          />
        </div>
      </div>

      <span className="hidden h-4 w-px shrink-0 bg-[rgb(var(--color-border-tertiary))] sm:block" aria-hidden />

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-text-muted">Cidade</span>
        {filtroCidade ? (
          <button
            type="button"
            onClick={() => setFiltroCidade('')}
            className="inline-flex items-center gap-1 rounded-[99px] border border-[rgb(var(--color-primary))] bg-[rgb(var(--color-primary-tint))] px-2.5 py-1 text-[11.5px] font-medium text-[rgb(var(--color-primary))]"
          >
            {cities.find((city) => city.id === filtroCidade)?.name ?? 'Cidade'}
            <IconX className="h-[11px] w-[11px] shrink-0" stroke={1.75} aria-hidden />
          </button>
        ) : (
          <div className={filterSelectWrapClass}>
            <select
              value={filtroCidade}
              onChange={(e) => setFiltroCidade(e.target.value)}
              className={cn(filterSelectClass, 'min-w-[6.5rem] max-w-[10rem]')}
            >
              <option value="">Todas</option>
              {cities.map((city) => (
                <option key={city.id} value={city.id}>
                  {city.name}
                </option>
              ))}
            </select>
            <IconChevronDown
              className="pointer-events-none absolute right-2 h-[11px] w-[11px] text-text-secondary"
              stroke={1.75}
              aria-hidden
            />
          </div>
        )}
      </div>

      <span className="hidden h-4 w-px shrink-0 bg-[rgb(var(--color-border-tertiary))] sm:block" aria-hidden />

      <div className="flex items-center gap-1.5">
        <span className="text-[11px] font-medium text-text-muted">Região</span>
        <div className={filterSelectWrapClass}>
          <select
            value={filtroRegiao}
            onChange={(e) => setFiltroRegiao(e.target.value as '' | RegiaoPiaui)}
            title="Mesma lógica do cockpit: município mapeado por latitude (Norte, Centro-Norte, Centro-Sul, Sul)."
            className={cn(filterSelectClass, 'min-w-[5.5rem] max-w-[8rem]')}
          >
            <option value="">Todas</option>
            {REGIOES_PI_ORDER.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
          <IconChevronDown
            className="pointer-events-none absolute right-2 h-[11px] w-[11px] text-text-secondary"
            stroke={1.75}
            aria-hidden
          />
        </div>
      </div>
    </div>
  )

  return (
    <div className={cn('min-h-screen font-sans', isCockpit ? 'sidebar-cockpit-shell' : 'bg-bg-surface')}>

      <div className="px-4 py-6 lg:px-6">
        <div className="mb-2.5 flex flex-row flex-wrap items-center gap-3 rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-2.5">
          <Link
            href={hrefResumoEleicoes}
            className="inline-flex items-center gap-[5px] rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent px-2 py-[5px] text-[12px] text-text-secondary transition-colors hover:bg-bg-app"
          >
            <IconArrowLeft className="h-[13px] w-[13px] shrink-0" stroke={1.75} aria-hidden />
            Resumo Eleições
          </Link>

          <span className="text-[12px] text-text-muted">Candidato para resumo:</span>

          <div className="relative inline-flex max-w-xs items-center">
            <select
              value={candidatoPadrao}
              onChange={(e) => {
                const novoCandidato = e.target.value
                setCandidatoPadrao(novoCandidato)
                localStorage.setItem('candidatoPadraoPesquisa', novoCandidato)
              }}
              className="appearance-none rounded-[99px] border border-[rgb(var(--color-border-secondary)/0.85)] bg-transparent py-1 pl-2.5 pr-7 text-[13px] font-medium text-text-primary transition-colors hover:border-[rgb(var(--color-primary))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--color-primary)/0.25)]"
            >
              <option value="">Selecione um candidato</option>
              {candidatosDisponiveis.map((candidato) => (
                <option key={candidato} value={candidato}>
                  {candidato}
                </option>
              ))}
            </select>
            <IconChevronDown
              className="pointer-events-none absolute right-2.5 h-[11px] w-[11px] text-text-secondary"
              stroke={1.75}
              aria-hidden
            />
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingPoll(null)
              setShowModal(true)
            }}
            className="ml-auto inline-flex items-center gap-1.5 rounded-[10px] border-none bg-[rgb(var(--color-primary))] px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[rgb(var(--color-primary-hover))]"
          >
            <IconPlus className="h-[13px] w-[13px] shrink-0" stroke={1.75} aria-hidden />
            Nova pesquisa
          </button>
        </div>

        <PesquisaShell activeTab={activeTab} onTabChange={onTabChange}>
          {activeTab === 'panorama' ? (
            <div className="flex flex-col gap-4">
              <TendenciaIntencaoExecutiveSection
                model={modeloExecutivoTendencia}
                loading={loading}
                ajusteNsPct={Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)}
                candidatoFoco={candidatoPadrao || null}
              />

              <section>
                <h3 className="mb-3 text-xs font-semibold uppercase tracking-wide text-text-muted">
                  Resumo de desempenho
                </h3>
                <p className="mb-3 text-[11px] text-text-muted">
                  Consolidado do candidato selecionado em todas as pesquisas cadastradas.
                </p>
                <div
                  className={cn(
                    'flex h-[440px] flex-col overflow-hidden rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface p-4 sm:p-6'
                  )}
                >
                  <div className="min-h-0 flex-1 overflow-y-auto">
                  {!candidatoPadrao ? (
                    <p className="text-sm text-secondary">
                      Selecione um candidato acima para visualizar o resumo consolidado.
                    </p>
                  ) : !resumoDesempenho ? (
                    <p className="text-sm text-secondary">
                      Não há pesquisas registradas para <strong>{candidatoPadrao}</strong>.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      <div className="grid grid-cols-2 gap-1.5 md:grid-cols-4">
                        <div className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)] px-2 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-text-muted">Pesquisas</p>
                          <p className="text-sm font-semibold tabular-nums text-text-primary">{resumoDesempenho.totalPesquisasUnicas}</p>
                        </div>
                        <div className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)] px-2 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-text-muted">Intenção média</p>
                          <p className="text-sm font-semibold tabular-nums text-text-primary">{resumoDesempenho.mediaIntencao.toFixed(1)}%</p>
                        </div>
                        <div className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)] px-2 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-text-muted">Rejeição média</p>
                          <p className="text-sm font-semibold tabular-nums text-text-primary">{resumoDesempenho.mediaRejeicao.toFixed(1)}%</p>
                        </div>
                        <div className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)] px-2 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-text-muted">Evolução</p>
                          <p className={`text-sm font-semibold tabular-nums ${resumoDesempenho.evolucaoIntencao >= 0 ? 'text-status-success' : 'text-status-error'}`}>
                            {resumoDesempenho.evolucaoIntencao >= 0 ? '+' : ''}{resumoDesempenho.evolucaoIntencao.toFixed(1)} p.p.
                          </p>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        <div className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)] px-2 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-text-muted">Melhor</p>
                          <p className="text-[11px] font-medium text-text-primary">
                            {resumoDesempenho.melhor.intencao.toFixed(1)}% · {formatDate(resumoDesempenho.melhor.data)}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {resumoDesempenho.melhor.instituto}{resumoDesempenho.melhor.cities?.name ? ` · ${resumoDesempenho.melhor.cities.name}` : ''}
                          </p>
                        </div>
                        <div className="rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)] px-2 py-1.5">
                          <p className="text-[10px] uppercase tracking-wide text-text-muted">Menor</p>
                          <p className="text-[11px] font-medium text-text-primary">
                            {resumoDesempenho.pior.intencao.toFixed(1)}% · {formatDate(resumoDesempenho.pior.data)}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {resumoDesempenho.pior.instituto}{resumoDesempenho.pior.cities?.name ? ` · ${resumoDesempenho.pior.cities.name}` : ''}
                          </p>
                        </div>
                      </div>

                      <p className="text-[10px] text-text-muted">
                        {resumoDesempenho.institutos} instituto(s) · {resumoDesempenho.cidades} cidade(s) · {resumoDesempenho.totalRegistros} registro(s)
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

                      <div className="overflow-auto rounded-lg border border-[rgb(var(--color-border-tertiary)/0.55)]">
                        <table className="w-full table-fixed border-collapse text-left text-[11px]">
                          <thead>
                            <tr className="border-b border-[rgb(var(--color-border-tertiary)/0.55)] text-[10px] uppercase tracking-wide text-text-muted">
                              <th className="px-2 py-1 text-left font-semibold">Cidade</th>
                              <th className="px-2 py-1 text-left font-semibold">Instituto</th>
                              <th className="px-2 py-1 text-right font-semibold">%</th>
                              <th className="px-2 py-1 text-right font-semibold">Data</th>
                            </tr>
                          </thead>
                          <tbody>
                            {linhasTabelaResumo.map((linha, index) => (
                              <tr key={`${linha.data}-${linha.instituto}-${index}`} className="hover:bg-background/40">
                                <td className="border-b border-[rgb(var(--color-border-tertiary)/0.35)] px-2 py-1">{linha.cidade}</td>
                                <td className="border-b border-[rgb(var(--color-border-tertiary)/0.35)] px-2 py-1">{linha.instituto}</td>
                                <td className="border-b border-[rgb(var(--color-border-tertiary)/0.35)] px-2 py-1 text-right tabular-nums font-medium text-text-primary">
                                  {linha.intencao.toFixed(1)}%
                                </td>
                                <td className="border-b border-[rgb(var(--color-border-tertiary)/0.35)] px-2 py-1 text-right text-text-secondary">
                                  {linha.data}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                  </div>
                </div>
              </section>
            </div>
          ) : activeTab === 'tendencia' ? (
            <div className="flex flex-col gap-2.5">
              {barraFiltrosPesquisa}
              <div
                ref={tendenciaGraficoRef}
                className={cn('rounded-xl border p-3 sm:p-4', sectionShellClass)}
              >
                <TendenciaTemporalPanel
                  pesquisaData={pesquisaData}
                  candidatos={candidatos}
                  candidatoPadrao={candidatoPadrao}
                  resumoLegendaPorCandidato={resumoLegendaPorCandidato}
                  onTelaCheia={() => setGraficoTelaCheia(true)}
                  loading={loading}
                  emptyMessage={emptyGraficoMessage}
                />
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-2.5">
              {barraFiltrosPesquisa}
              <div className={cn('rounded-xl border p-4 sm:p-6', innerPanelClass)}>
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
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoCadastradas('data')}
                        className="inline-flex items-center gap-1 select-none transition-colors hover:text-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/40 rounded"
                        aria-label={
                          ordenacaoCadastradas?.chave !== 'data'
                            ? 'Ordenar por Data (A→Z)'
                            : ordenacaoCadastradas.direcao === 'asc'
                              ? 'Ordenar por Data (Z→A)'
                              : 'Remover ordenação por Data'
                        }
                      >
                        <span>Data</span>
                        {ordenacaoCadastradas?.chave !== 'data' ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        ) : ordenacaoCadastradas.direcao === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoCadastradas('instituto')}
                        className="inline-flex items-center gap-1 select-none transition-colors hover:text-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/40 rounded"
                        aria-label={
                          ordenacaoCadastradas?.chave !== 'instituto'
                            ? 'Ordenar por Instituto (A→Z)'
                            : ordenacaoCadastradas.direcao === 'asc'
                              ? 'Ordenar por Instituto (Z→A)'
                              : 'Remover ordenação por Instituto'
                        }
                      >
                        <span>Instituto</span>
                        {ordenacaoCadastradas?.chave !== 'instituto' ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        ) : ordenacaoCadastradas.direcao === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th className="align-top py-3 px-4 text-left text-sm font-semibold text-text-primary">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoCadastradas('candidato')}
                        className="inline-flex items-center gap-1 select-none transition-colors hover:text-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/40 rounded"
                        aria-label={
                          ordenacaoCadastradas?.chave !== 'candidato'
                            ? 'Ordenar por Candidato (A→Z)'
                            : ordenacaoCadastradas.direcao === 'asc'
                              ? 'Ordenar por Candidato (Z→A)'
                              : 'Remover ordenação por Candidato'
                        }
                      >
                        <span>Candidato</span>
                        {ordenacaoCadastradas?.chave !== 'candidato' ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        ) : ordenacaoCadastradas.direcao === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        )}
                      </button>
                      <label htmlFor="pesquisa-cadastradas-filtro-candidato" className="sr-only">
                        Filtrar por nome do candidato
                      </label>
                      <input
                        id="pesquisa-cadastradas-filtro-candidato"
                        type="search"
                        value={filtroTextoCandidatoCadastradas}
                        onChange={(e) => setFiltroTextoCandidatoCadastradas(e.target.value)}
                        placeholder="Buscar nome…"
                        className={cn(
                          'mt-2 w-full min-w-[8rem] max-w-[18rem] rounded-md border px-2 py-1.5 text-xs font-normal text-text-primary placeholder:text-secondary focus:outline-none focus:ring-2 focus:ring-accent-gold/40',
                          inputShellClass
                        )}
                        autoComplete="off"
                      />
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoCadastradas('cidade')}
                        className="inline-flex items-center gap-1 select-none transition-colors hover:text-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/40 rounded"
                        aria-label={
                          ordenacaoCadastradas?.chave !== 'cidade'
                            ? 'Ordenar por Cidade (A→Z)'
                            : ordenacaoCadastradas.direcao === 'asc'
                              ? 'Ordenar por Cidade (Z→A)'
                              : 'Remover ordenação por Cidade'
                        }
                      >
                        <span>Cidade</span>
                        {ordenacaoCadastradas?.chave !== 'cidade' ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        ) : ordenacaoCadastradas.direcao === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoCadastradas('tipo')}
                        className="inline-flex items-center gap-1 select-none transition-colors hover:text-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/40 rounded"
                        aria-label={
                          ordenacaoCadastradas?.chave !== 'tipo'
                            ? 'Ordenar por Tipo (A→Z)'
                            : ordenacaoCadastradas.direcao === 'asc'
                              ? 'Ordenar por Tipo (Z→A)'
                              : 'Remover ordenação por Tipo'
                        }
                      >
                        <span>Tipo</span>
                        {ordenacaoCadastradas?.chave !== 'tipo' ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        ) : ordenacaoCadastradas.direcao === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-text-primary">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoCadastradas('cargo')}
                        className="inline-flex items-center gap-1 select-none transition-colors hover:text-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/40 rounded"
                        aria-label={
                          ordenacaoCadastradas?.chave !== 'cargo'
                            ? 'Ordenar por Cargo (A→Z)'
                            : ordenacaoCadastradas.direcao === 'asc'
                              ? 'Ordenar por Cargo (Z→A)'
                              : 'Remover ordenação por Cargo'
                        }
                      >
                        <span>Cargo</span>
                        {ordenacaoCadastradas?.chave !== 'cargo' ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        ) : ordenacaoCadastradas.direcao === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-primary">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoCadastradas('intencao')}
                        className="inline-flex items-center gap-1 select-none transition-colors hover:text-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/40 rounded ml-auto"
                        aria-label={
                          ordenacaoCadastradas?.chave !== 'intencao'
                            ? 'Ordenar por Intenção (menor → maior)'
                            : ordenacaoCadastradas.direcao === 'asc'
                              ? 'Ordenar por Intenção (maior → menor)'
                              : 'Remover ordenação por Intenção'
                        }
                      >
                        <span>Intenção</span>
                        {ordenacaoCadastradas?.chave !== 'intencao' ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        ) : ordenacaoCadastradas.direcao === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-text-primary">
                      <button
                        type="button"
                        onClick={() => alternarOrdenacaoCadastradas('rejeicao')}
                        className="inline-flex items-center gap-1 select-none transition-colors hover:text-accent-gold focus:outline-none focus:ring-2 focus:ring-accent-gold/40 rounded ml-auto"
                        aria-label={
                          ordenacaoCadastradas?.chave !== 'rejeicao'
                            ? 'Ordenar por Rejeição (menor → maior)'
                            : ordenacaoCadastradas.direcao === 'asc'
                              ? 'Ordenar por Rejeição (maior → menor)'
                              : 'Remover ordenação por Rejeição'
                        }
                      >
                        <span>Rejeição</span>
                        {ordenacaoCadastradas?.chave !== 'rejeicao' ? (
                          <ArrowUpDown className="h-3.5 w-3.5 opacity-40" aria-hidden="true" />
                        ) : ordenacaoCadastradas.direcao === 'asc' ? (
                          <ArrowUp className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        ) : (
                          <ArrowDown className="h-3.5 w-3.5 text-accent-gold" aria-hidden="true" />
                        )}
                      </button>
                    </th>
                    <th className="text-center py-3 px-4 text-sm font-semibold text-text-primary">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {pollsCadastradasExibicao.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="py-10 px-4 text-center text-sm text-secondary"
                      >
                        {filtroTextoCandidatoCadastradas.trim()
                          ? `Nenhuma pesquisa corresponde ao filtro de candidato «${filtroTextoCandidatoCadastradas.trim()}».`
                          : 'Nenhuma pesquisa para exibir.'}
                      </td>
                    </tr>
                  ) : null}
                  {pollsCadastradasExibicao.map((poll) => (
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
            </div>
          )}
        </PesquisaShell>
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
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-3 py-3 sm:px-4">
              <div className="min-w-0">
                <h2
                  id="pesquisa-tendencia-tela-cheia-titulo"
                  className="text-[13px] font-medium text-text-primary"
                >
                  Tendência temporal de intenção · tela cheia
                </h2>
                <p className="mt-0.5 text-[11px] text-text-muted">{subtituloModalTelaCheia}</p>
              </div>
              <button
                type="button"
                onClick={() => setGraficoTelaCheia(false)}
                className="shrink-0 rounded-[10px] border border-[rgb(var(--color-border-secondary)/0.85)] p-2 transition-colors hover:bg-bg-app"
                title="Fechar tela cheia"
              >
                <IconX className="h-5 w-5 text-text-secondary" stroke={1.75} />
              </button>
            </div>

            <div className="flex min-h-0 flex-1 flex-col p-2 sm:p-3">
              <TendenciaTemporalPanel
                pesquisaData={pesquisaData}
                candidatos={candidatos}
                candidatoPadrao={candidatoPadrao}
                resumoLegendaPorCandidato={resumoLegendaPorCandidato}
                showHeader={false}
                chartHeight={640}
                loading={loading}
                emptyMessage={emptyGraficoMessage}
                className="flex h-full min-h-0 flex-1 flex-col border-none p-2 sm:p-3"
              />
            </div>
          </div>,
          document.body
        )}
    </div>
  )
}

