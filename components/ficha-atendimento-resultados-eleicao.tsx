'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Loader2, ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  agruparPartido2024,
  CANDIDATO_FEDERAL_DESTAQUE,
  filtrarDeputadoEstadual2022,
  filtrarDeputadoFederal2022,
  filtrarPrefeito2024,
  filtrarVereador2024,
  includesNormalizedCargo,
  parseVotosEleicao,
  type PartidoResumoEleicao,
  type ResultadoEleicao,
} from '@/lib/resumo-eleicoes-dados'

const ITEMS_PER_PAGE = 10

function trZebra(rowIndex: number): string {
  return rowIndex % 2 === 0 ? 'bg-background/45' : 'bg-surface/25'
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
    <div className="mt-2 flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={() => onPageChange(Math.max(1, currentPage - 1))}
        disabled={currentPage === 1}
        className="rounded border border-card bg-surface px-2 py-1 text-xs text-text-primary hover:bg-background disabled:opacity-50"
      >
        Anterior
      </button>
      <span className="text-[11px] text-text-secondary">
        {currentPage} / {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
        disabled={currentPage === totalPages}
        className="rounded border border-card bg-surface px-2 py-1 text-xs text-text-primary hover:bg-background disabled:opacity-50"
      >
        Próxima
      </button>
    </div>
  )
}

function paginated<T>(items: T[], page: number): T[] {
  const start = (page - 1) * ITEMS_PER_PAGE
  return items.slice(start, start + ITEMS_PER_PAGE)
}

function TabelaCandidatos({
  titulo,
  itens,
  page,
  onPageChange,
  destaqueNome,
  colunaExtra,
}: {
  titulo: string
  itens: ResultadoEleicao[]
  page: number
  onPageChange: (p: number) => void
  destaqueNome?: string
  colunaExtra?: 'situacao' | 'partido'
}) {
  const totalVotos = itens.reduce((acc, item) => acc + parseVotosEleicao(item.quantidadeVotosNominais), 0)
  const eleitosCount =
    colunaExtra === 'situacao'
      ? itens.filter((item) => includesNormalizedCargo(item.situacao, 'eleito')).length
      : 0

  return (
    <div className="min-w-0 flex-1 rounded-xl border border-card bg-background/50 p-3 md:min-w-[220px] lg:min-w-[240px]">
      <h3 className="mb-2 text-center text-xs font-semibold text-text-primary">{titulo}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="bg-background px-1 py-1 text-left text-text-secondary">Candidato</th>
            {colunaExtra === 'partido' && (
              <th className="bg-background px-1 py-1 text-left text-text-secondary">Partido</th>
            )}
            <th className="bg-background px-1 py-1 text-right text-text-secondary">Votos</th>
            {colunaExtra === 'situacao' && (
              <th className="bg-background px-1 py-1 text-center text-text-secondary">Situação</th>
            )}
          </tr>
        </thead>
        <tbody>
          {paginated(itens, page).map((item, rowIndex) => {
            const votes = parseVotosEleicao(item.quantidadeVotosNominais)
            const isDestaque =
              destaqueNome &&
              item.nomeUrnaCandidato?.trim().toUpperCase() === destaqueNome.trim().toUpperCase()
            const isEleito = includesNormalizedCargo(item.situacao, 'eleito')
            return (
              <tr
                key={`${item.nomeUrnaCandidato}-${item.numeroUrna}`}
                className={cn(
                  'border-b border-card text-text-primary',
                  isDestaque
                    ? 'bg-accent-gold-soft font-semibold text-accent-gold'
                    : trZebra(rowIndex),
                )}
              >
                <td className="max-w-[10rem] truncate px-1 py-1" title={item.nomeUrnaCandidato}>
                  {item.nomeUrnaCandidato}
                </td>
                {colunaExtra === 'partido' && (
                  <td className="max-w-[4.5rem] truncate px-1 py-1 text-text-secondary" title={item.partido}>
                    {item.partido || '—'}
                  </td>
                )}
                <td className="px-1 py-1 text-right tabular-nums">{votes.toLocaleString('pt-BR')}</td>
                {colunaExtra === 'situacao' && (
                  <td className="px-1 py-1 text-center">
                    <span
                      className={cn(
                        'inline-flex rounded-full px-1.5 py-0.5 text-[10px]',
                        isEleito
                          ? 'bg-accent-gold-soft font-medium text-accent-gold'
                          : 'bg-background text-text-secondary',
                      )}
                    >
                      {item.situacao || '—'}
                    </span>
                  </td>
                )}
              </tr>
            )
          })}
          <tr className="border-t border-card bg-background/90 font-semibold text-text-primary">
            <td className="px-1 py-1">TOTAL</td>
            {colunaExtra === 'partido' && <td className="px-1 py-1" />}
            <td className="px-1 py-1 text-right tabular-nums">{totalVotos.toLocaleString('pt-BR')}</td>
            {colunaExtra === 'situacao' && (
              <td className="px-1 py-1 text-center text-[10px]">{eleitosCount} eleitos</td>
            )}
          </tr>
        </tbody>
      </table>
      <Pagination totalItems={itens.length} currentPage={page} onPageChange={onPageChange} />
    </div>
  )
}

