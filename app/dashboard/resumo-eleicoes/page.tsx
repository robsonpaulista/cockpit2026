'use client'

import { useMemo, useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, Crown, X } from 'lucide-react'
import { getEleitoradoByCity } from '@/lib/eleitores'

interface ResultadoEleicao {
  uf: string
  municipio: string
  codigoCargo: string
  cargo: string
  numeroUrna: string
  nomeCandidato: string
  nomeUrnaCandidato: string
  partido: string
  coligacao: string
  turno: string
  situacao: string
  dataUltimaTotalizacao: string
  ue: string
  sequencialCandidato: string
  tipoDestinacaoVotos: string
  sequencialEleicao: string
  anoEleicao: string
  regiao: string
  percentualVotosValidos: string
  quantidadeVotosNominais: string
  quantidadeVotosConcorrentes: string
}

interface PartidoResumo {
  partido: string
  votos: number
  eleitos: number
}

interface ResumoCidade {
  eleitores: number | null
  votos2026: number
  votacaoFinal2022: number
  liderancas: number
  liderancasDetalhe: Array<{
    nome: string
    cargo: string
    projecaoVotos: number
  }>
}

interface LiderancaDetalheResponse {
  nome?: string
  cargo?: string
  projecaoVotos?: number
}

type ResumosCidadeMap = Record<string, { expectativaVotos: number; votacaoFinal2022: number; liderancas: number }>

type TableKey =
  | 'deputado_estadual'
  | 'deputado_federal'
  | 'prefeito_2024'
  | 'vereador_2024'
  | 'partido_2024'

const ITEMS_PER_PAGE = 10
const CANDIDATO_FEDERAL_FIXO = 'JADYEL DA JUPI'

const EMPTY_SELECTIONS: Record<TableKey, Record<string, number>> = {
  deputado_estadual: {},
  deputado_federal: {},
  prefeito_2024: {},
  vereador_2024: {},
  partido_2024: {},
}

function parseVotos(value: string): number {
  const parsed = Number.parseInt(value || '0', 10)
  return Number.isNaN(parsed) ? 0 : parsed
}

function includesNormalized(source: string, term: string): boolean {
  return source.toLowerCase().includes(term.toLowerCase())
}

