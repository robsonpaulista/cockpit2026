'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Loader2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Users,
  Vote,
  X,
} from 'lucide-react'
import {
  ResumoLiderancasCrudModal,
  type LiderancaCrudRow,
} from '@/components/resumo-eleicoes/resumo-liderancas-crud-modal'
import { cn } from '@/lib/utils'

type GrupoCidade = {
  cidade: string
  rows: LiderancaCrudRow[]
  totalExpectativa: number
}

type ApiResponse = {
  rows?: LiderancaCrudRow[]
  error?: string
}

type ModalState = {
  cidade: string
  editingId: number | null
  creating: boolean
}

function normalizarBusca(value: string): string {
  return value
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

export function LiderancasPanel() {
  const [rows, setRows] = useState<LiderancaCrudRow[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [busca, setBusca] = useState<string>('')
  const [cidadesRecolhidas, setCidadesRecolhidas] = useState<Set<string>>(new Set())
  const [modal, setModal] = useState<ModalState | null>(null)
  const [selecionandoCidade, setSelecionandoCidade] = useState<boolean>(false)
  const [novaCidade, setNovaCidade] = useState<string>('')

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/territorio/liderancas', { cache: 'no-store' })
      const data = (await response.json()) as ApiResponse
      if (!response.ok) throw new Error(data.error || 'Erro ao carregar lideranças')
      setRows(Array.isArray(data.rows) ? data.rows : [])
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar lideranças')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  // Exibe apenas lideranças confirmadas (Liderança atual = SIM).
  const rowsSim = useMemo(
    () => rows.filter((row) => row.liderancaAtual.trim().toUpperCase() === 'SIM'),
    [rows],
  )

  const cidades = useMemo(
    () =>
      Array.from(new Set(rows.map((row) => row.municipio.trim()).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [rows],
  )

  const grupos = useMemo<GrupoCidade[]>(() => {
    const termo = normalizarBusca(busca)
    const agrupados = new Map<string, LiderancaCrudRow[]>()

    for (const row of rowsSim) {
      const cidade = row.municipio.trim() || 'Município não informado'
      if (
        termo &&
        !normalizarBusca(cidade).includes(termo) &&
        !normalizarBusca(row.nome).includes(termo) &&
        !normalizarBusca(row.cargo).includes(termo)
      ) {
        continue
      }
      const atuais = agrupados.get(cidade) ?? []
      atuais.push(row)
      agrupados.set(cidade, atuais)
    }

    return Array.from(agrupados.entries())
      .map(([cidade, liderancas]) => {
        const ordenadas = [...liderancas].sort(
          (a, b) =>
            b.expectativaLegado - a.expectativaLegado ||
            a.nome.localeCompare(b.nome, 'pt-BR'),
        )
        return {
          cidade,
          rows: ordenadas,
          totalExpectativa: ordenadas.reduce(
            (total, lideranca) => total + lideranca.expectativaLegado,
            0,
          ),
        }
      })
      .sort(
        (a, b) =>
          b.totalExpectativa - a.totalExpectativa ||
          a.cidade.localeCompare(b.cidade, 'pt-BR'),
      )
  }, [busca, rowsSim])

  const totalExpectativa = useMemo(
    () => rowsSim.reduce((total, row) => total + row.expectativaLegado, 0),
    [rowsSim],
  )

  const alternarCidade = (cidade: string) => {
    setCidadesRecolhidas((atuais) => {
      const proximas = new Set(atuais)
      if (proximas.has(cidade)) proximas.delete(cidade)
      else proximas.add(cidade)
      return proximas
    })
  }

  const abrirNovaLideranca = () => {
    const cidade = novaCidade.trim()
    if (!cidade) return
    setSelecionandoCidade(false)
    setModal({ cidade, editingId: null, creating: true })
    setNovaCidade('')
  }

  return (
    <section className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Indicador icon={Users} label="Lideranças" valor={rowsSim.length.toLocaleString('pt-BR')} />
        <Indicador
          icon={MapPin}
          label="Cidades"
          valor={new Set(rowsSim.map((row) => row.municipio.trim()).filter(Boolean)).size.toLocaleString('pt-BR')}
        />
        <Indicador
          icon={Vote}
          label="Expectativa de votos"
          valor={totalExpectativa.toLocaleString('pt-BR')}
        />
      </div>

      <div className="flex flex-col gap-3 rounded-xl border border-card bg-surface p-3 sm:flex-row sm:items-center sm:justify-between">
        <label className="relative min-w-0 flex-1 sm:max-w-md">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
            aria-hidden
          />
          <input
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Buscar cidade, liderança ou cargo"
            className="h-9 w-full rounded-lg border border-card bg-background pl-9 pr-9 text-sm text-text-primary outline-none focus:border-[#ff9800]"
          />
          {busca ? (
            <button
              type="button"
              onClick={() => setBusca('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-text-secondary hover:text-text-primary"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          ) : null}
        </label>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void carregar()}
            disabled={loading}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-card bg-background px-3 text-xs font-medium text-text-primary disabled:opacity-50"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
            Atualizar
          </button>
          <button
            type="button"
            onClick={() => setSelecionandoCidade(true)}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#ff9800] px-3 text-xs font-semibold text-black"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden />
            Nova liderança
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {loading && rows.length === 0 ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando lideranças…
        </div>
      ) : grupos.length === 0 ? (
        <div className="rounded-xl border border-dashed border-card px-4 py-12 text-center text-sm text-text-secondary">
          Nenhuma liderança encontrada.
        </div>
      ) : (
        <div className="space-y-3">
          {grupos.map((grupo) => {
            const recolhida = cidadesRecolhidas.has(grupo.cidade)
            return (
              <article
                key={grupo.cidade}
                className="overflow-hidden rounded-xl border border-card bg-surface shadow-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-card bg-background/50 px-4 py-3">
                  <button
                    type="button"
                    onClick={() => alternarCidade(grupo.cidade)}
                    className="flex min-w-0 items-center gap-2 text-left"
                    aria-expanded={!recolhida}
                  >
                    {recolhida ? (
                      <ChevronRight className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                    ) : (
                      <ChevronDown className="h-4 w-4 shrink-0 text-text-secondary" aria-hidden />
                    )}
                    <MapPin className="h-4 w-4 shrink-0 text-[#ff9800]" aria-hidden />
                    <span className="truncate text-sm font-semibold text-text-primary">
                      {grupo.cidade}
                    </span>
                    <span className="rounded-full bg-background px-2 py-0.5 text-[10px] text-text-secondary">
                      {grupo.rows.length}
                    </span>
                  </button>

                  <div className="flex items-center gap-3">
                    <span className="text-xs text-text-secondary">
                      Expectativa:{' '}
                      <strong className="tabular-nums text-text-primary">
                        {grupo.totalExpectativa.toLocaleString('pt-BR')} votos
                      </strong>
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setModal({ cidade: grupo.cidade, editingId: null, creating: true })
                      }
                      className="inline-flex h-7 items-center gap-1 rounded-lg border border-card bg-surface px-2 text-[11px] font-medium text-text-primary"
                    >
                      <Plus className="h-3 w-3" aria-hidden />
                      Adicionar
                    </button>
                  </div>
                </div>

                {!recolhida ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[860px] text-xs">
                      <thead>
                        <tr className="text-text-secondary">
                          <th className="px-4 py-2 text-left font-medium">Liderança</th>
                          <th className="px-3 py-2 text-left font-medium">Cargo</th>
                          <th className="px-3 py-2 text-left font-medium">Dep. Estadual</th>
                          <th className="px-3 py-2 text-left font-medium">Situação</th>
                          <th className="px-3 py-2 text-right font-medium">Votos 2024</th>
                          <th className="px-3 py-2 text-right font-medium">Promessa 2026</th>
                          <th className="px-3 py-2 text-right font-medium">Expectativa de votos</th>
                          <th className="w-16 px-3 py-2 text-right font-medium">Ações</th>
                        </tr>
                      </thead>
                      <tbody>
                        {grupo.rows.map((lideranca, index) => (
                          <tr
                            key={lideranca.id}
                            className={cn(
                              'border-t border-card text-text-primary',
                              index % 2 === 1 && 'bg-background/30',
                            )}
                          >
                            <td className="px-4 py-2 font-medium">{lideranca.nome || '-'}</td>
                            <td className="px-3 py-2 text-text-secondary">
                              {lideranca.cargo || '-'}
                            </td>
                            <td className="px-3 py-2 text-text-secondary">
                              {lideranca.depEstadual || '-'}
                            </td>
                            <td className="px-3 py-2">
                              {lideranca.emDialogo ? (
                                <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-medium text-text-primary">
                                  Em diálogo
                                </span>
                              ) : (
                                <span className="text-text-secondary">
                                  {lideranca.liderancaAtual || '-'}
                                </span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                              {(lideranca.votos2024 ?? 0).toLocaleString('pt-BR')}
                            </td>
                            <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                              {lideranca.promessa.toLocaleString('pt-BR')}
                            </td>
                            <td className="px-3 py-2 text-right font-semibold tabular-nums">
                              {lideranca.expectativaLegado.toLocaleString('pt-BR')}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  setModal({
                                    cidade: grupo.cidade,
                                    editingId: lideranca.id,
                                    creating: false,
                                  })
                                }
                                className="rounded p-1.5 text-text-secondary hover:bg-background hover:text-text-primary"
                                aria-label={`Editar ${lideranca.nome}`}
                                title="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" aria-hidden />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </article>
            )
          })}
        </div>
      )}

      {selecionandoCidade ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-xl border border-card bg-surface p-4 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-text-primary">Nova liderança</h3>
                <p className="text-xs text-text-secondary">Informe a cidade do cadastro.</p>
              </div>
              <button
                type="button"
                onClick={() => setSelecionandoCidade(false)}
                className="rounded p-1.5 text-text-secondary hover:bg-background"
                aria-label="Fechar"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <label className="text-xs text-text-secondary">
              Cidade
              <input
                value={novaCidade}
                onChange={(event) => setNovaCidade(event.target.value)}
                list="territorio-liderancas-cidades"
                placeholder="Ex.: Teresina"
                autoFocus
                className="mt-1 h-9 w-full rounded-lg border border-card bg-background px-3 text-sm text-text-primary"
                onKeyDown={(event) => {
                  if (event.key === 'Enter') abrirNovaLideranca()
                }}
              />
              <datalist id="territorio-liderancas-cidades">
                {cidades.map((cidade) => (
                  <option key={cidade} value={cidade} />
                ))}
              </datalist>
            </label>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSelecionandoCidade(false)}
                className="h-8 rounded-lg border border-card px-3 text-xs text-text-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={abrirNovaLideranca}
                disabled={!novaCidade.trim()}
                className="h-8 rounded-lg bg-[#ff9800] px-3 text-xs font-semibold text-black disabled:opacity-50"
              >
                Continuar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {modal ? (
        <ResumoLiderancasCrudModal
          cidade={modal.cidade}
          cenarioVotos="legado_anterior"
          initialEditingId={modal.editingId}
          startCreating={modal.creating}
          onClose={() => setModal(null)}
          onChanged={() => void carregar()}
        />
      ) : null}
    </section>
  )
}

type IndicadorProps = {
  icon: typeof Users
  label: string
  valor: string
}

function Indicador({ icon: Icon, label, valor }: IndicadorProps) {
  return (
    <div className="rounded-xl border border-card bg-surface p-3 shadow-sm">
      <div className="mb-2 flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff9800]/15 text-[#ff9800]">
        <Icon className="h-4 w-4" aria-hidden />
      </div>
      <p className="text-[10px] uppercase tracking-wide text-text-secondary">{label}</p>
      <p className="mt-0.5 text-lg font-semibold tabular-nums text-text-primary">{valor}</p>
    </div>
  )
}
