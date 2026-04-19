'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Loader2, Shield } from 'lucide-react'
import type { PontoVotosComparacao, PontoVotosMunicipio } from '@/components/mapa-votos-historico-municipal'
import { ComparativoVotacao20182022Municipios } from '@/components/comparativo-votacao-2018-2022-municipios'
import { nomeIndicaPerfilMilitar } from '@/lib/perfil-militar-nome'

const MapaVotosHistoricoMunicipal = dynamic(
  () =>
    import('@/components/mapa-votos-historico-municipal').then((m) => ({
      default: m.MapaVotosHistoricoMunicipal,
    })),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-card" /> }
)

const MapaVotosMunicipioCompare = dynamic(
  () =>
    import('@/components/mapa-votos-historico-municipal').then((m) => ({
      default: m.MapaVotosMunicipioCompare,
    })),
  { ssr: false, loading: () => <div className="h-[420px] animate-pulse rounded-xl bg-card" /> }
)

type ResultadoItem = {
  nome: string
  votos: number
  partido: string | null
  nomeRegistroCivil?: string | null
}
type ResumoMeta = { totalVotos: number; totalCandidatos: number; partidos: string[] }

type StaticPayload = {
  scope: 'total_geral'
  resultados2018: ResultadoItem[]
  resultados2022: ResultadoItem[]
  resumo2018: ResumoMeta
  resumo2022: ResumoMeta
}
type PrevisaoPayload = {
  scope: 'total_geral'
  cenarioPrincipal: { id: string; nome: string }
  previsao2026: ResultadoItem[]
  resumo2026: ResumoMeta
}

const STATIC_CACHE_KEY = 'historico_federal_static_v2_nome_urna_2018'

function filtrarPorPerfilMilitar(items: ResultadoItem[], ativo: boolean): ResultadoItem[] {
  if (!ativo) return items
  return items.filter((i) => nomeIndicaPerfilMilitar(i.nome))
}

function metaParaLista(items: ResultadoItem[]): ResumoMeta {
  const totalVotos = items.reduce((acc, i) => acc + i.votos, 0)
  const partidos = [...new Set(items.map((i) => i.partido).filter((p): p is string => Boolean(p)))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR')
  )
  return {
    totalVotos,
    totalCandidatos: items.length,
    partidos,
  }
}

type OptCandidato = { nome: string; nomeRegistroCivil: string | null }

function candidatoToValue(o: OptCandidato): string {
  return JSON.stringify({ n: o.nome, c: o.nomeRegistroCivil })
}

function candidatoFromValue(s: string): OptCandidato | null {
  try {
    const o = JSON.parse(s) as { n: string; c: string | null }
    if (!o || typeof o.n !== 'string') return null
    return { nome: o.n, nomeRegistroCivil: o.c || null }
  } catch {
    return null
  }
}

function mergedCandidatosOpções(a: ResultadoItem[], b: ResultadoItem[]): OptCandidato[] {
  const map = new Map<string, OptCandidato>()
  for (const item of [...a, ...b]) {
    const key = `${item.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')}|${(item.nomeRegistroCivil || '').toLowerCase()}`
    if (!map.has(key)) {
      map.set(key, {
        nome: item.nome,
        nomeRegistroCivil: item.nomeRegistroCivil?.trim() || null,
      })
    }
  }
  return [...map.values()].sort((x, y) => x.nome.localeCompare(y.nome, 'pt-BR'))
}

type ModoMapa = 'todos' | 'candidato' | 'comparar'

type MapaSingleJson = {
  tipo?: string
  error?: string
  pontos?: PontoVotosMunicipio[]
  label?: string
  totalVotos?: number
}

type MapaCompararJson = {
  tipo?: string
  error?: string
  pontos?: PontoVotosComparacao[]
  labelA?: string
  labelB?: string
}

