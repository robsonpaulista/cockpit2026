'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { ExternalLink, Box, ImageIcon, Loader2, MapPinned, Maximize2, MessageSquare, Minimize2, RefreshCw } from 'lucide-react'
import Link from 'next/link'
import {
  OBRA_FASE_COLOR,
  OBRA_FASE_LABEL,
  OBRA_MAPA_TEMAS,
  OBRA_MAPA_TEMAS_OBRA,
  agregarMarcadoresPorMunicipioETema,
  filtrarMarcadoresPorFase,
  filtrarMarcadoresPorMunicipio,
  filtrarObrasPorTema,
  listarMunicipiosComObras,
  obraMapaTemaConfig,
  type ObraFaseFiltro,
  type ObraMapaRow,
  type ObraMapaTemaFiltro,
  type ObraMapaVisao,
} from '@/lib/obras-mapa'
import { MapaObrasKpiStrip } from '@/components/territorio-campo/mapa-obras-kpi-strip'
import { MapaObrasSplash } from '@/components/territorio-campo/mapa-obras-splash'
import { ObraFotoUrlField } from '@/components/obras/obra-foto-url-field'
import { ObraTemaMarkerPreview } from '@/components/territorio-campo/obra-tema-scene-icon'
import {
  OBRA_MAQUINARIO_3D_VARIANTS,
  OBRA_PAVIMENTACAO_3D_VARIANTS,
  OBRA_TEMA_MARKER_LABEL,
  type ObraMaquinario3dVariant,
  type ObraPavimentacao3dVariant,
} from '@/lib/obras-mapa-tema-icons'
import { OBRA_MAPA_LEGENDA } from '@/lib/obras-mapa-markers'
import { chromeButtonClass, chromeFilterChipClass } from '@/lib/button-chrome'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const MapaObrasLeaflet = dynamic(
  () => import('@/components/mapa-obras-leaflet').then((mod) => mod.MapaObrasLeaflet),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[420px] items-center justify-center rounded-xl border border-card bg-bg-surface text-sm text-text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa…
      </div>
    ),
  }
)

const FILTROS: { id: ObraFaseFiltro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'em_andamento', label: 'Em andamento' },
  { id: 'finalizada', label: 'Finalizadas' },
  { id: 'a_iniciar', label: 'A iniciar' },
]

