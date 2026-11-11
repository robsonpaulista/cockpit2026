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
import {
  TseBusca,
  TseCard,
  TseCarregando,
  TseFilterBar,
  TseModal,
  TsePage,
  TsePill,
  TseStatus,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoNeutroClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseCardClass,
  tseControleClass,
  tseLinkAcaoClass,
  tseRotuloCampoClass,
  tseTabela,
} from '@/components/tse/tse-ui'

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

const TIPOS_DESTAQUE = new Set(['PL', 'PLP', 'PEC', 'MPV'])

function getBadgeTom(tipo: string): 'amarelo' | 'neutro' {
  return TIPOS_DESTAQUE.has(tipo) ? 'amarelo' : 'neutro'
}

function formatDataApresentacao(data: string): string {
  if (!data) return ''
  const date = new Date(data)
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
}

function formatDataHora(data: string): string {
  if (!data) return ''
  const date = new Date(data)
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getStatusCor(descricao: string | null): string {
  if (!descricao) return 'var(--tse-muted)'
  const d = descricao.toLowerCase()
  if (d.includes('aprovad') || d.includes('sancionad') || d.includes('transformad')) return 'var(--tse-olive)'
  if (d.includes('arquivad') || d.includes('rejeitad') || d.includes('prejudicad') || d.includes('vetad')) {
    return 'rgb(185 28 28)'
  }
  if (d.includes('senado')) return 'var(--tse-gold-text)'
  if (d.includes('aguardando')) return 'var(--tse-yellow)'
  return 'var(--tse-olive)'
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

const chipFiltroClass =
  'inline-flex max-w-full items-center gap-1.5 rounded-full bg-[var(--tse-yellow-soft)] px-2.5 py-1 text-[12px] font-bold text-[var(--tse-gold-text)]'

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
    return () => {
      cancelled = true
    }
  }, [allProposicoes])

  const filteredItems = useMemo(() => {
    let items = [...allProposicoes]
    if (filtroDeputadoQuadro != null) {
      items = items.filter((p) => p.deputadoAutorId === filtroDeputadoQuadro)
    }
    if (filtroColunaQuadro != null) {
      items = items.filter((p) => proposicaoNaColunaResumo(filtroColunaQuadro, p, statusMap[p.id]))
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

  const handleSearch = () => {
    setFiltroKeyword(searchInput)
    setPagina(1)
  }
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch()
  }

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
    setAutoresModalOpen(true)
    setAutoresLoading(true)
    setAutoresProposicao(titulo)
    setAutores([])
    try {
      const response = await fetch(`/api/proposicoes/${proposicaoId}/autores`)
      if (response.ok) {
        setAutores((await response.json()).dados || [])
      }
    } catch (error) {
      console.error('Erro ao buscar autores:', error)
    } finally {
      setAutoresLoading(false)
    }
  }

  const fetchTramitacoes = async (proposicaoId: number, titulo: string) => {
    setTramitacoesModalOpen(true)
    setTramitacoesLoading(true)
    setTramitacoesProposicao(titulo)
    setTramitacoes([])
    try {
      const response = await fetch(`/api/proposicoes/${proposicaoId}/tramitacoes`)
      if (response.ok) {
        const lista: Tramitacao[] = (await response.json()).dados || []
        setTramitacoes(lista.sort((a, b) => b.sequencia - a.sequencia))
      }
    } catch (error) {
      console.error('Erro ao buscar tramitações:', error)
    } finally {
      setTramitacoesLoading(false)
    }
  }

  const hasActiveFilters = Boolean(
    filtroTipo || filtroAno || filtroKeyword || filtroStatus || filtroColunaQuadro != null
  )
  const activeFilterCount = [
    filtroTipo,
    filtroAno,
    filtroKeyword,
    filtroStatus,
    filtroColunaQuadro != null ? 'quadro' : '',
  ].filter(Boolean).length
  const statusFilterActive = !!filtroStatus
  const progressPercent =
    statusProgress.total > 0 ? Math.round((statusProgress.loaded / statusProgress.total) * 100) : 0

  const startItem = filteredItems.length > 0 ? (pagina - 1) * ITEMS_PER_PAGE + 1 : 0
  const endItem = Math.min(pagina * ITEMS_PER_PAGE, filteredItems.length)

  if (initialLoading) {
    return (
      <TsePage>
        <TseCarregando texto="Carregando todas as proposições…" />
      </TsePage>
    )
  }

  return (
    <TsePage>
      <div className="mb-5">
        <p className="text-xl font-bold uppercase">Proposições Legislativas</p>
        <p className="mt-1 text-[15px] text-[var(--tse-muted)]">
          {allProposicoes.length} proposições — {DEPUTADOS_QUADRO_RESUMO.map((d) => d.nome).join(', ')} — Câmara
          dos Deputados
        </p>
      </div>

      <section className={cn(tseCardClass, 'mb-5 flex flex-wrap items-center gap-4')}>
        <img
          src="https://www.camara.leg.br/internet/deputado/bandep/220697.jpg"
          alt="Dep. Jadyel Alencar"
          className="h-16 w-16 rounded-full object-cover ring-2 ring-[var(--tse-yellow)]"
        />
        <div className="min-w-0 flex-1">
          <h3 className="text-[17px] font-bold">Jadyel Alencar</h3>
          <p className="text-[13px] text-[var(--tse-muted)]">REPUBLICANOS — PI | 57ª Legislatura</p>
        </div>
        <a
          href="https://www.camara.leg.br/deputados/220697"
          target="_blank"
          rel="noopener noreferrer"
          className={cn(tseBotaoCinzaClass, 'gap-1.5')}
        >
          Perfil na Câmara
          <ExternalLink className={tseBotaoIconeClass} />
        </a>
      </section>

      {!statusesFullyLoaded && statusProgress.total > 0 ? (
        <section className={cn(tseCardClass, 'mb-5')}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="flex items-center gap-2 text-[13px] text-[var(--tse-muted)]">
              <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} />
              Carregando status das proposições…
            </p>
            <span className="text-[13px] font-bold tabular-nums">
              {statusProgress.loaded}/{statusProgress.total} ({progressPercent}%)
            </span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--tse-bar)]">
            <div
              className="h-full rounded-full bg-[var(--tse-yellow)] transition-all duration-300"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </section>
      ) : null}

      {deputadosBundles.length > 0 ? (
        <TseCard
          className="mb-5 overflow-hidden p-0"
          titulo={
            <span className="inline-flex items-center gap-2 px-4 pt-4">
              <Table2 className="h-5 w-5 fill-[var(--tse-yellow)] text-[var(--tse-yellow)]" aria-hidden />
              Quadro resumo legislativo
            </span>
          }
        >
          <div className={cn(tseTabela.container, 'mt-3 rounded-none shadow-none')}>
            <table className={cn(tseTabela.table, 'min-w-[880px]')} data-tse-tabela>
              <thead className={tseTabela.thead}>
                <tr>
                  <th className={tseTabela.th}>Deputado</th>
                  {COLUNAS_QUADRO_RESUMO.map((col) => (
                    <th key={col.id} className={cn(tseTabela.th, 'max-w-[120px] text-center leading-tight')}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {deputadosBundles.map((dep) => (
                  <tr
                    key={dep.id}
                    className={cn(tseTabela.tr, dep.destaque && 'bg-[var(--tse-yellow-soft)]')}
                  >
                    <td className={cn(tseTabela.td, 'font-bold')}>{dep.nome}</td>
                    {COLUNAS_QUADRO_RESUMO.map((col) => {
                      const n = contagemQuadro[dep.id]?.[col.id] ?? 0
                      const loading = n < 0
                      return (
                        <td key={col.id} className={cn(tseTabela.td, 'text-center')}>
                          <button
                            type="button"
                            onClick={() => handleCelulaQuadro(dep.id, col.id)}
                            disabled={loading}
                            title={`Ver lista: ${col.label}`}
                            className={cn(
                              'min-w-[2.25rem] rounded-md px-2 py-1 text-[13px] font-bold tabular-nums transition-colors',
                              loading
                                ? 'cursor-wait text-[var(--tse-muted)]'
                                : 'text-[var(--tse-olive)] hover:bg-[var(--tse-yellow-soft)] focus:outline-none focus:ring-2 focus:ring-[var(--tse-yellow)]/40',
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
          <div className="space-y-1 border-t border-[#EEEEEE] bg-[var(--tse-bar)] px-4 py-3 text-[12px] leading-relaxed text-[var(--tse-muted)]">
            <p>
              <span className="font-bold text-[var(--tse-text)]">57ª Legislatura:</span> apenas proposições
              apresentadas a partir de fevereiro de 2023. Clique em um número para filtrar a lista abaixo (outros
              filtros são limpos para bater com o total da célula).
            </p>
            <p>
              Colunas por status usam a última tramitação da API. Mostram “…” até o carregamento terminar.
            </p>
          </div>
        </TseCard>
      ) : null}

      <div className="mb-5">
        <TseFilterBar>
          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-3" onKeyDown={handleKeyDown}>
            <TseBusca
              value={searchInput}
              onChange={setSearchInput}
              placeholder="Buscar por palavra-chave na ementa…"
              className="min-w-[220px] flex-1"
            />
            <button type="button" onClick={handleSearch} className={tseBotaoPrimarioClass}>
              <Search className="h-4 w-4" />
              Buscar
            </button>
            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(showFilters ? tseBotaoPrimarioClass : tseBotaoCinzaClass, 'gap-1.5')}
            >
              <Filter className={showFilters ? 'h-4 w-4' : tseBotaoIconeClass} />
              Filtros
              {activeFilterCount > 0 ? (
                <span className="inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--tse-yellow)] px-1 text-[10px] font-black text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </button>
          </div>
        </TseFilterBar>

        {showFilters ? (
          <section className={cn(tseCardClass, 'mt-3')}>
            <div className="flex flex-wrap items-start gap-4">
              <div className="min-w-[200px] flex-1">
                <label className={tseRotuloCampoClass}>Tipo de proposição</label>
                <select
                  value={filtroTipo}
                  onChange={(e) => {
                    setFiltroTipo(e.target.value)
                    setPagina(1)
                  }}
                  className={cn(tseCampoClass, 'h-10')}
                >
                  {TIPOS_PROPOSICAO.map((t) => (
                    <option key={t.value} value={t.value}>
                      {t.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="min-w-[200px] flex-1">
                <label className={tseRotuloCampoClass}>
                  Status / situação
                  {!statusesFullyLoaded && statusProgress.total > 0 ? (
                    <span className="ml-2 font-semibold normal-case tracking-normal text-[var(--tse-gold-text)]">
                      ({progressPercent}% carregado)
                    </span>
                  ) : null}
                </label>
                <select
                  value={filtroStatus}
                  onChange={(e) => {
                    setFiltroStatus(e.target.value)
                    setPagina(1)
                  }}
                  className={cn(tseCampoClass, 'h-10')}
                >
                  {SITUACOES_PROPOSICAO.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="w-36">
                <label className={tseRotuloCampoClass}>Ano</label>
                <input
                  type="number"
                  value={filtroAno}
                  onChange={(e) => {
                    setFiltroAno(e.target.value)
                    setPagina(1)
                  }}
                  placeholder="Ex: 2026"
                  min="2000"
                  max="2030"
                  className={cn(tseCampoClass, 'h-10')}
                />
              </div>
            </div>

            {hasActiveFilters ? (
              <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-[#EEEEEE] pt-4">
                {filtroColunaQuadro != null ? (
                  <span className={chipFiltroClass}>
                    <Table2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">
                      {nomeDeputadoQuadro(filtroDeputadoQuadro ?? 0)} — {labelColunaQuadro(filtroColunaQuadro)}
                    </span>
                    <button type="button" onClick={() => limparFiltroQuadro()} className="shrink-0 hover:text-[var(--tse-text)]">
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {filtroTipo ? (
                  <span className={chipFiltroClass}>
                    <FileText className="h-3 w-3" />
                    {TIPOS_PROPOSICAO.find((t) => t.value === filtroTipo)?.label?.split(' — ')[0] || filtroTipo}
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroTipo('')
                        setPagina(1)
                      }}
                      className="hover:text-[var(--tse-text)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {filtroStatus ? (
                  <span className={chipFiltroClass}>
                    <GitBranch className="h-3 w-3" />
                    {SITUACOES_PROPOSICAO.find((s) => s.value === filtroStatus)?.label || filtroStatus}
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroStatus('')
                        setPagina(1)
                      }}
                      className="hover:text-[var(--tse-text)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {filtroAno ? (
                  <span className={chipFiltroClass}>
                    <Calendar className="h-3 w-3" />
                    {filtroAno}
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroAno('')
                        setPagina(1)
                      }}
                      className="hover:text-[var(--tse-text)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                {filtroKeyword ? (
                  <span className={chipFiltroClass}>
                    <Search className="h-3 w-3" />
                    &quot;{filtroKeyword}&quot;
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroKeyword('')
                        setSearchInput('')
                        setPagina(1)
                      }}
                      className="hover:text-[var(--tse-text)]"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ) : null}
                <button type="button" onClick={clearFilters} className={tseLinkAcaoClass}>
                  Limpar todos
                </button>
              </div>
            ) : null}
          </section>
        ) : null}
      </div>

      {hasActiveFilters ? (
        <div className="mb-4 flex items-center gap-3 rounded-2xl bg-[var(--tse-yellow-soft)] px-4 py-3">
          <Filter className="h-4 w-4 shrink-0 text-[var(--tse-gold-text)]" />
          <p className="text-[13px] text-[var(--tse-text)]">
            <span className="font-bold">{filteredItems.length}</span> proposição(ões) encontrada(s) de{' '}
            {allProposicoes.length} no total
            {(statusFilterActive || filtroColunaQuadro != null) && !statusesFullyLoaded ? (
              <span className="text-[var(--tse-gold-text)]"> — status ainda carregando, resultado pode mudar</span>
            ) : null}
          </p>
        </div>
      ) : null}

      <div ref={listaProposicoesRef} className="scroll-mt-28">
        {paginatedItems.length === 0 ? (
          <TseVazio>
            {hasActiveFilters ? (
              <>
                Nenhuma proposição corresponde aos filtros selecionados.{' '}
                <button type="button" onClick={clearFilters} className={tseLinkAcaoClass}>
                  Limpar filtros
                </button>
              </>
            ) : (
              'Nenhuma proposição encontrada.'
            )}
          </TseVazio>
        ) : (
          <div className="space-y-3">
            {paginatedItems.map((prop) => {
              const status = statusMap[prop.id]
              return (
                <article key={prop.id} className={cn(tseCardClass, 'transition-shadow hover:shadow-md')}>
                  <div className="flex items-start gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="mb-2 flex flex-wrap items-center gap-3">
                        <TsePill tom={getBadgeTom(prop.siglaTipo)}>
                          {prop.siglaTipo} {prop.numero}/{prop.ano}
                        </TsePill>
                        <span className="inline-flex items-center gap-1 text-[12px] text-[var(--tse-muted)]">
                          <Calendar className="h-3 w-3" />
                          {formatDataApresentacao(prop.dataApresentacao)}
                        </span>
                      </div>
                      <p className="mb-3 line-clamp-3 text-[14px] leading-relaxed">{prop.ementa}</p>

                      {status ? (
                        <div className="flex flex-wrap items-center gap-2">
                          <TseStatus cor={getStatusCor(status.descricaoSituacao)}>
                            {status.descricaoSituacao || status.descricaoTramitacao}
                          </TseStatus>
                          <span className="inline-flex items-center gap-1 text-[12px] text-[var(--tse-muted)]">
                            <Building2 className="h-3 w-3" />
                            {status.siglaOrgao}
                          </span>
                          <span className="text-[12px] text-[var(--tse-muted)]">
                            {formatDataApresentacao(status.dataHora)}
                          </span>
                        </div>
                      ) : (
                        <div className="h-5 w-48 animate-pulse rounded-md bg-[var(--tse-bar)]" />
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-2">
                      <button
                        type="button"
                        onClick={() => fetchTramitacoes(prop.id, `${prop.siglaTipo} ${prop.numero}/${prop.ano}`)}
                        className={cn(tseBotaoPrimarioClass, 'gap-1.5')}
                      >
                        <GitBranch className="h-3.5 w-3.5" />
                        Tramitação
                      </button>
                      <button
                        type="button"
                        onClick={() => fetchAutores(prop.id, `${prop.siglaTipo} ${prop.numero}/${prop.ano}`)}
                        className={cn(tseBotaoCinzaClass, 'gap-1.5')}
                      >
                        <Users className="h-3.5 w-3.5" />
                        Autores
                      </button>
                      <a
                        href={`https://www.camara.leg.br/propostas-legislativas/${prop.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={cn(tseBotaoNeutroClass, 'justify-center gap-1.5')}
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                        Detalhes
                      </a>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>
        )}

        {filteredItems.length > 0 ? (
          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            <span className="text-[13px] text-[var(--tse-muted)]">
              Mostrando {startItem}–{endItem} de {filteredItems.length} proposições
              {hasActiveFilters ? <span> (filtrado)</span> : null}
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina <= 1}
                className={cn(tseBotaoCinzaClass, 'disabled:cursor-not-allowed disabled:opacity-40')}
              >
                <ChevronLeft className="h-4 w-4" />
                Anterior
              </button>
              <span className={cn(tseControleClass, 'inline-flex items-center font-bold')}>
                {pagina} / {totalPages || 1}
              </span>
              <button
                type="button"
                onClick={() => setPagina((p) => Math.min(totalPages, p + 1))}
                disabled={pagina >= totalPages}
                className={cn(tseBotaoCinzaClass, 'disabled:cursor-not-allowed disabled:opacity-40')}
              >
                Próxima
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}
      </div>

      <TseCard
        className="mt-8"
        titulo={
          <span className="inline-flex items-center gap-2">
            <FileText className="h-5 w-5 fill-[var(--tse-yellow)] text-[var(--tse-yellow)]" aria-hidden />
            Sobre as proposições
          </span>
        }
      >
        <p className="mt-2 text-[14px] leading-relaxed text-[var(--tse-muted)]">
          As proposições legislativas incluem projetos de lei, requerimentos, indicações e outras iniciativas
          parlamentares. Dados obtidos em tempo real da API de Dados Abertos da Câmara dos Deputados. Pelo Regimento
          da Câmara, todos os que assinam uma proposição são considerados autores (art. 102), tanto os proponentes
          quanto os apoiadores.
        </p>
      </TseCard>

      {autoresModalOpen ? (
        <TseModal
          id="proposicoes-autores"
          titulo="Autores da proposição"
          subtitulo={autoresProposicao}
          onClose={() => setAutoresModalOpen(false)}
          largura="max-w-lg"
        >
          {autoresLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className={cn(tseBotaoIconeClass, 'h-6 w-6 animate-spin')} />
            </div>
          ) : autores.length === 0 ? (
            <p className="py-8 text-center text-[13px] text-[var(--tse-muted)]">Nenhum autor encontrado.</p>
          ) : (
            <div className="space-y-2">
              {autores.map((autor, idx) => (
                <div key={`${autor.nome}-${idx}`} className={cn(tseCardClass, 'flex items-center gap-3 p-3')}>
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--tse-yellow-soft)]">
                    <Users className="h-4 w-4 text-[var(--tse-gold-text)]" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-bold">{autor.nome}</p>
                    <p className="text-[12px] text-[var(--tse-muted)]">{autor.tipo}</p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {autor.proponente === 1 ? <TsePill tom="amarelo">Proponente</TsePill> : null}
                    <span className="text-[12px] text-[var(--tse-muted)]">#{autor.ordemAssinatura}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TseModal>
      ) : null}

      {tramitacoesModalOpen ? (
        <TseModal
          id="proposicoes-tramitacoes"
          titulo={
            <span className="inline-flex items-center gap-2">
              <GitBranch className="h-5 w-5 text-[var(--tse-yellow)]" aria-hidden />
              Tramitação
            </span>
          }
          subtitulo={tramitacoesProposicao}
          onClose={() => setTramitacoesModalOpen(false)}
          largura="max-w-2xl"
        >
          {tramitacoesLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className={cn(tseBotaoIconeClass, 'h-6 w-6 animate-spin')} />
            </div>
          ) : tramitacoes.length === 0 ? (
            <p className="py-12 text-center text-[13px] text-[var(--tse-muted)]">Nenhuma tramitação encontrada.</p>
          ) : (
            <div className="space-y-4">
              <div className="rounded-xl border border-[var(--tse-border)] bg-[var(--tse-yellow-soft)] p-4">
                <p className="mb-1 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-gold-text)]">
                  Status atual
                </p>
                <p className="text-[14px] font-bold">
                  {tramitacoes[0].descricaoSituacao || tramitacoes[0].descricaoTramitacao}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-3 text-[12px] text-[var(--tse-muted)]">
                  <span className="inline-flex items-center gap-1">
                    <Building2 className="h-3 w-3" />
                    {tramitacoes[0].siglaOrgao}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {formatDataHora(tramitacoes[0].dataHora)}
                  </span>
                  {tramitacoes[0].regime && tramitacoes[0].regime !== '.' ? (
                    <span>Regime: {tramitacoes[0].regime}</span>
                  ) : null}
                </div>
              </div>

              <div className="relative">
                <div className="absolute bottom-0 left-[17px] top-0 w-px bg-[var(--tse-border)]" />
                {tramitacoes.map((tram, idx) => {
                  const isFirst = idx === 0
                  const Icon = getTimelineIcon(tram.descricaoTramitacao)
                  return (
                    <div key={`${tram.sequencia}-${idx}`} className="relative pb-6 pl-12 last:pb-0">
                      <div
                        className={cn(
                          'absolute left-0 top-0 z-10 flex h-[35px] w-[35px] items-center justify-center rounded-full',
                          isFirst
                            ? 'bg-[var(--tse-yellow)] text-white shadow-sm'
                            : 'border-2 border-[var(--tse-border)] bg-white text-[var(--tse-muted)]',
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <div
                        className={cn(
                          'rounded-xl border p-4 transition-colors',
                          isFirst
                            ? 'border-[var(--tse-yellow)]/40 bg-[var(--tse-yellow-soft)]/60'
                            : 'border-[var(--tse-border)] bg-white hover:border-[var(--tse-yellow)]/30',
                        )}
                      >
                        <div className="mb-1 flex items-start justify-between gap-2">
                          <p
                            className={cn(
                              'text-[13px] font-bold',
                              isFirst ? 'text-[var(--tse-gold-text)]' : 'text-[var(--tse-text)]',
                            )}
                          >
                            {tram.descricaoTramitacao}
                          </p>
                          <span className="shrink-0 whitespace-nowrap text-[12px] text-[var(--tse-muted)]">
                            #{tram.sequencia}
                          </span>
                        </div>
                        <div className="mb-2 flex flex-wrap items-center gap-3 text-[12px] text-[var(--tse-muted)]">
                          <span className="inline-flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {tram.siglaOrgao}
                          </span>
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {formatDataHora(tram.dataHora)}
                          </span>
                          {tram.descricaoSituacao ? (
                            <TseStatus cor={getStatusCor(tram.descricaoSituacao)}>{tram.descricaoSituacao}</TseStatus>
                          ) : null}
                        </div>
                        {tram.despacho ? (
                          <p className="line-clamp-3 text-[12px] leading-relaxed text-[var(--tse-muted)]">
                            {tram.despacho}
                          </p>
                        ) : null}
                        {tram.url ? (
                          <a
                            href={tram.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={cn(tseLinkAcaoClass, 'mt-2 inline-flex items-center gap-1')}
                          >
                            <ExternalLink className="h-3 w-3" />
                            Ver documento
                          </a>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </TseModal>
      ) : null}
    </TsePage>
  )
}
