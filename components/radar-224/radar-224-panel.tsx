'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Building2,
  ExternalLink,
  Loader2,
  MapPin,
  Newspaper,
  Radar,
  RefreshCw,
  Search,
  Target,
} from 'lucide-react'
import {
  QuickAccessKpiStrip,
  type QuickAccessKpiCardModel,
} from '@/components/monitoramento/quick-access-kpi-card'
import type { RadarNoticiaItem } from '@/lib/radar-224/buscar-noticias'
import type {
  Radar224Resumo,
  RadarFonte,
  RadarFonteCamada,
  RadarMunicipioPrioritario,
} from '@/lib/radar-224/types'
import { cn } from '@/lib/utils'
import { resumoTrZebra } from '@/lib/resumo-eleicoes-table-styles'
import {
  territorioBaseGhostButtonClass,
  territorioBaseTextClass,
} from '@/lib/territorio-base-styles'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

type Aba = 'noticias' | 'municipios' | 'fontes'

type ApiPayload = {
  ok?: boolean
  error?: string
  municipios?: RadarMunicipioPrioritario[]
  fontes?: RadarFonte[]
  resumo?: Radar224Resumo
}

type NoticiasApiPayload = {
  ok?: boolean
  error?: string
  modo?: string
  municipio?: string
  municipios?: string[]
  queries?: number
  brutos?: number
  descartadas?: number
  descartadasContexto?: number
  descartadasAntigas?: number
  janelaDias?: number
  total?: number
  itens?: RadarNoticiaItem[]
  porMunicipio?: Record<string, number>
}

const CAMADA_LABEL: Record<RadarFonteCamada, string> = {
  estadual: 'Estadual',
  regional: 'Regional',
  local: 'Local',
  oficial: 'Oficial',
  rede_social: 'Rede social',
  conteudo_politico: 'Conteúdo político',
}

const STATUS_PILL: Record<string, string> = {
  ativa: 'bg-emerald-500/15 text-emerald-700',
  candidata: 'bg-amber-500/15 text-amber-800',
  pausada: 'bg-slate-500/15 text-slate-600',
  rejeitada: 'bg-red-500/15 text-red-700',
}

