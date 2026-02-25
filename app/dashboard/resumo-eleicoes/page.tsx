'use client'

import { useMemo, useState, useEffect } from 'react'
import { RefreshCw, AlertCircle } from 'lucide-react'

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
  const [error, setError] = useState<string | null>(null)
  const [buscaIniciada, setBuscaIniciada] = useState(false)
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

  const buscarDados = async () => {
    if (!cidade) return
    setBuscaIniciada(true)
    setLoadingDados(true)
    setError(null)
    setDados([])
    setSelectedVotes(EMPTY_SELECTIONS)
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
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao buscar resultados')
    } finally {
      setLoadingDados(false)
    }
  }

  const deputadoEstadual2022 = useMemo(
    () =>
      dados
        .filter((item) => includesNormalized(item.cargo, 'estadual') && item.anoEleicao === '2022')
        .sort((a, b) => parseVotos(b.quantidadeVotosNominais) - parseVotos(a.quantidadeVotosNominais)),
    [dados]
  )

  const deputadoFederal2022 = useMemo(
    () =>
      dados
        .filter((item) => includesNormalized(item.cargo, 'federal') && item.anoEleicao === '2022')
        .sort((a, b) => parseVotos(b.quantidadeVotosNominais) - parseVotos(a.quantidadeVotosNominais)),
    [dados]
  )

  const prefeito2024 = useMemo(
    () =>
      dados
        .filter((item) => includesNormalized(item.cargo, 'prefeito') && item.anoEleicao === '2024')
        .sort((a, b) => parseVotos(b.quantidadeVotosNominais) - parseVotos(a.quantidadeVotosNominais)),
    [dados]
  )

  const vereador2024 = useMemo(
    () =>
      dados
        .filter((item) => includesNormalized(item.cargo, 'vereador') && item.anoEleicao === '2024')
        .sort((a, b) => parseVotos(b.quantidadeVotosNominais) - parseVotos(a.quantidadeVotosNominais)),
    [dados]
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
                    return (
                      <tr
                        key={`${item.nomeUrnaCandidato}-${item.numeroUrna}`}
                        className={isSelected ? 'border-b border-card bg-accent-gold-soft/30' : 'border-b border-card'}
                      >
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection('vereador_2024', rowId, votes)}
                            className="h-3.5 w-3.5 accent-[rgb(var(--accent-gold))]"
                          />
                        </td>
                        <td className="py-1 px-1">{item.nomeUrnaCandidato}</td>
                        <td className="py-1 px-1 text-right">{votes.toLocaleString('pt-BR')}</td>
                        <td className="py-1 px-1 text-center">
                          <span
                            className={`inline-flex px-1.5 py-0.5 rounded-full ${
                              includesNormalized(item.situacao, 'eleito')
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
                    return (
                      <tr
                        key={item.partido}
                        className={isSelected ? 'border-b border-card bg-accent-gold-soft/30' : 'border-b border-card'}
                      >
                        <td className="py-1 px-1 text-center">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleSelection('partido_2024', rowId, item.votos)}
                            className="h-3.5 w-3.5 accent-[rgb(var(--accent-gold))]"
                          />
                        </td>
                        <td className="py-1 px-1">{item.partido}</td>
                        <td className="py-1 px-1 text-right">{item.votos.toLocaleString('pt-BR')}</td>
                        <td className="py-1 px-1 text-right">{item.eleitos}</td>
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
        )}
      </div>
    </div>
  )
}