function TabelaPartidos({
  itens,
  page,
  onPageChange,
}: {
  itens: PartidoResumoEleicao[]
  page: number
  onPageChange: (p: number) => void
}) {
  const totalVotos = itens.reduce((acc, item) => acc + item.votos, 0)
  const totalEleitos = itens.reduce((acc, item) => acc + item.eleitos, 0)

  return (
    <div className="min-w-0 flex-1 rounded-xl border border-card bg-background/50 p-3 md:min-w-[220px] lg:min-w-[240px]">
      <h3 className="mb-2 text-center text-xs font-semibold text-text-primary">Votação por Partido 2024</h3>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className="bg-background px-1 py-1 text-left text-text-secondary">Partido</th>
            <th className="bg-background px-1 py-1 text-right text-text-secondary">Votos</th>
            <th className="bg-background px-1 py-1 text-right text-text-secondary">Eleitos</th>
          </tr>
        </thead>
        <tbody>
          {paginated(itens, page).map((item, rowIndex) => (
            <tr key={item.partido} className={cn('border-b border-card text-text-primary', trZebra(rowIndex))}>
              <td className="px-1 py-1">{item.partido}</td>
              <td className="px-1 py-1 text-right tabular-nums">{item.votos.toLocaleString('pt-BR')}</td>
              <td className="px-1 py-1 text-right tabular-nums">{item.eleitos}</td>
            </tr>
          ))}
          <tr className="border-t border-card bg-background/90 font-semibold text-text-primary">
            <td className="px-1 py-1">TOTAL</td>
            <td className="px-1 py-1 text-right tabular-nums">{totalVotos.toLocaleString('pt-BR')}</td>
            <td className="px-1 py-1 text-right tabular-nums">{totalEleitos}</td>
          </tr>
        </tbody>
      </table>
      <Pagination totalItems={itens.length} currentPage={page} onPageChange={onPageChange} />
    </div>
  )
}

const PAGES_INICIAIS = {
  deputado_estadual: 1,
  deputado_federal: 1,
  prefeito_2024: 1,
  vereador_2024: 1,
  partido_2024: 1,
} as const

type PageKey = keyof typeof PAGES_INICIAIS

export function FichaAtendimentoResultadosEleicao({ municipio }: { municipio: string }) {
  const [dados, setDados] = useState<ResultadoEleicao[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cidadeApi, setCidadeApi] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(PAGES_INICIAIS)

  const setPage = (key: PageKey, page: number) => {
    setCurrentPage((prev) => ({ ...prev, [key]: page }))
  }

  const carregar = useCallback(async (nomeCidade: string) => {
    const alvo = nomeCidade.trim()
    if (!alvo) {
      setDados([])
      setCidadeApi(null)
      return
    }
    setLoading(true)
    setError(null)
    setCurrentPage(PAGES_INICIAIS)
    try {
      const res = await fetch(`/api/resumo-eleicoes?cidade=${encodeURIComponent(alvo)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao buscar resultados eleitorais')
      setDados(Array.isArray(json.resultados) ? json.resultados : [])
      setCidadeApi(json.cidade ?? alvo)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar eleições')
      setDados([])
      setCidadeApi(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar(municipio)
  }, [municipio, carregar])

  const deputadoEstadual = useMemo(() => filtrarDeputadoEstadual2022(dados), [dados])
  const deputadoFederal = useMemo(() => filtrarDeputadoFederal2022(dados), [dados])
  const prefeito = useMemo(() => filtrarPrefeito2024(dados), [dados])
  const vereador = useMemo(() => filtrarVereador2024(dados), [dados])
  const partidos = useMemo(() => agruparPartido2024(dados), [dados])

  const semDados = !loading && dados.length === 0 && !error

  return (
    <section className="rounded-2xl border border-card bg-surface p-5 shadow-sm min-w-0">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">Resultados eleitorais</h2>
          <p className="text-xs text-text-secondary mt-0.5">
            {cidadeApi
              ? `Dados da planilha de votação — ${cidadeApi}`
              : 'Mesma base do Resumo por cidade'}
          </p>
        </div>
        <Link
          href={`/dashboard/resumo-eleicoes${municipio ? `?cidade=${encodeURIComponent(municipio)}` : ''}`}
          className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-accent-gold hover:underline"
        >
          Abrir no Resumo Eleições
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {loading && (
        <div className="flex items-center justify-center gap-2 py-12 text-sm text-text-secondary">
          <Loader2 className="h-5 w-5 animate-spin text-accent-gold" />
          Carregando resultados…
        </div>
      )}

      {error && !loading && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</p>
      )}

      {semDados && !error && (
        <p className="py-8 text-center text-sm text-text-secondary">
          Nenhum resultado eleitoral encontrado para este município na planilha.
        </p>
      )}

      {!loading && !error && dados.length > 0 && (
        <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:flex-wrap xl:flex-nowrap xl:overflow-x-auto xl:pb-1">
          <TabelaCandidatos
            titulo="Deputado Estadual 2022"
            itens={deputadoEstadual}
            page={currentPage.deputado_estadual}
            onPageChange={(p) => setPage('deputado_estadual', p)}
          />
          <TabelaCandidatos
            titulo="Deputado Federal 2022"
            itens={deputadoFederal}
            page={currentPage.deputado_federal}
            onPageChange={(p) => setPage('deputado_federal', p)}
            destaqueNome={CANDIDATO_FEDERAL_DESTAQUE}
          />
          <TabelaCandidatos
            titulo="Prefeito 2024"
            itens={prefeito}
            page={currentPage.prefeito_2024}
            onPageChange={(p) => setPage('prefeito_2024', p)}
            colunaExtra="partido"
          />
          <TabelaCandidatos
            titulo="Vereador 2024"
            itens={vereador}
            page={currentPage.vereador_2024}
            onPageChange={(p) => setPage('vereador_2024', p)}
            colunaExtra="situacao"
          />
          <TabelaPartidos
            itens={partidos}
            page={currentPage.partido_2024}
            onPageChange={(p) => setPage('partido_2024', p)}
          />
        </div>
      )}
    </section>
  )
}
