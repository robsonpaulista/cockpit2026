'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  Activity,
  Download,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
} from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { DashboardPageShell } from '@/components/dashboard/dashboard-page-chrome'
import { IptExecutiveBanner } from '@/components/ipt/ipt-executive-banner'
import { IptMissoesStrip } from '@/components/ipt/ipt-missoes-strip'
import { IptMissaoLista } from '@/components/ipt/ipt-missao-lista'
import { IptMissaoDetalhe } from '@/components/ipt/ipt-missao-detalhe'
import { IptRadarNoticias } from '@/components/ipt/ipt-radar-noticias'
import {
  IptTerritorioVisaoToggle,
  type IptTerritorioVisao,
} from '@/components/ipt/ipt-territorio-visao-toggle'
import { IptResumoCampanhaBar } from '@/components/ipt/ipt-resumo-campanha-bar'
import { IptTdSelect } from '@/components/ipt/ipt-td-select'
import { IptMunicipioSelect } from '@/components/ipt/ipt-municipio-select'
import { IptMissaoEvolucaoModal } from '@/components/ipt/ipt-missao-evolucao-modal'
import { useIpt } from '@/hooks/use-ipt'
import { usePermissions } from '@/hooks/use-permissions'
import { exportarIptExcel } from '@/lib/ipt-export'
import {
  appendEventosLocais,
  bootstrapMissaoSync,
  buildEventosMissaoDiff,
  garantirHistoricoMissaoRemoto,
  lerMembrosSync,
  lerMetricasSync,
  persistirEventosMissao,
  salvarMembrosSync,
  salvarMetricasSync,
} from '@/lib/ipt-missao-evolucao'
import {
  buildLeituraExecutivaHoje,
  buildLeituraMunicipioFiltro,
  buildResumoCampanha,
  contagemPorMissao,
  filtrarMunicipiosPorMissao,
  filtrarMunicipiosVisaoUniverso,
  idsMissoesDoMunicipio,
  indicadorDaMissao,
  IPT_MISSOES,
  iptMissaoConfig,
  lerContagemHistorico,
  membrosPorMissao,
  microcopyMapaMissao,
  missaoRecomendadaParaMunicipio,
  municipioNaMissao,
  ordenarMunicipiosMissao,
  salvarContagemHistorico,
  variacaoMissao,
  type IptMissaoFiltro,
  type IptMissaoId,
  type IptMissaoVariacao,
  type IptVisaoUniverso,
} from '@/lib/ipt-missoes'
import { filtrarIptMunicipiosPorTd } from '@/lib/ipt-td'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { cn } from '@/lib/utils'
import '@/app/dashboard/territorio/ipt/ipt-visual-refine.css'
import '@/app/dashboard/territorio/ipt/ipt-operacional.css'

const IptMapSection = dynamic(
  () => import('@/components/ipt/ipt-map-section').then((mod) => mod.IptMapSection),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-text-muted">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
        Carregando mapa…
      </div>
    ),
  }
)