function normalizeText(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function extrairAliases(nome: string): string[] {
  const bruto = String(nome || '')
  const partes = bruto
    .split(/[\/|;]+/g)
    .map((parte) => normalizeText(parte))
    .filter((parte) => parte.length > 0)

  const normalizadoCompleto = normalizeText(bruto)
  if (normalizadoCompleto && !partes.includes(normalizadoCompleto)) {
    partes.unshift(normalizadoCompleto)
  }

  return Array.from(new Set(partes))
}

function termosFortes(nome: string): string[] {
  const stopwords = new Set(['de', 'da', 'do', 'dos', 'das', 'e'])
  return normalizeText(nome)
    .split(' ')
    .map((token) => token.trim())
    .filter((token) => token.length >= 5 && !stopwords.has(token) && !/^\d+$/.test(token))
}

function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

function Pagination({
  totalItems,
  currentPage,
  onPageChange,
}: {
  totalItems: number
  currentPage: number
  onPageChange: (page: number) => void
}) {
  const totalPages = Math.ceil(totalItems / ITEMS_PER_PAGE)
  if (totalPages <= 1) return null

  return (
    <div className="flex justify-center items-center gap-2 mt-3">
      <button
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="px-2 py-1 text-xs rounded bg-background border border-card disabled:opacity-50"
      >
        Anterior
      </button>
      <span className="text-xs text-text-secondary">
        Pág {currentPage}/{totalPages}
      </span>
      <button
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="px-2 py-1 text-xs rounded bg-background border border-card disabled:opacity-50"
      >
        Próxima
      </button>
    </div>
  )
}

export default function ResumoEleicoesPage() {
  const [cidade, setCidade] = useState('')
  const [cidades, setCidades] = useState<string[]>([])
  const [dados, setDados] = useState<ResultadoEleicao[]>([])
  const [loadingCidades, setLoadingCidades] = useState(true)
  const [loadingDados, setLoadingDados] = useState(false)
  const [savingPresidente, setSavingPresidente] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [buscaIniciada, setBuscaIniciada] = useState(false)
  const [presidenteCamaraNome, setPresidenteCamaraNome] = useState<string | null>(null)
  const [filtroPartidoAtivo, setFiltroPartidoAtivo] = useState<string | null>(null)
  const [resumoCidade, setResumoCidade] = useState<ResumoCidade | null>(null)
  const [resumosCidadeMap, setResumosCidadeMap] = useState<ResumosCidadeMap>({})
  const [showLiderancasModal, setShowLiderancasModal] = useState(false)
  const [feedbackMarcacao, setFeedbackMarcacao] = useState<string | null>(null)
  const [mostrarFeedbackMarcacao, setMostrarFeedbackMarcacao] = useState(false)
  const [currentPage, setCurrentPage] = useState<Record<string, number>>({
    deputado_estadual: 1,
    deputado_federal: 1,
    prefeito_2024: 1,
    vereador_2024: 1,
    partido_2024: 1,
  })
  const [selectedVotes, setSelectedVotes] = useState<Record<TableKey, Record<string, number>>>(EMPTY_SELECTIONS)

  const setPage = (key: string, page: number) => {
    setCurrentPage((prev) => ({ ...prev, [key]: page }))
  }

  const toggleSelection = (table: TableKey, rowId: string, votes: number) => {
    setSelectedVotes((prev) => {
      const tableSelection = prev[table]
      if (tableSelection[rowId] !== undefined) {
        const { [rowId]: _, ...rest } = tableSelection
        return { ...prev, [table]: rest }
      }
      return {
        ...prev,
        [table]: {
          ...tableSelection,
          [rowId]: votes,
        },
      }
    })
  }

  const clearTableSelection = (table: TableKey) => {
    setSelectedVotes((prev) => ({ ...prev, [table]: {} }))
  }

  const getSelectedCount = (table: TableKey): number => Object.keys(selectedVotes[table]).length

  const getSelectedTotal = (table: TableKey): number =>
    Object.values(selectedVotes[table]).reduce((sum, value) => sum + value, 0)

  const getSelectedVotesTotalFromSelection = (selection: Record<TableKey, Record<string, number>>): number =>
    (Object.keys(selection) as TableKey[]).reduce((sum, table) => {
      return sum + Object.values(selection[table]).reduce((tableSum, value) => tableSum + value, 0)
    }, 0)

  const formatarPercentual = (valor: number | null): string => {
    if (valor === null || !Number.isFinite(valor)) return '-'
    return `${valor.toFixed(1).replace('.', ',')}%`
  }

  const formatarResumoPenetracao = (selection: Record<TableKey, Record<string, number>>): string => {
    const votosSelecionadosTotal = getSelectedVotesTotalFromSelection(selection)
    const votosPrefeitoSelecionados = Object.values(selection.prefeito_2024).reduce((sum, value) => sum + value, 0)
    const votosPenetracao = votosSelecionadosTotal - votosPrefeitoSelecionados
    const totalPrefeitoCidade = prefeito2024.reduce(
      (sum, item) => sum + parseVotos(item.quantidadeVotosNominais),
      0
    )

    const percentualSobre2026 =
      resumoCidade && resumoCidade.votos2026 > 0 ? (votosPenetracao / resumoCidade.votos2026) * 100 : null
    const percentualSobreEleitores =
      resumoCidade && resumoCidade.eleitores && resumoCidade.eleitores > 0
        ? (votosPenetracao / resumoCidade.eleitores) * 100
        : null
    const percentualPrefeito =
      totalPrefeitoCidade > 0 ? (votosPrefeitoSelecionados / totalPrefeitoCidade) * 100 : null

    return [
      `Penetração (sem prefeito): ${votosPenetracao.toLocaleString('pt-BR')} votos`,
      `${formatarPercentual(percentualSobre2026)} de Votos 2026`,
      `${formatarPercentual(percentualSobreEleitores)} de Eleitores`,
      `Prefeito: ${votosPrefeitoSelecionados.toLocaleString('pt-BR')} (${formatarPercentual(percentualPrefeito)} do total Prefeito 2024)`,
    ].join(' | ')
  }

  const partidosIguais = (a?: string | null, b?: string | null): boolean =>
    (a || '').trim().toUpperCase() === (b || '').trim().toUpperCase()

  const toggleFiltroPartido = (partido: string) => {
    setFiltroPartidoAtivo((prev) => (partidosIguais(prev, partido) ? null : partido))
    setCurrentPage((prev) => ({
      ...prev,
      deputado_estadual: 1,
      deputado_federal: 1,
      prefeito_2024: 1,
      vereador_2024: 1,
    }))
  }

  const getResumoFromMap = (
    cidadeAlvo: string
  ): { expectativaVotos: number; votacaoFinal2022: number; liderancas: number } | null => {
    const normalized = normalizeCityName(cidadeAlvo)
    if (!normalized) return null

    if (resumosCidadeMap[normalized]) return resumosCidadeMap[normalized]

    let fallback: { expectativaVotos: number; votacaoFinal2022: number; liderancas: number } | null = null
    Object.entries(resumosCidadeMap).forEach(([key, value]) => {
      if (key.includes(normalized) || normalized.includes(key)) {
        fallback = {
          expectativaVotos: (fallback?.expectativaVotos || 0) + value.expectativaVotos,
          votacaoFinal2022: (fallback?.votacaoFinal2022 || 0) + value.votacaoFinal2022,
          liderancas: (fallback?.liderancas || 0) + value.liderancas,
        }
      }
    })
    return fallback
  }

  const carregarResumoCidade = async (cidadeAlvo: string): Promise<void> => {
    const eleitores = getEleitoradoByCity(cidadeAlvo)
    const fromMap = getResumoFromMap(cidadeAlvo)
    if (fromMap) {
      setResumoCidade({
        eleitores,
        votos2026: fromMap.expectativaVotos,
        votacaoFinal2022: fromMap.votacaoFinal2022,
        liderancas: fromMap.liderancas,
        liderancasDetalhe: [],
      })
    }

    try {
      const res = await fetch('/api/territorio/expectativa-por-cidade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cidade: cidadeAlvo }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar resumo da cidade')
      const cityKey = normalizeCityName(cidadeAlvo)
      if (cityKey) {
        setResumosCidadeMap((prev) => ({
          ...prev,
          [cityKey]: {
            expectativaVotos: Number(json.expectativaVotos || 0),
            votacaoFinal2022: Number(json.votacaoFinal2022 || 0),
            liderancas: Number(json.liderancas || 0),
          },
        }))
      }
      setResumoCidade({
        eleitores,
        votos2026: Number(json.expectativaVotos || 0),
        votacaoFinal2022: Number(json.votacaoFinal2022 || 0),
        liderancas: Number(json.liderancas || 0),
        liderancasDetalhe: Array.isArray(json.liderancasDetalhe)
          ? (json.liderancasDetalhe as LiderancaDetalheResponse[]).map((item) => ({
              nome: String(item.nome || ''),
              cargo: String(item.cargo || '-'),
              projecaoVotos: Number(item.projecaoVotos || 0),
            }))
          : [],
      })
    } catch {
      setResumoCidade({
        eleitores,
        votos2026: 0,
        votacaoFinal2022: 0,
        liderancas: 0,
        liderancasDetalhe: [],
      })
    }
  }

  const carregarPresidenteCamara = async (cidadeAlvo: string) => {
    try {
      const res = await fetch(`/api/resumo-eleicoes/presidente-camara?cidade=${encodeURIComponent(cidadeAlvo)}`)
      const json = await res.json()
      if (res.ok) {
        setPresidenteCamaraNome(json.presidente || null)
      } else {
        setPresidenteCamaraNome(null)
      }
    } catch {
      setPresidenteCamaraNome(null)
    }
  }

  const definirPresidenteCamara = async (vereadorNome: string) => {
    if (!cidade || savingPresidente) return

    const anterior = presidenteCamaraNome
    const nomeNormalizado = vereadorNome.trim()
    setPresidenteCamaraNome(nomeNormalizado)
    setSavingPresidente(true)
    try {
      const res = await fetch('/api/resumo-eleicoes/presidente-camara', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cidade,
          vereadorNome: nomeNormalizado,
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar presidente da câmara')
      setPresidenteCamaraNome(json.presidente || nomeNormalizado)
    } catch {
      setPresidenteCamaraNome(anterior)
    } finally {
      setSavingPresidente(false)
    }
  }

  useEffect(() => {
    let mounted = true

    const loadCities = async () => {
      setLoadingCidades(true)
      try {
        const res = await fetch('/api/resumo-eleicoes')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar municípios')
        if (!mounted) return
        setCidades(Array.isArray(json.cidades) ? json.cidades : [])
      } catch (e) {
        if (!mounted) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar municípios')
      } finally {
        if (mounted) setLoadingCidades(false)
      }
    }

    loadCities()
    return () => {
      mounted = false
    }
  }, [])

  useEffect(() => {
    if (cidades.length === 0) return
    let active = true

    const preloadResumos = async () => {
      try {
        const res = await fetch('/api/territorio/expectativa-por-cidade')
        const json = await res.json()
        if (!res.ok || !active) return
        const summaries = (json.summaries || {}) as ResumosCidadeMap
        if (Object.keys(summaries).length > 0) {
          setResumosCidadeMap(summaries)
        }
      } catch {
        // fallback silencioso: o POST por cidade continua funcionando
      }
    }

    preloadResumos()
    return () => {
      active = false
    }
  }, [cidades.length])

  const buscarDados = async () => {
    if (!cidade) return
    setBuscaIniciada(true)
    setLoadingDados(true)
    setError(null)
    setDados([])
    setSelectedVotes(EMPTY_SELECTIONS)
    setPresidenteCamaraNome(null)
    setFiltroPartidoAtivo(null)
    setResumoCidade(null)
    setShowLiderancasModal(false)
    setFeedbackMarcacao(null)
    setMostrarFeedbackMarcacao(false)
    setCurrentPage({
      deputado_estadual: 1,
      deputado_federal: 1,
      prefeito_2024: 1,
      vereador_2024: 1,
      partido_2024: 1,
    })

    try {
      const res = await fetch(`/api/resumo-eleicoes?cidade=${encodeURIComponent(cidade)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar resultados')
      setDados(Array.isArray(json.resultados) ? json.resultados : [])
      await carregarPresidenteCamara(cidade)
      void carregarResumoCidade(cidade)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar resultados')
    } finally {
      setLoadingDados(false)
    }
  }

  const dadosFiltradosPorPartido = useMemo(() => {
    if (!filtroPartidoAtivo) return dados
    return dados.filter((item) => partidosIguais(item.partido, filtroPartidoAtivo))
  }, [dados, filtroPartidoAtivo])

  const deputadoEstadual2022 = useMemo(
    () =>
      dadosFiltradosPorPartido
        .filter((item) => includesNormalized(item.cargo, 'estadual') && item.anoEleicao === '2022')
        .sort((a, b) => parseVotos(b.quantidadeVotosNominais) - parseVotos(a.quantidadeVotosNominais)),
    [dadosFiltradosPorPartido]
  )

  const deputadoFederal2022 = useMemo(
    () =>
      dadosFiltradosPorPartido
        .filter((item) => includesNormalized(item.cargo, 'federal') && item.anoEleicao === '2022')
        .sort((a, b) => parseVotos(b.quantidadeVotosNominais) - parseVotos(a.quantidadeVotosNominais)),
    [dadosFiltradosPorPartido]
  )

  const prefeito2024 = useMemo(
    () =>
      dadosFiltradosPorPartido
        .filter((item) => includesNormalized(item.cargo, 'prefeito') && item.anoEleicao === '2024')
        .sort((a, b) => parseVotos(b.quantidadeVotosNominais) - parseVotos(a.quantidadeVotosNominais)),
    [dadosFiltradosPorPartido]
  )

  const vereador2024 = useMemo(
    () =>
      dadosFiltradosPorPartido
        .filter((item) => includesNormalized(item.cargo, 'vereador') && item.anoEleicao === '2024')
        .sort((a, b) => parseVotos(b.quantidadeVotosNominais) - parseVotos(a.quantidadeVotosNominais)),
    [dadosFiltradosPorPartido]
  )

  const partido2024 = useMemo<PartidoResumo[]>(() => {
    const grouped = new Map<string, PartidoResumo>()

    for (const item of dados) {
      if (item.anoEleicao !== '2024') continue
      const key = item.partido || '-'
      const current = grouped.get(key) || { partido: key, votos: 0, eleitos: 0 }
      current.votos += parseVotos(item.quantidadeVotosNominais)
      if (includesNormalized(item.situacao, 'eleito')) current.eleitos += 1
      grouped.set(key, current)
    }

    return Array.from(grouped.values()).sort((a, b) => b.votos - a.votos)
  }, [dados])

  const paginated = <T,>(list: T[], page: number): T[] => {
    const start = (page - 1) * ITEMS_PER_PAGE
    return list.slice(start, start + ITEMS_PER_PAGE)
  }

  const nomesCorrespondem = (nomeA: string, nomeB: string): boolean => {
    const a = normalizeText(nomeA)
    const b = normalizeText(nomeB)
    if (!a || !b) return false

    // 1) Match exato/parcial tradicional
    if (a === b || a.includes(b) || b.includes(a)) return true

    // 2) Match por aliases (ex: "Valdir / Valdiomar")
    const aliasesB = extrairAliases(nomeB)
    if (aliasesB.some((alias) => a === alias || a.includes(alias) || alias.includes(a))) return true

    // 3) Match por termos fortes do alias/nome (ex: "Adevandro" em "Adevandro Fontenele")
    const termos = Array.from(new Set([...termosFortes(nomeB), ...aliasesB.flatMap((alias) => termosFortes(alias))]))
    if (termos.some((termo) => a.includes(termo))) return true

    return false
  }

  const tabelasPorCargo = (cargo: string): Array<'deputado_estadual' | 'prefeito_2024' | 'vereador_2024'> => {
    const cargoNormalizado = normalizeText(cargo)
    const tabelas: Array<'deputado_estadual' | 'prefeito_2024' | 'vereador_2024'> = []
    if (cargoNormalizado.includes('vereador')) tabelas.push('vereador_2024')
    if (cargoNormalizado.includes('prefeito')) tabelas.push('prefeito_2024')
    if (cargoNormalizado.includes('deputado estadual') || cargoNormalizado.includes('dep estadual')) {
      tabelas.push('deputado_estadual')
    }
    return tabelas
  }

  const extrairNomeDoCargo = (cargoTexto: string, padrao: RegExp): string | null => {
    const match = cargoTexto.match(padrao)
    const nome = match?.[1]?.trim()
    return nome ? nome : null
  }

  const obterAlvosPorTabela = (lideranca: { nome: string; cargo: string }) => {
    const cargoBruto = String(lideranca.cargo || '')
    const tabelasAlvo = tabelasPorCargo(cargoBruto)
    const alvos: Record<'deputado_estadual' | 'prefeito_2024' | 'vereador_2024', string[]> = {
      deputado_estadual: [],
      prefeito_2024: [],
      vereador_2024: [],
    }

    const depNome = extrairNomeDoCargo(
      cargoBruto,
      /(?:dep\.?\s*estadual|deputad[oa]\s*estadual)\s*:?\s*([^|;·]+?)(?=\s{2,}|[|;·]|$)/i
    )
    const prefNome = extrairNomeDoCargo(
      cargoBruto,
      /(?:prefeit[oa])\s*:?\s*([^|;·]+?)(?=\s{2,}|[|;·]|$)/i
    )
    const verNome = extrairNomeDoCargo(
      cargoBruto,
      /(?:vereador(?:a)?)\s*:?\s*([^|;·]+?)(?=\s{2,}|[|;·]|$)/i
    )

    if (depNome) alvos.deputado_estadual.push(depNome)
    if (prefNome) alvos.prefeito_2024.push(prefNome)
    if (verNome) alvos.vereador_2024.push(verNome)

    // Fallback: quando o cargo indica a tabela, mas não trouxe nome explícito.
    if (tabelasAlvo.includes('deputado_estadual') && alvos.deputado_estadual.length === 0) {
      alvos.deputado_estadual.push(lideranca.nome)
    }
    if (tabelasAlvo.includes('prefeito_2024') && alvos.prefeito_2024.length === 0) {
      alvos.prefeito_2024.push(lideranca.nome)
    }
    if (tabelasAlvo.includes('vereador_2024') && alvos.vereador_2024.length === 0) {
      alvos.vereador_2024.push(lideranca.nome)
    }

    return { tabelasAlvo, alvos }
  }

  const selecionarLiderancaNasTabelas = (lideranca: { nome: string; cargo: string }) => {
    const { tabelasAlvo, alvos } = obterAlvosPorTabela(lideranca)
    if (tabelasAlvo.length === 0) {
      setFeedbackMarcacao(`"${lideranca.nome}": cargo sem correspondência com as tabelas eleitorais.`)
      return
    }

    const aplicarMarcacao = (
      next: Record<TableKey, Record<string, number>>
    ): { novosMarcados: number; porTabela: { deputado_estadual: number; prefeito_2024: number; vereador_2024: number } } => {
      let novosMarcados = 0
      const porTabela = {
        deputado_estadual: 0,
        prefeito_2024: 0,
        vereador_2024: 0,
      }

      if (tabelasAlvo.includes('deputado_estadual')) {
        deputadoEstadual2022.forEach((item) => {
          const bate = alvos.deputado_estadual.some((alvo) => nomesCorrespondem(item.nomeUrnaCandidato, alvo))
          if (!bate) return
          const rowId = `deputado_estadual:${item.nomeUrnaCandidato}:${item.numeroUrna}`
          if (next.deputado_estadual[rowId] === undefined) {
            next.deputado_estadual[rowId] = parseVotos(item.quantidadeVotosNominais)
            novosMarcados += 1
            porTabela.deputado_estadual += 1
          }
        })
      }

      if (tabelasAlvo.includes('prefeito_2024')) {
        prefeito2024.forEach((item) => {
          const bate = alvos.prefeito_2024.some((alvo) => nomesCorrespondem(item.nomeUrnaCandidato, alvo))
          if (!bate) return
          const rowId = `prefeito_2024:${item.nomeUrnaCandidato}:${item.numeroUrna}`
          if (next.prefeito_2024[rowId] === undefined) {
            next.prefeito_2024[rowId] = parseVotos(item.quantidadeVotosNominais)
            novosMarcados += 1
            porTabela.prefeito_2024 += 1
          }
        })
      }

      if (tabelasAlvo.includes('vereador_2024')) {
        vereador2024.forEach((item) => {
          const bate = alvos.vereador_2024.some((alvo) => nomesCorrespondem(item.nomeUrnaCandidato, alvo))
          if (!bate) return
          const rowId = `vereador_2024:${item.nomeUrnaCandidato}:${item.numeroUrna}`
          if (next.vereador_2024[rowId] === undefined) {
            next.vereador_2024[rowId] = parseVotos(item.quantidadeVotosNominais)
            novosMarcados += 1
            porTabela.vereador_2024 += 1
          }
        })
      }

      return { novosMarcados, porTabela }
    }

    let resultado = {
      novosMarcados: 0,
      porTabela: { deputado_estadual: 0, prefeito_2024: 0, vereador_2024: 0 },
    }

    const next = {
      ...selectedVotes,
      deputado_estadual: { ...selectedVotes.deputado_estadual },
      prefeito_2024: { ...selectedVotes.prefeito_2024 },
      vereador_2024: { ...selectedVotes.vereador_2024 },
    }
    resultado = aplicarMarcacao(next)
    setSelectedVotes(next)
    const penetracao = formatarResumoPenetracao(next)

    if (resultado.novosMarcados > 0) {
      const detalhes: string[] = []
      if (resultado.porTabela.deputado_estadual > 0) detalhes.push(`Dep. Estadual: ${resultado.porTabela.deputado_estadual}`)
      if (resultado.porTabela.prefeito_2024 > 0) detalhes.push(`Prefeito: ${resultado.porTabela.prefeito_2024}`)
      if (resultado.porTabela.vereador_2024 > 0) detalhes.push(`Vereador: ${resultado.porTabela.vereador_2024}`)
      setFeedbackMarcacao(
        `"${lideranca.nome}": ${resultado.novosMarcados} marcação(ões). ${detalhes.join(' | ')}. ${penetracao}`
      )
    } else {
      setFeedbackMarcacao(`"${lideranca.nome}": nenhum novo candidato marcado. ${penetracao}`)
    }
  }

  const marcarLiderancasDoCard = () => {
    setMostrarFeedbackMarcacao(true)

    if (!resumoCidade || resumoCidade.liderancasDetalhe.length === 0) {
      setFeedbackMarcacao('Nenhuma liderança disponível para marcação automática.')
      return
    }

    let totalMarcacoes = 0
    let liderancasComMatch = 0

    const next = {
      ...selectedVotes,
      deputado_estadual: { ...selectedVotes.deputado_estadual },
      prefeito_2024: { ...selectedVotes.prefeito_2024 },
      vereador_2024: { ...selectedVotes.vereador_2024 },
    }

    resumoCidade.liderancasDetalhe.forEach((lideranca) => {
      const { tabelasAlvo, alvos } = obterAlvosPorTabela(lideranca)
      if (tabelasAlvo.length === 0) return

      let marcacoesDaLideranca = 0

      if (tabelasAlvo.includes('deputado_estadual')) {
        deputadoEstadual2022.forEach((item) => {
          const bate = alvos.deputado_estadual.some((alvo) => nomesCorrespondem(item.nomeUrnaCandidato, alvo))
          if (!bate) return
          const rowId = `deputado_estadual:${item.nomeUrnaCandidato}:${item.numeroUrna}`
          if (next.deputado_estadual[rowId] === undefined) {
            next.deputado_estadual[rowId] = parseVotos(item.quantidadeVotosNominais)
            marcacoesDaLideranca += 1
          }
        })
      }

      if (tabelasAlvo.includes('prefeito_2024')) {
        prefeito2024.forEach((item) => {
          const bate = alvos.prefeito_2024.some((alvo) => nomesCorrespondem(item.nomeUrnaCandidato, alvo))
          if (!bate) return
          const rowId = `prefeito_2024:${item.nomeUrnaCandidato}:${item.numeroUrna}`
          if (next.prefeito_2024[rowId] === undefined) {
            next.prefeito_2024[rowId] = parseVotos(item.quantidadeVotosNominais)
            marcacoesDaLideranca += 1
          }
        })
      }

      if (tabelasAlvo.includes('vereador_2024')) {
        vereador2024.forEach((item) => {
          const bate = alvos.vereador_2024.some((alvo) => nomesCorrespondem(item.nomeUrnaCandidato, alvo))
          if (!bate) return
          const rowId = `vereador_2024:${item.nomeUrnaCandidato}:${item.numeroUrna}`
          if (next.vereador_2024[rowId] === undefined) {
            next.vereador_2024[rowId] = parseVotos(item.quantidadeVotosNominais)
            marcacoesDaLideranca += 1
          }
        })
      }

      if (marcacoesDaLideranca > 0) {
        liderancasComMatch += 1
        totalMarcacoes += marcacoesDaLideranca
      }
    })

    setSelectedVotes(next)
    const penetracao = formatarResumoPenetracao(next)

    if (totalMarcacoes > 0) {
      setFeedbackMarcacao(
        `Auto-marcação: ${totalMarcacoes} candidato(s) em ${liderancasComMatch} liderança(s). ${penetracao}.`
      )
    } else {
      setFeedbackMarcacao(`Nenhum novo candidato correspondente foi marcado. ${penetracao}.`)
    }
  }

  const diferenca2026Vs2022 = resumoCidade ? resumoCidade.votos2026 - resumoCidade.votacaoFinal2022 : 0
  const diferencaFormatada = `${diferenca2026Vs2022 > 0 ? '+' : ''}${diferenca2026Vs2022.toLocaleString('pt-BR')}`
  const statusComparativo =
    diferenca2026Vs2022 > 0 ? 'Melhor que 2022' : diferenca2026Vs2022 < 0 ? 'Pior que 2022' : 'Igual a 2022'
  const percentualAlcance =
    resumoCidade && resumoCidade.eleitores && resumoCidade.eleitores > 0
      ? (resumoCidade.votos2026 / resumoCidade.eleitores) * 100
      : null

  return (
    <div className="min-h-screen bg-background">
      <div className="px-4 py-6 lg:px-6">
        <div className="bg-surface rounded-2xl border border-card p-4 mb-6">
          <div className="flex flex-col md:flex-row md:items-end gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-text-secondary block mb-1">Cidade</label>
              <select
                value={cidade}
                onChange={(e) => setCidade(e.target.value)}
                disabled={loadingCidades}
                className="w-full h-10 px-3 rounded-lg border border-card bg-background text-sm"
              >
                <option value="">
                  {loadingCidades ? 'Carregando municípios...' : 'Selecione um município...'}
                </option>
                {cidades.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={buscarDados}
              disabled={!cidade || loadingDados}
              className="h-10 px-4 rounded-lg text-sm font-medium bg-accent-gold text-white hover:bg-accent-gold/90 disabled:opacity-50 flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loadingDados ? 'animate-spin' : ''}`} />
              Buscar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl border border-status-danger/30 bg-status-danger/10 text-status-danger text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {buscaIniciada && !loadingDados && dados.length === 0 && !error && (
          <div className="bg-surface rounded-2xl border border-card p-6 text-sm text-text-secondary">
            Nenhum resultado encontrado para {cidade}.
          </div>
        )}

        {dados.length > 0 && (
          <>
          {resumoCidade && (
            <div className="mb-3 grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="rounded-lg border border-card bg-surface p-2 text-center">
                <p className="text-[11px] text-text-secondary">Eleitores</p>
                <p className="text-sm font-semibold text-text-primary">
                  {resumoCidade.eleitores !== null ? resumoCidade.eleitores.toLocaleString('pt-BR') : '-'}
                </p>
                <p className="text-[11px] mt-0.5 text-text-secondary">
                  Alcance: {percentualAlcance !== null ? `${percentualAlcance.toFixed(1).replace('.', ',')}%` : '-'}
                </p>
              </div>
              <div className="rounded-lg border border-card bg-surface p-2 text-center">
                <p className="text-[11px] text-text-secondary">Votos 2026</p>
                <p className="text-sm font-semibold text-text-primary">
                  {resumoCidade.votos2026.toLocaleString('pt-BR')}
                </p>
                <p
                  className={`text-[11px] mt-0.5 ${
                    diferenca2026Vs2022 > 0
                      ? 'text-status-success'
                      : diferenca2026Vs2022 < 0
                        ? 'text-status-danger'
                        : 'text-text-secondary'
                  }`}
                >
                  {statusComparativo} ({diferencaFormatada})
                </p>
              </div>
              <div className="rounded-lg border border-card bg-surface p-2 text-center">
                <p className="text-[11px] text-text-secondary">Votação Final 2022</p>
                <p className="text-sm font-semibold text-text-primary">
                  {resumoCidade.votacaoFinal2022.toLocaleString('pt-BR')}
                </p>
              </div>
              <div className="rounded-lg border border-card bg-surface p-2 text-center select-none">
                <p className="text-[11px] text-text-secondary">Quantidade de Lideranças</p>
                <p className="text-sm font-semibold text-text-primary">
                  {resumoCidade.liderancas.toLocaleString('pt-BR')}
                </p>
                <button
                  type="button"
                  onClick={marcarLiderancasDoCard}
                  className="text-[11px] mt-0.5 text-accent-gold hover:underline"
                >
                  Marcar automaticamente
                </button>
                <button
                  type="button"
                  onClick={() => setShowLiderancasModal(true)}
                  className="text-[11px] mt-0.5 text-accent-gold hover:underline"
                >
                  Clique para ver detalhes
                </button>
              </div>
            </div>
          )}
          {mostrarFeedbackMarcacao && feedbackMarcacao && (
            <div className="mb-3 rounded-md border border-card bg-surface px-3 py-2 text-xs text-text-primary">
              {feedbackMarcacao}
            </div>
          )}
          {filtroPartidoAtivo && (
            <div className="mb-3 flex items-center justify-between rounded-lg border border-card bg-surface p-2 text-xs">
              <span className="text-text-secondary">
                Filtro por partido ativo: <strong className="text-text-primary">{filtroPartidoAtivo}</strong>
              </span>
              <button
                onClick={() => setFiltroPartidoAtivo(null)}
                className="px-2 py-1 rounded border border-card hover:bg-background text-text-secondary"
              >
                Limpar filtro
              </button>
            </div>
          )}
          <div className="grid grid-cols-1 md:flex md:flex-nowrap gap-4 overflow-x-auto pb-2">
            <div className="bg-surface rounded-xl border border-card p-2 md:flex-1 min-w-[240px]">
              <h3 className="text-xs font-semibold text-center mb-2">Deputado Estadual 2022</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-center py-1 px-1 bg-background w-8">Sel.</th>
                    <th className="text-left py-1 px-1 bg-background">Candidato</th>
                    <th className="text-right py-1 px-1 bg-background">Votos</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(deputadoEstadual2022, currentPage.deputado_estadual).map((item) => {
                    const rowId = `deputado_estadual:${item.nomeUrnaCandidato}:${item.numeroUrna}`
                    const votes = parseVotos(item.quantidadeVotosNominais)
                    const isSelected = selectedVotes.deputado_estadual[rowId] !== undefined
                    return (
                      <tr
                        key={`${item.nomeUrnaCandidato}-${item.numeroUrna}`}
                        className={isSelected ? 'border-b border-card bg-accent-gold-soft/30' : 'border-b border-card'}
                      >
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection('deputado_estadual', rowId, votes)}
                            className="h-3.5 w-3.5 accent-[rgb(var(--accent-gold))]"
                          />
                        </td>
                        <td className="py-1 px-1">{item.nomeUrnaCandidato}</td>
                        <td className="py-1 px-1 text-right">{votes.toLocaleString('pt-BR')}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-background font-semibold">
                    <td className="py-1 px-1"></td>
                    <td className="py-1 px-1">TOTAL</td>
                    <td className="py-1 px-1 text-right">
                      {deputadoEstadual2022
                        .reduce((acc, item) => acc + parseVotos(item.quantidadeVotosNominais), 0)
                        .toLocaleString('pt-BR')}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary">
                <span>
                  Selecionados: <strong>{getSelectedCount('deputado_estadual')}</strong> | Votos:{' '}
                  <strong>{getSelectedTotal('deputado_estadual').toLocaleString('pt-BR')}</strong>
                </span>
                {getSelectedCount('deputado_estadual') > 0 && (
                  <button
                    onClick={() => clearTableSelection('deputado_estadual')}
                    className="px-2 py-1 rounded border border-card hover:bg-background"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <Pagination
                totalItems={deputadoEstadual2022.length}
                currentPage={currentPage.deputado_estadual}
                onPageChange={(page) => setPage('deputado_estadual', page)}
              />
            </div>

            <div className="bg-surface rounded-xl border border-card p-2 md:flex-1 min-w-[240px]">
              <h3 className="text-xs font-semibold text-center mb-2">Deputado Federal 2022</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-center py-1 px-1 bg-background w-8">Sel.</th>
                    <th className="text-left py-1 px-1 bg-background">Candidato</th>
                    <th className="text-right py-1 px-1 bg-background">Votos</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(deputadoFederal2022, currentPage.deputado_federal).map((item) => {
                    const isJadyel = item.nomeUrnaCandidato?.trim().toUpperCase() === CANDIDATO_FEDERAL_FIXO
                    const rowId = `deputado_federal:${item.nomeUrnaCandidato}:${item.numeroUrna}`
                    const votes = parseVotos(item.quantidadeVotosNominais)
                    const isSelected = selectedVotes.deputado_federal[rowId] !== undefined
                    return (
                      <tr
                        key={`${item.nomeUrnaCandidato}-${item.numeroUrna}`}
                        className={
                          isJadyel
                            ? 'bg-accent-gold text-white border-b border-card'
                            : isSelected
                              ? 'border-b border-card bg-accent-gold-soft/30'
                              : 'border-b border-card'
                        }
                      >
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection('deputado_federal', rowId, votes)}
                            className="h-3.5 w-3.5 accent-[rgb(var(--accent-gold))]"
                          />
                        </td>
                        <td className="py-1 px-1">{item.nomeUrnaCandidato}</td>
                        <td className="py-1 px-1 text-right">{votes.toLocaleString('pt-BR')}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-background font-semibold">
                    <td className="py-1 px-1"></td>
                    <td className="py-1 px-1">TOTAL</td>
                    <td className="py-1 px-1 text-right">
                      {deputadoFederal2022
                        .reduce((acc, item) => acc + parseVotos(item.quantidadeVotosNominais), 0)
                        .toLocaleString('pt-BR')}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary">
                <span>
                  Selecionados: <strong>{getSelectedCount('deputado_federal')}</strong> | Votos:{' '}
                  <strong>{getSelectedTotal('deputado_federal').toLocaleString('pt-BR')}</strong>
                </span>
                {getSelectedCount('deputado_federal') > 0 && (
                  <button
                    onClick={() => clearTableSelection('deputado_federal')}
                    className="px-2 py-1 rounded border border-card hover:bg-background"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <Pagination
                totalItems={deputadoFederal2022.length}
                currentPage={currentPage.deputado_federal}
                onPageChange={(page) => setPage('deputado_federal', page)}
              />
            </div>

            <div className="bg-surface rounded-xl border border-card p-2 md:flex-1 min-w-[240px]">
              <h3 className="text-xs font-semibold text-center mb-2">Prefeito 2024</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-center py-1 px-1 bg-background w-8">Sel.</th>
                    <th className="text-left py-1 px-1 bg-background">Candidato</th>
                    <th className="text-right py-1 px-1 bg-background">Votos</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(prefeito2024, currentPage.prefeito_2024).map((item) => {
                    const rowId = `prefeito_2024:${item.nomeUrnaCandidato}:${item.numeroUrna}`
                    const votes = parseVotos(item.quantidadeVotosNominais)
                    const isSelected = selectedVotes.prefeito_2024[rowId] !== undefined
                    return (
                      <tr
                        key={`${item.nomeUrnaCandidato}-${item.numeroUrna}`}
                        className={isSelected ? 'border-b border-card bg-accent-gold-soft/30' : 'border-b border-card'}
                      >
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection('prefeito_2024', rowId, votes)}
                            className="h-3.5 w-3.5 accent-[rgb(var(--accent-gold))]"
                          />
                        </td>
                        <td className="py-1 px-1">{item.nomeUrnaCandidato}</td>
                        <td className="py-1 px-1 text-right">{votes.toLocaleString('pt-BR')}</td>
                      </tr>
                    )
                  })}
                  <tr className="bg-background font-semibold">
                    <td className="py-1 px-1"></td>
                    <td className="py-1 px-1">TOTAL</td>
                    <td className="py-1 px-1 text-right">
                      {prefeito2024
                        .reduce((acc, item) => acc + parseVotos(item.quantidadeVotosNominais), 0)
                        .toLocaleString('pt-BR')}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary">
                <span>
                  Selecionados: <strong>{getSelectedCount('prefeito_2024')}</strong> | Votos:{' '}
                  <strong>{getSelectedTotal('prefeito_2024').toLocaleString('pt-BR')}</strong>
                </span>
                {getSelectedCount('prefeito_2024') > 0 && (
                  <button
                    onClick={() => clearTableSelection('prefeito_2024')}
                    className="px-2 py-1 rounded border border-card hover:bg-background"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <Pagination
                totalItems={prefeito2024.length}
                currentPage={currentPage.prefeito_2024}
                onPageChange={(page) => setPage('prefeito_2024', page)}
              />
            </div>

            <div className="bg-surface rounded-xl border border-card p-2 md:flex-1 min-w-[280px]">
              <h3 className="text-xs font-semibold text-center mb-2">Vereador 2024</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-center py-1 px-1 bg-background w-8">Sel.</th>
                    <th className="text-left py-1 px-1 bg-background">Candidato</th>
                    <th className="text-right py-1 px-1 bg-background">Votos</th>
                    <th className="text-center py-1 px-1 bg-background">Situação</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(vereador2024, currentPage.vereador_2024).map((item) => {
                    const rowId = `vereador_2024:${item.nomeUrnaCandidato}:${item.numeroUrna}`
                    const votes = parseVotos(item.quantidadeVotosNominais)
                    const isSelected = selectedVotes.vereador_2024[rowId] !== undefined
                    const isPresidente =
                      item.nomeUrnaCandidato?.trim().toUpperCase() === presidenteCamaraNome?.trim().toUpperCase()
                    return (
                      <tr
                        key={`${item.nomeUrnaCandidato}-${item.numeroUrna}`}
                        onDoubleClick={() => definirPresidenteCamara(item.nomeUrnaCandidato)}
                        title="Dê duplo clique para definir como Presidente da Câmara"
                        className={
                          isSelected && !isPresidente
                            ? 'border-b border-card bg-accent-gold-soft/30'
                            : 'border-b border-card'
                        }
                      >
                        <td className={`py-1 px-1 text-center ${isPresidente ? 'bg-accent-gold text-white select-none' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection('vereador_2024', rowId, votes)}
                            className="h-3.5 w-3.5 accent-[rgb(var(--accent-gold))]"
                          />
                        </td>
                        <td className={`py-1 px-1 ${isPresidente ? 'bg-accent-gold text-white select-none' : ''}`}>
                          <span className="inline-flex items-center gap-1">
                            <span>{item.nomeUrnaCandidato}</span>
                            {isPresidente && <Crown className="h-3 w-3 shrink-0 text-white" />}
                          </span>
                        </td>
                        <td className={`py-1 px-1 text-right ${isPresidente ? 'bg-accent-gold text-white select-none' : ''}`}>
                          {votes.toLocaleString('pt-BR')}
                        </td>
                        <td className={`py-1 px-1 text-center ${isPresidente ? 'bg-accent-gold text-white select-none' : ''}`}>
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded-full ${
                              isPresidente
                                ? 'bg-white text-accent-gold'
                                : includesNormalized(item.situacao, 'eleito')
                                  ? 'bg-accent-gold text-white'
                                : 'bg-background text-text-secondary'
                            }`}
                          >
                            {item.situacao || '-'}
                          </span>
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-background font-semibold">
                    <td className="py-1 px-1"></td>
                    <td className="py-1 px-1">TOTAL</td>
                    <td className="py-1 px-1 text-right">
                      {vereador2024
                        .reduce((acc, item) => acc + parseVotos(item.quantidadeVotosNominais), 0)
                        .toLocaleString('pt-BR')}
                    </td>
                    <td className="py-1 px-1 text-center">
                      {vereador2024.filter((item) => includesNormalized(item.situacao, 'eleito')).length} eleitos
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary">
                <span>
                  Selecionados: <strong>{getSelectedCount('vereador_2024')}</strong> | Votos:{' '}
                  <strong>{getSelectedTotal('vereador_2024').toLocaleString('pt-BR')}</strong>
                </span>
                {getSelectedCount('vereador_2024') > 0 && (
                  <button
                    onClick={() => clearTableSelection('vereador_2024')}
                    className="px-2 py-1 rounded border border-card hover:bg-background"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <Pagination
                totalItems={vereador2024.length}
                currentPage={currentPage.vereador_2024}
                onPageChange={(page) => setPage('vereador_2024', page)}
              />
            </div>

            <div className="bg-surface rounded-xl border border-card p-2 md:flex-1 min-w-[240px]">
              <h3 className="text-xs font-semibold text-center mb-2">Votação por Partido 2024</h3>
              <table className="w-full text-xs">
                <thead>
                  <tr>
                    <th className="text-center py-1 px-1 bg-background w-8">Sel.</th>
                    <th className="text-left py-1 px-1 bg-background">Partido</th>
                    <th className="text-right py-1 px-1 bg-background">Votos</th>
                    <th className="text-right py-1 px-1 bg-background">Eleitos</th>
                  </tr>
                </thead>
                <tbody>
                  {paginated(partido2024, currentPage.partido_2024).map((item) => {
                    const rowId = `partido_2024:${item.partido}`
                    const isSelected = selectedVotes.partido_2024[rowId] !== undefined
                    const isPartidoAtivo = partidosIguais(item.partido, filtroPartidoAtivo)
                    return (
                      <tr
                        key={item.partido}
                        onDoubleClick={() => toggleFiltroPartido(item.partido)}
                        title="Dê duplo clique para filtrar as demais tabelas por este partido"
                        className={
                          isSelected && !isPartidoAtivo
                              ? 'border-b border-card bg-accent-gold-soft/30'
                              : 'border-b border-card'
                        }
                      >
                        <td className={`py-1 px-1 text-center ${isPartidoAtivo ? 'bg-accent-gold text-white select-none' : ''}`}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection('partido_2024', rowId, item.votos)}
                            className="h-3.5 w-3.5 accent-[rgb(var(--accent-gold))]"
                          />
                        </td>
                        <td className={`py-1 px-1 ${isPartidoAtivo ? 'bg-accent-gold text-white select-none' : ''}`}>{item.partido}</td>
                        <td className={`py-1 px-1 text-right ${isPartidoAtivo ? 'bg-accent-gold text-white select-none' : ''}`}>
                          {item.votos.toLocaleString('pt-BR')}
                        </td>
                        <td className={`py-1 px-1 text-right ${isPartidoAtivo ? 'bg-accent-gold text-white select-none' : ''}`}>
                          {item.eleitos}
                        </td>
                      </tr>
                    )
                  })}
                  <tr className="bg-background font-semibold">
                    <td className="py-1 px-1"></td>
                    <td className="py-1 px-1">TOTAL</td>
                    <td className="py-1 px-1 text-right">
                      {partido2024.reduce((acc, item) => acc + item.votos, 0).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-1 px-1 text-right">
                      {partido2024.reduce((acc, item) => acc + item.eleitos, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-2 flex items-center justify-between text-[11px] text-text-secondary">
                <span>
                  Selecionados: <strong>{getSelectedCount('partido_2024')}</strong> | Votos:{' '}
                  <strong>{getSelectedTotal('partido_2024').toLocaleString('pt-BR')}</strong>
                </span>
                {getSelectedCount('partido_2024') > 0 && (
                  <button
                    onClick={() => clearTableSelection('partido_2024')}
                    className="px-2 py-1 rounded border border-card hover:bg-background"
                  >
                    Limpar seleção
                  </button>
                )}
              </div>
              <Pagination
                totalItems={partido2024.length}
                currentPage={currentPage.partido_2024}
                onPageChange={(page) => setPage('partido_2024', page)}
              />
            </div>
          </div>
          </>
        )}
      </div>

      {showLiderancasModal && resumoCidade && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl max-h-[85vh] bg-surface rounded-xl border border-card overflow-hidden flex flex-col">
            <div className="flex items-center justify-between px-4 py-3 border-b border-card">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">
                  Lideranças de {cidade}
                </h3>
                <p className="text-xs text-text-secondary">
                  {resumoCidade.liderancasDetalhe.length} registro(s)
                </p>
              </div>
              <button
                onClick={() => setShowLiderancasModal(false)}
                className="p-1.5 rounded hover:bg-background transition-colors"
              >
                <X className="h-4 w-4 text-text-secondary" />
              </button>
            </div>

            <div className="overflow-auto p-3">
              {resumoCidade.liderancasDetalhe.length === 0 ? (
                <p className="text-sm text-text-secondary py-6 text-center">
                  Nenhuma liderança encontrada para os filtros atuais.
                </p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr>
                      <th className="text-left py-2 px-2 bg-background">Nome</th>
                      <th className="text-left py-2 px-2 bg-background">Cargo</th>
                      <th className="text-right py-2 px-2 bg-background">Projeção de votos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {resumoCidade.liderancasDetalhe.map((lideranca) => (
                      <tr key={`${lideranca.nome}-${lideranca.cargo}`} className="border-b border-card">
                        <td className="py-1.5 px-2">{lideranca.nome || '-'}</td>
                        <td className="py-1.5 px-2">{lideranca.cargo || '-'}</td>
                        <td className="py-1.5 px-2 text-right">
                          {lideranca.projecaoVotos.toLocaleString('pt-BR')}
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
