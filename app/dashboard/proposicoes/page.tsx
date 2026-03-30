'use client'

import { useEffect, useState, useMemo, useRef } from 'react'
import {
  FileText,
  Search,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Users,
  X,
  Loader2,
  Filter,
  Calendar,
  GitBranch,
  Building2,
  ArrowRight,
  Clock,
  CheckCircle2,
  Circle,
  Table2,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface Proposicao {
  id: number
  uri: string
  siglaTipo: string
  codTipo: number
  numero: number
  ano: number
  ementa: string
  dataApresentacao: string
  /** Preenchido no cliente ao agregar proposições por deputado */
  deputadoAutorId?: number
}

interface Autor {
  uri: string
  nome: string
  codTipo: number
  tipo: string
  ordemAssinatura: number
  proponente: number
}

interface Tramitacao {
  dataHora: string
  sequencia: number
  siglaOrgao: string
  uriOrgao: string
  uriUltimoRelator: string | null
  regime: string
  descricaoTramitacao: string
  codTipoTramitacao: string
  descricaoSituacao: string | null
  codSituacao: number | null
  despacho: string
  url: string | null
  ambito: string
  apreciacao: string
}

interface StatusCache {
  descricaoSituacao: string | null
  codSituacao: number | null
  siglaOrgao: string
  descricaoTramitacao: string
  dataHora: string
}

const ITEMS_PER_PAGE = 15
const STATUS_CONCURRENCY = 15

/** Início aproximado da 57ª Legislatura (comparativo planilha: 2023 até hoje). */
const LEGISLATURA_57_INICIO = new Date('2023-02-01T00:00:00-03:00')

export type ColunaResumoId =
  | 'projetosLei'
  | 'aprovadosCamara'
  | 'convertidosLei'
  | 'emendas'
  | 'parecerRelator'
  | 'indicacoesRic'
  | 'reqAudiencia'

type DeputadoQuadro = {
  id: number
  nome: string
  /** Destaque visual (ex.: linha verde na planilha) */
  destaque?: boolean
}

/** Adicione outros deputados (id da Câmara) para multiplicar as linhas do quadro. */
const DEPUTADOS_QUADRO_RESUMO: DeputadoQuadro[] = [
  { id: 220697, nome: 'Jadyel Alencar', destaque: true },
]

const COLUNAS_QUADRO_RESUMO: { id: ColunaResumoId; label: string; precisaStatus: boolean }[] = [
  { id: 'projetosLei', label: 'Projetos de Lei', precisaStatus: false },
  { id: 'aprovadosCamara', label: 'Aprovados na Câmara', precisaStatus: true },
  { id: 'convertidosLei', label: 'Convertidos em Lei', precisaStatus: true },
  { id: 'emendas', label: 'Emendas', precisaStatus: false },
  { id: 'parecerRelator', label: 'Parecer do Relator', precisaStatus: true },
  { id: 'indicacoesRic', label: 'Indicações / Req. de Informação', precisaStatus: false },
  { id: 'reqAudiencia', label: 'Req. de Audiência Pública', precisaStatus: false },
]

function naLegislaturaAtual(p: Proposicao): boolean {
  if (!p.dataApresentacao) return false
  const d = new Date(p.dataApresentacao)
  return !Number.isNaN(d.getTime()) && d >= LEGISLATURA_57_INICIO
}

/** Remove ids repetidos (a API pode devolver a mesma proposição mais de uma vez). */
function dedupeProposicoesPorId(lista: Proposicao[]): Proposicao[] {
  const visto = new Set<number>()
  const out: Proposicao[] = []
  for (const p of lista) {
    if (visto.has(p.id)) continue
    visto.add(p.id)
    out.push(p)
  }
  return out
}

const TIPOS_MATERIA_LEGISLATIVA = new Set(['PL', 'PLP', 'PEC', 'PDL', 'PRC', 'MPV'])

/** Critérios alinhados ao quadro resumo legislativo; cada coluna filtra a lista ao clicar. */
function proposicaoNaColunaResumo(
  col: ColunaResumoId,
  p: Proposicao,
  st: StatusCache | undefined
): boolean {
  if (!naLegislaturaAtual(p)) return false
  const situ = (st?.descricaoSituacao || '').toLowerCase()
  const tram = (st?.descricaoTramitacao || '').toLowerCase()
  const texto = `${situ} ${tram}`
  const cod = st?.codSituacao

  switch (col) {
    case 'projetosLei':
      return ['PL', 'PLP', 'PEC'].includes(p.siglaTipo)
    case 'aprovadosCamara': {
      if (!st) return false
      // Já virou norma: conta em "Convertidos em Lei", não duplicar aqui
      if (cod === 1140) return false
      if (cod === 926 || cod === 1150) return true
      if (cod === 1285) {
        if (texto.includes('não aprovad') || texto.includes('nao aprovad')) return false
        if (texto.includes('aprovad')) return true
        return false
      }
      if (texto.includes('não aprovad') || texto.includes('nao aprovad')) return false
      if (texto.includes('arquivad') || texto.includes('rejeitad') || texto.includes('vetad')) return false
      if (!texto.includes('aprovad')) return false
      // "aprovad" genérico só para matérias legislativas (evita REQ/INC com votação acessória inflando o número)
      if (TIPOS_MATERIA_LEGISLATIVA.has(p.siglaTipo)) return true
      return false
    }
    case 'convertidosLei': {
      if (!st) return false
      if (cod === 1140) return true
      return texto.includes('transformad') && texto.includes('norma')
    }
    case 'emendas':
      return p.siglaTipo === 'EMC'
    case 'parecerRelator': {
      if (!st) return false
      return (
        (texto.includes('parecer') && (texto.includes('relat') || texto.includes('relator'))) ||
        tram.includes('parecer do relat')
      )
    }
    case 'indicacoesRic':
      return p.siglaTipo === 'INC' || p.siglaTipo === 'RIC'
    case 'reqAudiencia': {
      if (p.siglaTipo !== 'REQ') return false
      const e = p.ementa.toLowerCase()
      return (
        e.includes('audiência pública') ||
        e.includes('audiencia publica') ||
        e.includes('realização de audiência') ||
        e.includes('realizacao de audiencia') ||
        e.includes('instalação de audiência') ||
        e.includes('instalacao de audiencia')
      )
    }
    default:
      return false
  }
}

const TIPOS_PROPOSICAO = [
  { value: '', label: 'Todos os tipos' },
  { value: 'PL', label: 'PL — Projeto de Lei' },
  { value: 'PLP', label: 'PLP — Projeto de Lei Complementar' },
  { value: 'PEC', label: 'PEC — Proposta de Emenda à Constituição' },
  { value: 'REQ', label: 'REQ — Requerimento' },
  { value: 'INC', label: 'INC — Indicação' },
  { value: 'EMC', label: 'EMC — Emenda' },
  { value: 'DOC', label: 'DOC — Documento' },
  { value: 'MPV', label: 'MPV — Medida Provisória' },
  { value: 'PDL', label: 'PDL — Projeto de Decreto Legislativo' },
  { value: 'PRC', label: 'PRC — Projeto de Resolução' },
  { value: 'RIC', label: 'RIC — Requerimento de Informação' },
  { value: 'RCP', label: 'RCP — Requerimento de CPI' },
  { value: 'MSC', label: 'MSC — Mensagem' },
  { value: 'PDC', label: 'PDC — Projeto de Decreto Legislativo da Câmara' },
]

const SITUACOES_PROPOSICAO = [
  { value: '', label: 'Todos os status' },
  { value: '923', label: 'Arquivada' },
  { value: '907', label: 'Aguardando Designação de Relator(a)' },
  { value: '910', label: 'Aguardando Encaminhamento' },
  { value: '915', label: 'Aguardando Parecer' },
  { value: '924', label: 'Pronta para Pauta' },
  { value: '925', label: 'Tramitando em Conjunto' },
  { value: '926', label: 'Aguardando Apreciação pelo Senado Federal' },
  { value: '1140', label: 'Transformado em Norma Jurídica' },
  { value: '1285', label: 'Tramitação Finalizada' },
  { value: '903', label: 'Aguardando Deliberação' },
  { value: '906', label: 'Aguardando Distribuição' },
  { value: '937', label: 'Vetado Totalmente' },
  { value: '950', label: 'Retirado pelo(a) Autor(a)' },
  { value: '1120', label: 'Devolvida ao(à) Autor(a)' },
  { value: '1222', label: 'Prejudicialidade' },
  { value: '928', label: 'Aguardando Análise de Parecer' },
  { value: '1150', label: 'Aguardando Sanção' },
]

const BADGE_COLORS: Record<string, string> = {
  PL: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  PLP: 'bg-purple-500/15 text-purple-400 border-purple-500/30',
  PEC: 'bg-red-500/15 text-red-400 border-red-500/30',
  MPV: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
  REQ: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  INC: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  PDL: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  PRC: 'bg-pink-500/15 text-pink-400 border-pink-500/30',
  EMC: 'bg-indigo-500/15 text-indigo-400 border-indigo-500/30',
  DOC: 'bg-slate-500/15 text-slate-400 border-slate-500/30',
  RIC: 'bg-teal-500/15 text-teal-400 border-teal-500/30',
  RCP: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
  MSC: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
  PDC: 'bg-sky-500/15 text-sky-400 border-sky-500/30',
}

function getBadgeColor(tipo: string): string {
  return BADGE_COLORS[tipo] || 'bg-accent-gold-soft text-accent-gold border-accent-gold/30'
}

function formatDataApresentacao(data: string): string {
  if (!data) return ''
  const date = new Date(data)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDataHora(data: string): string {
  if (!data) return ''
  const date = new Date(data)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function getStatusColor(descricao: string | null): string {
  if (!descricao) return 'bg-text-secondary/10 text-text-secondary'
  const d = descricao.toLowerCase()
  if (d.includes('aprovad') || d.includes('sancionad') || d.includes('transformad')) return 'bg-status-success/15 text-status-success'
  if (d.includes('arquivad') || d.includes('rejeitad') || d.includes('prejudicad')) return 'bg-status-danger/15 text-status-danger'
  if (d.includes('senado')) return 'bg-purple-500/15 text-purple-400'
  if (d.includes('aguardando')) return 'bg-status-warning/15 text-status-warning'
  return 'bg-status-info/15 text-status-info'
}

function getTimelineIcon(descricao: string): typeof CheckCircle2 {
  const d = descricao.toLowerCase()
  if (d.includes('aprovação') || d.includes('aprovado')) return CheckCircle2
  if (d.includes('apresentação')) return FileText
  if (d.includes('distribuição') || d.includes('recebimento')) return ArrowRight
  if (d.includes('designação')) return Users
  if (d.includes('prazo') || d.includes('abertura')) return Clock
  return Circle
}

type BundleDeputado = DeputadoQuadro & { proposicoes: Proposicao[] }

export default function ProposicoesPage() {
  const [deputadosBundles, setDeputadosBundles] = useState<BundleDeputado[]>([])
  const [initialLoading, setInitialLoading] = useState<boolean>(true)
  const [pagina, setPagina] = useState<number>(1)

  const [filtroTipo, setFiltroTipo] = useState<string>('')
  const [filtroAno, setFiltroAno] = useState<string>('')
  const [filtroKeyword, setFiltroKeyword] = useState<string>('')
  const [filtroStatus, setFiltroStatus] = useState<string>('')
  const [filtroDeputadoQuadro, setFiltroDeputadoQuadro] = useState<number | null>(null)
  const [filtroColunaQuadro, setFiltroColunaQuadro] = useState<ColunaResumoId | null>(null)
  const [searchInput, setSearchInput] = useState<string>('')
  const [showFilters, setShowFilters] = useState<boolean>(false)
  const listaProposicoesRef = useRef<HTMLDivElement>(null)

  const allProposicoes = useMemo(() => {
    const seen = new Set<number>()
    const out: Proposicao[] = []
    for (const b of deputadosBundles) {
      for (const p of b.proposicoes) {
        if (seen.has(p.id)) continue
        seen.add(p.id)
        out.push(p)
      }
    }
    return out
  }, [deputadosBundles])

  const [autoresModalOpen, setAutoresModalOpen] = useState<boolean>(false)
  const [autoresLoading, setAutoresLoading] = useState<boolean>(false)
  const [autores, setAutores] = useState<Autor[]>([])
  const [autoresProposicao, setAutoresProposicao] = useState<string>('')

  const [tramitacoesModalOpen, setTramitacoesModalOpen] = useState<boolean>(false)
  const [tramitacoesLoading, setTramitacoesLoading] = useState<boolean>(false)
  const [tramitacoes, setTramitacoes] = useState<Tramitacao[]>([])
  const [tramitacoesProposicao, setTramitacoesProposicao] = useState<string>('')

  const [statusMap, setStatusMap] = useState<Record<number, StatusCache>>({})
  const [statusProgress, setStatusProgress] = useState<{ loaded: number; total: number }>({ loaded: 0, total: 0 })
  const [statusesFullyLoaded, setStatusesFullyLoaded] = useState<boolean>(false)

  useEffect(() => {
    let cancelled = false
    const loadAll = async () => {
      try {
        const bundles = await Promise.all(
          DEPUTADOS_QUADRO_RESUMO.map(async (dep) => {
            const res = await fetch(`/api/proposicoes?fetchAll=true&idDeputado=${dep.id}`)
            if (!res.ok) return { ...dep, proposicoes: [] as Proposicao[] }
            const data = await res.json()
            const lista = dedupeProposicoesPorId((data.dados || []) as Proposicao[])
            return {
              ...dep,
              proposicoes: lista.map((p) => ({ ...p, deputadoAutorId: dep.id })),
            }
          })
        )
        if (!cancelled) setDeputadosBundles(bundles)
      } catch (err) {
        console.error('Erro ao buscar proposições:', err)
      } finally {
        if (!cancelled) setInitialLoading(false)
      }
    }
    loadAll()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (allProposicoes.length === 0) return

    const ids = allProposicoes.map((p) => p.id)
    setStatusProgress({ loaded: 0, total: ids.length })
    setStatusesFullyLoaded(false)
    let cancelled = false
    let loaded = 0

    const fetchStatus = async (id: number): Promise<{ id: number; status: StatusCache } | null> => {
      try {
        const res = await fetch(`/api/proposicoes/${id}/tramitacoes`)
        if (!res.ok) return null
        const data = await res.json()
        const list: Tramitacao[] = data.dados || []
        if (list.length === 0) return null
        const last = [...list].sort((a, b) => b.sequencia - a.sequencia)[0]
        return {
          id,
          status: {
            descricaoSituacao: last.descricaoSituacao,
            codSituacao: last.codSituacao,
            siglaOrgao: last.siglaOrgao,
            descricaoTramitacao: last.descricaoTramitacao,
            dataHora: last.dataHora,
          },
        }
      } catch {
        return null
      }
    }

    const run = async () => {
      for (let i = 0; i < ids.length; i += STATUS_CONCURRENCY) {
        if (cancelled) break
        const batch = ids.slice(i, i + STATUS_CONCURRENCY)
        const results = await Promise.allSettled(batch.map(fetchStatus))
        const newStatuses: Record<number, StatusCache> = {}
        results.forEach((r) => {
          if (r.status === 'fulfilled' && r.value) {
            newStatuses[r.value.id] = r.value.status
          }
        })
        loaded += batch.length
        if (!cancelled) {
          setStatusMap((prev) => ({ ...prev, ...newStatuses }))
          setStatusProgress({ loaded, total: ids.length })
        }
      }
      if (!cancelled) setStatusesFullyLoaded(true)
    }

    run()
    return () => { cancelled = true }
  }, [allProposicoes])

  const filteredItems = useMemo(() => {
    let items = [...allProposicoes]
    if (filtroDeputadoQuadro != null) {
      items = items.filter((p) => p.deputadoAutorId === filtroDeputadoQuadro)
    }
    if (filtroColunaQuadro != null) {
      items = items.filter((p) =>
        proposicaoNaColunaResumo(filtroColunaQuadro, p, statusMap[p.id])
      )
    }
    if (filtroTipo) items = items.filter((p) => p.siglaTipo === filtroTipo)
    if (filtroAno) items = items.filter((p) => p.ano === Number(filtroAno))
    if (filtroKeyword) {
      const kw = filtroKeyword.toLowerCase()
      items = items.filter((p) => p.ementa.toLowerCase().includes(kw))
    }
    if (filtroStatus) {
      const code = Number(filtroStatus)
      items = items.filter((p) => {
        const s = statusMap[p.id]
        return s && s.codSituacao === code
      })
    }
    items.sort((a, b) => new Date(b.dataApresentacao).getTime() - new Date(a.dataApresentacao).getTime())
    return items
  }, [
    allProposicoes,
    filtroDeputadoQuadro,
    filtroColunaQuadro,
    filtroTipo,
    filtroAno,
    filtroKeyword,
    filtroStatus,
    statusMap,
  ])

  const contagemQuadro = useMemo(() => {
    const out: Record<number, Record<ColunaResumoId, number>> = {}
    for (const dep of deputadosBundles) {
      const row = {} as Record<ColunaResumoId, number>
      for (const col of COLUNAS_QUADRO_RESUMO) {
        if (col.precisaStatus && !statusesFullyLoaded) {
          row[col.id] = -1
        } else {
          row[col.id] = dep.proposicoes.filter((p) =>
            proposicaoNaColunaResumo(col.id, p, statusMap[p.id])
          ).length
        }
      }
      out[dep.id] = row
    }
    return out
  }, [deputadosBundles, statusMap, statusesFullyLoaded])

  const labelColunaQuadro = (id: ColunaResumoId) =>
    COLUNAS_QUADRO_RESUMO.find((c) => c.id === id)?.label ?? id

  const nomeDeputadoQuadro = (id: number) =>
    DEPUTADOS_QUADRO_RESUMO.find((d) => d.id === id)?.nome ?? `Deputado ${id}`

  const handleCelulaQuadro = (deputadoId: number, col: ColunaResumoId) => {
    // Garante que o total da célula = itens da lista (sem filtros antigos escondidos)
    setFiltroTipo('')
    setFiltroAno('')
    setFiltroKeyword('')
    setFiltroStatus('')
    setSearchInput('')
    setFiltroDeputadoQuadro(deputadoId)
    setFiltroColunaQuadro(col)
    setPagina(1)
    setShowFilters(true)
    window.setTimeout(() => {
      listaProposicoesRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 100)
  }

  const limparFiltroQuadro = () => {
    setFiltroDeputadoQuadro(null)
    setFiltroColunaQuadro(null)
    setPagina(1)
  }

  const totalPages = Math.ceil(filteredItems.length / ITEMS_PER_PAGE)

  const paginatedItems = useMemo(() => {
    const start = (pagina - 1) * ITEMS_PER_PAGE
    return filteredItems.slice(start, start + ITEMS_PER_PAGE)
  }, [filteredItems, pagina])

  const handleSearch = () => { setFiltroKeyword(searchInput); setPagina(1) }
  const handleKeyDown = (e: React.KeyboardEvent) => { if (e.key === 'Enter') handleSearch() }

  const clearFilters = () => {
    setFiltroTipo('')
    setFiltroAno('')
    setFiltroKeyword('')
    setFiltroStatus('')
    setFiltroDeputadoQuadro(null)
    setFiltroColunaQuadro(null)
    setSearchInput('')
    setPagina(1)
  }

  const fetchAutores = async (proposicaoId: number, titulo: string) => {
    setAutoresModalOpen(true); setAutoresLoading(true); setAutoresProposicao(titulo); setAutores([])
    try {
      const response = await fetch(`/api/proposicoes/${proposicaoId}/autores`)
      if (response.ok) { setAutores((await response.json()).dados || []) }
    } catch (error) { console.error('Erro ao buscar autores:', error) }
    finally { setAutoresLoading(false) }
  }

  const fetchTramitacoes = async (proposicaoId: number, titulo: string) => {
    setTramitacoesModalOpen(true); setTramitacoesLoading(true); setTramitacoesProposicao(titulo); setTramitacoes([])
    try {
      const response = await fetch(`/api/proposicoes/${proposicaoId}/tramitacoes`)
      if (response.ok) {
        const lista: Tramitacao[] = (await response.json()).dados || []
        setTramitacoes(lista.sort((a, b) => b.sequencia - a.sequencia))
      }
    } catch (error) { console.error('Erro ao buscar tramitações:', error) }
    finally { setTramitacoesLoading(false) }
  }

  const hasActiveFilters =
    Boolean(filtroTipo || filtroAno || filtroKeyword || filtroStatus || filtroColunaQuadro != null)
  const activeFilterCount = [
    filtroTipo,
    filtroAno,
    filtroKeyword,
    filtroStatus,
    filtroColunaQuadro != null ? 'quadro' : '',
  ].filter(Boolean).length
  const statusFilterActive = !!filtroStatus
  const progressPercent = statusProgress.total > 0 ? Math.round((statusProgress.loaded / statusProgress.total) * 100) : 0

  const startItem = filteredItems.length > 0 ? (pagina - 1) * ITEMS_PER_PAGE + 1 : 0
  const endItem = Math.min(pagina * ITEMS_PER_PAGE, filteredItems.length)

  if (initialLoading) {
    return (
      <div className="min-h-screen bg-background">
        <div className="px-4 py-6 lg:px-6">
          <div className="mb-6">
            <div className="h-8 w-64 bg-surface rounded-lg animate-pulse mb-2" />
            <div className="h-4 w-96 bg-surface rounded-lg animate-pulse" />
          </div>
          <div className="flex items-center justify-center py-16">
            <div className="text-center">
              <Loader2 className="w-8 h-8 text-accent-gold animate-spin mx-auto mb-4" />
              <p className="text-sm text-text-secondary">Carregando todas as proposições...</p>
              <p className="text-xs text-text-secondary/60 mt-1">Isso pode levar alguns segundos</p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6 lg:px-6">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl bg-accent-gold-soft flex items-center justify-center">
              <FileText className="w-5 h-5 text-accent-gold" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-text-primary">Proposições Legislativas</h2>
              <p className="text-sm text-text-secondary">
                {allProposicoes.length} proposições —{' '}
                {DEPUTADOS_QUADRO_RESUMO.map((d) => d.nome).join(', ')} — Câmara dos Deputados
              </p>
            </div>
          </div>
        </div>

        {/* Card do Deputado */}
        <div className="bg-surface rounded-2xl border border-card p-5 mb-6 flex items-center gap-4">
          <img
            src="https://www.camara.leg.br/internet/deputado/bandep/220697.jpg"
            alt="Dep. Jadyel Alencar"
            className="w-16 h-16 rounded-full object-cover border-2 border-accent-gold shadow-md"
          />
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-text-primary">Jadyel Alencar</h3>
            <p className="text-sm text-text-secondary">REPUBLICANOS — PI | 57ª Legislatura</p>
          </div>
          <a
            href="https://www.camara.leg.br/deputados/220697"
            target="_blank"
            rel="noopener noreferrer"
            className="px-4 py-2 bg-accent-gold-soft text-accent-gold rounded-lg text-sm font-medium hover:bg-accent-gold hover:text-white transition-all duration-200 flex items-center gap-2"
          >
            Perfil na Câmara
            <ExternalLink className="w-4 h-4" />
          </a>
        </div>

        {/* Barra de progresso de status */}
        {!statusesFullyLoaded && statusProgress.total > 0 && (
          <div className="mb-4 p-4 rounded-xl bg-surface border border-card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-text-secondary flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-accent-gold animate-spin" />
                Carregando status das proposições...
              </p>
              <span className="text-xs font-medium text-text-primary">
                {statusProgress.loaded}/{statusProgress.total} ({progressPercent}%)
              </span>
            </div>
            <div className="w-full h-1.5 bg-background rounded-full overflow-hidden">
              <div
                className="h-full bg-accent-gold rounded-full transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>
        )}

        {/* Quadro resumo (padrão visual do dashboard) */}
        {deputadosBundles.length > 0 && (
          <div className="mb-6 rounded-2xl border border-card bg-surface overflow-hidden shadow-sm">
            <div className="flex items-center gap-2 px-4 py-3 border-b border-card bg-background/80">
              <Table2 className="w-4 h-4 text-accent-gold" />
              <h3 className="text-sm font-semibold text-text-primary">Quadro resumo legislativo</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[880px] border-collapse text-sm text-text-primary">
                <thead>
                  <tr className="bg-accent-gold-soft/25 text-text-primary">
                    <th className="border border-card px-3 py-2.5 text-left font-semibold">Deputado</th>
                    {COLUNAS_QUADRO_RESUMO.map((col) => (
                      <th
                        key={col.id}
                        className="border border-card px-2 py-2.5 text-center font-semibold text-[11px] leading-tight max-w-[120px]"
                      >
                        {col.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {deputadosBundles.map((dep) => (
                    <tr
                      key={dep.id}
                      className={cn(
                        'border-b border-card last:border-b-0 transition-colors',
                        dep.destaque ? 'bg-accent-gold-soft/15' : 'bg-surface hover:bg-background/80'
                      )}
                    >
                      <td className="border border-card px-3 py-2.5 font-medium text-left text-text-primary">
                        {dep.nome}
                      </td>
                      {COLUNAS_QUADRO_RESUMO.map((col) => {
                        const n = contagemQuadro[dep.id]?.[col.id] ?? 0
                        const loading = n < 0
                        return (
                          <td
                            key={col.id}
                            className="border border-card px-2 py-2 text-center align-middle bg-background/40"
                          >
                            <button
                              type="button"
                              onClick={() => handleCelulaQuadro(dep.id, col.id)}
                              disabled={loading}
                              title={`Ver lista: ${col.label}`}
                              className={cn(
                                'min-w-[2.25rem] tabular-nums rounded-lg px-2 py-1 text-sm font-semibold transition-colors',
                                loading
                                  ? 'text-text-secondary cursor-wait'
                                  : 'text-accent-gold hover:bg-accent-gold-soft/50 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft'
                              )}
                            >
                              {loading ? '…' : n}
                            </button>
                          </td>
                        )
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-background/50 border-t border-card text-xs text-text-secondary leading-relaxed space-y-1">
              <p>
                <span className="font-medium text-text-primary">57ª Legislatura:</span> apenas proposições
                apresentadas a partir de fevereiro de 2023. Clique em um número para filtrar a lista abaixo
                (outros filtros são limpos para bater com o total da célula).
              </p>
              <p className="text-text-secondary/80">
                Colunas por status usam a última tramitação da API. Mostram “…” até o carregamento terminar.
              </p>
            </div>
          </div>
        )}

        {/* Busca e filtros */}
        <div className="bg-surface rounded-2xl border border-card p-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-secondary" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Buscar por palavra-chave na ementa..."
                className="w-full pl-10 pr-4 py-2.5 bg-background border border-card rounded-xl text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft focus:border-accent-gold transition-all"
              />
            </div>
            <button onClick={handleSearch} className="px-5 py-2.5 bg-accent-gold text-white rounded-xl text-sm font-medium hover:bg-accent-gold/90 transition-colors">
              Buscar
            </button>
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'px-4 py-2.5 rounded-xl text-sm font-medium flex items-center gap-2 transition-all border',
                showFilters ? 'bg-accent-gold-soft text-accent-gold border-accent-gold/30' : 'bg-background text-text-secondary border-card hover:border-accent-gold/30'
              )}
            >
              <Filter className="w-4 h-4" />
              Filtros
              {activeFilterCount > 0 && (
                <span className="min-w-[18px] h-[18px] flex items-center justify-center text-[10px] font-bold rounded-full bg-accent-gold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>
          </div>

          {showFilters && (
            <div className="mt-4 pt-4 border-t border-card space-y-4">
              <div className="flex flex-wrap items-start gap-4">
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Tipo de Proposição</label>
                  <select
                    value={filtroTipo}
                    onChange={(e) => { setFiltroTipo(e.target.value); setPagina(1) }}
                    className="w-full px-3 py-2.5 bg-background border border-card rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft focus:border-accent-gold transition-all"
                  >
                    {TIPOS_PROPOSICAO.map((t) => (<option key={t.value} value={t.value}>{t.label}</option>))}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">
                    Status / Situação
                    {!statusesFullyLoaded && statusProgress.total > 0 && (
                      <span className="ml-2 text-accent-gold">({progressPercent}% carregado)</span>
                    )}
                  </label>
                  <select
                    value={filtroStatus}
                    onChange={(e) => { setFiltroStatus(e.target.value); setPagina(1) }}
                    className="w-full px-3 py-2.5 bg-background border border-card rounded-xl text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft focus:border-accent-gold transition-all"
                  >
                    {SITUACOES_PROPOSICAO.map((s) => (<option key={s.value} value={s.value}>{s.label}</option>))}
                  </select>
                </div>
                <div className="w-36">
                  <label className="block text-xs font-medium text-text-secondary mb-1.5">Ano</label>
                  <input
                    type="number"
                    value={filtroAno}
                    onChange={(e) => { setFiltroAno(e.target.value); setPagina(1) }}
                    placeholder="Ex: 2026"
                    min="2000"
                    max="2030"
                    className="w-full px-3 py-2.5 bg-background border border-card rounded-xl text-sm text-text-primary placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft focus:border-accent-gold transition-all"
                  />
                </div>
              </div>

              {hasActiveFilters && (
                <div className="flex items-center gap-2 flex-wrap">
                  {filtroColunaQuadro != null && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 rounded-lg max-w-full">
                      <Table2 className="w-3 h-3 flex-shrink-0" />
                      <span className="truncate">
                        {nomeDeputadoQuadro(filtroDeputadoQuadro ?? 0)} — {labelColunaQuadro(filtroColunaQuadro)}
                      </span>
                      <button
                        type="button"
                        onClick={() => limparFiltroQuadro()}
                        className="ml-0.5 hover:text-status-danger transition-colors flex-shrink-0"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  )}
                  {filtroTipo && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-accent-gold-soft text-accent-gold rounded-lg">
                      <FileText className="w-3 h-3" />
                      {TIPOS_PROPOSICAO.find(t => t.value === filtroTipo)?.label?.split(' — ')[0] || filtroTipo}
                      <button onClick={() => { setFiltroTipo(''); setPagina(1) }} className="ml-0.5 hover:text-status-danger transition-colors"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filtroStatus && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-status-info/15 text-status-info rounded-lg">
                      <GitBranch className="w-3 h-3" />
                      {SITUACOES_PROPOSICAO.find(s => s.value === filtroStatus)?.label || filtroStatus}
                      <button onClick={() => { setFiltroStatus(''); setPagina(1) }} className="ml-0.5 hover:text-status-danger transition-colors"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filtroAno && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-status-warning/15 text-status-warning rounded-lg">
                      <Calendar className="w-3 h-3" />
                      {filtroAno}
                      <button onClick={() => { setFiltroAno(''); setPagina(1) }} className="ml-0.5 hover:text-status-danger transition-colors"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  {filtroKeyword && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-purple-500/15 text-purple-400 rounded-lg">
                      <Search className="w-3 h-3" />
                      &quot;{filtroKeyword}&quot;
                      <button onClick={() => { setFiltroKeyword(''); setSearchInput(''); setPagina(1) }} className="ml-0.5 hover:text-status-danger transition-colors"><X className="w-3 h-3" /></button>
                    </span>
                  )}
                  <button onClick={clearFilters} className="px-3 py-1 text-xs text-status-danger hover:bg-status-danger/10 rounded-lg transition-colors flex items-center gap-1 ml-1">
                    <X className="w-3 h-3" />
                    Limpar todos
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Info banner */}
        {hasActiveFilters && (
          <div className="mb-4 p-3 rounded-xl bg-status-info/10 border border-status-info/20 flex items-center gap-3">
            <Filter className="w-4 h-4 text-status-info flex-shrink-0" />
            <p className="text-xs text-text-secondary">
              <span className="font-semibold text-text-primary">{filteredItems.length}</span> proposição(ões) encontrada(s)
              {' '}de {allProposicoes.length} no total
              {(statusFilterActive || filtroColunaQuadro != null) && !statusesFullyLoaded && (
                <span className="text-accent-gold"> — status ainda carregando, resultado pode mudar</span>
              )}
            </p>
          </div>
        )}

        {/* Lista */}
        <div ref={listaProposicoesRef} className="scroll-mt-28">
        {paginatedItems.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-card p-12 text-center">
            <FileText className="w-12 h-12 text-text-secondary/30 mx-auto mb-4" />
            <p className="text-text-secondary mb-2">
              {hasActiveFilters
                ? 'Nenhuma proposição corresponde aos filtros selecionados.'
                : 'Nenhuma proposição encontrada.'}
            </p>
            {hasActiveFilters && (
              <button onClick={clearFilters} className="text-sm text-accent-gold hover:underline mt-2">
                Limpar filtros
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {paginatedItems.map((prop) => {
              const status = statusMap[prop.id]
              return (
                <div key={prop.id} className="bg-surface rounded-2xl border border-card p-5 hover:shadow-card-hover hover:border-accent-gold/20 transition-all duration-200 group">
                  <div className="flex items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <span className={cn('px-2.5 py-1 text-xs font-bold rounded-lg border', getBadgeColor(prop.siglaTipo))}>
                          {prop.siglaTipo} {prop.numero}/{prop.ano}
                        </span>
                        <span className="text-xs text-text-secondary flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {formatDataApresentacao(prop.dataApresentacao)}
                        </span>
                      </div>
                      <p className="text-sm text-text-primary leading-relaxed line-clamp-3 mb-3">{prop.ementa}</p>

                      {status ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={cn('px-2.5 py-1 text-xs font-medium rounded-lg', getStatusColor(status.descricaoSituacao))}>
                            {status.descricaoSituacao || status.descricaoTramitacao}
                          </span>
                          <span className="text-xs text-text-secondary flex items-center gap-1">
                            <Building2 className="w-3 h-3" />{status.siglaOrgao}
                          </span>
                          <span className="text-xs text-text-secondary/60">{formatDataApresentacao(status.dataHora)}</span>
                        </div>
                      ) : (
                        <div className="h-5 w-48 bg-background rounded-md animate-pulse" />
                      )}
                    </div>
                    <div className="flex flex-col gap-2 flex-shrink-0">
                      <button
                        onClick={() => fetchTramitacoes(prop.id, `${prop.siglaTipo} ${prop.numero}/${prop.ano}`)}
                        className="px-3 py-2 bg-accent-gold text-white rounded-lg text-xs font-medium hover:bg-accent-gold/90 transition-all duration-200 flex items-center gap-1.5"
                      >
                        <GitBranch className="w-3.5 h-3.5" />Tramitação
                      </button>
                      <button
                        onClick={() => fetchAutores(prop.id, `${prop.siglaTipo} ${prop.numero}/${prop.ano}`)}
                        className="px-3 py-2 bg-accent-gold-soft text-accent-gold rounded-lg text-xs font-medium hover:bg-accent-gold hover:text-white transition-all duration-200 flex items-center gap-1.5"
                      >
                        <Users className="w-3.5 h-3.5" />Autores
                      </button>
                      <a
                        href={`https://www.camara.leg.br/propostas-legislativas/${prop.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-2 bg-background text-text-secondary rounded-lg text-xs font-medium hover:text-accent-gold hover:bg-accent-gold-soft border border-card transition-all duration-200 flex items-center gap-1.5"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />Detalhes
                      </a>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {filteredItems.length > 0 && (
          <div className="mt-6 flex items-center justify-between">
            <span className="text-sm text-text-secondary">
              Mostrando {startItem}–{endItem} de {filteredItems.length} proposições
              {hasActiveFilters && <span className="text-text-secondary/60"> (filtrado)</span>}
            </span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1 transition-all border',
                  pagina > 1 ? 'bg-surface border-card text-text-primary hover:bg-accent-gold-soft hover:text-accent-gold hover:border-accent-gold/30' : 'bg-background border-card text-text-secondary/40 cursor-not-allowed'
                )}
              >
                <ChevronLeft className="w-4 h-4" />Anterior
              </button>
              <span className="px-3 py-2 text-sm font-medium text-text-primary">
                {pagina} / {totalPages}
              </span>
              <button
                onClick={() => setPagina((p) => Math.min(totalPages, p + 1))}
                disabled={pagina >= totalPages}
                className={cn(
                  'px-4 py-2 rounded-xl text-sm font-medium flex items-center gap-1 transition-all border',
                  pagina < totalPages ? 'bg-surface border-card text-text-primary hover:bg-accent-gold-soft hover:text-accent-gold hover:border-accent-gold/30' : 'bg-background border-card text-text-secondary/40 cursor-not-allowed'
                )}
              >
                Próxima<ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
        </div>

        {/* Info box */}
        <div className="mt-8 bg-accent-gold-soft/30 rounded-2xl border border-accent-gold/20 p-6">
          <h3 className="text-base font-semibold text-text-primary mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4 text-accent-gold" />Sobre as Proposições
          </h3>
          <p className="text-sm text-text-secondary leading-relaxed">
            As proposições legislativas incluem projetos de lei, requerimentos, indicações e outras iniciativas
            parlamentares. Dados obtidos em tempo real da API de Dados Abertos da Câmara dos Deputados.
            Pelo Regimento da Câmara, todos os que assinam uma proposição são considerados autores (art. 102),
            tanto os proponentes quanto os apoiadores.
          </p>
        </div>
      </div>

      {/* Modal de Autores */}
      {autoresModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setAutoresModalOpen(false)}>
          <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-lg max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-text-primary">Autores da Proposição</h2>
                <p className="text-sm text-text-secondary">{autoresProposicao}</p>
              </div>
              <button onClick={() => setAutoresModalOpen(false)} className="p-2 rounded-lg hover:bg-background transition-colors">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>
            {autoresLoading ? (
              <div className="flex items-center justify-center py-8"><Loader2 className="w-6 h-6 text-accent-gold animate-spin" /></div>
            ) : autores.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-8">Nenhum autor encontrado.</p>
            ) : (
              <div className="space-y-3">
                {autores.map((autor, idx) => (
                  <div key={`${autor.nome}-${idx}`} className="flex items-center gap-3 p-3 rounded-xl bg-background border border-card">
                    <div className="w-9 h-9 rounded-full bg-accent-gold-soft flex items-center justify-center flex-shrink-0"><Users className="w-4 h-4 text-accent-gold" /></div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">{autor.nome}</p>
                      <p className="text-xs text-text-secondary">{autor.tipo}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {autor.proponente === 1 && (<span className="px-2 py-0.5 text-xs font-medium bg-accent-gold-soft text-accent-gold rounded-md">Proponente</span>)}
                      <span className="text-xs text-text-secondary">#{autor.ordemAssinatura}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modal de Tramitações */}
      {tramitacoesModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setTramitacoesModalOpen(false)}>
          <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-2xl max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <div>
                <h2 className="text-lg font-semibold text-text-primary flex items-center gap-2">
                  <GitBranch className="w-5 h-5 text-accent-gold" />Tramitação
                </h2>
                <p className="text-sm text-text-secondary">{tramitacoesProposicao}</p>
              </div>
              <button onClick={() => setTramitacoesModalOpen(false)} className="p-2 rounded-lg hover:bg-background transition-colors">
                <X className="w-5 h-5 text-text-secondary" />
              </button>
            </div>

            {tramitacoesLoading ? (
              <div className="flex items-center justify-center py-12"><Loader2 className="w-6 h-6 text-accent-gold animate-spin" /></div>
            ) : tramitacoes.length === 0 ? (
              <p className="text-sm text-text-secondary text-center py-12">Nenhuma tramitação encontrada.</p>
            ) : (
              <div className="overflow-y-auto flex-1 pr-2 scrollbar-hide">
                <div className="mb-6 p-4 rounded-xl bg-accent-gold-soft/30 border border-accent-gold/20">
                  <p className="text-xs font-medium text-accent-gold mb-1">Status Atual</p>
                  <p className="text-sm font-semibold text-text-primary">
                    {tramitacoes[0].descricaoSituacao || tramitacoes[0].descricaoTramitacao}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-text-secondary">
                    <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{tramitacoes[0].siglaOrgao}</span>
                    <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDataHora(tramitacoes[0].dataHora)}</span>
                    {tramitacoes[0].regime && tramitacoes[0].regime !== '.' && <span>Regime: {tramitacoes[0].regime}</span>}
                  </div>
                </div>

                <div className="relative">
                  <div className="absolute left-[17px] top-0 bottom-0 w-px bg-border-card" />
                  {tramitacoes.map((tram, idx) => {
                    const isFirst = idx === 0
                    const Icon = getTimelineIcon(tram.descricaoTramitacao)
                    return (
                      <div key={`${tram.sequencia}-${idx}`} className="relative pl-12 pb-6 last:pb-0">
                        <div className={cn('absolute left-0 top-0 w-[35px] h-[35px] rounded-full flex items-center justify-center z-10', isFirst ? 'bg-accent-gold text-white shadow-md' : 'bg-background border-2 border-card text-text-secondary')}>
                          <Icon className="w-4 h-4" />
                        </div>
                        <div className={cn('rounded-xl p-4 border transition-all', isFirst ? 'bg-accent-gold-soft/20 border-accent-gold/20' : 'bg-background border-card hover:border-accent-gold/10')}>
                          <div className="flex items-start justify-between gap-2 mb-1">
                            <p className={cn('text-sm font-medium', isFirst ? 'text-accent-gold' : 'text-text-primary')}>{tram.descricaoTramitacao}</p>
                            <span className="text-xs text-text-secondary whitespace-nowrap flex-shrink-0">#{tram.sequencia}</span>
                          </div>
                          <div className="flex items-center gap-3 mb-2 text-xs text-text-secondary flex-wrap">
                            <span className="flex items-center gap-1"><Building2 className="w-3 h-3" />{tram.siglaOrgao}</span>
                            <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{formatDataHora(tram.dataHora)}</span>
                            {tram.descricaoSituacao && (
                              <span className={cn('px-2 py-0.5 rounded-md text-xs font-medium', getStatusColor(tram.descricaoSituacao))}>{tram.descricaoSituacao}</span>
                            )}
                          </div>
                          {tram.despacho && <p className="text-xs text-text-secondary/80 leading-relaxed line-clamp-3">{tram.despacho}</p>}
                          {tram.url && (
                            <a href={tram.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 mt-2 text-xs text-accent-gold hover:underline">
                              <ExternalLink className="w-3 h-3" />Ver documento
                            </a>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