function formatCurrency(value?: number | null): string {
  if (!value) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

/** Ocupa toda a área útil da guia (compensa padding do DashboardPageContent). */
const MAPA_OBRAS_TAB_SPLASH_CLASS =
  '-mx-4 -mb-4 flex min-h-[calc(100dvh-11.5rem)] w-[calc(100%+2rem)] flex-col md:-mx-6 md:-mb-6 md:w-[calc(100%+3rem)]'

export function MapaObrasPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  const [obras, setObras] = useState<ObraMapaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filtroFase, setFiltroFase] = useState<ObraFaseFiltro>('todas')
  const [filtroMunicipio, setFiltroMunicipio] = useState<string>('')
  const [temaAtivo, setTemaAtivo] = useState<ObraMapaTemaFiltro>('todos')
  const [visaoMapa, setVisaoMapa] = useState<ObraMapaVisao>('operacional')
  const [usarIcone3d, setUsarIcone3d] = useState<boolean>(true)
  const [pavimentacao3dVariant, setPavimentacao3dVariant] = useState<ObraPavimentacao3dVariant>('oncoming')
  const [maquinario3dVariant, setMaquinario3dVariant] = useState<ObraMaquinario3dVariant>('trator')
  const [mostrarTodosPopups, setMostrarTodosPopups] = useState<boolean>(false)
  const [splashConcluido, setSplashConcluido] = useState<boolean>(false)
  const [animacaoEntradaMapa, setAnimacaoEntradaMapa] = useState<boolean>(false)
  const [selectedMarcadorKey, setSelectedMarcadorKey] = useState<string | null>(null)

  const temaConfig = useMemo(() => obraMapaTemaConfig(temaAtivo), [temaAtivo])

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/obras', { cache: 'no-store' })
      const json = (await res.json()) as { obras?: ObraMapaRow[]; error?: string }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao carregar obras.')
      setObras(json.obras ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar obras.')
      setObras([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!loading && (obras.length === 0 || error)) {
      setSplashConcluido(true)
    }
  }, [error, loading, obras.length])

  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  const toggleFullscreen = useCallback(() => {
    const container = mapContainerRef.current
    if (!container) return
    if (document.fullscreenElement) {
      void document.exitFullscreen()
    } else {
      void container.requestFullscreen()
    }
  }, [])

  const contagemPorTema = useMemo(() => {
    return Object.fromEntries(
      OBRA_MAPA_TEMAS_OBRA.map((tema) => [tema, filtrarObrasPorTema(obras, tema).length])
    ) as Record<(typeof OBRA_MAPA_TEMAS_OBRA)[number], number>
  }, [obras])

  const totalObrasTemas = useMemo(
    () => OBRA_MAPA_TEMAS_OBRA.reduce((sum, tema) => sum + contagemPorTema[tema], 0),
    [contagemPorTema]
  )

  const marcadoresAgregados = useMemo(
    () => agregarMarcadoresPorMunicipioETema(obras, temaAtivo),
    [obras, temaAtivo]
  )

  const municipiosDisponiveis = useMemo(
    () => listarMunicipiosComObras(obras, temaAtivo),
    [obras, temaAtivo]
  )

  const marcadoresPorMunicipio = useMemo(
    () => filtrarMarcadoresPorMunicipio(marcadoresAgregados, filtroMunicipio),
    [filtroMunicipio, marcadoresAgregados]
  )

  const marcadoresFiltrados = useMemo(
    () => filtrarMarcadoresPorFase(marcadoresPorMunicipio, filtroFase),
    [filtroFase, marcadoresPorMunicipio]
  )

  const totais = useMemo(() => {
    const municipiosUnicos = new Set(marcadoresPorMunicipio.map((m) => m.municipio))
    return marcadoresPorMunicipio.reduce(
      (acc, m) => ({
        municipios: municipiosUnicos.size,
        obras: acc.obras + m.total,
        emAndamento: acc.emAndamento + m.emAndamento,
        finalizadas: acc.finalizadas + m.finalizadas,
        aIniciar: acc.aIniciar + m.aIniciar,
      }),
      { municipios: municipiosUnicos.size, obras: 0, emAndamento: 0, finalizadas: 0, aIniciar: 0 }
    )
  }, [marcadoresPorMunicipio])

  const marcadorSelecionado = useMemo(
    () => marcadoresFiltrados.find((m) => m.markerKey === selectedMarcadorKey) ?? null,
    [marcadoresFiltrados, selectedMarcadorKey]
  )

  useEffect(() => {
    if (filtroMunicipio && !municipiosDisponiveis.includes(filtroMunicipio)) {
      setFiltroMunicipio('')
      setSelectedMarcadorKey(null)
    }
  }, [filtroMunicipio, municipiosDisponiveis])

  useEffect(() => {
    setMostrarTodosPopups(false)
  }, [filtroFase, filtroMunicipio, temaAtivo])

  const onTemaChange = useCallback((tema: ObraMapaTemaFiltro) => {
    setTemaAtivo(tema)
    setFiltroFase('todas')
    setFiltroMunicipio('')
    setSelectedMarcadorKey(null)
  }, [])

  const atualizarImagemObra = useCallback((obraId: string, imagem_url: string | null) => {
    setObras((prev) => prev.map((o) => (o.id === obraId ? { ...o, imagem_url } : o)))
  }, [])

  const exibirSplash = !loading && !error && obras.length > 0 && !splashConcluido

  const concluirSplash = useCallback(() => {
    setSplashConcluido(true)
    setAnimacaoEntradaMapa(true)
  }, [])

  if (loading && !splashConcluido) {
    return (
      <div className={cn(MAPA_OBRAS_TAB_SPLASH_CLASS, 'items-center justify-center bg-bg-surface text-sm text-text-muted')}>
        <Loader2 className="mr-2 h-5 w-5 animate-spin" aria-hidden />
        Carregando obras…
      </div>
    )
  }

  if (exibirSplash) {
    return (
      <MapaObrasSplash
        obras={obras}
        onConcluir={concluirSplash}
        className={cn(MAPA_OBRAS_TAB_SPLASH_CLASS, 'min-h-full flex-1')}
      />
    )
  }

  const filtrosMapa = (
    <div
      className={cn(
        'border-b border-card px-4 py-3',
        isNativeFullscreen ? 'shrink-0 bg-bg-surface' : 'bg-bg-app/40'
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        {OBRA_MAPA_TEMAS.map((tema) => (
          <button
            key={tema.id}
            type="button"
            onClick={() => onTemaChange(tema.id)}
            className={chromeFilterChipClass(temaAtivo === tema.id)}
          >
            {tema.label}
            <span className="ml-1 tabular-nums text-text-muted">
              ({tema.id === 'todos' ? totalObrasTemas : contagemPorTema[tema.id as (typeof OBRA_MAPA_TEMAS_OBRA)[number]] ?? 0})
            </span>
          </button>
        ))}

        <span className="hidden h-4 w-px shrink-0 bg-border-card opacity-60 sm:block" aria-hidden />

        {FILTROS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFiltroFase(f.id)}
            className={chromeFilterChipClass(filtroFase === f.id)}
          >
            {f.label}
          </button>
        ))}

        <span className="hidden h-4 w-px shrink-0 bg-border-card opacity-60 sm:block" aria-hidden />

        <label className="flex min-w-0 items-center gap-1.5">
          <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-text-secondary">
            Município
          </span>
          <select
            value={filtroMunicipio}
            onChange={(e) => {
              setFiltroMunicipio(e.target.value)
              setSelectedMarcadorKey(null)
            }}
            title="Filtrar por município"
            className="max-w-[9rem] truncate rounded-lg border border-card bg-bg-app px-2 py-1 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:max-w-[11rem]"
          >
            <option value="">Todos ({municipiosDisponiveis.length})</option>
            {municipiosDisponiveis.map((municipio) => (
              <option key={municipio} value={municipio}>
                {municipio}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )

  return (
    <div className="flex flex-col gap-4">
      <section>
        <MapaObrasKpiStrip totais={totais} tema={temaAtivo} />
      </section>

      <div className="rounded-xl border border-card bg-bg-surface p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-text-primary">{temaConfig.titulo}</h2>
            <p className={cn('mt-1 max-w-2xl', typographyBodyMutedClass)}>{temaConfig.descricao}</p>
          </div>
          <button type="button" onClick={() => void carregar()} className={chromeButtonClass} disabled={loading}>
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <RefreshCw className="h-3.5 w-3.5" aria-hidden />}
            Atualizar
          </button>
        </div>
      </div>

      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      <div
        ref={mapContainerRef}
        className={cn(
          'overflow-hidden rounded-xl border border-card bg-bg-surface',
          '[&:fullscreen]:flex [&:fullscreen]:h-screen [&:fullscreen]:w-full [&:fullscreen]:flex-col [&:fullscreen]:min-h-0 [&:fullscreen]:rounded-none [&:fullscreen]:border-none [&:fullscreen]:bg-bg-surface'
        )}
      >
        <div
          className={cn(
            'border-b border-card px-4 py-3',
            isNativeFullscreen && 'shrink-0 bg-bg-surface'
          )}
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-medium text-text-primary">
              <MapPinned className="h-4 w-4 text-accent-gold" aria-hidden />
              {temaAtivo === 'todos'
                ? `${marcadoresFiltrados.length} marcador(es) no mapa`
                : `${new Set(marcadoresFiltrados.map((m) => m.municipio)).size} município(s) no mapa`}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              {(temaAtivo === 'todos' ? OBRA_MAPA_TEMAS_OBRA : [temaAtivo]).map((temaLeg) => (
                <span key={temaLeg} className="inline-flex items-center gap-1.5 text-[11px] text-text-muted">
                  <ObraTemaMarkerPreview
                    tema={temaLeg}
                    fase="em_andamento"
                    size={24}
                    usarIcone3d={usarIcone3d && visaoMapa !== 'comunicacao'}
                    pavimentacao3dVariant={pavimentacao3dVariant}
                    maquinario3dVariant={maquinario3dVariant}
                  />
                  {OBRA_TEMA_MARKER_LABEL[temaLeg]}
                </span>
              ))}
              <span className="hidden h-4 w-px shrink-0 bg-border-card opacity-60 sm:block" aria-hidden />
              {OBRA_MAPA_LEGENDA.map((item) => (
                <span
                  key={item.fase}
                  className="inline-flex items-center gap-1.5 text-[11px] text-text-muted"
                >
                  <span
                    className="inline-block h-3 w-3 rounded-full ring-2 ring-white/90"
                    style={{ backgroundColor: OBRA_FASE_COLOR[item.fase] }}
                  />
                  {item.label}
                </span>
              ))}
              <span className="hidden h-4 w-px shrink-0 bg-border-card opacity-60 sm:block" aria-hidden />
              <button
                type="button"
                onClick={() => setMostrarTodosPopups((v) => !v)}
                className={cn(
                  chromeFilterChipClass(mostrarTodosPopups),
                  'inline-flex items-center gap-1.5'
                )}
                title={
                  mostrarTodosPopups
                    ? 'Ocultar popups do mapa'
                    : 'Exibir popups de todos os marcadores visíveis'
                }
                disabled={marcadoresFiltrados.length === 0}
              >
                <MessageSquare className="h-3.5 w-3.5" aria-hidden />
                Popups
              </button>
              <button
                type="button"
                onClick={() => setUsarIcone3d((v) => !v)}
                className={cn(
                  chromeFilterChipClass(usarIcone3d),
                  'inline-flex items-center gap-1.5'
                )}
                title={usarIcone3d ? 'Voltar aos ícones SVG' : 'Usar ícones 3D estáticos'}
                disabled={visaoMapa === 'comunicacao' || marcadoresFiltrados.length === 0}
              >
                <Box className="h-3.5 w-3.5" aria-hidden />
                3D
              </button>
              {usarIcone3d && visaoMapa !== 'comunicacao' && (temaAtivo === 'todos' || temaAtivo === 'pavimentacao') ? (
                <select
                  value={pavimentacao3dVariant}
                  onChange={(e) => setPavimentacao3dVariant(e.target.value as ObraPavimentacao3dVariant)}
                  className="h-8 max-w-[9.5rem] truncate rounded-lg border border-card bg-bg-surface px-2 text-xs text-text-secondary"
                  title="Ícone 3D de pavimentação"
                  disabled={marcadoresFiltrados.length === 0}
                >
                  {OBRA_PAVIMENTACAO_3D_VARIANTS.map((v) => (
                    <option key={v.id} value={v.id} title={v.descricao}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : null}
              {usarIcone3d && visaoMapa !== 'comunicacao' && (temaAtivo === 'todos' || temaAtivo === 'maquinario-agricola') ? (
                <select
                  value={maquinario3dVariant}
                  onChange={(e) => setMaquinario3dVariant(e.target.value as ObraMaquinario3dVariant)}
                  className="h-8 max-w-[9.5rem] truncate rounded-lg border border-card bg-bg-surface px-2 text-xs text-text-secondary"
                  title="Ícone 3D de maquinário agrícola"
                  disabled={marcadoresFiltrados.length === 0}
                >
                  {OBRA_MAQUINARIO_3D_VARIANTS.map((v) => (
                    <option key={v.id} value={v.id} title={v.descricao}>
                      {v.label}
                    </option>
                  ))}
                </select>
              ) : null}
              <button
                type="button"
                onClick={() => setVisaoMapa((v) => (v === 'operacional' ? 'comunicacao' : 'operacional'))}
                className={cn(
                  chromeFilterChipClass(visaoMapa === 'comunicacao'),
                  'inline-flex items-center gap-1.5'
                )}
                title={visaoMapa === 'comunicacao' ? 'Voltar aos ícones operacionais' : 'Exibir fotos nos marcadores'}
              >
                <ImageIcon className="h-3.5 w-3.5" aria-hidden />
                Comunicação
              </button>
              {!isNativeFullscreen ? (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-app hover:text-text-primary"
                  title="Expandir mapa em tela cheia"
                  disabled={loading || marcadoresFiltrados.length === 0}
                >
                  <Maximize2 className="h-4 w-4" aria-hidden />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="rounded-lg p-2 text-text-secondary transition-colors hover:bg-bg-app hover:text-text-primary"
                  title="Sair da tela cheia"
                >
                  <Minimize2 className="h-5 w-5" aria-hidden />
                </button>
              )}
            </div>
          </div>
          <p className={cn('mt-1.5', typographyBodyMutedClass)}>
            Passe o mouse para ver o resumo · clique no pin para detalhes
            {visaoMapa === 'comunicacao' ? ' · visão Comunicação: fotos nos marcadores com imagem cadastrada' : usarIcone3d ? ' · ícones 3D estáticos (Fluent Emoji)' : ' · ícones SVG · anel colorido = fase'}
            {mostrarTodosPopups ? ' · popups abertos em todos os marcadores' : ''}
            {temaAtivo === 'todos' ? ' · cidades com mais de um tema exibem pins separados' : ''}
            {isNativeFullscreen ? '' : ' e painel abaixo'}
          </p>
        </div>

        {filtrosMapa}

        <div className={cn(isNativeFullscreen ? 'flex min-h-0 flex-1 flex-col' : 'h-[480px]')}>
          {loading ? (
            <div className="flex min-h-[420px] items-center justify-center text-sm text-text-muted">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
              Carregando obras…
            </div>
          ) : marcadoresFiltrados.length === 0 ? (
            <div className="flex min-h-[320px] flex-col items-center justify-center gap-2 px-6 text-center text-sm text-text-muted">
              <p>
                Nenhuma obra de {temaConfig.label.toLowerCase()} encontrada
                {filtroMunicipio ? ` em ${filtroMunicipio}` : ''} para este filtro.
              </p>
              <Link href="/dashboard/obras" className="inline-flex items-center gap-1 text-[rgb(var(--color-primary))] hover:underline">
                Cadastrar obras
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            </div>
          ) : (
            <MapaObrasLeaflet
              marcadores={marcadoresFiltrados}
              obras={obras}
              filtroFase={filtroFase}
              visaoMapa={visaoMapa}
              animacaoEntrada={animacaoEntradaMapa}
              mostrarTodosPopups={mostrarTodosPopups}
              usarIcone3d={usarIcone3d}
              pavimentacao3dVariant={pavimentacao3dVariant}
              maquinario3dVariant={maquinario3dVariant}
              selectedMarcadorKey={selectedMarcadorKey}
              onSelectMarcador={setSelectedMarcadorKey}
              isFullscreen={isNativeFullscreen}
            />
          )}
        </div>
      </div>

      {marcadorSelecionado ? (
        <div className="rounded-xl border border-card bg-bg-surface p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <h3 className="text-sm font-semibold text-text-primary">{marcadorSelecionado.municipio}</h3>
              <p className={typographyBodyMutedClass}>
                {obraMapaTemaConfig(marcadorSelecionado.tema).label} · {marcadorSelecionado.total} obra(s) ·{' '}
                {OBRA_FASE_LABEL[marcadorSelecionado.fase]}
              </p>
            </div>
            <button
              type="button"
              className="text-xs text-text-muted hover:text-text-primary"
              onClick={() => setSelectedMarcadorKey(null)}
            >
              Limpar seleção
            </button>
          </div>

          <ul className="mt-3 divide-y divide-card border-t border-card">
            {marcadorSelecionado.obras.map((obra) => (
              <li key={obra.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-text-primary">{obra.obra ?? 'Obra sem nome'}</p>
                    <p className={typographyBodyMutedClass}>
                      {obra.orgao ?? 'Órgão não informado'} · {obra.status ?? 'Sem status'}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm tabular-nums text-text-secondary">{formatCurrency(obra.valor_total)}</p>
                </div>
                <div className="mt-3">
                  <ObraFotoUrlField
                    obraId={obra.id}
                    initialUrl={obra.imagem_url}
                    compact
                    onSaved={(url) => atualizarImagemObra(obra.id, url)}
                  />
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  )
}