export function IptPanel() {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState(false)
  /** Visão da coluna território: tabela (principal) ou mapa. */
  const [visaoTerritorio, setVisaoTerritorio] = useState<IptTerritorioVisao>('lista')
  const [missaoAtiva, setMissaoAtiva] = useState<IptMissaoFiltro>('expectativa')
  const [visaoUniverso, setVisaoUniverso] = useState<IptVisaoUniverso>('prioridade')
  const [filtroTd, setFiltroTd] = useState<TerritorioDesenvolvimentoPI | null>(null)
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string | null>(null)
  /** Filtro explícito da página (dropdown / escolha deliberada) — não confundir com destaque automático do top da lista. */
  const [escopoMunicipio, setEscopoMunicipio] = useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)
  const [contagemAnterior, setContagemAnterior] = useState<Record<
    IptMissaoId,
    number
  > | null>(null)
  const [membrosAnterior, setMembrosAnterior] = useState<Record<
    IptMissaoId,
    string[]
  > | null>(null)
  const [evolucaoModalOpen, setEvolucaoModalOpen] = useState<boolean>(false)
  const [evolucaoRefreshToken, setEvolucaoRefreshToken] = useState<number>(0)
  const syncEventosLockRef = useRef<string | null>(null)
  const { loading, error, conexaoInstavel, municipios, obras, recarregar } = useIpt()
  const { isAdmin, canAccess } = usePermissions()
  const podeVerExpectativa =
    isAdmin || canAccess('territorio') || canAccess('ipt')

  useEffect(() => {
    document.body.setAttribute('data-ipt-operacional', '')
    return () => {
      document.body.removeAttribute('data-ipt-operacional')
    }
  }, [])

  const municipiosNoEscopo = useMemo(
    () => filtrarIptMunicipiosPorTd(municipios, filtroTd),
    [municipios, filtroTd]
  )

  const contagem = useMemo(() => contagemPorMissao(municipiosNoEscopo), [municipiosNoEscopo])

  const membrosAtuais = useMemo(
    () => membrosPorMissao(municipiosNoEscopo),
    [municipiosNoEscopo]
  )

  const variacoes = useMemo(() => {
    const out = {} as Record<IptMissaoId, IptMissaoVariacao>
    for (const m of IPT_MISSOES) {
      out[m.id] = variacaoMissao(
        contagem[m.id],
        contagemAnterior?.[m.id] ?? null,
        m.id,
        membrosAtuais[m.id],
        membrosAnterior?.[m.id] ?? null
      )
    }
    return out
  }, [contagem, contagemAnterior, membrosAtuais, membrosAnterior])

  const municipiosEmMissaoTodas = useMemo(
    () => filtrarMunicipiosPorMissao(municipiosNoEscopo, 'todas'),
    [municipiosNoEscopo]
  )

  const municipiosMissao = useMemo(() => {
    const filtrados = filtrarMunicipiosVisaoUniverso(
      municipiosNoEscopo,
      missaoAtiva,
      visaoUniverso
    )
    return ordenarMunicipiosMissao(filtrados, missaoAtiva, visaoUniverso)
  }, [municipiosNoEscopo, missaoAtiva, visaoUniverso])

  /** Recorte efetivo da página: missão (+ TD) e, se houver, um único município. */
  const municipiosVisao = useMemo(() => {
    if (!escopoMunicipio) return municipiosMissao
    const naMissao = municipiosMissao.filter((m) => m.municipio === escopoMunicipio)
    if (naMissao.length > 0) return naMissao
    const solto = municipiosNoEscopo.find((m) => m.municipio === escopoMunicipio)
    return solto ? [solto] : []
  }, [escopoMunicipio, municipiosMissao, municipiosNoEscopo])

  const municipioEscopoObj = useMemo(() => {
    if (!escopoMunicipio) return null
    return (
      municipiosNoEscopo.find((m) => m.municipio === escopoMunicipio) ??
      municipios.find((m) => m.municipio === escopoMunicipio) ??
      null
    )
  }, [escopoMunicipio, municipiosNoEscopo, municipios])

  const missoesDoEscopo = useMemo(
    () => (municipioEscopoObj ? idsMissoesDoMunicipio(municipioEscopoObj) : []),
    [municipioEscopoObj]
  )

  const resumo = useMemo(
    () =>
      buildResumoCampanha(
        escopoMunicipio ? municipiosVisao : municipiosNoEscopo,
        missaoAtiva
      ),
    [escopoMunicipio, municipiosVisao, municipiosNoEscopo, missaoAtiva]
  )

  const leituraHoje = useMemo(() => {
    if (municipioEscopoObj) return buildLeituraMunicipioFiltro(municipioEscopoObj)
    return buildLeituraExecutivaHoje(
      municipiosNoEscopo,
      missaoAtiva === 'todas' ? 'campo' : missaoAtiva
    )
  }, [municipioEscopoObj, municipiosNoEscopo, missaoAtiva])

  const municipioDetalhe = useMemo(() => {
    if (!municipioSelecionado) return null
    return (
      municipiosVisao.find((m) => m.municipio === municipioSelecionado) ??
      municipiosMissao.find((m) => m.municipio === municipioSelecionado) ??
      municipiosNoEscopo.find((m) => m.municipio === municipioSelecionado) ??
      null
    )
  }, [municipioSelecionado, municipiosVisao, municipiosMissao, municipiosNoEscopo])

  const indicadorMapa = useMemo(() => indicadorDaMissao(missaoAtiva), [missaoAtiva])

  const primeiroMunicipio = municipiosVisao[0]?.municipio ?? municipiosMissao[0]?.municipio ?? null

  const aplicarFiltroMunicipio = useCallback(
    (nome: string | null) => {
      setEscopoMunicipio(nome)
      setMunicipioSelecionado(nome)
      if (!nome) return
      const m =
        municipiosNoEscopo.find((row) => row.municipio === nome) ??
        municipios.find((row) => row.municipio === nome)
      if (!m) return
      // Mantém a missão atual se a cidade já estiver nela (ou no universo Ver todos).
      setMissaoAtiva((atual) => {
        if (atual !== 'todas' && municipioNaMissao(m, atual)) return atual
        if (atual !== 'todas' && visaoUniverso === 'com_expectativa') return atual
        return missaoRecomendadaParaMunicipio(m)
      })
    },
    [municipiosNoEscopo, municipios, visaoUniverso]
  )

  const handleMissaoSelect = useCallback((id: IptMissaoId) => {
    setMissaoAtiva((atual) => (atual === id ? 'todas' : id))
  }, [])

  /** Clique simples: só destaca o detalhe, sem filtrar a página. */
  const handleMunicipioSelect = useCallback((nome: string) => {
    setMunicipioSelecionado(nome)
  }, [])

  /** Duplo clique: aplica ou limpa o filtro de município na página. */
  const handleMunicipioToggleFiltro = useCallback(
    (nome: string) => {
      if (escopoMunicipio === nome) {
        aplicarFiltroMunicipio(null)
        return
      }
      aplicarFiltroMunicipio(nome)
    },
    [aplicarFiltroMunicipio, escopoMunicipio]
  )

  useEffect(() => {
    document.body.dataset.iptRefine = 'true'
    document.body.dataset.iptOperacional = 'true'
    return () => {
      delete document.body.dataset.iptRefine
      delete document.body.dataset.iptOperacional
    }
  }, [])

  useEffect(() => {
    const hist = lerContagemHistorico()
    setContagemAnterior(hist?.counts ?? null)
    setMembrosAnterior(hist?.membros ?? null)
  }, [])

  useEffect(() => {
    if (loading || municipios.length === 0) return
    setAtualizadoEm(new Date())
    const hist = lerContagemHistorico()
    if (!hist) {
      salvarContagemHistorico(contagem, membrosAtuais)
      return
    }
    // Migra snapshot antigo (só contagem) para incluir membros sem zerar o delta numérico.
    if (!hist.membros) {
      salvarContagemHistorico(hist.counts, membrosAtuais)
      setMembrosAnterior(membrosAtuais)
    }
  }, [loading, municipios.length, contagem, membrosAtuais])

  // Migra localStorage → banco e, se ainda vazio, grava snapshot inicial (1x).
  const historicoRemotoSyncRef = useRef(false)
  useEffect(() => {
    if (loading || municipios.length === 0 || historicoRemotoSyncRef.current) return
    historicoRemotoSyncRef.current = true
    let cancelled = false
    void garantirHistoricoMissaoRemoto(municipios).then((r) => {
      if (cancelled) return
      if (!r.ok) {
        historicoRemotoSyncRef.current = false
        return
      }
      if (r.synced > 0 || r.baseline > 0) {
        setEvolucaoRefreshToken((n) => n + 1)
      }
    })
    return () => {
      cancelled = true
    }
  }, [loading, municipios])

  // Timeline de evolução: grava entrada/saída com motivo a cada sync de dados.
  useEffect(() => {
    if (loading || municipios.length === 0) return
    const fingerprint = municipios
      .map((m) => `${m.municipio}:${m.prioridade}:${m.detalhes.visitasNoPeriodo}:${m.detalhes.visitasUltimos15Dias}:${m.detalhes.obrasDivulgacaoPosts ?? 0}:${m.sinais.pesquisa}:${m.sinais.digital}`)
      .join('|')
    if (syncEventosLockRef.current === fingerprint) return
    syncEventosLockRef.current = fingerprint

    const syncAnterior = lerMembrosSync()
    if (!syncAnterior) {
      bootstrapMissaoSync(municipios)
      return
    }

    const metricasAnteriores = lerMetricasSync()
    const {
      membrosAtuais: syncAtuais,
      metricasAtuais,
      eventos,
    } = buildEventosMissaoDiff(municipios, syncAnterior, 'sync', metricasAnteriores)
    if (eventos.length > 0) {
      appendEventosLocais(eventos)
      void persistirEventosMissao(eventos).then(() => {
        setEvolucaoRefreshToken((n) => n + 1)
      })
      setEvolucaoRefreshToken((n) => n + 1)
    }
    salvarMembrosSync(syncAtuais)
    salvarMetricasSync(metricasAtuais)
  }, [loading, municipios])

  useEffect(() => {
    if (escopoMunicipio) {
      const aindaNoEscopo = municipiosNoEscopo.some((m) => m.municipio === escopoMunicipio)
      if (!aindaNoEscopo) {
        setEscopoMunicipio(null)
        setMunicipioSelecionado(primeiroMunicipio)
        return
      }
      setMunicipioSelecionado(escopoMunicipio)
      return
    }
    setMunicipioSelecionado(primeiroMunicipio)
  }, [missaoAtiva, filtroTd, primeiroMunicipio, escopoMunicipio, municipiosNoEscopo])

  // Missão incompatível com a cidade filtrada → solta o filtro de município.
  useEffect(() => {
    if (!escopoMunicipio || missaoAtiva === 'todas') return
    const m =
      municipiosNoEscopo.find((row) => row.municipio === escopoMunicipio) ??
      municipios.find((row) => row.municipio === escopoMunicipio)
    if (!m) return
    if (visaoUniverso === 'com_expectativa') {
      const aindaNoEscopo = municipiosNoEscopo.some((row) => row.municipio === escopoMunicipio)
      if (!aindaNoEscopo) setEscopoMunicipio(null)
      return
    }
    if (!municipioNaMissao(m, missaoAtiva)) {
      setEscopoMunicipio(null)
    }
  }, [missaoAtiva, escopoMunicipio, municipiosNoEscopo, municipios, visaoUniverso])

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

  const handleExportar = useCallback(() => {
    exportarIptExcel(municipiosVisao, {
      prioridade: null,
      indicador: indicadorMapa ?? 'geral',
      evolucao: 'todos',
      td: filtroTd,
    })
  }, [municipiosVisao, indicadorMapa, filtroTd])

  const handleAtualizar = useCallback(() => {
    void Promise.resolve(recarregar()).then(() => {
      // Snapshot atual vira a base da próxima variação (inclui membros).
      salvarContagemHistorico(contagem, membrosAtuais)
      setContagemAnterior(contagem)
      setMembrosAnterior(membrosAtuais)
      setAtualizadoEm(new Date())
    })
  }, [contagem, membrosAtuais, recarregar])

  // Atualização silenciosa a cada 10 min (sem spinner / sem resetar “Mudança recente”).
  useEffect(() => {
    const DEZ_MINUTOS_MS = 10 * 60 * 1000
    const id = window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
      void Promise.resolve(recarregar({ silent: true })).then(() => {
        setAtualizadoEm(new Date())
      })
    }, DEZ_MINUTOS_MS)
    return () => window.clearInterval(id)
  }, [recarregar])

  const atualizadoLabel = atualizadoEm
    ? atualizadoEm.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  const bannerActions = (
    <div className="ipt-header-actions">
      <IptTdSelect
        variant="inline"
        value={filtroTd}
        totalMunicipios={municipiosNoEscopo.length}
        totalMunicipiosPi={municipios.length}
        disabled={loading}
        active={Boolean(filtroTd)}
        onChange={setFiltroTd}
      />
      <IptMunicipioSelect
        value={escopoMunicipio}
        disabled={loading}
        opcoes={municipiosNoEscopo.map((m) => m.municipio)}
        onChange={aplicarFiltroMunicipio}
      />
      <button
        type="button"
        onClick={() => setEvolucaoModalOpen(true)}
        className="ipt-btn-exportar"
        title="Evolução das missões: entradas, saídas e motivos"
      >
        <CockpitIcon icon={Activity} size="sm" />
        Evolução
      </button>
      <button
        type="button"
        onClick={handleExportar}
        className="ipt-btn-exportar"
        disabled={loading || municipiosVisao.length === 0}
        title={`Exportar ${municipiosVisao.length} município(s) da visão`}
      >
        <CockpitIcon icon={Download} size="sm" />
        Exportar
        <span className="ipt-btn-exportar__count">{municipiosVisao.length}</span>
      </button>
      <button
        type="button"
        onClick={handleAtualizar}
        className="ipt-btn-atualizar"
        disabled={loading}
      >
        <CockpitIcon icon={RefreshCw} size="sm" className={loading ? 'animate-spin' : undefined} />
        Atualizar
      </button>
    </div>
  )

  return (
    <DashboardPageShell className="ipt-page-shell ipt-page-shell--operacional">
      <div className="ipt-page-body ipt-operacional flex min-h-0 flex-1 flex-col gap-3">
        {conexaoInstavel && !error ? (
          <div className="ipt-page-alert flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Conexão com o Supabase instável. Tentando novamente…
          </div>
        ) : null}
        {error ? (
          <div className="ipt-page-alert rounded-lg bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        ) : null}

        {!isNativeFullscreen ? (
          <>
            <IptExecutiveBanner
              texto={leituraHoje}
              janela="30 / 31–60 dias"
              atualizadoEm={atualizadoLabel}
              actions={bannerActions}
            />
            <IptMissoesStrip
              municipios={municipiosNoEscopo}
              contagem={contagem}
              variacoes={variacoes}
              missaoAtiva={missaoAtiva}
              missoesDoMunicipio={missoesDoEscopo}
              municipioFiltro={escopoMunicipio}
              loading={loading}
              onSelect={handleMissaoSelect}
            />
            <p className="ipt-fluxo-hint">
              Selecione uma missão para identificar os municípios relacionados e aprofundar o
              contexto local.
            </p>
          </>
        ) : null}

        <div
          ref={mapContainerRef}
          className={cn(
            'ipt-operacional__workspace',
            isNativeFullscreen && 'ipt-operacional__workspace--fullscreen'
          )}
        >
          <div className="ipt-operacional__col ipt-operacional__col--territorio">
            {!isNativeFullscreen && visaoTerritorio === 'lista' ? (
              <section
                className={cn(
                  'ipt-bloco ipt-bloco-territorio',
                  Boolean(escopoMunicipio) && 'ipt-bloco-territorio--muni-foco'
                )}
              >
                <IptMissaoLista
                  municipios={municipiosVisao}
                  missaoAtiva={missaoAtiva}
                  visaoUniverso={visaoUniverso}
                  onVisaoUniversoChange={setVisaoUniverso}
                  selecionado={municipioSelecionado}
                  municipioFiltro={escopoMunicipio}
                  onSelect={handleMunicipioSelect}
                  onToggleFiltro={handleMunicipioToggleFiltro}
                  podeVerExpectativa={podeVerExpectativa}
                  visaoTerritorio={visaoTerritorio}
                  onVisaoTerritorioChange={setVisaoTerritorio}
                  embedded
                />
                <IptMissaoDetalhe
                  municipio={municipioDetalhe}
                  missaoAtiva={missaoAtiva}
                  obras={obras}
                  embedded
                  onClear={
                    escopoMunicipio
                      ? () => aplicarFiltroMunicipio(null)
                      : municipioDetalhe
                        ? () => setMunicipioSelecionado(null)
                        : undefined
                  }
                />
              </section>
            ) : null}

            {isNativeFullscreen || visaoTerritorio === 'mapa' ? (
            <section className="ipt-bloco ipt-bloco-mapa">
              <div className="ipt-bloco-mapa__head">
                <div className="ipt-bloco-mapa__intro">
                  <h2 className="ipt-bloco__title">Mapa Estratégico</h2>
                  <p className="ipt-bloco__sub">
                    {escopoMunicipio
                      ? `Foco em ${escopoMunicipio}${
                          missoesDoEscopo.length > 0
                            ? ` · ${missoesDoEscopo
                                .map((id) => iptMissaoConfig(id).titulo)
                                .join(', ')}`
                            : ' · fora das missões críticas'
                        }`
                      : visaoUniverso === 'com_expectativa'
                        ? missaoAtiva === 'expectativa'
                          ? 'Mapa com todos os municípios — com e sem expectativa 2026'
                          : 'Mapa com todos os municípios que têm expectativa 2026 (prioridades e saudáveis)'
                        : missaoAtiva === 'todas'
                          ? 'Visão geral dos municípios da campanha'
                          : `Exibindo municípios da missão ${iptMissaoConfig(missaoAtiva).titulo}`}
                  </p>
                  <span className="ipt-bloco-mapa__seal">
                    {visaoUniverso === 'com_expectativa' && missaoAtiva === 'expectativa'
                      ? 'Onde a campanha tem — e ainda não tem — expectativa de votos 2026'
                      : microcopyMapaMissao(missaoAtiva)}
                  </span>
                </div>
                {!isNativeFullscreen ? (
                  <IptTerritorioVisaoToggle
                    value={visaoTerritorio}
                    onChange={setVisaoTerritorio}
                    className="ipt-territorio-visao--in-mapa"
                  />
                ) : null}
              </div>

              <div className="ipt-bloco-mapa__body">
                {loading ? (
                  <div className="ipt-operacional__map-loading">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                    Calculando missões…
                  </div>
                ) : (
                  <IptMapSection
                    municipios={municipiosVisao}
                    indicadorFiltro={indicadorMapa}
                    evolucaoFiltro="todos"
                    filtroTd={filtroTd}
                    municipiosBoundsTd={municipiosVisao}
                    missaoFiltro={missaoAtiva}
                    isFullscreen={isNativeFullscreen}
                    onInsightSaved={recarregar}
                    onMunicipioSelect={handleMunicipioSelect}
                    onMunicipioToggleFiltro={handleMunicipioToggleFiltro}
                  />
                )}

                <div
                  className="ipt-mapa-legenda"
                  role="radiogroup"
                  aria-label="Filtrar mapa por missão"
                >
                  <button
                    type="button"
                    role="radio"
                    aria-checked={missaoAtiva === 'todas'}
                    disabled={loading}
                    className={cn(
                      'ipt-mapa-legenda__item',
                      missaoAtiva === 'todas' && 'ipt-mapa-legenda__item--active'
                    )}
                    onClick={() => setMissaoAtiva('todas')}
                  >
                    <span
                      className="ipt-mapa-legenda__dot ipt-mapa-legenda__dot--todas"
                      aria-hidden
                    />
                    <span className="ipt-mapa-legenda__label">Todas</span>
                    <span className="ipt-mapa-legenda__count tabular-nums">
                      {escopoMunicipio
                        ? municipiosVisao.length
                        : municipiosEmMissaoTodas.length}
                    </span>
                  </button>
                  {IPT_MISSOES.map((m) => {
                    const ativo = missaoAtiva === m.id
                    const cidadeNaMissao =
                      Boolean(escopoMunicipio) && missoesDoEscopo.includes(m.id)
                    const qtd = escopoMunicipio
                      ? cidadeNaMissao
                        ? 1
                        : 0
                      : contagem[m.id]
                    return (
                      <button
                        key={m.id}
                        type="button"
                        role="radio"
                        aria-checked={ativo}
                        disabled={loading}
                        title={
                          ativo
                            ? 'Clique para limpar o filtro'
                            : `Filtrar mapa: ${m.titulo}`
                        }
                        className={cn(
                          'ipt-mapa-legenda__item',
                          ativo && 'ipt-mapa-legenda__item--active',
                          cidadeNaMissao && 'ipt-mapa-legenda__item--muni'
                        )}
                        style={
                          {
                            '--missao-cor': m.cor,
                            '--missao-tint': m.corTint,
                            '--missao-texto': m.corTexto,
                          } as CSSProperties
                        }
                        onClick={() => handleMissaoSelect(m.id)}
                      >
                        <span
                          className="ipt-mapa-legenda__dot"
                          style={{ background: m.cor }}
                          aria-hidden
                        />
                        <span className="ipt-mapa-legenda__label">{m.titulo}</span>
                        <span className="ipt-mapa-legenda__count tabular-nums">{qtd}</span>
                      </button>
                    )
                  })}
                </div>

                <button
                  type="button"
                  onClick={toggleFullscreen}
                  className="ipt-mapa-fullscreen"
                  title={isNativeFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
                  disabled={loading}
                >
                  <CockpitIcon icon={isNativeFullscreen ? Minimize2 : Maximize2} size="sm" />
                  {isNativeFullscreen ? 'Sair' : 'Tela cheia'}
                </button>
              </div>
            </section>
            ) : null}
          </div>

          {!isNativeFullscreen ? (
            <div className="ipt-operacional__col ipt-operacional__col--noticias">
              <IptRadarNoticias
                municipio={municipioSelecionado}
                entregasMandato={municipioDetalhe?.detalhes.obrasQuantidade ?? 0}
              />
            </div>
          ) : null}
        </div>

        {!isNativeFullscreen ? (
          <IptResumoCampanhaBar
            resumo={resumo}
            missaoAtiva={missaoAtiva}
            onSelectMunicipio={handleMunicipioSelect}
            onToggleFiltroMunicipio={handleMunicipioToggleFiltro}
          />
        ) : null}
      </div>

      <IptMissaoEvolucaoModal
        open={evolucaoModalOpen}
        onClose={() => setEvolucaoModalOpen(false)}
        municipios={municipios}
        refreshToken={evolucaoRefreshToken}
      />
    </DashboardPageShell>
  )
}
