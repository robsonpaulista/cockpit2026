'use client'

import { useMemo, useState, useEffect } from 'react'
import { RefreshCw, AlertCircle, Crown } from 'lucide-react'
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
      })
      return
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
      })
    } catch {
      setResumoCidade({
        eleitores,
        votos2026: 0,
        votacaoFinal2022: 0,
        liderancas: 0,
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

  const diferenca2026Vs2022 = resumoCidade ? resumoCidade.votos2026 - resumoCidade.votacaoFinal2022 : 0
  const diferencaFormatada = `${diferenca2026Vs2022 > 0 ? '+' : ''}${diferenca2026Vs2022.toLocaleString('pt-BR')}`
  const statusComparativo =
    diferenca2026Vs2022 > 0 ? 'Melhor que 2022' : diferenca2026Vs2022 < 0 ? 'Pior que 2022' : 'Igual a 2022'

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
              <div className="rounded-lg border border-card bg-surface p-2 text-center">
                <p className="text-[11px] text-text-secondary">Quantidade de Lideranças</p>
                <p className="text-sm font-semibold text-text-primary">
                  {resumoCidade.liderancas.toLocaleString('pt-BR')}
                </p>
              </div>
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
    </div>
  )
}