function buildKpis(resumo: Radar224Resumo | null): QuickAccessKpiCardModel[] {
  if (!resumo) return []
  return [
    {
      id: 'top',
      icon: Target,
      title: `Top ${resumo.topN}`,
      metricLabel: 'EXPECTATIVA · LEGADO',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Votos',
          text: `${resumo.topNLegado.toLocaleString('pt-BR')} no recorte`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Estado',
          text: `${resumo.topNPctEstado}% de ${resumo.totalEstadoLegado.toLocaleString('pt-BR')}`,
        },
      ],
    },
    {
      id: 'corte',
      icon: MapPin,
      title: 'Corte mínimo',
      metricLabel: '50º MUNICÍPIO',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Legado',
          text: `${resumo.corteMinimoLegado.toLocaleString('pt-BR')} votos`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Base',
          text: `${resumo.cidadesComExpectativa} cidades com expectativa`,
        },
      ],
    },
    {
      id: 'fontes',
      icon: Newspaper,
      title: 'Fontes',
      metricLabel: 'CATÁLOGO · FASE 1',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Ativas',
          text: `${resumo.fontesAtivas} em coleta prevista`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Candidatas',
          text: `${resumo.fontesCandidatas} aguardando validação`,
        },
      ],
    },
    {
      id: 'tds',
      icon: Building2,
      title: 'Territórios',
      metricLabel: 'TD NO TOP N',
      insights: [
        {
          badge: 'leader',
          badgeLabel: 'Cobertos',
          text: `${resumo.territoriosCobertos} TDs com cidade prioritária`,
        },
        {
          badge: 'growth',
          badgeLabel: 'Camadas',
          text: 'Estadual + regional + local + oficial',
        },
      ],
    },
  ]
}

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function Radar224Panel() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [municipios, setMunicipios] = useState<RadarMunicipioPrioritario[]>([])
  const [fontes, setFontes] = useState<RadarFonte[]>([])
  const [resumo, setResumo] = useState<Radar224Resumo | null>(null)
  const [aba, setAba] = useState<Aba>('noticias')
  const [filtroTd, setFiltroTd] = useState<string>('')
  const [filtroCamada, setFiltroCamada] = useState<string>('')
  const [busca, setBusca] = useState('')

  const [municipioBusca, setMunicipioBusca] = useState('')
  const [buscandoNoticias, setBuscandoNoticias] = useState(false)
  const [erroNoticias, setErroNoticias] = useState<string | null>(null)
  const [noticias, setNoticias] = useState<RadarNoticiaItem[]>([])
  const [metaNoticias, setMetaNoticias] = useState<string>('')

  const carregar = useCallback(async (refresh = false) => {
    setLoading(true)
    setError(null)
    try {
      const qs = refresh ? '?refresh=1' : ''
      const res = await fetch(`/api/radar-224${qs}`, { cache: 'no-store' })
      const json = (await res.json()) as ApiPayload
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar Radar 224')
      const lista = json.municipios ?? []
      setMunicipios(lista)
      setFontes(json.fontes ?? [])
      setResumo(json.resumo ?? null)
      setMunicipioBusca((prev) => prev || lista[0]?.municipio || '')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
      setMunicipios([])
      setFontes([])
      setResumo(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const buscarNoticiasMunicipio = useCallback(async () => {
    if (!municipioBusca.trim()) return
    setBuscandoNoticias(true)
    setErroNoticias(null)
    setAba('noticias')
    try {
      const res = await fetch('/api/radar-224/noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ municipio: municipioBusca.trim() }),
      })
      const json = (await res.json()) as NoticiasApiPayload
      if (!res.ok) throw new Error(json.error || 'Falha na busca')
      setNoticias(json.itens ?? [])
      const janela = json.janelaDias ?? 30
      setMetaNoticias(
        `${json.total ?? 0} relevantes (últimos ${janela} dias) · ${json.descartadasContexto ?? 0} fora de contexto · ${json.descartadasAntigas ?? 0} antigas · ${json.queries ?? 0} consultas · ${municipioBusca.trim()}`,
      )
    } catch (e) {
      setErroNoticias(e instanceof Error ? e.message : 'Erro na busca')
      setNoticias([])
      setMetaNoticias('')
    } finally {
      setBuscandoNoticias(false)
    }
  }, [municipioBusca])

  const buscarNoticiasTop5 = useCallback(async () => {
    setBuscandoNoticias(true)
    setErroNoticias(null)
    setAba('noticias')
    try {
      const res = await fetch('/api/radar-224/noticias', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ top: 5, apenasEstaduais: true }),
      })
      const json = (await res.json()) as NoticiasApiPayload
      if (!res.ok) throw new Error(json.error || 'Falha na busca')
      setNoticias(json.itens ?? [])
      const nomes = (json.municipios ?? []).join(', ')
      const janela = json.janelaDias ?? 30
      setMetaNoticias(
        `Top 5 · ${json.total ?? 0} relevantes (últimos ${janela} dias) · ${json.descartadasContexto ?? 0} fora de contexto · ${json.descartadasAntigas ?? 0} antigas · ${json.queries ?? 0} consultas · ${nomes}`,
      )
    } catch (e) {
      setErroNoticias(e instanceof Error ? e.message : 'Erro na busca')
      setNoticias([])
      setMetaNoticias('')
    } finally {
      setBuscandoNoticias(false)
    }
  }, [])

  const kpis = useMemo(() => buildKpis(resumo), [resumo])

  const tds = useMemo(() => {
    const set = new Set<string>()
    for (const m of municipios) {
      if (m.territorio) set.add(m.territorio)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [municipios])

  const municipiosFiltrados = useMemo(() => {
    const q = busca
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    return municipios.filter((m) => {
      if (filtroTd && m.territorio !== filtroTd) return false
      if (!q) return true
      const blob = `${m.municipio} ${m.territorio ?? ''} ${m.fontesRegionais.join(' ')}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return blob.includes(q)
    })
  }, [municipios, filtroTd, busca])

  const fontesFiltradas = useMemo(() => {
    const q = busca
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    return fontes.filter((f) => {
      if (filtroCamada && f.camada !== filtroCamada) return false
      if (!q) return true
      const blob = `${f.nome} ${f.dominio} ${f.coberturaResumo} ${f.selo}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return blob.includes(q)
    })
  }, [fontes, filtroCamada, busca])

  const noticiasFiltradas = useMemo(() => {
    const q = busca
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .trim()
    if (!q) return noticias
    return noticias.filter((n) => {
      const blob = `${n.title} ${n.municipio} ${n.fonteNome} ${n.sourceName ?? ''}`
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
      return blob.includes(q)
    })
  }, [noticias, busca])

  return (
    <div className={cn('flex flex-col gap-4', territorioBaseTextClass)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-2">
            <Radar className="h-4 w-4 text-[#ff9800]" aria-hidden />
            <p className="text-[11px] font-semibold uppercase tracking-wide text-[#ff9800]">
              Radar 224 · fase 1
            </p>
          </div>
          <h1 className="text-lg font-semibold text-text-primary">
            Cobertura noticiosa priorizada
          </h1>
          <p className="mt-1 max-w-2xl text-xs text-text-secondary">
            Busca ao vivo no Google News com <code className="rounded bg-background px-1">site:portal</code>{' '}
            nos estaduais (GP1, MeioNews, 180graus) e regionais do município.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void carregar(true)}
          disabled={loading}
          className={cn(territorioBaseGhostButtonClass, 'disabled:opacity-50')}
        >
          <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} aria-hidden />
          Atualizar base
        </button>
      </div>

      {error ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {error}
        </div>
      ) : null}

      {kpis.length > 0 ? <QuickAccessKpiStrip cards={kpis} /> : null}

      <div className="flex flex-col gap-2 rounded-xl border border-card bg-surface p-3 sm:flex-row sm:flex-wrap sm:items-center">
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[11px] text-text-secondary">
          Município
          <select
            value={municipioBusca}
            onChange={(e) => setMunicipioBusca(e.target.value)}
            disabled={loading || buscandoNoticias || municipios.length === 0}
            className="h-9 rounded-lg border border-card bg-background px-2 text-xs text-text-primary"
          >
            {municipios.map((m) => (
              <option key={m.municipioNormalizado} value={m.municipio}>
                #{m.rank} {m.municipio} ({m.expectativaLegado.toLocaleString('pt-BR')})
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-end gap-2">
          <button
            type="button"
            onClick={() => void buscarNoticiasMunicipio()}
            disabled={buscandoNoticias || !municipioBusca}
            className={cn(sidebarPrimaryCTAButtonClass(false), 'disabled:opacity-50')}
          >
            {buscandoNoticias ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <Search className="h-3.5 w-3.5" aria-hidden />
            )}
            Buscar notícias
          </button>
          <button
            type="button"
            onClick={() => void buscarNoticiasTop5()}
            disabled={buscandoNoticias || municipios.length === 0}
            className={cn(territorioBaseGhostButtonClass, 'disabled:opacity-50')}
            title="Consulta os 5 maiores (só portais estaduais)"
          >
            Buscar top 5
          </button>
        </div>
      </div>

      {erroNoticias ? (
        <div className="rounded-xl border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error">
          {erroNoticias}
        </div>
      ) : null}
      {metaNoticias ? (
        <p className="text-[11px] text-text-secondary">{metaNoticias}</p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            ['noticias', 'Notícias'],
            ['municipios', 'Municípios'],
            ['fontes', 'Fontes'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setAba(id)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              aba === id
                ? 'border-[#ff9800] bg-[#ff9800]/10 text-[#e28000]'
                : 'border-card bg-surface text-text-secondary hover:bg-background',
            )}
          >
            {label}
            {id === 'noticias' && noticias.length > 0 ? ` (${noticias.length})` : ''}
          </button>
        ))}
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder={
            aba === 'municipios'
              ? 'Filtrar município ou TD…'
              : aba === 'fontes'
                ? 'Filtrar fonte…'
                : 'Filtrar notícias…'
          }
          className="h-8 min-w-[180px] flex-1 rounded-lg border border-card bg-surface px-3 text-xs text-text-primary sm:max-w-xs"
        />
        {aba === 'municipios' ? (
          <select
            value={filtroTd}
            onChange={(e) => setFiltroTd(e.target.value)}
            className="h-8 rounded-lg border border-card bg-surface px-2 text-xs text-text-primary"
          >
            <option value="">Todos os TDs</option>
            {tds.map((td) => (
              <option key={td} value={td}>
                {td}
              </option>
            ))}
          </select>
        ) : null}
        {aba === 'fontes' ? (
          <select
            value={filtroCamada}
            onChange={(e) => setFiltroCamada(e.target.value)}
            className="h-8 rounded-lg border border-card bg-surface px-2 text-xs text-text-primary"
          >
            <option value="">Todas as camadas</option>
            {(Object.keys(CAMADA_LABEL) as RadarFonteCamada[]).map((c) => (
              <option key={c} value={c}>
                {CAMADA_LABEL[c]}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="overflow-hidden rounded-xl border border-card bg-surface">
        {loading && aba !== 'noticias' ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Montando Radar 224…
          </div>
        ) : aba === 'noticias' ? (
          buscandoNoticias ? (
            <div className="flex flex-col items-center justify-center gap-2 py-16 text-sm text-text-secondary">
              <Loader2 className="h-5 w-5 animate-spin text-[#ff9800]" aria-hidden />
              Consultando Google News… isso pode levar alguns segundos.
            </div>
          ) : noticiasFiltradas.length === 0 ? (
            <div className="px-4 py-12 text-center text-sm text-text-secondary">
              {noticias.length === 0
                ? 'Escolha um município e clique em Buscar notícias para consultar GP1, MeioNews, 180graus e regionais.'
                : 'Nenhuma notícia no filtro atual.'}
            </div>
          ) : (
            <div className="divide-y divide-card">
              {noticiasFiltradas.map((n) => (
                <article key={`${n.fonteId}-${n.articleId}`} className="px-4 py-3">
                  <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-wide text-text-secondary">
                    <span className="font-semibold text-[#e28000]">{n.municipio}</span>
                    <span>·</span>
                    <span>{n.fonteNome}</span>
                    <span>·</span>
                    <span>{CAMADA_LABEL[n.fonteCamada]}</span>
                    <span>·</span>
                    <time dateTime={n.publishedAt ?? undefined}>{formatWhen(n.publishedAt)}</time>
                  </div>
                  <h3 className="mt-1 text-sm font-semibold text-text-primary">
                    {n.url ? (
                      <a
                        href={n.url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-start gap-1 hover:text-[#e28000]"
                      >
                        {n.title}
                        <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 opacity-60" aria-hidden />
                      </a>
                    ) : (
                      n.title
                    )}
                  </h3>
                  {n.summary ? (
                    <p className="mt-1 line-clamp-2 text-xs text-text-secondary">{n.summary}</p>
                  ) : null}
                  {n.sourceName ? (
                    <p className="mt-1 text-[11px] text-text-secondary">Fonte no Google: {n.sourceName}</p>
                  ) : null}
                </article>
              ))}
            </div>
          )
        ) : aba === 'municipios' ? (
          <div className="overflow-auto">
            <table className="w-full min-w-[720px] text-xs">
              <thead>
                <tr className="border-b border-card bg-background/80">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">#</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Município</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">TD</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Legado</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">% est.</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Regionais</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Ação</th>
                </tr>
              </thead>
              <tbody>
                {municipiosFiltrados.map((m, idx) => (
                  <tr
                    key={m.municipioNormalizado}
                    className={cn('border-b border-card text-text-primary', resumoTrZebra(idx))}
                  >
                    <td className="px-3 py-2 tabular-nums text-text-secondary">{m.rank}</td>
                    <td className="px-3 py-2 font-medium">{m.municipio}</td>
                    <td className="px-3 py-2 text-text-secondary">{m.territorio ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">
                      {m.expectativaLegado.toLocaleString('pt-BR')}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-text-secondary">
                      {m.pctEstado}%
                    </td>
                    <td className="px-3 py-2 text-text-secondary">
                      {m.fontesRegionais.length > 0 ? m.fontesRegionais.join(', ') : '—'}
                    </td>
                    <td className="px-3 py-2">
                      <button
                        type="button"
                        className="text-[11px] font-medium text-[#e28000] hover:underline"
                        onClick={() => {
                          setMunicipioBusca(m.municipio)
                          setAba('noticias')
                        }}
                      >
                        Buscar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="overflow-auto">
            <table className="w-full min-w-[760px] text-xs">
              <thead>
                <tr className="border-b border-card bg-background/80">
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Fonte</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Camada</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Selo</th>
                  <th className="px-3 py-2 text-right font-medium text-text-secondary">Nota</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Status</th>
                  <th className="px-3 py-2 text-left font-medium text-text-secondary">Cobertura</th>
                </tr>
              </thead>
              <tbody>
                {fontesFiltradas.map((f, idx) => (
                  <tr
                    key={f.id}
                    className={cn('border-b border-card text-text-primary', resumoTrZebra(idx))}
                  >
                    <td className="px-3 py-2">
                      <div className="font-medium">{f.nome}</div>
                      {f.url ? (
                        <a
                          href={f.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[11px] text-[#e28000] hover:underline"
                        >
                          {f.dominio || f.url}
                        </a>
                      ) : (
                        <span className="text-[11px] text-text-secondary">URL a definir</span>
                      )}
                    </td>
                    <td className="px-3 py-2">{CAMADA_LABEL[f.camada]}</td>
                    <td className="px-3 py-2 text-text-secondary">{f.selo}</td>
                    <td className="px-3 py-2 text-right tabular-nums font-semibold">{f.nota}</td>
                    <td className="px-3 py-2">
                      <span
                        className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                          STATUS_PILL[f.status] ?? STATUS_PILL.candidata,
                        )}
                      >
                        {f.status}
                      </span>
                    </td>
                    <td className="max-w-[280px] px-3 py-2 text-text-secondary">
                      {f.coberturaResumo}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-[11px] text-text-secondary">
        Busca: Google News RSS com janela de 30 dias + menção obrigatória do município no título ou
        resumo. Sem data de publicação ou notícia mais antiga é descartada.
      </p>
    </div>
  )
}
