'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { normalizeMunicipioComparacao } from '@/lib/votacao-secao'
import type { VotacaoSecaoItem, VotacaoSecaoResumo } from '@/lib/votacao-secao'
import {
  agruparMatrizPorBairro,
  agruparMatrizPorLocal,
  contarBairrosMatriz,
  idsCandidatosPadrao,
  listarCandidatosSecao,
  montarMatrizVotacaoSecao,
  type CandidatoMatrizColuna,
  type GrupoBairroMatriz,
  type GrupoLocalMatriz,
  type LinhaMatrizSecao,
} from '@/lib/votacao-secao-matriz'

const LOCAIS_POR_PAGINA = 25
const BAIRROS_POR_PAGINA = 20
const CARGOS = ['Prefeito', 'Vereador'] as const
const AGRUPAMENTOS = [
  { id: 'local', label: 'Por local' },
  { id: 'bairro', label: 'Por bairro' },
] as const
type AgrupamentoMatriz = (typeof AGRUPAMENTOS)[number]['id']

function normalizeCityName(city: string): string {
  return normalizeMunicipioComparacao(city)
}

export default function VotacaoSecaoPage() {
  const searchParams = useSearchParams()
  const [municipios, setMunicipios] = useState<string[]>([])
  const [cidade, setCidade] = useState('')
  const [cargo, setCargo] = useState<(typeof CARGOS)[number]>('Prefeito')
  const [loading, setLoading] = useState(false)
  const [loadingMunicipios, setLoadingMunicipios] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumo, setResumo] = useState<VotacaoSecaoResumo | null>(null)
  const [secoes, setSecoes] = useState<VotacaoSecaoItem[]>([])
  const [pagina, setPagina] = useState(1)
  const [candidatosSel, setCandidatosSel] = useState<string[]>([])
  const [buscaCandidato, setBuscaCandidato] = useState('')
  const [agrupamento, setAgrupamento] = useState<AgrupamentoMatriz>('bairro')
  const [locaisExpandidos, setLocaisExpandidos] = useState<Set<string>>(new Set())
  const [bairrosExpandidos, setBairrosExpandidos] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/resumo-eleicoes/votacao-secao?only_municipios=true')
      .then((r) => r.json())
      .then((data) => {
        setMunicipios(data.municipios ?? [])
      })
      .catch(() => setMunicipios([]))
      .finally(() => setLoadingMunicipios(false))
  }, [])

  useEffect(() => {
    const cidadeParam = searchParams.get('cidade')
    const cargoParam = searchParams.get('cargo')
    if (cargoParam === 'Prefeito' || cargoParam === 'Vereador') {
      setCargo(cargoParam)
    }
    if (!cidadeParam) return

    const alvo = municipios.find((m) => normalizeCityName(m) === normalizeCityName(cidadeParam))
    setCidade(alvo ?? cidadeParam)
  }, [municipios, searchParams])

  const carregar = useCallback(async (nomeCidade: string, cargoSel: string) => {
    const alvo = nomeCidade.trim()
    if (!alvo) return
    setLoading(true)
    setError(null)
    setPagina(1)
    setLocaisExpandidos(new Set())
    setBairrosExpandidos(new Set())
    try {
      const params = new URLSearchParams({ cidade: alvo, cargo: cargoSel })
      const res = await fetch(`/api/resumo-eleicoes/votacao-secao?${params.toString()}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(data.error || `Erro ${res.status}`)
      }
      const listaSecoes = (data.secoes ?? []) as VotacaoSecaoItem[]
      setResumo(data.resumo ?? null)
      setSecoes(listaSecoes)
      const todos = listarCandidatosSecao(listaSecoes)
      setCandidatosSel(idsCandidatosPadrao(todos, cargoSel))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar votação por seção')
      setResumo(null)
      setSecoes([])
      setCandidatosSel([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!cidade) return
    void carregar(cidade, cargo)
  }, [cidade, cargo, carregar])

  const todosCandidatos = useMemo(() => listarCandidatosSecao(secoes), [secoes])

  const matriz = useMemo(
    () => montarMatrizVotacaoSecao(secoes, candidatosSel),
    [secoes, candidatosSel],
  )

  const gruposLocal = useMemo(
    () => agruparMatrizPorLocal(matriz.linhas),
    [matriz.linhas],
  )

  const gruposBairro = useMemo(
    () => agruparMatrizPorBairro(matriz.linhas),
    [matriz.linhas],
  )

  const totalBairros = useMemo(() => contarBairrosMatriz(matriz.linhas), [matriz.linhas])
  const secoesComBairro = useMemo(
    () => matriz.linhas.filter((l) => l.nmBairro?.trim()).length,
    [matriz.linhas],
  )

  const totalPaginas =
    agrupamento === 'bairro'
      ? Math.max(1, Math.ceil(gruposBairro.length / BAIRROS_POR_PAGINA))
      : Math.max(1, Math.ceil(gruposLocal.length / LOCAIS_POR_PAGINA))

  const gruposLocalPagina = useMemo(() => {
    const start = (pagina - 1) * LOCAIS_POR_PAGINA
    return gruposLocal.slice(start, start + LOCAIS_POR_PAGINA)
  }, [gruposLocal, pagina])

  const gruposBairroPagina = useMemo(() => {
    const start = (pagina - 1) * BAIRROS_POR_PAGINA
    return gruposBairro.slice(start, start + BAIRROS_POR_PAGINA)
  }, [gruposBairro, pagina])

  const chaveLocalExpandido = (bairroId: string | null, localId: string) =>
    bairroId ? `${bairroId}::${localId}` : localId

  const toggleLocal = (localId: string, bairroId: string | null = null) => {
    const key = chaveLocalExpandido(bairroId, localId)
    setLocaisExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleBairro = (id: string) => {
    setBairrosExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandirTodos = () => {
    if (agrupamento === 'bairro') {
      setBairrosExpandidos(new Set(gruposBairro.map((g) => g.id)))
      setLocaisExpandidos(
        new Set(
          gruposBairro.flatMap((b) => b.locais.map((l) => chaveLocalExpandido(b.id, l.id))),
        ),
      )
      return
    }
    setLocaisExpandidos(new Set(gruposLocal.map((g) => g.id)))
  }

  const recolherTodos = () => {
    setLocaisExpandidos(new Set())
    setBairrosExpandidos(new Set())
  }

  const candidatosDisponiveisFiltrados = useMemo(() => {
    const q = buscaCandidato.trim().toLowerCase()
    if (!q) return todosCandidatos
    return todosCandidatos.filter(
      (c) =>
        c.nmVotavel.toLowerCase().includes(q) ||
        String(c.nrVotavel).includes(q),
    )
  }, [todosCandidatos, buscaCandidato])

  const toggleCandidato = (id: string) => {
    setCandidatosSel((prev) => {
      if (prev.includes(id)) {
        return prev.length <= 1 ? prev : prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  const selecionarTop = (n: number) => {
    setCandidatosSel(todosCandidatos.slice(0, n).map((c) => c.id))
  }

  return (
    <div className="min-h-screen bg-bg-surface pb-12">
      <div className="mx-auto max-w-[100rem] px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link
            href={
              cidade
                ? `/dashboard/resumo-eleicoes?cidade=${encodeURIComponent(cidade)}`
                : '/dashboard/resumo-eleicoes'
            }
            className="inline-flex items-center gap-2 rounded-lg border border-card bg-surface px-3 py-2 text-sm text-text-primary hover:bg-background"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao resumo
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Votação por seção</h1>
            <p className="text-sm text-text-secondary">
              Matriz comparativa · Eleições 2024 · 1º turno · TSE (bweb)
            </p>
          </div>
        </div>

        <div className="mb-4 flex flex-wrap items-end gap-3 rounded-2xl border border-card bg-surface p-4">
          <label className="flex min-w-[14rem] flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Município</span>
            <select
              value={cidade}
              onChange={(e) => setCidade(e.target.value)}
              disabled={loadingMunicipios}
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            >
              <option value="">Selecione…</option>
              {municipios.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[10rem] flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Cargo</span>
            <select
              value={cargo}
              onChange={(e) => setCargo(e.target.value as (typeof CARGOS)[number])}
              disabled={!cidade || loading}
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            >
              {CARGOS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex min-w-[10rem] flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">Agrupar</span>
            <select
              value={agrupamento}
              onChange={(e) => {
                setAgrupamento(e.target.value as AgrupamentoMatriz)
                setPagina(1)
                recolherTodos()
              }}
              disabled={!cidade || loading}
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
            >
              {AGRUPAMENTOS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            onClick={() => void carregar(cidade, cargo)}
            disabled={!cidade || loading}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-card bg-surface px-4 text-sm font-medium text-text-primary hover:bg-background disabled:opacity-50"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Atualizar
          </button>
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!cidade && !loadingMunicipios && (
          <div className="rounded-xl border border-dashed border-card p-8 text-center text-sm text-text-secondary">
            Selecione um município para comparar candidatos por seção.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-text-secondary">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando matriz…
          </div>
        )}

        {!loading && resumo && secoes.length > 0 && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              <ResumoCard label="Município" valor={resumo.municipio} />
              <ResumoCard label="Cargo" valor={cargo} />
              <ResumoCard label="Seções" valor={resumo.totalSecoes.toLocaleString('pt-BR')} />
              <ResumoCard label="Bairros" valor={String(totalBairros)} />
              <ResumoCard label="Candidatos no cargo" valor={String(todosCandidatos.length)} />
              <ResumoCard label="Exercício" valor={`${resumo.anoEleicao} · ${resumo.nrTurno}º turno`} />
            </div>

            {secoesComBairro === 0 && (
              <div className="mb-4 rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-4 py-3 text-xs text-text-secondary">
                Bairros ainda não carregados no banco. Execute{' '}
                <code className="rounded bg-background px-1">database/alter-votacao-secao-bairro.sql</code>{' '}
                e{' '}
                <code className="rounded bg-background px-1">python scripts/enrich-votacao-secao-bairro.py</code>.
              </div>
            )}

            {secoesComBairro > 0 && agrupamento === 'local' && (
              <div className="mb-4 rounded-xl border border-card bg-background/40 px-4 py-2 text-xs text-text-secondary">
                Bairro oficial TSE disponível ({totalBairros} no município). Use{' '}
                <strong className="font-medium text-text-primary">Agrupar → Por bairro</strong> para comparar
                candidatos por região.
              </div>
            )}

            <div className="mb-4 rounded-2xl border border-card bg-surface p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Candidatos na matriz</h2>
                  <p className="text-xs text-text-secondary">
                    Compare quantos votos cada candidato teve em cada seção.
                    {cargo === 'Vereador'
                      ? ' Para vereador, selecione os candidatos a comparar (padrão: top 12).'
                      : ' Prefeito: todos os candidatos do município.'}
                  </p>
                </div>
                {cargo === 'Vereador' && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => selecionarTop(8)}
                      className="rounded border border-card px-2 py-1 text-xs hover:bg-background"
                    >
                      Top 8
                    </button>
                    <button
                      type="button"
                      onClick={() => selecionarTop(12)}
                      className="rounded border border-card px-2 py-1 text-xs hover:bg-background"
                    >
                      Top 12
                    </button>
                    <button
                      type="button"
                      onClick={() => selecionarTop(20)}
                      className="rounded border border-card px-2 py-1 text-xs hover:bg-background"
                    >
                      Top 20
                    </button>
                  </div>
                )}
              </div>

              {cargo === 'Vereador' && (
                <div className="mb-3 flex flex-wrap gap-2">
                  <input
                    type="search"
                    value={buscaCandidato}
                    onChange={(e) => setBuscaCandidato(e.target.value)}
                    placeholder="Buscar candidato para adicionar…"
                    className="min-w-[14rem] flex-1 rounded-lg border border-card bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              )}

              <div className="mb-3 flex flex-wrap gap-1.5">
                {matriz.candidatos.map((c) => (
                  <CandidatoChip
                    key={c.id}
                    candidato={c}
                    ativo
                    onRemove={cargo === 'Vereador' ? () => toggleCandidato(c.id) : undefined}
                  />
                ))}
              </div>

              {cargo === 'Vereador' && buscaCandidato && (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-card bg-background/50 p-2">
                  {candidatosDisponiveisFiltrados
                    .filter((c) => !candidatosSel.includes(c.id))
                    .slice(0, 20)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          toggleCandidato(c.id)
                          setBuscaCandidato('')
                        }}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-surface"
                      >
                        <span>
                          {c.nrVotavel} · {c.nmVotavel}
                        </span>
                        <span className="tabular-nums text-text-secondary">
                          {c.totalVotos.toLocaleString('pt-BR')} total
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            <div className="overflow-hidden rounded-2xl border border-card bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card px-4 py-2 text-xs text-text-secondary">
                <span>
                  {agrupamento === 'bairro'
                    ? 'Bairros (TSE) · expanda para locais e seções · colunas = candidatos'
                    : 'Locais agrupados · expanda para seções · colunas = candidatos'}
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={expandirTodos}
                    className="rounded border border-card px-2 py-1 hover:bg-background"
                  >
                    Expandir todos
                  </button>
                  <button
                    type="button"
                    onClick={recolherTodos}
                    className="rounded border border-card px-2 py-1 hover:bg-background"
                  >
                    Recolher todos
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left text-xs">
                  <thead>
                    <tr className="border-b border-card bg-background/70">
                      <th className="sticky left-0 z-20 min-w-[18rem] bg-background/95 px-2 py-2 font-medium backdrop-blur">
                        {agrupamento === 'bairro' ? 'Bairro / Local / Seção' : 'Local / Seção'}
                      </th>
                      {matriz.candidatos.map((c) => (
                        <th
                          key={c.id}
                          className="min-w-[5.5rem] max-w-[8rem] px-2 py-2 text-right font-medium align-bottom"
                          title={`${c.nmVotavel} · total ${c.totalVotos.toLocaleString('pt-BR')}`}
                        >
                          <div className="truncate">{c.nmVotavel.split(' ')[0]}</div>
                          <div className="truncate font-normal text-[10px] text-text-secondary">
                            {c.nrVotavel}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agrupamento === 'bairro'
                      ? gruposBairroPagina.map((grupo) => (
                          <GrupoBairroRows
                            key={grupo.id}
                            grupo={grupo}
                            candidatos={matriz.candidatos}
                            bairroExpandido={bairrosExpandidos.has(grupo.id)}
                            locaisExpandidos={locaisExpandidos}
                            onToggleBairro={() => toggleBairro(grupo.id)}
                            onToggleLocal={(localId) => toggleLocal(localId, grupo.id)}
                          />
                        ))
                      : gruposLocalPagina.map((grupo) => {
                          const expandido = locaisExpandidos.has(grupo.id)
                          const multiSecao = grupo.totalSecoes > 1

                          return (
                            <GrupoLocalRows
                              key={grupo.id}
                              grupo={grupo}
                              candidatos={matriz.candidatos}
                              expandido={expandido}
                              multiSecao={multiSecao}
                              onToggle={() => toggleLocal(grupo.id)}
                            />
                          )
                        })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-card bg-background/80 font-semibold">
                      <td className="sticky left-0 z-10 bg-background/95 px-2 py-2">
                        Total no município
                      </td>
                      {matriz.candidatos.map((c) => (
                        <td key={c.id} className="px-2 py-2 text-right tabular-nums">
                          {c.totalVotos.toLocaleString('pt-BR')}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between border-t border-card px-4 py-3 text-xs text-text-secondary">
                  <span>
                    Página {pagina} de {totalPaginas}
                    {agrupamento === 'bairro'
                      ? ` · ${gruposBairro.length} bairros · ${matriz.linhas.length} seções`
                      : ` · ${gruposLocal.length} locais · ${matriz.linhas.length} seções`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pagina <= 1}
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      className="rounded border border-card px-2 py-1 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={pagina >= totalPaginas}
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                      className="rounded border border-card px-2 py-1 disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BadgeBairro({ bairro }: { bairro: string | null | undefined }) {
  const nome = bairro?.trim()
  if (!nome) return null
  return (
    <span className="inline-flex rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-[10px] font-medium text-text-primary">
      {nome}
    </span>
  )
}

function MetaLocalSecao({
  nrZona,
  nrSecao,
  nrLocalVotacao,
  nmBairro,
  endereco,
  ocultarBairro = false,
}: {
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmBairro: string | null | undefined
  endereco: string | null | undefined
  ocultarBairro?: boolean
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[10px] text-text-secondary">
      <span>
        Zona {nrZona} · Seção {nrSecao}
        {nrLocalVotacao != null ? ` · Local ${nrLocalVotacao}` : ''}
      </span>
      {!ocultarBairro ? <BadgeBairro bairro={nmBairro} /> : null}
      {endereco ? <span className="basis-full sm:basis-auto">· {endereco}</span> : null}
    </div>
  )
}

function CelulasVotosMatriz({
  candidatos,
  votos,
  liderId,
  destacarLider = true,
}: {
  candidatos: CandidatoMatrizColuna[]
  votos: Record<string, number>
  liderId: string | null
  destacarLider?: boolean
}) {
  return (
    <>
      {candidatos.map((c) => {
        const qt = votos[c.id] ?? 0
        const lider = destacarLider && liderId === c.id && qt > 0
        return (
          <td
            key={c.id}
            className={cn(
              'px-2 py-2 text-right tabular-nums',
              lider && 'bg-accent-gold/15 font-semibold text-text-primary',
              !qt && 'text-text-secondary/40',
            )}
          >
            {qt > 0 ? qt.toLocaleString('pt-BR') : '—'}
          </td>
        )
      })}
    </>
  )
}

function GrupoBairroRows({
  grupo,
  candidatos,
  bairroExpandido,
  locaisExpandidos,
  onToggleBairro,
  onToggleLocal,
}: {
  grupo: GrupoBairroMatriz
  candidatos: CandidatoMatrizColuna[]
  bairroExpandido: boolean
  locaisExpandidos: Set<string>
  onToggleBairro: () => void
  onToggleLocal: (localId: string) => void
}) {
  const localUnico = grupo.totalLocais === 1 ? grupo.locais[0] : null

  // 1 local · 1 seção → linha única do bairro (sem badge duplicado)
  if (localUnico && localUnico.totalSecoes === 1) {
    const secao = localUnico.secoes[0]
    const endereco = localUnico.dsEndereco?.trim()
    return (
      <tr className="border-b border-card/50 bg-accent-gold/5 hover:bg-accent-gold/10">
        <td className="sticky left-0 z-10 bg-accent-gold/5 px-2 py-2">
          <div className="font-semibold text-text-primary">{grupo.nmBairro}</div>
          <div className="mt-0.5 font-medium text-text-primary">
            {localUnico.nmLocalVotacao || 'Local não informado'}
          </div>
          <MetaLocalSecao
            nrZona={localUnico.nrZona}
            nrSecao={secao.nrSecao}
            nrLocalVotacao={localUnico.nrLocalVotacao}
            nmBairro={null}
            endereco={endereco}
            ocultarBairro
          />
        </td>
        <CelulasVotosMatriz candidatos={candidatos} votos={grupo.votos} liderId={grupo.liderId} />
      </tr>
    )
  }

  const rotuloContagem =
    grupo.totalLocais === 1
      ? `${grupo.totalSecoes} seções`
      : `${grupo.totalLocais} locais · ${grupo.totalSecoes} seções`

  return (
    <>
      <tr className="border-b border-card/50 bg-accent-gold/5 hover:bg-accent-gold/10">
        <td className="sticky left-0 z-10 bg-accent-gold/5 px-2 py-2">
          <button
            type="button"
            onClick={onToggleBairro}
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={bairroExpandido}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary">
              {bairroExpandido ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-text-primary">{grupo.nmBairro}</span>
                <span className="rounded-full border border-card bg-surface px-2 py-0.5 text-[10px] tabular-nums text-text-secondary">
                  {rotuloContagem}
                </span>
              </span>
            </span>
          </button>
        </td>
        <CelulasVotosMatriz candidatos={candidatos} votos={grupo.votos} liderId={grupo.liderId} />
      </tr>
      {bairroExpandido
        ? grupo.locais.map((local) => (
            <GrupoLocalRows
              key={local.id}
              grupo={local}
              candidatos={candidatos}
              expandido={locaisExpandidos.has(`${grupo.id}::${local.id}`)}
              multiSecao={local.totalSecoes > 1}
              onToggle={() => onToggleLocal(local.id)}
              indent={1}
              ocultarBairro
            />
          ))
        : null}
    </>
  )
}

function GrupoLocalRows({
  grupo,
  candidatos,
  expandido,
  multiSecao,
  onToggle,
  indent = 0,
  ocultarBairro = false,
}: {
  grupo: GrupoLocalMatriz
  candidatos: CandidatoMatrizColuna[]
  expandido: boolean
  multiSecao: boolean
  onToggle: () => void
  indent?: number
  ocultarBairro?: boolean
}) {
  const tituloLocal = grupo.nmLocalVotacao || 'Local não informado'
  const endereco = grupo.dsEndereco?.trim()
  const padLeft = indent === 0 ? '' : indent === 1 ? 'pl-6' : 'pl-10'

  if (!multiSecao) {
    const secao = grupo.secoes[0]
    return (
      <tr className="border-b border-card/50 hover:bg-background/30">
        <td className={cn('sticky left-0 z-10 bg-surface px-2 py-2', padLeft)}>
          <div className="font-medium text-text-primary">{tituloLocal}</div>
          <MetaLocalSecao
            nrZona={grupo.nrZona}
            nrSecao={secao.nrSecao}
            nrLocalVotacao={grupo.nrLocalVotacao}
            nmBairro={grupo.nmBairro ?? secao.nmBairro}
            endereco={endereco}
            ocultarBairro={ocultarBairro}
          />
        </td>
        <CelulasVotosMatriz
          candidatos={candidatos}
          votos={secao.votos}
          liderId={secao.liderId}
        />
      </tr>
    )
  }

  return (
    <>
      <tr className="border-b border-card/50 bg-background/20 hover:bg-background/40">
        <td className={cn('sticky left-0 z-10 bg-background/30 px-2 py-2', padLeft)}>
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={expandido}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary">
              {expandido ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2">
                <span className="font-semibold text-text-primary">{tituloLocal}</span>
                {!ocultarBairro ? <BadgeBairro bairro={grupo.nmBairro} /> : null}
                <span className="rounded-full border border-card bg-surface px-2 py-0.5 text-[10px] tabular-nums text-text-secondary">
                  {grupo.totalSecoes} seções
                </span>
              </span>
              <span className="mt-0.5 block">
                <MetaLocalSecao
                  nrZona={grupo.nrZona}
                  nrSecao={grupo.secoes[0]?.nrSecao ?? 0}
                  nrLocalVotacao={grupo.nrLocalVotacao}
                  nmBairro={grupo.nmBairro}
                  endereco={endereco}
                  ocultarBairro={ocultarBairro}
                />
              </span>
            </span>
          </button>
        </td>
        <CelulasVotosMatriz
          candidatos={candidatos}
          votos={grupo.votos}
          liderId={grupo.liderId}
        />
      </tr>
      {expandido
        ? grupo.secoes.map((secao) => (
            <LinhaSecaoMatriz
              key={secao.localId}
              secao={secao}
              candidatos={candidatos}
              indent={indent + 1}
              ocultarBairro={ocultarBairro}
            />
          ))
        : null}
    </>
  )
}

function LinhaSecaoMatriz({
  secao,
  candidatos,
  indent = 0,
  ocultarBairro = false,
}: {
  secao: LinhaMatrizSecao
  candidatos: CandidatoMatrizColuna[]
  indent?: number
  ocultarBairro?: boolean
}) {
  const padLeft = indent <= 0 ? 'pl-9' : indent === 1 ? 'pl-12' : 'pl-16'

  return (
    <tr className="border-b border-card/30 hover:bg-background/20">
      <td className={cn('sticky left-0 z-10 bg-surface/95 px-2 py-1.5', padLeft)}>
        <div className="text-text-primary">
          Seção <span className="tabular-nums font-medium">{secao.nrSecao}</span>
        </div>
        <div className="text-[10px] text-text-secondary">
          Zona {secao.nrZona}
          {secao.nrLocalVotacao != null ? ` · Local ${secao.nrLocalVotacao}` : ''}
        </div>
        {!ocultarBairro ? <BadgeBairro bairro={secao.nmBairro} /> : null}
      </td>
      <CelulasVotosMatriz
        candidatos={candidatos}
        votos={secao.votos}
        liderId={secao.liderId}
      />
    </tr>
  )
}

function ResumoCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-card bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-semibold text-text-primary truncate" title={valor}>
        {valor}
      </p>
    </div>
  )
}

function CandidatoChip({
  candidato,
  ativo,
  onRemove,
}: {
  candidato: CandidatoMatrizColuna
  ativo?: boolean
  onRemove?: () => void
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]',
        ativo
          ? 'border-accent-gold/40 bg-accent-gold/10 text-text-primary'
          : 'border-card bg-background text-text-secondary',
      )}
    >
      <span className="font-medium tabular-nums">{candidato.nrVotavel}</span>
      <span className="max-w-[8rem] truncate">{candidato.nmVotavel}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="rounded p-0.5 hover:bg-background" aria-label="Remover">
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
}
