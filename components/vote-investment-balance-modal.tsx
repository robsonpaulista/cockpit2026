'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, BarChart3, ArrowUpDown } from 'lucide-react'

interface CidadePrevisaoItem {
  cidade: string
  previsaoVotos: number
  liderancas: number
}

interface DemandRecord {
  cidade?: unknown
  valor?: unknown
  value?: unknown
  custo?: unknown
  orcamento?: unknown
  sheets_data?: Record<string, unknown>
  visits?: unknown
}

interface VoteInvestmentBalanceModalProps {
  isOpen: boolean
  onClose: () => void
  cidades: CidadePrevisaoItem[]
  cenarioLabel: string
}

function normalizeCityName(city: string): string {
  return city
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function normalizeNumber(value: unknown): number {
  if (typeof value === 'number') return value

  const str = String(value || '').trim()
  if (!str) return 0

  let cleaned = str.replace(/[^\d.,]/g, '')

  if (cleaned.includes(',') && cleaned.includes('.')) {
    if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
      cleaned = cleaned.replace(/\./g, '').replace(',', '.')
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  } else if (cleaned.includes(',')) {
    const parts = cleaned.split(',')
    if (parts.length === 2) {
      if (parts[1].length === 3) {
        cleaned = cleaned.replace(/,/g, '')
      } else if (parts[1].length <= 2) {
        cleaned = cleaned.replace(',', '.')
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    } else {
      cleaned = cleaned.replace(/,/g, '')
    }
  }

  const numValue = parseFloat(cleaned)
  return isNaN(numValue) ? 0 : numValue
}

function formatValor(value: number): string {
  if (!Number.isFinite(value) || value <= 0) return '-'
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function getSheetsField(demand: DemandRecord, patterns: RegExp[]): string | null {
  const raw = demand.sheets_data
  if (!raw || typeof raw !== 'object') return null

  const entries = Object.entries(raw)
  const match = entries.find(([key]) => patterns.some((pattern) => pattern.test(key)))
  if (!match) return null

  const value = match[1]
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text || null
}

function extractDemandCity(demand: DemandRecord): string | null {
  const fromSheets =
    getSheetsField(demand, [/cidade|city|munic[ií]pio|localidade|local/i]) ||
    String(demand.sheets_data?.cidade || '').trim()
  if (fromSheets) return fromSheets

  const directCity = String(demand.cidade || '').trim()
  if (directCity) return directCity

  const visits = demand.visits
  const visitList = Array.isArray(visits) ? visits : visits ? [visits] : []

  for (const visit of visitList) {
    const visitRecord = visit as Record<string, unknown>
    const agendas = visitRecord.agendas
    const agendaList = Array.isArray(agendas) ? agendas : agendas ? [agendas] : []

    for (const agenda of agendaList) {
      const agendaRecord = agenda as Record<string, unknown>
      const cities = agendaRecord.cities
      const cityList = Array.isArray(cities) ? cities : cities ? [cities] : []

      for (const city of cityList) {
        const cityName = String((city as Record<string, unknown>).name || '').trim()
        if (cityName) return cityName
      }
    }
  }

  return null
}

function extractDemandValue(demand: DemandRecord): number {
  const fromSheets = getSheetsField(demand, [
    /^valor$/i,
    /valor\s*\(?.*r\$.*\)?/i,
    /custo|or[çc]amento/i,
  ])
  if (fromSheets) return normalizeNumber(fromSheets)

  return normalizeNumber(demand.valor ?? demand.value ?? demand.custo ?? demand.orcamento)
}

export function VoteInvestmentBalanceModal({
  isOpen,
  onClose,
  cidades,
  cenarioLabel,
}: VoteInvestmentBalanceModalProps) {
  const [demands, setDemands] = useState<DemandRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [filtroCidade, setFiltroCidade] = useState('')
  const [sortBy, setSortBy] = useState<'cidade' | 'liderancas' | 'previsaoVotos' | 'investimento' | 'valorPorVoto'>('previsaoVotos')
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc')

  useEffect(() => {
    if (!isOpen) return

    setLoading(true)
    setError(null)

    fetch('/api/campo/demands')
      .then(async (response) => {
        if (!response.ok) throw new Error('Erro ao buscar demandas')
        return response.json()
      })
      .then((data) => {
        setDemands(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        setDemands([])
        setError(err instanceof Error ? err.message : 'Erro ao carregar demandas')
      })
      .finally(() => setLoading(false))
  }, [isOpen])

  const linhasAnalise = useMemo(() => {
    const investimentoPorCidade = new Map<string, number>()

    demands.forEach((demand) => {
      const city = extractDemandCity(demand)
      if (!city) return
      const value = extractDemandValue(demand)
      if (value <= 0) return

      const cityKey = normalizeCityName(city)
      investimentoPorCidade.set(cityKey, (investimentoPorCidade.get(cityKey) || 0) + value)
    })

    return cidades
      .map((item) => {
        const investimento = investimentoPorCidade.get(normalizeCityName(item.cidade)) || 0
        const valorPorVoto = item.previsaoVotos > 0 ? investimento / item.previsaoVotos : 0

        return {
          ...item,
          investimento,
          valorPorVoto,
        }
      })
  }, [cidades, demands])

  const linhasExibidas = useMemo(() => {
    const termo = normalizeCityName(filtroCidade)
    const filtradas = termo
      ? linhasAnalise.filter((row) => normalizeCityName(row.cidade).includes(termo))
      : linhasAnalise

    const sorted = [...filtradas].sort((a, b) => {
      if (sortBy === 'cidade') {
        const compare = a.cidade.localeCompare(b.cidade, 'pt-BR')
        return sortDirection === 'asc' ? compare : -compare
      }

      const compare = (a[sortBy] as number) - (b[sortBy] as number)
      return sortDirection === 'asc' ? compare : -compare
    })

    return sorted
  }, [linhasAnalise, filtroCidade, sortBy, sortDirection])

  const totais = useMemo(() => {
    const totalVotos = linhasExibidas.reduce((sum, row) => sum + row.previsaoVotos, 0)
    const totalInvestido = linhasExibidas.reduce((sum, row) => sum + row.investimento, 0)
    const valorPorVotoTotal = totalVotos > 0 ? totalInvestido / totalVotos : 0

    return {
      totalVotos,
      totalInvestido,
      valorPorVotoTotal,
      cidadesComInvestimento: linhasExibidas.filter((row) => row.investimento > 0).length,
    }
  }, [linhasExibidas])

  const handleSort = (column: 'cidade' | 'liderancas' | 'previsaoVotos' | 'investimento' | 'valorPorVoto') => {
    if (sortBy === column) {
      setSortDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'))
      return
    }
    setSortBy(column)
    setSortDirection(column === 'cidade' ? 'asc' : 'desc')
  }

  const getSortIndicator = (column: 'cidade' | 'liderancas' | 'previsaoVotos' | 'investimento' | 'valorPorVoto') => {
    if (sortBy !== column) return 'text-secondary/50'
    return 'text-accent-gold'
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-surface rounded-xl border border-card w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-card">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent-gold" />
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Equilíbrio Investimento x Votos</h2>
              <p className="text-xs text-secondary">
                Base: {cenarioLabel}. Indicador analítico de valor por voto (sem relação com compra de votos).
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background transition-colors"
            title="Fechar"
          >
            <X className="w-4 h-4 text-secondary" />
          </button>
        </div>

        <div className="px-5 py-3 border-b border-card bg-background/40 grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
          <div>
            <p className="text-secondary">Cidades analisadas</p>
            <p className="text-sm font-semibold text-text-primary">{linhasExibidas.length}</p>
          </div>
          <div>
            <p className="text-secondary">Cidades com investimento</p>
            <p className="text-sm font-semibold text-text-primary">{totais.cidadesComInvestimento}</p>
          </div>
          <div>
            <p className="text-secondary">Previsão total</p>
            <p className="text-sm font-semibold text-accent-gold">{Math.round(totais.totalVotos).toLocaleString('pt-BR')} votos</p>
          </div>
          <div>
            <p className="text-secondary">Valor por voto (global)</p>
            <p className="text-sm font-semibold text-[#B46800]">{formatValor(totais.valorPorVotoTotal)}</p>
          </div>
        </div>

        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-5 h-5 text-accent-gold animate-spin" />
              <span className="ml-2 text-sm text-secondary">Calculando relação investimento x votos...</span>
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg border border-status-error/30 bg-status-error/10 text-sm text-status-error">
              {error}
            </div>
          ) : linhasExibidas.length === 0 ? (
            <div className="text-sm text-secondary text-center py-10">
              Nenhuma cidade disponível para análise com os filtros atuais.
            </div>
          ) : (
            <div className="overflow-auto space-y-3">
              <div className="max-w-sm">
                <label className="block text-xs font-medium text-secondary mb-1">Filtrar cidade</label>
                <input
                  type="text"
                  value={filtroCidade}
                  onChange={(e) => setFiltroCidade(e.target.value)}
                  placeholder="Digite a cidade..."
                  className="w-full px-3 py-2 text-sm border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
                />
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-card text-secondary">
                    <th className="text-left py-2 px-2 font-medium">
                      <button type="button" onClick={() => handleSort('cidade')} className="inline-flex items-center gap-1 hover:text-text-primary">
                        Cidade <ArrowUpDown className={`w-3.5 h-3.5 ${getSortIndicator('cidade')}`} />
                      </button>
                    </th>
                    <th className="text-right py-2 px-2 font-medium">
                      <button type="button" onClick={() => handleSort('liderancas')} className="inline-flex items-center gap-1 hover:text-text-primary">
                        Lideranças <ArrowUpDown className={`w-3.5 h-3.5 ${getSortIndicator('liderancas')}`} />
                      </button>
                    </th>
                    <th className="text-right py-2 px-2 font-medium">
                      <button type="button" onClick={() => handleSort('previsaoVotos')} className="inline-flex items-center gap-1 hover:text-text-primary">
                        {cenarioLabel} <ArrowUpDown className={`w-3.5 h-3.5 ${getSortIndicator('previsaoVotos')}`} />
                      </button>
                    </th>
                    <th className="text-right py-2 px-2 font-medium">
                      <button type="button" onClick={() => handleSort('investimento')} className="inline-flex items-center gap-1 hover:text-text-primary">
                        Valor investido <ArrowUpDown className={`w-3.5 h-3.5 ${getSortIndicator('investimento')}`} />
                      </button>
                    </th>
                    <th className="text-right py-2 px-2 font-medium">
                      <button type="button" onClick={() => handleSort('valorPorVoto')} className="inline-flex items-center gap-1 hover:text-text-primary">
                        Valor por voto <ArrowUpDown className={`w-3.5 h-3.5 ${getSortIndicator('valorPorVoto')}`} />
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {linhasExibidas.map((row) => (
                    <tr key={row.cidade} className="border-b border-card/60 hover:bg-background/40">
                      <td className="py-2 px-2 font-medium text-text-primary">{row.cidade}</td>
                      <td className="py-2 px-2 text-right text-text-primary">{row.liderancas}</td>
                      <td className="py-2 px-2 text-right text-accent-gold font-semibold">
                        {Math.round(row.previsaoVotos).toLocaleString('pt-BR')}
                      </td>
                      <td className="py-2 px-2 text-right text-text-primary">{formatValor(row.investimento)}</td>
                      <td className="py-2 px-2 text-right text-[#B46800] font-semibold">{formatValor(row.valorPorVoto)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-card bg-background/60">
                    <td className="py-2 px-2 font-semibold text-text-primary">Total Geral</td>
                    <td className="py-2 px-2 text-right font-semibold text-text-primary">
                      {linhasExibidas.reduce((sum, row) => sum + row.liderancas, 0)}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-accent-gold">
                      {Math.round(totais.totalVotos).toLocaleString('pt-BR')}
                    </td>
                    <td className="py-2 px-2 text-right font-semibold text-text-primary">{formatValor(totais.totalInvestido)}</td>
                    <td className="py-2 px-2 text-right font-semibold text-[#B46800]">{formatValor(totais.valorPorVotoTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

