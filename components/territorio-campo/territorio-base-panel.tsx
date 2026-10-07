'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Briefcase, Check, ChevronDown, Download, Network, RefreshCw } from 'lucide-react'
import { TerritorioBaseExportModal } from '@/components/territorio-campo/territorio-base-export-modal'
import { MindMapModal } from '@/components/mind-map-modal'
import { CityDemandsModal } from '@/components/city-demands-modal'
import { ExecutiveBriefingModal } from '@/components/executive-briefing-modal'
import { VoteInvestmentBalanceModal } from '@/components/vote-investment-balance-modal'
import { MapaVotoCruzado } from '@/components/mapa-voto-cruzado'
import { cn } from '@/lib/utils'
import type { AIAgentPageContext } from '@/components/ai-agent'
import { useRegisterJarvisHostProps } from '@/contexts/jarvis-host-props-context'
import { resolverColunaDepEstadualLideranca, extrairDepEstadualDeLideranca } from '@/lib/planilha-dep-estadual-lideranca'
import { deveIncluirLiderancaPlanilha } from '@/lib/territorio-lideranca-atual'
import {
  compareTerritorioNumber,
  compareTerritorioText,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'
import { TERRITORIO_BASE_VOTACAO_JADYEL_2026 } from '@/lib/territorio-base-records'
import {
  corNivelCargo,
  TerritorioCidadesTabela,
  type CidadeBaseLinha,
  type LiderancaBase,
  type SortCidadeCol,
} from '@/components/territorio-campo/territorio-cidades-tabela'
import { useTerritorioMunicipio } from '@/components/territorio-campo/territorio-municipio-context'
import {
  TseBarraRotulo,
  TseBusca,
  TseCard,
  TseCarregando,
  TseCarregarMais,
  TseDado,
  TseDados,
  TseErro,
  TseListaFiltro,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
  tseControleClass,
  tseLinkAcaoClass,
} from '@/components/tse/tse-ui'

type Lideranca = LiderancaBase

type CenarioVotos = 'revisao_final' | 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'
type FaixaVotos = '' | 'ate-100' | 'ate-300' | 'ate-500' | 'acima-500' | 'acima-1000'

/** Rótulo fixo na UI — o cenário só altera a coluna de votos, não o texto exibido. */
const LABEL_EXPECTATIVA_2026 = 'Expectativa 2026'
const LABEL_VOTACAO_JADYEL_2026 = 'Jadyel 2026'
const TOTAL_MUNICIPIOS_PI = 224
const PAGE_SIZE = 30

const FAIXAS: { id: Exclude<FaixaVotos, ''>; label: string; cabe: (v: number) => boolean }[] = [
  { id: 'ate-100', label: 'Até 100', cabe: (v) => v <= 100 },
  { id: 'ate-300', label: 'Até 300', cabe: (v) => v <= 300 },
  { id: 'ate-500', label: 'Até 500', cabe: (v) => v <= 500 },
  { id: 'acima-500', label: 'Acima de 500', cabe: (v) => v > 500 },
  { id: 'acima-1000', label: 'Acima de 1000', cabe: (v) => v > 1000 },
]

const fmt = (n: number): string => Math.round(n).toLocaleString('pt-BR')
const fmtPct = (n: number): string => `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`

/** O valor é o total do município repetido em cada liderança: lê de uma linha, não soma. */
function votacaoJadyelCidade(liderancasCidade: Lideranca[]): number | null {
  for (const l of liderancasCidade) {
    const v = l[TERRITORIO_BASE_VOTACAO_JADYEL_2026]
    if (typeof v === 'number' && Number.isFinite(v)) return v
  }
  return null
}

function labelCenarioDados(cenario: CenarioVotos): string {
  if (cenario === 'revisao_final') return 'Revisão Final'
  if (cenario === 'promessa_lideranca') return 'Prometido'
  if (cenario === 'legado_anterior') return 'Expectativa'
  return 'Aferido'
}

/** Aceita "1.234", "1,234", "4,50" etc. (planilhas com separadores mistos). */
function normalizeNumber(value: unknown): number {
  if (typeof value === 'number') return value
  const str = String(value ?? '').trim()
  if (!str) return 0

  let cleaned = str.replace(/[^\d.,]/g, '')
  if (cleaned.includes(',') && cleaned.includes('.')) {
    cleaned =
      cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')
        ? cleaned.replace(/\./g, '').replace(',', '.')
        : cleaned.replace(/,/g, '')
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    cleaned = parts.length === 2 && parts[1].length <= 2 ? cleaned.replace(',', '.') : cleaned.replace(/,/g, '')
  }
  const numValue = parseFloat(cleaned)
  return isNaN(numValue) ? 0 : numValue
}

const texto = (v: unknown): string => String(v ?? '').trim()

export function TerritorioBasePanel() {
  const { municipio, noMunicipio } = useTerritorioMunicipio()
  const [liderancas, setLiderancas] = useState<Lideranca[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [headers, setHeaders] = useState<string[]>([])
  const [expandedCities, setExpandedCities] = useState<Set<string>>(new Set())
  const [filtroNome, setFiltroNome] = useState<string>('')
  const [filtroCargo, setFiltroCargo] = useState<string>('')
  const [filtroDepEstadual, setFiltroDepEstadual] = useState<string[]>([])
  const [filtroFaixaVotos, setFiltroFaixaVotos] = useState<FaixaVotos>('')
  const [showDepDropdown, setShowDepDropdown] = useState<boolean>(false)
  const [showMapaVotoCruzado, setShowMapaVotoCruzado] = useState<boolean>(true)
  const [showMindMap, setShowMindMap] = useState<boolean>(false)
  const [showExportModal, setShowExportModal] = useState<boolean>(false)
  const [candidatoPadrao, setCandidatoPadrao] = useState<string>('')
  const [baseCarregada, setBaseCarregada] = useState<boolean>(false)
  const [showCityDemands, setShowCityDemands] = useState<boolean>(false)
  const [selectedCityForDemands, setSelectedCityForDemands] = useState<string>('')
  const [showExecutiveBriefing, setShowExecutiveBriefing] = useState<boolean>(false)
  const [showVoteInvestmentBalance, setShowVoteInvestmentBalance] = useState<boolean>(false)
  const [selectedCityForBriefing, setSelectedCityForBriefing] = useState<string>('')
  const [selectedCityLiderancas, setSelectedCityLiderancas] = useState<Lideranca[]>([])
  const [cenarioVotos, setCenarioVotos] = useState<CenarioVotos>('revisao_final')
  const [sortCol, setSortCol] = useState<SortCidadeCol>('expectativa')
  const [sortAsc, setSortAsc] = useState<boolean>(false)
  const [limite, setLimite] = useState<number>(PAGE_SIZE)
  const depDropdownButtonRef = useRef<HTMLButtonElement | null>(null)
  const depDropdownMenuRef = useRef<HTMLDivElement | null>(null)
  const mapaVotoCruzadoRef = useRef<HTMLDivElement | null>(null)
  const [depMenuPos, setDepMenuPos] = useState<{ top: number; left: number; width: number } | null>(null)

  const fetchBaseFromDb = useCallback(async (opts?: { refresh?: boolean }) => {
    setLoading(true)
    setError(null)

    try {
      const qs = opts?.refresh ? '?refresh=1' : ''
      const response = await fetch(`/api/territorio/base${qs}`, { cache: 'no-store' })
      const data = (await response.json()) as {
        error?: string
        records?: Lideranca[]
        headers?: string[]
      }

      if (!response.ok) {
        setError(data.error || 'Erro ao buscar base territorial')
        setBaseCarregada(false)
        return
      }

      setLiderancas(data.records || [])
      setHeaders(data.headers || [])
      setBaseCarregada(true)
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Erro ao conectar com a base territorial'
      setError(message)
      setBaseCarregada(false)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void fetchBaseFromDb()
    const savedCandidato = localStorage.getItem('candidato_padrao')
    if (savedCandidato) setCandidatoPadrao(savedCandidato)
  }, [fetchBaseFromDb])

  const updateDepMenuPosition = useCallback(() => {
    const el = depDropdownButtonRef.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const vw = window.innerWidth
    const width = Math.max(r.width, 224)
    let left = r.left
    if (left + width > vw - 8) left = Math.max(8, vw - width - 8)
    setDepMenuPos({ top: r.bottom + 4, left, width })
  }, [])

  useLayoutEffect(() => {
    if (!showDepDropdown) {
      setDepMenuPos(null)
      return
    }
    updateDepMenuPosition()
    window.addEventListener('scroll', updateDepMenuPosition, true)
    window.addEventListener('resize', updateDepMenuPosition)
    return () => {
      window.removeEventListener('scroll', updateDepMenuPosition, true)
      window.removeEventListener('resize', updateDepMenuPosition)
    }
  }, [showDepDropdown, updateDepMenuPosition])

  useEffect(() => {
    if (!showDepDropdown) return

    const handleClickOutside = (event: MouseEvent) => {
      const t = event.target as Node
      if (depDropdownButtonRef.current?.contains(t)) return
      if (depDropdownMenuRef.current?.contains(t)) return
      setShowDepDropdown(false)
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowDepDropdown(false)
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)
    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [showDepDropdown])

  const liderancaAtualCol = headers.find((h) => /liderança atual|lideranca atual|atual\?/i.test(h))
  const expectativaJadyelCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return (
      /expectativa.*jadyel.*2026/i.test(normalized) ||
      /expectativa.*2026.*jadyel/i.test(normalized) ||
      /aferid[oa].*2026/i.test(normalized)
    )
  })
  const promessaLiderancaCol = headers.find((h) => /promessa.*lideran[cç]a.*2026/i.test(h))
  const expectativaLegadoCol = headers.find((h) => {
    const normalized = h.toLowerCase().trim()
    return (
      /^expectativa\s+de\s+votos\s+2026$/i.test(h) ||
      (/expectativa.*votos.*2026/i.test(h) &&
        !/jadyel/i.test(normalized) &&
        !/promessa/i.test(normalized) &&
        !/aferid[oa]/i.test(normalized))
    )
  })
  const revisaoFinalCol = headers.find((h) => /revis[aã]o\s+final/i.test(h))

  const votosReferenciaCol = (() => {
    if (cenarioVotos === 'revisao_final') {
      return revisaoFinalCol || expectativaLegadoCol || expectativaJadyelCol || promessaLiderancaCol
    }
    if (cenarioVotos === 'promessa_lideranca') {
      return promessaLiderancaCol || expectativaJadyelCol || expectativaLegadoCol
    }
    if (cenarioVotos === 'legado_anterior') {
      return expectativaLegadoCol || expectativaJadyelCol || promessaLiderancaCol
    }
    return expectativaJadyelCol || expectativaLegadoCol || promessaLiderancaCol
  })()

  const labelCenarioDadosAtivo = labelCenarioDados(cenarioVotos)

  useEffect(() => {
    if (headers.length === 0) return
    if (cenarioVotos === 'revisao_final' && !revisaoFinalCol) {
      if (expectativaLegadoCol) setCenarioVotos('legado_anterior')
      else if (expectativaJadyelCol) setCenarioVotos('aferido_jadyel')
      return
    }
    if (cenarioVotos === 'promessa_lideranca' && !promessaLiderancaCol) {
      if (expectativaJadyelCol) setCenarioVotos('aferido_jadyel')
      else if (expectativaLegadoCol) setCenarioVotos('legado_anterior')
      return
    }
    if (cenarioVotos === 'aferido_jadyel' && !expectativaJadyelCol) {
      if (expectativaLegadoCol) setCenarioVotos('legado_anterior')
      else if (promessaLiderancaCol) setCenarioVotos('promessa_lideranca')
      return
    }
    if (cenarioVotos === 'legado_anterior' && !expectativaLegadoCol) {
      if (expectativaJadyelCol) setCenarioVotos('aferido_jadyel')
      else if (promessaLiderancaCol) setCenarioVotos('promessa_lideranca')
    }
  }, [headers.length, cenarioVotos, revisaoFinalCol, promessaLiderancaCol, expectativaJadyelCol, expectativaLegadoCol])

  const nomeCol = headers.find((h) => /nome|name|lider|pessoa/i.test(h)) || headers[0] || 'Coluna 1'
  const cidadeCol = headers.find((h) => /cidade|city|município|municipio/i.test(h)) || headers[1] || 'Coluna 2'
  const cargoCol = (() => {
    const cargo2024 = headers.find((h) => /cargo.*2024/i.test(h))
    if (cargo2024) return cargo2024
    return headers.find((h) => {
      const normalized = h.toLowerCase().trim()
      return (
        /cargo.*atual|cargo/i.test(normalized) &&
        !/cargo.*2020/i.test(normalized) &&
        !/expectativa|votos|telefone|email|whatsapp|contato|endereco|endereço/i.test(normalized)
      )
    })
  })()
  const depEstadualCol = resolverColunaDepEstadualLideranca(headers)

  const cidadeDe = (l: Lideranca): string => texto(l[cidadeCol]) || 'Sem cidade'
  const votosDe = (l: Lideranca): number => (votosReferenciaCol ? normalizeNumber(l[votosReferenciaCol]) : 0)

  const extrairDepEstadual = (lider: Lideranca): string =>
    extrairDepEstadualDeLideranca({
      nome: texto(lider[nomeCol]),
      cargo: cargoCol ? texto(lider[cargoCol]) : '',
      depEstadual: depEstadualCol ? texto(lider[depEstadualCol]) : '',
    })

  const deputadosEstaduaisUnicos = Array.from(
    new Set(liderancas.map((l) => extrairDepEstadual(l)).filter((n) => n.length > 0)),
  ).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const toggleDepEstadual = (dep: string) => {
    setFiltroDepEstadual((prev) => (prev.includes(dep) ? prev.filter((item) => item !== dep) : [...prev, dep]))
  }

  const cargosUnicos = cargoCol
    ? Array.from(new Set(liderancas.map((l) => texto(l[cargoCol])).filter((c) => c.length > 0))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      )
    : []

  // Exclui LIDERANCA ATUAL = N/Não; inclui SIM ou com votos no cenário.
  const liderancasFiltradas = (() => {
    if (liderancas.length === 0) return []

    let filtradas = liderancas.filter(
      (l) =>
        deveIncluirLiderancaPlanilha(l, { liderancaAtualCol, colunasVotos: [votosReferenciaCol] }) &&
        noMunicipio(texto(l[cidadeCol])),
    )

    if (filtroNome) {
      const termo = filtroNome.toLowerCase()
      filtradas = filtradas.filter((l) => texto(l[nomeCol]).toLowerCase().includes(termo))
    }
    if (filtroCargo && cargoCol) {
      filtradas = filtradas.filter((l) => texto(l[cargoCol]) === filtroCargo)
    }
    if (filtroDepEstadual.length > 0) {
      filtradas = filtradas.filter((l) => filtroDepEstadual.includes(extrairDepEstadual(l)))
    }

    // Faixa considera o total de votos de cada cidade.
    const faixa = FAIXAS.find((f) => f.id === filtroFaixaVotos)
    if (faixa && votosReferenciaCol) {
      const votosPorCidade = new Map<string, number>()
      for (const l of filtradas) votosPorCidade.set(cidadeDe(l), (votosPorCidade.get(cidadeDe(l)) ?? 0) + votosDe(l))
      filtradas = filtradas.filter((l) => faixa.cabe(votosPorCidade.get(cidadeDe(l)) ?? 0))
    }

    return filtradas
  })()

  const mapaVotoCruzado = (() => {
    const porCidade: Record<
      string,
      { votos: number; liderancas: number; porDeputado: Record<string, { votos: number; liderancas: number }> }
    > = {}

    for (const lider of liderancasFiltradas) {
      const cidade = cidadeDe(lider)
      const dep = extrairDepEstadual(lider) || 'Não informado'
      const votos = votosDe(lider)
      porCidade[cidade] ??= { votos: 0, liderancas: 0, porDeputado: {} }
      porCidade[cidade].votos += votos
      porCidade[cidade].liderancas += 1
      porCidade[cidade].porDeputado[dep] ??= { votos: 0, liderancas: 0 }
      porCidade[cidade].porDeputado[dep].votos += votos
      porCidade[cidade].porDeputado[dep].liderancas += 1
    }

    return Object.entries(porCidade)
      .map(([cidade, info]) => {
        const rankingDeputados = Object.entries(info.porDeputado)
          .map(([nome, dados]) => ({ nome, votos: Math.round(dados.votos), liderancas: dados.liderancas }))
          .sort((a, b) => b.votos - a.votos || b.liderancas - a.liderancas)
        return {
          cidade,
          votos: Math.round(info.votos),
          liderancas: info.liderancas,
          deputadoDominante: rankingDeputados[0]?.nome || 'Não informado',
          rankingDeputados: rankingDeputados.slice(0, 5),
        }
      })
      .sort((a, b) => b.votos - a.votos)
  })()

  const totaisPorCargo = (() => {
    if (!cargoCol) return []
    const totais = new Map<string, number>()
    for (const l of liderancasFiltradas) {
      const cargo = texto(l[cargoCol])
      if (cargo) totais.set(cargo, (totais.get(cargo) ?? 0) + 1)
    }
    return [...totais.entries()].map(([cargo, total]) => ({ cargo, total })).sort((a, b) => b.total - a.total)
  })()

  const liderancasPorCidadeMap: Record<string, Lideranca[]> = {}
  for (const l of liderancasFiltradas) (liderancasPorCidadeMap[cidadeDe(l)] ??= []).push(l)

  const linhasCidades: CidadeBaseLinha[] = Object.entries(liderancasPorCidadeMap).map(([cidade, lista]) => ({
    cidade,
    liderancas: lista,
    expectativa: lista.reduce((s, l) => s + votosDe(l), 0),
    votacao2026: votacaoJadyelCidade(lista),
  }))

  const linhasOrdenadas = [...linhasCidades].sort((a, b) => {
    const porNome = compareTerritorioText(a.cidade, b.cidade, true)
    if (sortCol === 'cidade') return compareTerritorioText(a.cidade, b.cidade, sortAsc)
    if (sortCol === 'liderancas') {
      return compareTerritorioNumber(a.liderancas.length, b.liderancas.length, sortAsc) || porNome
    }
    if (sortCol === 'votacao2026') {
      return compareTerritorioNumber(a.votacao2026 ?? -1, b.votacao2026 ?? -1, sortAsc) || porNome
    }
    return compareTerritorioNumber(a.expectativa, b.expectativa, sortAsc) || porNome
  })

  const rankCidades = new Map(
    [...linhasCidades]
      .sort((a, b) => b.expectativa - a.expectativa || compareTerritorioText(a.cidade, b.cidade, true))
      .map((l, i) => [l.cidade, i + 1]),
  )

  const totalExpectativa = linhasCidades.reduce((s, l) => s + l.expectativa, 0)
  const totalVotacao2026 = linhasCidades.reduce((s, l) => s + (l.votacao2026 ?? 0), 0)
  const maxExpectativa = linhasCidades.reduce((m, l) => Math.max(m, l.expectativa), 0)
  const maxVotacao = linhasCidades.reduce((m, l) => Math.max(m, l.votacao2026 ?? 0), 0)
  const maiorBase = linhasCidades.find((l) => rankCidades.get(l.cidade) === 1) ?? null
  const cidadesUnicasCount = linhasCidades.length
  const universoMunicipios = municipio ? 1 : TOTAL_MUNICIPIOS_PI
  const pctCobertura = (Math.min(cidadesUnicasCount, universoMunicipios) / universoMunicipios) * 100
  const todasExpandidas = expandedCities.size >= cidadesUnicasCount && cidadesUnicasCount > 0
  const hasFiltrosAtivos =
    Boolean(filtroNome) || Boolean(filtroCargo) || filtroDepEstadual.length > 0 || Boolean(filtroFaixaVotos)
  const escopoLabel = municipio ?? 'Piauí'

  // Com um município escolhido no topo, abre direto as lideranças dele.
  const cidadesVisiveisRef = useRef<string[]>([])
  cidadesVisiveisRef.current = Object.keys(liderancasPorCidadeMap)
  useEffect(() => {
    setLimite(PAGE_SIZE)
    setExpandedCities(municipio ? new Set(cidadesVisiveisRef.current) : new Set())
  }, [municipio, baseCarregada])

  const cidadesParaAnaliseInvestimento = linhasCidades
    .map((l) => ({ cidade: l.cidade, previsaoVotos: Math.round(l.expectativa), liderancas: l.liderancas.length }))
    .sort((a, b) => b.previsaoVotos - a.previsaoVotos)

  const cidadesTerritorioLista = Object.keys(liderancasPorCidadeMap).sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const cidadesExpandidasLista = useMemo(() => Array.from(expandedCities), [expandedCities])

  const territorioAgentActionsRef = useRef({
    alternarLiderancasCidade: (_nomeCidade: string, _expandir?: boolean) => {},
    recolherTodasCidades: () => {},
    abrirObrasCidade: (_nomeCidade: string): boolean => false,
    fecharModalObras: () => {},
    atualizarDados: () => {},
  })

  territorioAgentActionsRef.current = {
    alternarLiderancasCidade: (nomeCidade, expandir) => {
      setExpandedCities((prev) => {
        const next = new Set(prev)
        const isExpanded = next.has(nomeCidade)
        if (expandir === true) next.add(nomeCidade)
        else if (expandir === false) next.delete(nomeCidade)
        else if (isExpanded) next.delete(nomeCidade)
        else next.add(nomeCidade)
        return next
      })
    },
    recolherTodasCidades: () => setExpandedCities(new Set()),
    abrirObrasCidade: (nomeCidade) => {
      const liderancasCidade = liderancasPorCidadeMap[nomeCidade]
      if (!liderancasCidade?.length) return false
      setSelectedCityForDemands(nomeCidade)
      if (typeof window !== 'undefined') {
        const nomes = liderancasCidade.map((lider) => texto(lider[nomeCol])).filter((nome) => nome.length > 0)
        sessionStorage.setItem('territorio_demands_liderancas', JSON.stringify(nomes))
      }
      setShowCityDemands(true)
      return true
    },
    fecharModalObras: () => {
      setShowCityDemands(false)
      setSelectedCityForDemands('')
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('territorio_demands_liderancas')
      }
    },
    atualizarDados: () => {
      void fetchBaseFromDb({ refresh: true })
    },
  }

  const territorioAgentPageActions = useMemo(
    () => ({
      alternarLiderancasCidade: (nomeCidade: string, expandir?: boolean) =>
        territorioAgentActionsRef.current.alternarLiderancasCidade(nomeCidade, expandir),
      recolherTodasCidades: () => territorioAgentActionsRef.current.recolherTodasCidades(),
      abrirObrasCidade: (nomeCidade: string) => territorioAgentActionsRef.current.abrirObrasCidade(nomeCidade),
      fecharModalObras: () => territorioAgentActionsRef.current.fecharModalObras(),
      atualizarDados: () => territorioAgentActionsRef.current.atualizarDados(),
    }),
    [],
  )

  const contextoAgenteTerritorio = useMemo<AIAgentPageContext>(
    () => ({
      kind: 'territorio',
      cidades: cidadesTerritorioLista,
      loading,
      planilhaConfigurada: baseCarregada,
      cidadesExpandidas: cidadesExpandidasLista,
      modalObrasAberto: showCityDemands,
      cidadeObrasAtual: selectedCityForDemands,
      ...territorioAgentPageActions,
    }),
    [
      cidadesTerritorioLista,
      loading,
      baseCarregada,
      cidadesExpandidasLista,
      showCityDemands,
      selectedCityForDemands,
      territorioAgentPageActions,
    ],
  )

  const expectativaFormatada = votosReferenciaCol && totalExpectativa > 0 ? fmt(totalExpectativa) : undefined

  const jarvisHostProps = useMemo(
    () => ({
      pageContext: contextoAgenteTerritorio,
      loadingKPIs: loading,
      loadingTerritorios: loading,
      kpisCount: liderancasFiltradas.length > 0 ? 4 : 0,
      expectativa2026: expectativaFormatada,
      candidatoPadrao: candidatoPadrao || undefined,
    }),
    [contextoAgenteTerritorio, loading, liderancasFiltradas.length, expectativaFormatada, candidatoPadrao],
  )

  useRegisterJarvisHostProps(jarvisHostProps)

  const exportFiltrosResumo = useMemo(() => {
    const rows: Array<{ Campo: string; Valor: string }> = [{ Campo: 'Cenário de votos', Valor: labelCenarioDadosAtivo }]
    if (municipio) rows.push({ Campo: 'Município', Valor: municipio })
    if (filtroNome.trim()) rows.push({ Campo: 'Filtro liderança', Valor: filtroNome.trim() })
    if (filtroCargo.trim()) rows.push({ Campo: 'Filtro cargo', Valor: filtroCargo.trim() })
    if (filtroDepEstadual.length > 0) {
      rows.push({ Campo: 'Filtro dep. estadual', Valor: filtroDepEstadual.join(', ') })
    }
    const faixa = FAIXAS.find((f) => f.id === filtroFaixaVotos)
    if (faixa) rows.push({ Campo: 'Faixa de votos', Valor: faixa.label })
    return rows
  }, [labelCenarioDadosAtivo, municipio, filtroNome, filtroCargo, filtroDepEstadual, filtroFaixaVotos])

  const limparFiltros = () => {
    setFiltroNome('')
    setFiltroCargo('')
    setFiltroDepEstadual([])
    setFiltroFaixaVotos('')
    setLimite(PAGE_SIZE)
  }

  const ordenarPor = (col: SortCidadeCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, col, ['cidade'] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  const alternarMapaTelaCheia = () => {
    const container = mapaVotoCruzadoRef.current
    if (!container) return
    if (document.fullscreenElement) void document.exitFullscreen()
    else container.requestFullscreen().catch(() => {})
  }

  if (loading && !baseCarregada) return <TseCarregando texto="Carregando base territorial…" />

  if (!baseCarregada) {
    return (
      <TseErro>
        <p className="font-semibold">Não foi possível carregar a base territorial</p>
        {error ? <p className="mt-1 text-xs">{error}</p> : null}
        <button
          type="button"
          onClick={() => void fetchBaseFromDb({ refresh: true })}
          className={cn(tseLinkAcaoClass, 'mt-3')}
        >
          Tentar novamente
        </button>
      </TseErro>
    )
  }

  if (liderancas.length === 0) return <TseVazio>Nenhum registro em territorio_liderancas.</TseVazio>

  const temCenarios = Boolean(revisaoFinalCol || expectativaJadyelCol || promessaLiderancaCol || expectativaLegadoCol)

  return (
    <>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[270px_1fr]">
        <aside className="space-y-4">
          <section className={tseCardClass}>
            <h2 className="text-xl font-bold">Dados Gerais</h2>
            <p className="mt-2 text-[10px] font-semibold text-[var(--tse-muted)]">
              Cenário {labelCenarioDadosAtivo} · {escopoLabel}
            </p>
            <TseDados>
              <TseDado
                rotulo="Lideranças ativas"
                valor={fmt(liderancasFiltradas.length)}
                sufixo={`/ ${fmt(liderancas.length)}`}
              />
              <TseDado
                rotulo="Cidades com liderança"
                valor={fmt(cidadesUnicasCount)}
                sufixo={`/ ${fmt(universoMunicipios)}`}
              />
              <TseDado
                rotulo="Média por cidade"
                valor={cidadesUnicasCount ? fmt(totalExpectativa / cidadesUnicasCount) : '—'}
              />
              {totalExpectativa > 0 && totalVotacao2026 > 0 ? (
                <TseDado rotulo="Apurado ÷ expectativa" valor={fmtPct((totalVotacao2026 / totalExpectativa) * 100)} />
              ) : null}
            </TseDados>
            <TseBarraRotulo pct={pctCobertura} rotulo={fmtPct(pctCobertura)} />
            <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Cobertura de municípios</p>

            {maiorBase ? (
              <div className="mt-4 rounded-lg bg-[var(--tse-bar)] p-3 text-[12px]">
                <p className="font-bold">Maior base</p>
                <p className="mt-1 uppercase">{maiorBase.cidade}</p>
                <p className="text-[var(--tse-muted)]">
                  {fmt(maiorBase.liderancas.length)} lideranças
                  {maiorBase.votacao2026 != null ? ` · ${fmt(maiorBase.votacao2026)} votos em 2026` : ''}
                </p>
                <p className="mt-1 text-[14px] font-bold">{fmt(maiorBase.expectativa)} de expectativa</p>
              </div>
            ) : null}
          </section>

          {totaisPorCargo.length > 0 ? (
            <TseListaFiltro
              titulo="Lideranças por cargo"
              itens={totaisPorCargo.map((item) => ({
                id: item.cargo,
                label: item.cargo,
                valor: item.total,
                cor: corNivelCargo(item.cargo),
              }))}
              ativo={filtroCargo || null}
              onChange={(cargo) => setFiltroCargo(cargo ?? '')}
            />
          ) : null}

          {filtroDepEstadual.length > 0 ? (
            <TseCard titulo="Voto cruzado" subtitulo={filtroDepEstadual.join(', ')}>
              <TseDados className="mt-3">
                <TseDado rotulo="Cidades" valor={fmt(cidadesUnicasCount)} />
                <TseDado rotulo="Lideranças" valor={fmt(liderancasFiltradas.length)} />
                {votosReferenciaCol ? <TseDado rotulo={LABEL_EXPECTATIVA_2026} valor={fmt(totalExpectativa)} /> : null}
              </TseDados>
            </TseCard>
          ) : null}
        </aside>

        <main className="min-w-0">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              {cargoCol && cargosUnicos.length > 0 ? (
                <select
                  value={filtroCargo}
                  onChange={(e) => setFiltroCargo(e.target.value)}
                  className={tseControleClass}
                  aria-label="Filtrar por cargo"
                >
                  <option value="">Todos os cargos</option>
                  {cargosUnicos.map((cargo) => (
                    <option key={cargo} value={cargo}>
                      {cargo}
                    </option>
                  ))}
                </select>
              ) : null}

              {deputadosEstaduaisUnicos.length > 0 ? (
                <button
                  ref={depDropdownButtonRef}
                  type="button"
                  onClick={() => setShowDepDropdown((v) => !v)}
                  title="Voto cruzado: selecione um ou mais deputados"
                  aria-expanded={showDepDropdown}
                  className={cn(
                    tseControleClass,
                    'inline-flex items-center gap-1.5',
                    filtroDepEstadual.length > 0 && 'border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] font-semibold',
                  )}
                >
                  {filtroDepEstadual.length === 0
                    ? 'Dep. estadual'
                    : filtroDepEstadual.length === deputadosEstaduaisUnicos.length
                      ? 'Todos os dep.'
                      : `${filtroDepEstadual.length} dep. estadual`}
                  <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', showDepDropdown && 'rotate-180')} />
                </button>
              ) : null}

              {temCenarios ? (
                <select
                  value={cenarioVotos}
                  onChange={(e) => setCenarioVotos(e.target.value as CenarioVotos)}
                  className={tseControleClass}
                  aria-label="Cenário de votos"
                >
                  {revisaoFinalCol ? <option value="revisao_final">Cenário: Revisão Final 2026</option> : null}
                  {expectativaJadyelCol ? <option value="aferido_jadyel">Cenário: Aferido 2026</option> : null}
                  {promessaLiderancaCol ? <option value="promessa_lideranca">Cenário: Prometido 2026</option> : null}
                  {expectativaLegadoCol ? (
                    <option value="legado_anterior">Cenário: {LABEL_EXPECTATIVA_2026}</option>
                  ) : null}
                </select>
              ) : null}

              {votosReferenciaCol ? (
                <select
                  value={filtroFaixaVotos}
                  onChange={(e) => {
                    setFiltroFaixaVotos(e.target.value as FaixaVotos)
                    setLimite(PAGE_SIZE)
                  }}
                  className={tseControleClass}
                  aria-label="Faixa de votos por cidade"
                >
                  <option value="">Qualquer faixa</option>
                  {FAIXAS.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.label}
                    </option>
                  ))}
                </select>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <TseBusca value={filtroNome} onChange={setFiltroNome} placeholder="Buscar liderança" />
              <button
                type="button"
                onClick={() => setShowExportModal(true)}
                disabled={liderancasFiltradas.length === 0}
                className={tseBotaoCinzaClass}
              >
                <Download className={tseBotaoIconeClass} />
                Exportar
              </button>
              <button
                type="button"
                onClick={() => setShowMindMap(true)}
                disabled={liderancasFiltradas.length === 0}
                className={tseBotaoCinzaClass}
              >
                <Network className={tseBotaoIconeClass} />
                Mapa mental
              </button>
              {votosReferenciaCol ? (
                <button
                  type="button"
                  onClick={() => setShowVoteInvestmentBalance(true)}
                  disabled={liderancasFiltradas.length === 0}
                  className={tseBotaoCinzaClass}
                  title="Equilíbrio entre investimento e previsão de votos"
                >
                  <Briefcase className={tseBotaoIconeClass} />
                  Demandas
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => territorioAgentActionsRef.current.atualizarDados()}
                disabled={loading}
                className={tseBotaoCinzaClass}
                title="Recarregar a base"
              >
                <RefreshCw className={cn(tseBotaoIconeClass, loading && 'animate-spin')} />
                Atualizar
              </button>
            </div>
          </div>

          {error ? <div className="mt-3"><TseErro>{error}</TseErro></div> : null}

          <section className="mt-4 flex flex-wrap items-center gap-x-8 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
            <div className="min-w-[180px] flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-xl font-bold uppercase">Base de lideranças</p>
                <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
                  {escopoLabel}
                </span>
              </div>
              <p className="text-[15px] text-[var(--tse-muted)]">
                {fmt(liderancasFiltradas.length)} lideranças em {fmt(cidadesUnicasCount)}{' '}
                {cidadesUnicasCount === 1 ? 'cidade' : 'cidades'}
              </p>
            </div>
            {totalVotacao2026 > 0 ? (
              <div className="text-right">
                <p className="text-3xl font-black">{fmt(totalVotacao2026)}</p>
                <p className="text-[13px] text-[var(--tse-muted)]">votos Jadyel 2026</p>
              </div>
            ) : null}
            {votosReferenciaCol ? (
              <div className="text-right">
                <p className="text-3xl font-black">{fmt(totalExpectativa)}</p>
                <p className="text-[13px] text-[var(--tse-muted)]">{LABEL_EXPECTATIVA_2026.toLowerCase()}</p>
              </div>
            ) : null}
          </section>

          {filtroDepEstadual.length > 0 && mapaVotoCruzado.length > 0 ? (
            <TseCard
              className="mt-4"
              titulo="Mapa de voto cruzado"
              acao={
                <button
                  type="button"
                  onClick={() => setShowMapaVotoCruzado((v) => !v)}
                  className={tseLinkAcaoClass}
                >
                  {showMapaVotoCruzado ? 'Ocultar mapa' : 'Mostrar mapa'}
                </button>
              }
            >
              {showMapaVotoCruzado ? (
                <div ref={mapaVotoCruzadoRef} className="mt-3">
                  <MapaVotoCruzado
                    deputados={filtroDepEstadual}
                    cidades={mapaVotoCruzado}
                    onFullscreen={alternarMapaTelaCheia}
                  />
                </div>
              ) : null}
            </TseCard>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--tse-muted)]">
            <p>
              {fmt(cidadesUnicasCount)} {cidadesUnicasCount === 1 ? 'município' : 'municípios'}
              {hasFiltrosAtivos ? ' com os filtros aplicados' : ''}
              {liderancaAtualCol || votosReferenciaCol
                ? ` · lideranças atuais ou com ${LABEL_EXPECTATIVA_2026.toLowerCase()}`
                : ''}
            </p>
            <div className="flex items-center gap-4">
              {hasFiltrosAtivos ? (
                <button type="button" onClick={limparFiltros} className={tseLinkAcaoClass}>
                  Limpar filtros
                </button>
              ) : null}
              {cidadesUnicasCount > 0 ? (
                <button
                  type="button"
                  onClick={() =>
                    setExpandedCities(todasExpandidas ? new Set() : new Set(linhasCidades.map((l) => l.cidade)))
                  }
                  className={tseLinkAcaoClass}
                >
                  {todasExpandidas ? 'Recolher todas' : 'Expandir todas'}
                </button>
              ) : null}
            </div>
          </div>

          {linhasOrdenadas.length === 0 ? (
            <div className="mt-3">
              <TseVazio>
                {municipio && !hasFiltrosAtivos
                  ? `Nenhuma liderança atual cadastrada em ${municipio}.`
                  : 'Nenhuma liderança encontrada com os filtros aplicados.'}
              </TseVazio>
            </div>
          ) : (
            <>
              <TerritorioCidadesTabela
                linhas={linhasOrdenadas.slice(0, limite)}
                rank={rankCidades}
                maxExpectativa={maxExpectativa}
                maxVotacao={maxVotacao}
                sortCol={sortCol}
                sortAsc={sortAsc}
                onSort={ordenarPor}
                expandidas={expandedCities}
                onToggle={(cidade) => territorioAgentActionsRef.current.alternarLiderancasCidade(cidade)}
                onBriefing={(linha) => {
                  setSelectedCityForBriefing(linha.cidade)
                  setSelectedCityLiderancas(linha.liderancas)
                  setShowExecutiveBriefing(true)
                }}
                onObras={(cidade) => territorioAgentActionsRef.current.abrirObrasCidade(cidade)}
                nomeCol={nomeCol}
                cargoCol={cargoCol}
                votosReferenciaCol={votosReferenciaCol}
                normalizeNumber={normalizeNumber}
                labelExpectativa={LABEL_EXPECTATIVA_2026}
                labelVotacao={LABEL_VOTACAO_JADYEL_2026}
              />
              <TseCarregarMais
                restantes={linhasOrdenadas.length - limite}
                onClick={() => setLimite((n) => n + PAGE_SIZE)}
              />
            </>
          )}
        </main>
      </div>

      {showDepDropdown && depMenuPos && typeof document !== 'undefined'
        ? createPortal(
            <div
              ref={depDropdownMenuRef}
              className="fixed z-[10000] max-w-[min(calc(100vw-1rem),20rem)] overflow-hidden rounded-lg border border-[#DDDDDD] bg-white text-[#333333] shadow-lg"
              style={{ top: depMenuPos.top, left: depMenuPos.left, minWidth: depMenuPos.width }}
            >
              <div className="max-h-56 overflow-auto p-1">
                {deputadosEstaduaisUnicos.map((dep) => {
                  const checked = filtroDepEstadual.includes(dep)
                  return (
                    <button
                      key={dep}
                      type="button"
                      onClick={() => toggleDepEstadual(dep)}
                      className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-[#FFF8D6]"
                    >
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-sm border',
                          checked ? 'border-[#EBB402] bg-[#EBB402]' : 'border-[#CFCFCF] bg-white',
                        )}
                      >
                        {checked ? <Check className="h-3 w-3 text-white" /> : null}
                      </span>
                      <span className="truncate">{dep}</span>
                    </button>
                  )
                })}
              </div>
              <div className="flex items-center justify-between border-t border-[#EEEEEE] px-3 py-2 text-[11px]">
                <span className="text-[#717171]">{filtroDepEstadual.length} selecionados</span>
                <div className="flex items-center gap-3 font-bold uppercase tracking-wide text-[#6A8421]">
                  <button
                    type="button"
                    onClick={() => setFiltroDepEstadual(deputadosEstaduaisUnicos)}
                    className="hover:underline disabled:opacity-50"
                    disabled={filtroDepEstadual.length === deputadosEstaduaisUnicos.length}
                  >
                    Todos
                  </button>
                  <button type="button" onClick={() => setFiltroDepEstadual([])} className="hover:underline">
                    Limpar
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      <MindMapModal
        isOpen={showMindMap}
        onClose={() => setShowMindMap(false)}
        liderancas={liderancasFiltradas}
        candidatoPadrao={candidatoPadrao || 'Candidato'}
        cidadeCol={cidadeCol || 'cidade'}
        nomeCol={nomeCol || 'nome'}
        expectativaVotosCol={votosReferenciaCol || null}
      />

      <TerritorioBaseExportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        records={liderancasFiltradas}
        filtrosResumo={exportFiltrosResumo}
      />

      <CityDemandsModal
        isOpen={showCityDemands}
        onClose={() => territorioAgentActionsRef.current.fecharModalObras()}
        cidade={selectedCityForDemands}
      />

      {showExecutiveBriefing && (
        <ExecutiveBriefingModal
          isOpen={showExecutiveBriefing}
          onClose={() => {
            setShowExecutiveBriefing(false)
            setSelectedCityForBriefing('')
            setSelectedCityLiderancas([])
          }}
          cidade={selectedCityForBriefing}
          liderancas={selectedCityLiderancas}
          expectativaVotosCol={votosReferenciaCol}
          nomeCol={nomeCol}
        />
      )}

      <VoteInvestmentBalanceModal
        isOpen={showVoteInvestmentBalance}
        onClose={() => setShowVoteInvestmentBalance(false)}
        cidades={cidadesParaAnaliseInvestimento}
        cenarioLabel={LABEL_EXPECTATIVA_2026}
      />
    </>
  )
}