function buildMapaUrl(
  ano: 2018 | 2022,
  modo: ModoMapa,
  c: OptCandidato | null,
  ca: OptCandidato | null,
  cb: OptCandidato | null,
  filtroPerfilMilitar: boolean
): string {
  const u = new URL('/api/resumo-eleicoes/historico-federal/mapa-por-municipio', window.location.origin)
  u.searchParams.set('ano', String(ano))
  u.searchParams.set('modo', modo)
  if (filtroPerfilMilitar) u.searchParams.set('filtroMilitar', 'true')
  if (modo === 'candidato' && c) {
    u.searchParams.set('nome', c.nome)
    if (c.nomeRegistroCivil) u.searchParams.set('nomeCivil', c.nomeRegistroCivil)
  }
  if (modo === 'comparar' && ca && cb) {
    u.searchParams.set('nomeA', ca.nome)
    if (ca.nomeRegistroCivil) u.searchParams.set('nomeCivilA', ca.nomeRegistroCivil)
    u.searchParams.set('nomeB', cb.nome)
    if (cb.nomeRegistroCivil) u.searchParams.set('nomeCivilB', cb.nomeRegistroCivil)
  }
  return u.toString()
}

export default function HistoricoEleicoesPage() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [staticData, setStaticData] = useState<StaticPayload | null>(null)
  const [previsaoData, setPrevisaoData] = useState<PrevisaoPayload | null>(null)
  const [filtroPerfilMilitar, setFiltroPerfilMilitar] = useState(false)

  const [modoMapa, setModoMapa] = useState<ModoMapa>('todos')
  /** Quando true, um único conjunto de candidatos alimenta 2018 e 2022. */
  const [filtrosSincronizados, setFiltrosSincronizados] = useState<boolean>(true)
  const [candidatoVal, setCandidatoVal] = useState<string>('')
  const [candidatoAVal, setCandidatoAVal] = useState<string>('')
  const [candidatoBVal, setCandidatoBVal] = useState<string>('')
  const [candidatoVal18, setCandidatoVal18] = useState<string>('')
  const [candidatoVal22, setCandidatoVal22] = useState<string>('')
  const [candidatoA18, setCandidatoA18] = useState<string>('')
  const [candidatoB18, setCandidatoB18] = useState<string>('')
  const [candidatoA22, setCandidatoA22] = useState<string>('')
  const [candidatoB22, setCandidatoB22] = useState<string>('')

  const [mapa18, setMapa18] = useState<MapaSingleJson | MapaCompararJson | null>(null)
  const [mapa22, setMapa22] = useState<MapaSingleJson | MapaCompararJson | null>(null)
  const [mapaLoading, setMapaLoading] = useState(false)
  const [mapaError, setMapaError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        let staticPayload: StaticPayload | null = null
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem(STATIC_CACHE_KEY)
          if (cached) {
            try {
              staticPayload = JSON.parse(cached) as StaticPayload
            } catch {
              window.localStorage.removeItem(STATIC_CACHE_KEY)
            }
          }
        }
        if (!staticPayload) {
          const staticRes = await fetch('/api/resumo-eleicoes/historico-federal?section=static')
          const staticJson = (await staticRes.json()) as StaticPayload & { error?: string }
          if (!staticRes.ok) throw new Error(staticJson.error || 'Erro ao carregar base histórica')
          staticPayload = staticJson
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STATIC_CACHE_KEY, JSON.stringify(staticPayload))
          }
        }
        const previsaoRes = await fetch('/api/resumo-eleicoes/historico-federal?section=previsao', {
          cache: 'no-store',
        })
        const previsaoJson = (await previsaoRes.json()) as PrevisaoPayload & { error?: string }
        if (!previsaoRes.ok) throw new Error(previsaoJson.error || 'Erro ao carregar previsão 2026')
        if (!active) return
        setStaticData(staticPayload)
        setPrevisaoData(previsaoJson)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar histórico')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => {
      active = false
    }
  }, [])

  const resultados2018 = useMemo(() => staticData?.resultados2018 ?? [], [staticData])
  const resultados2022 = useMemo(() => staticData?.resultados2022 ?? [], [staticData])
  const previsao2026 = useMemo(() => previsaoData?.previsao2026 ?? [], [previsaoData])

  const lista2018 = useMemo(
    () => filtrarPorPerfilMilitar(resultados2018, filtroPerfilMilitar),
    [resultados2018, filtroPerfilMilitar]
  )
  const lista2022 = useMemo(
    () => filtrarPorPerfilMilitar(resultados2022, filtroPerfilMilitar),
    [resultados2022, filtroPerfilMilitar]
  )
  const lista2026 = useMemo(
    () => filtrarPorPerfilMilitar(previsao2026, filtroPerfilMilitar),
    [previsao2026, filtroPerfilMilitar]
  )

  const meta2018 = useMemo(
    () =>
      filtroPerfilMilitar && staticData ? metaParaLista(lista2018) : staticData?.resumo2018 ?? null,
    [filtroPerfilMilitar, staticData, lista2018]
  )
  const meta2022 = useMemo(
    () =>
      filtroPerfilMilitar && staticData ? metaParaLista(lista2022) : staticData?.resumo2022 ?? null,
    [filtroPerfilMilitar, staticData, lista2022]
  )
  const meta2026 = useMemo(
    () =>
      filtroPerfilMilitar && previsaoData ? metaParaLista(lista2026) : previsaoData?.resumo2026 ?? null,
    [filtroPerfilMilitar, previsaoData, lista2026]
  )

  const opcoesCandidatos = useMemo(() => mergedCandidatosOpções(lista2018, lista2022), [lista2018, lista2022])
  const opcoes2018 = useMemo(() => mergedCandidatosOpções(lista2018, []), [lista2018])
  const opcoes2022 = useMemo(() => mergedCandidatosOpções(lista2022, []), [lista2022])

  const candidatoSel = candidatoFromValue(candidatoVal)
  const candidatoASel = candidatoFromValue(candidatoAVal)
  const candidatoBSel = candidatoFromValue(candidatoBVal)

  const mapaQueryOk = useMemo(() => {
    if (modoMapa === 'todos') return true
    if (filtrosSincronizados) {
      if (modoMapa === 'candidato') return Boolean(candidatoSel)
      if (modoMapa === 'comparar') {
        return Boolean(
          candidatoASel &&
            candidatoBSel &&
            candidatoToValue(candidatoASel) !== candidatoToValue(candidatoBSel)
        )
      }
    } else {
      const c18 = candidatoFromValue(candidatoVal18)
      const c22 = candidatoFromValue(candidatoVal22)
      const a18 = candidatoFromValue(candidatoA18)
      const b18 = candidatoFromValue(candidatoB18)
      const a22 = candidatoFromValue(candidatoA22)
      const b22 = candidatoFromValue(candidatoB22)
      if (modoMapa === 'candidato') return Boolean(c18 && c22)
      if (modoMapa === 'comparar') {
        return Boolean(
          a18 &&
            b18 &&
            a22 &&
            b22 &&
            candidatoToValue(a18) !== candidatoToValue(b18) &&
            candidatoToValue(a22) !== candidatoToValue(b22)
        )
      }
    }
    return false
  }, [
    modoMapa,
    filtrosSincronizados,
    candidatoSel,
    candidatoASel,
    candidatoBSel,
    candidatoVal18,
    candidatoVal22,
    candidatoA18,
    candidatoB18,
    candidatoA22,
    candidatoB22,
  ])

  const carregarMapas = useCallback(async () => {
    if (!mapaQueryOk) {
      setMapa18(null)
      setMapa22(null)
      return
    }
    setMapaLoading(true)
    setMapaError(null)
    try {
      let c18: OptCandidato | null = null
      let c22: OptCandidato | null = null
      let ca18: OptCandidato | null = null
      let cb18: OptCandidato | null = null
      let ca22: OptCandidato | null = null
      let cb22: OptCandidato | null = null

      if (modoMapa === 'candidato') {
        if (filtrosSincronizados) {
          c18 = candidatoSel
          c22 = candidatoSel
        } else {
          c18 = candidatoFromValue(candidatoVal18)
          c22 = candidatoFromValue(candidatoVal22)
        }
      } else if (modoMapa === 'comparar') {
        if (filtrosSincronizados) {
          ca18 = candidatoASel
          cb18 = candidatoBSel
          ca22 = candidatoASel
          cb22 = candidatoBSel
        } else {
          ca18 = candidatoFromValue(candidatoA18)
          cb18 = candidatoFromValue(candidatoB18)
          ca22 = candidatoFromValue(candidatoA22)
          cb22 = candidatoFromValue(candidatoB22)
        }
      }

      const u18 = buildMapaUrl(2018, modoMapa, c18, ca18, cb18, filtroPerfilMilitar)
      const u22 = buildMapaUrl(2022, modoMapa, c22, ca22, cb22, filtroPerfilMilitar)
      const [r18, r22] = await Promise.all([
        fetch(u18, { cache: 'no-store' }),
        fetch(u22, { cache: 'no-store' }),
      ])
      const j18 = (await r18.json()) as MapaSingleJson & MapaCompararJson
      const j22 = (await r22.json()) as MapaSingleJson & MapaCompararJson
      if (!r18.ok) throw new Error(j18.error || 'Erro ao carregar mapa 2018')
      if (!r22.ok) throw new Error(j22.error || 'Erro ao carregar mapa 2022')
      setMapa18(j18)
      setMapa22(j22)
    } catch (e) {
      setMapaError(e instanceof Error ? e.message : 'Erro ao carregar mapas')
      setMapa18(null)
      setMapa22(null)
    } finally {
      setMapaLoading(false)
    }
  }, [
    mapaQueryOk,
    modoMapa,
    filtrosSincronizados,
    filtroPerfilMilitar,
    candidatoSel,
    candidatoASel,
    candidatoBSel,
    candidatoVal18,
    candidatoVal22,
    candidatoA18,
    candidatoB18,
    candidatoA22,
    candidatoB22,
  ])

  useEffect(() => {
    void carregarMapas()
  }, [carregarMapas])

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link
            href="/dashboard/resumo-eleicoes"
            className="inline-flex items-center gap-2 rounded-lg border border-card bg-surface px-3 py-2 text-sm text-text-primary hover:bg-background"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao resumo
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Histórico eleitoral</h1>
            <p className="text-sm text-secondary">Federal 2018 × Federal 2022 × Cenário principal 2026</p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-secondary">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando histórico...
          </div>
        ) : error ? (
          <div className="rounded-xl border border-status-error/30 bg-status-error/10 p-4 text-sm text-status-error">
            {error}
          </div>
        ) : !staticData || !previsaoData ? (
          <div className="rounded-xl border border-dashed border-card p-6 text-secondary">Sem dados.</div>
        ) : (
          <>
            <div className="mb-6 rounded-xl border border-card bg-surface p-4 text-sm text-secondary">
              <p>
                <strong className="text-text-primary">Escopo:</strong> total geral (PI / federal na base).{' '}
                <strong className="text-text-primary">Cenário principal:</strong>{' '}
                {previsaoData.cenarioPrincipal.nome}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-text-secondary">
                <strong className="text-text-primary">2018:</strong> quando o nome na base é o registro civil e há nome
                de urna mapeado, a lista mostra o nome de urna e o civil em linha auxiliar.
              </p>
            </div>

            <label className="mb-6 flex cursor-pointer items-start gap-3 rounded-xl border border-card bg-surface p-4">
              <input
                type="checkbox"
                checked={filtroPerfilMilitar}
                onChange={(e) => setFiltroPerfilMilitar(e.target.checked)}
                className="mt-1 h-4 w-4 shrink-0 rounded border-card text-accent-gold focus:ring-accent-gold-soft"
              />
              <div>
                <span className="flex items-center gap-2 text-sm font-medium text-text-primary">
                  <Shield className="h-4 w-4 text-accent-gold" />
                  Filtrar por perfil militar / hierarquia
                </span>
                <p className="mt-1 text-xs text-secondary leading-relaxed">
                  Afeta tabelas, listas nos controles dos mapas e os dados georreferenciados (totais por cidade
                  restringidos ao perfil quando o filtro está ativo).
                </p>
              </div>
            </label>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
              {(
                [
                  {
                    title: 'Resultado 2018',
                    data: lista2018,
                    accent: 'text-text-primary',
                    meta: meta2018 ?? staticData.resumo2018,
                  },
                  {
                    title: 'Resultado 2022',
                    data: lista2022,
                    accent: 'text-text-primary',
                    meta: meta2022 ?? staticData.resumo2022,
                  },
                  {
                    title: 'Previsão 2026',
                    data: lista2026,
                    accent: 'text-accent-gold',
                    meta: meta2026 ?? previsaoData.resumo2026,
                  },
                ] as const
              ).map((section) => (
                <div key={section.title} className="overflow-hidden rounded-xl border border-card bg-surface">
                  <div className="border-b border-card bg-background px-3 py-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                    {section.title}
                  </div>
                  <div className="border-b border-card px-3 py-2 text-[11px] text-text-secondary">
                    <span className="font-semibold text-text-primary">
                      {section.meta.totalCandidatos.toLocaleString('pt-BR')}
                    </span>{' '}
                    candidatos
                    <span className="mx-2">|</span>
                    Total de votos:{' '}
                    <span className="font-semibold text-text-primary">
                      {section.meta.totalVotos.toLocaleString('pt-BR')}
                    </span>
                    <div className="mt-1 truncate">
                      Partidos:{' '}
                      <span className="font-medium text-text-primary">
                        {section.meta.partidos.length > 0 ? section.meta.partidos.join(', ') : 'N/D'}
                      </span>
                    </div>
                  </div>
                  <div className="max-h-[70vh] overflow-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs uppercase tracking-wide text-secondary">
                          <th className="px-3 py-2">Candidato</th>
                          <th className="px-3 py-2 text-right">Votos</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.data.map((item) => (
                          <tr
                            key={`${section.title}-${item.nome}-${item.nomeRegistroCivil ?? ''}`}
                            className="border-t border-card"
                          >
                            <td className="px-3 py-2 text-text-primary">
                              <div className="font-medium">{item.nome}</div>
                              {item.nomeRegistroCivil ? (
                                <div className="mt-0.5 text-[10px] font-normal leading-snug text-secondary">
                                  Registro civil: {item.nomeRegistroCivil}
                                </div>
                              ) : null}
                            </td>
                            <td className={`px-3 py-2 text-right font-semibold ${section.accent}`}>
                              {item.votos.toLocaleString('pt-BR')}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
            </div>

            <section className="mb-10 mt-10 rounded-2xl border border-card bg-surface p-5">
              <h2 className="text-base font-semibold text-text-primary">Mapas por município (PI)</h2>
              <p className="mt-1 text-xs text-secondary leading-relaxed">
                {filtroPerfilMilitar ? (
                  <>
                    Com o <strong className="text-text-primary">filtro militar</strong> ativo, no modo &quot;Todos&quot;
                    cada cidade soma apenas votos de candidatos com perfil militar/hierarquia (mesmo critério das tabelas
                    acima). Nos outros modos, use apenas as opções da lista filtrada.
                  </>
                ) : (
                  <>
                    Dois painéis: <strong className="text-text-primary">2018</strong> e{' '}
                    <strong className="text-text-primary">2022</strong>. Em &quot;Todos&quot;, soma dos votos nominais de
                    todos os deputados federais por cidade. Em &quot;Comparar&quot;, a cor indica quem venceu no
                    município (azul = candidato A, âmbar = B); o tamanho reflete a soma dos dois.
                  </>
                )}
              </p>

              <div className="mt-4 flex flex-wrap items-end gap-4">
                <div className="min-w-[200px]">
                  <label className="block text-xs font-medium text-secondary mb-1">Modo do mapa</label>
                  <select
                    value={modoMapa}
                    onChange={(e) => setModoMapa(e.target.value as ModoMapa)}
                    className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
                  >
                    <option value="todos">Todos os candidatos (total por cidade)</option>
                    <option value="candidato">Um candidato</option>
                    <option value="comparar">Comparar dois candidatos</option>
                  </select>
                </div>
              </div>

              {modoMapa !== 'todos' && (
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg border border-card bg-background px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={filtrosSincronizados}
                    onChange={(e) => {
                      const checked = e.target.checked
                      setFiltrosSincronizados(checked)
                      if (checked) {
                        if (!candidatoVal) {
                          if (candidatoVal18) setCandidatoVal(candidatoVal18)
                          else if (candidatoVal22) setCandidatoVal(candidatoVal22)
                        }
                        if (!candidatoAVal) {
                          if (candidatoA18) setCandidatoAVal(candidatoA18)
                          else if (candidatoA22) setCandidatoAVal(candidatoA22)
                        }
                        if (!candidatoBVal) {
                          if (candidatoB18) setCandidatoBVal(candidatoB18)
                          else if (candidatoB22) setCandidatoBVal(candidatoB22)
                        }
                      } else {
                        if (candidatoVal) {
                          setCandidatoVal18(candidatoVal)
                          setCandidatoVal22(candidatoVal)
                        }
                        if (candidatoAVal) {
                          setCandidatoA18(candidatoAVal)
                          setCandidatoA22(candidatoAVal)
                        }
                        if (candidatoBVal) {
                          setCandidatoB18(candidatoBVal)
                          setCandidatoB22(candidatoBVal)
                        }
                      }
                    }}
                    className="mt-0.5 h-4 w-4 shrink-0 rounded border-card text-accent-gold focus:ring-accent-gold-soft"
                  />
                  <div className="text-xs text-secondary leading-relaxed">
                    <span className="font-medium text-text-primary">Mesmos candidatos nos dois mapas</span>
                    <p className="mt-0.5">
                      Desmarque para escolher candidatos distintos em 2018 e 2022 (listas separadas por eleição).
                    </p>
                  </div>
                </label>
              )}

              <div className="mt-4 flex flex-col gap-4">
                {modoMapa === 'candidato' && filtrosSincronizados && (
                  <div className="min-w-[260px] w-full max-w-xl">
                    <label className="block text-xs font-medium text-secondary mb-1">Candidato (2018 e 2022)</label>
                    <select
                      value={candidatoVal}
                      onChange={(e) => setCandidatoVal(e.target.value)}
                      className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
                    >
                      <option value="">Selecione…</option>
                      {opcoesCandidatos.map((o) => (
                        <option key={candidatoToValue(o)} value={candidatoToValue(o)}>
                          {o.nome}
                          {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {modoMapa === 'candidato' && !filtrosSincronizados && (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">2018 — candidato</label>
                      <select
                        value={candidatoVal18}
                        onChange={(e) => setCandidatoVal18(e.target.value)}
                        className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
                      >
                        <option value="">Selecione…</option>
                        {opcoes2018.map((o) => (
                          <option key={`18-${candidatoToValue(o)}`} value={candidatoToValue(o)}>
                            {o.nome}
                            {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-secondary mb-1">2022 — candidato</label>
                      <select
                        value={candidatoVal22}
                        onChange={(e) => setCandidatoVal22(e.target.value)}
                        className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
                      >
                        <option value="">Selecione…</option>
                        {opcoes2022.map((o) => (
                          <option key={`22-${candidatoToValue(o)}`} value={candidatoToValue(o)}>
                            {o.nome}
                            {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {modoMapa === 'comparar' && filtrosSincronizados && (
                  <div className="flex flex-wrap gap-4">
                    <div className="min-w-[240px] flex-1">
                      <label className="block text-xs font-medium text-secondary mb-1">Candidato A (azul)</label>
                      <select
                        value={candidatoAVal}
                        onChange={(e) => setCandidatoAVal(e.target.value)}
                        className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
                      >
                        <option value="">Selecione…</option>
                        {opcoesCandidatos.map((o) => (
                          <option key={`a-${candidatoToValue(o)}`} value={candidatoToValue(o)}>
                            {o.nome}
                            {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="min-w-[240px] flex-1">
                      <label className="block text-xs font-medium text-secondary mb-1">Candidato B (âmbar)</label>
                      <select
                        value={candidatoBVal}
                        onChange={(e) => setCandidatoBVal(e.target.value)}
                        className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary"
                      >
                        <option value="">Selecione…</option>
                        {opcoesCandidatos.map((o) => (
                          <option key={`b-${candidatoToValue(o)}`} value={candidatoToValue(o)}>
                            {o.nome}
                            {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {modoMapa === 'comparar' && !filtrosSincronizados && (
                  <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                    <div className="rounded-lg border border-card bg-background p-3 space-y-3">
                      <p className="text-xs font-semibold text-text-primary">Federal 2018</p>
                      <div>
                        <label className="block text-xs font-medium text-secondary mb-1">Candidato A (azul)</label>
                        <select
                          value={candidatoA18}
                          onChange={(e) => setCandidatoA18(e.target.value)}
                          className="w-full rounded-lg border border-card bg-surface px-3 py-2 text-sm text-text-primary"
                        >
                          <option value="">Selecione…</option>
                          {opcoes2018.map((o) => (
                            <option key={`18a-${candidatoToValue(o)}`} value={candidatoToValue(o)}>
                              {o.nome}
                              {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-secondary mb-1">Candidato B (âmbar)</label>
                        <select
                          value={candidatoB18}
                          onChange={(e) => setCandidatoB18(e.target.value)}
                          className="w-full rounded-lg border border-card bg-surface px-3 py-2 text-sm text-text-primary"
                        >
                          <option value="">Selecione…</option>
                          {opcoes2018.map((o) => (
                            <option key={`18b-${candidatoToValue(o)}`} value={candidatoToValue(o)}>
                              {o.nome}
                              {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="rounded-lg border border-card bg-background p-3 space-y-3">
                      <p className="text-xs font-semibold text-text-primary">Federal 2022</p>
                      <div>
                        <label className="block text-xs font-medium text-secondary mb-1">Candidato A (azul)</label>
                        <select
                          value={candidatoA22}
                          onChange={(e) => setCandidatoA22(e.target.value)}
                          className="w-full rounded-lg border border-card bg-surface px-3 py-2 text-sm text-text-primary"
                        >
                          <option value="">Selecione…</option>
                          {opcoes2022.map((o) => (
                            <option key={`22a-${candidatoToValue(o)}`} value={candidatoToValue(o)}>
                              {o.nome}
                              {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-secondary mb-1">Candidato B (âmbar)</label>
                        <select
                          value={candidatoB22}
                          onChange={(e) => setCandidatoB22(e.target.value)}
                          className="w-full rounded-lg border border-card bg-surface px-3 py-2 text-sm text-text-primary"
                        >
                          <option value="">Selecione…</option>
                          {opcoes2022.map((o) => (
                            <option key={`22b-${candidatoToValue(o)}`} value={candidatoToValue(o)}>
                              {o.nome}
                              {o.nomeRegistroCivil ? ` — civil: ${o.nomeRegistroCivil}` : ''}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {!mapaQueryOk && modoMapa !== 'todos' && (
                <p className="mt-3 text-xs text-amber-700 dark:text-amber-400">
                  {modoMapa === 'candidato' &&
                    (filtrosSincronizados
                      ? 'Selecione um candidato para carregar os mapas.'
                      : 'Selecione o candidato na lista de 2018 e o da lista de 2022.')}
                  {modoMapa === 'comparar' &&
                    (filtrosSincronizados
                      ? !candidatoASel || !candidatoBSel
                        ? 'Selecione os dois candidatos.'
                        : 'Escolha dois candidatos diferentes.'
                      : 'Em cada bloco (2018 e 2022), selecione A e B com A ≠ B.')}
                </p>
              )}

              {mapaError && (
                <div className="mt-4 rounded-lg border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
                  {mapaError}
                </div>
              )}

              {mapaLoading && (
                <div className="mt-6 flex items-center gap-2 text-sm text-secondary">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Atualizando mapas…
                </div>
              )}

              {!mapaLoading && mapaQueryOk && mapa18 && mapa22 && (
                <div className="mt-6 grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {mapa18.tipo === 'comparar' && mapa22.tipo === 'comparar' ? (
                    <>
                      <MapaVotosMunicipioCompare
                        pontos={(mapa18 as MapaCompararJson).pontos ?? []}
                        labelA={(mapa18 as MapaCompararJson).labelA ?? 'A'}
                        labelB={(mapa18 as MapaCompararJson).labelB ?? 'B'}
                        titulo="Federal 2018 — comparação"
                        subtitulo={`${(mapa18 as MapaCompararJson).labelA} × ${(mapa18 as MapaCompararJson).labelB}`}
                      />
                      <MapaVotosMunicipioCompare
                        pontos={(mapa22 as MapaCompararJson).pontos ?? []}
                        labelA={(mapa22 as MapaCompararJson).labelA ?? 'A'}
                        labelB={(mapa22 as MapaCompararJson).labelB ?? 'B'}
                        titulo="Federal 2022 — comparação"
                        subtitulo={`${(mapa22 as MapaCompararJson).labelA} × ${(mapa22 as MapaCompararJson).labelB}`}
                      />
                    </>
                  ) : (
                    <>
                      <MapaVotosHistoricoMunicipal
                        pontos={(mapa18 as MapaSingleJson).pontos ?? []}
                        titulo="Federal 2018"
                        subtitulo={(mapa18 as MapaSingleJson).label ?? ''}
                      />
                      <MapaVotosHistoricoMunicipal
                        pontos={(mapa22 as MapaSingleJson).pontos ?? []}
                        titulo="Federal 2022"
                        subtitulo={(mapa22 as MapaSingleJson).label ?? ''}
                      />
                    </>
                  )}
                </div>
              )}

              {!mapaLoading &&
                mapaQueryOk &&
                mapa18 &&
                mapa22 &&
                mapa18.tipo === 'single' &&
                mapa22.tipo === 'single' && (
                  <ComparativoVotacao20182022Municipios
                    pontos18={(mapa18 as MapaSingleJson).pontos ?? []}
                    pontos22={(mapa22 as MapaSingleJson).pontos ?? []}
                    escopoResumo={(() => {
                      const l18 = (mapa18 as MapaSingleJson).label ?? ''
                      const l22 = (mapa22 as MapaSingleJson).label ?? ''
                      return l18 === l22 ? l18 : `${l18} (2018) · ${l22} (2022)`
                    })()}
                  />
                )}

              <p className="mt-6 text-xs text-secondary border-t border-card pt-4">
                <strong className="text-text-primary">2026:</strong> a previsão por cenário não inclui mapa municipal
                nesta tela — totais agregados estão na tabela acima.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  )
}
