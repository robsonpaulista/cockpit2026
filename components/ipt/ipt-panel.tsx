'use client'

import dynamic from 'next/dynamic'
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import {
  BarChart3,
  Crosshair,
  Download,
  Hexagon,
  LineChart,
  Loader2,
  Maximize2,
  Minimize2,
  RefreshCw,
  type LucideIcon,
} from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import {
  DashboardPageChrome,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { IptPageHeader } from '@/components/ipt/ipt-page-header'
import { IptMissoesStrip } from '@/components/ipt/ipt-missoes-strip'
import { IptMissaoLista } from '@/components/ipt/ipt-missao-lista'
import { IptMissaoDetalhe } from '@/components/ipt/ipt-missao-detalhe'
import { IptResumoCampanhaBar } from '@/components/ipt/ipt-resumo-campanha-bar'
import { IptTdSelect } from '@/components/ipt/ipt-td-select'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import { useIpt } from '@/hooks/use-ipt'
import { usePermissions } from '@/hooks/use-permissions'
import { exportarIptExcel } from '@/lib/ipt-export'
import {
  buildResumoCampanha,
  contagemPorMissao,
  filtrarMunicipiosPorMissao,
  indicadorDaMissao,
  IPT_MISSAO_FILTRO_OPCOES,
  IPT_MISSOES,
  iptMissaoConfig,
  lerContagemHistorico,
  ordenarMunicipiosMissao,
  salvarContagemHistorico,
  variacaoMissao,
  type IptMissaoFiltro,
  type IptMissaoId,
  type IptMissaoVariacao,
} from '@/lib/ipt-missoes'
import { filtrarIptMunicipiosPorTd } from '@/lib/ipt-td'
import type { TerritorioDesenvolvimentoPI } from '@/lib/piaui-territorio-desenvolvimento'
import { cn } from '@/lib/utils'
import '@/app/dashboard/territorio/ipt/ipt-visual-refine.css'
import '@/app/dashboard/territorio/ipt/ipt-operacional.css'

const IPT_PAGE_TITLE = 'Missões estratégicas'
const IPT_PAGE_DESCRIPTION = 'Onde sua atenção gera mais impacto agora'

const MISSAO_FILTRO_ICONE: Record<IptMissaoId, LucideIcon> = {
  campo: Crosshair,
  pesquisa: LineChart,
  digital: BarChart3,
  obras: Hexagon,
}

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
  const [missaoAtiva, setMissaoAtiva] = useState<IptMissaoFiltro>('todas')
  const [filtroTd, setFiltroTd] = useState<TerritorioDesenvolvimentoPI | null>(null)
  const [municipioSelecionado, setMunicipioSelecionado] = useState<string | null>(null)
  const [atualizadoEm, setAtualizadoEm] = useState<Date | null>(null)
  const [contagemAnterior, setContagemAnterior] = useState<Record<
    IptMissaoId,
    number
  > | null>(null)
  const topbarVisible = useDashboardTopbarVisible()
  const { loading, error, conexaoInstavel, municipios, recarregar } = useIpt()
  const { isAdmin, canAccess } = usePermissions()
  const podeVerExpectativa = isAdmin || canAccess('territorio')

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

  const variacoes = useMemo(() => {
    const out = {} as Record<IptMissaoId, IptMissaoVariacao>
    for (const m of IPT_MISSOES) {
      out[m.id] = variacaoMissao(contagem[m.id], contagemAnterior?.[m.id] ?? null)
    }
    return out
  }, [contagem, contagemAnterior])

  const municipiosEmMissaoTodas = useMemo(
    () => filtrarMunicipiosPorMissao(municipiosNoEscopo, 'todas'),
    [municipiosNoEscopo]
  )

  const municipiosMissao = useMemo(() => {
    const filtrados =
      missaoAtiva === 'todas'
        ? municipiosEmMissaoTodas
        : filtrarMunicipiosPorMissao(municipiosNoEscopo, missaoAtiva)
    return ordenarMunicipiosMissao(filtrados, missaoAtiva)
  }, [municipiosNoEscopo, municipiosEmMissaoTodas, missaoAtiva])

  const resumo = useMemo(
    () => buildResumoCampanha(municipiosNoEscopo, missaoAtiva),
    [municipiosNoEscopo, missaoAtiva]
  )

  const municipioDetalhe = useMemo(() => {
    if (!municipioSelecionado) return null
    return (
      municipiosMissao.find((m) => m.municipio === municipioSelecionado) ??
      municipiosNoEscopo.find((m) => m.municipio === municipioSelecionado) ??
      null
    )
  }, [municipioSelecionado, municipiosMissao, municipiosNoEscopo])

  const indicadorMapa = useMemo(() => indicadorDaMissao(missaoAtiva), [missaoAtiva])

  const primeiroMunicipio = municipiosMissao[0]?.municipio ?? null

  const handleMissaoSelect = useCallback((id: IptMissaoId) => {
    setMissaoAtiva((atual) => (atual === id ? 'todas' : id))
  }, [])

  const handleMunicipioSelect = useCallback((nome: string) => {
    setMunicipioSelecionado(nome)
  }, [])

  useEffect(() => {
    document.body.dataset.iptRefine = 'true'
    document.body.dataset.iptOperacional = 'true'
    return () => {
      delete document.body.dataset.iptRefine
      delete document.body.dataset.iptOperacional
    }
  }, [])

  useEffect(() => {
    setContagemAnterior(lerContagemHistorico()?.counts ?? null)
  }, [])

  useEffect(() => {
    if (loading || municipios.length === 0) return
    setAtualizadoEm(new Date())
    if (!lerContagemHistorico()) {
      salvarContagemHistorico(contagem)
    }
  }, [loading, municipios.length, contagem])

  useEffect(() => {
    setMunicipioSelecionado(primeiroMunicipio)
  }, [missaoAtiva, filtroTd, primeiroMunicipio])

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
    exportarIptExcel(municipiosMissao, {
      prioridade: null,
      indicador: indicadorMapa ?? 'geral',
      evolucao: 'todos',
      td: filtroTd,
    })
  }, [municipiosMissao, indicadorMapa, filtroTd])

  const handleAtualizar = useCallback(() => {
    void Promise.resolve(recarregar()).then(() => {
      // Snapshot da contagem atual vira a base da próxima variação.
      salvarContagemHistorico(contagem)
      setContagemAnterior(contagem)
      setAtualizadoEm(new Date())
    })
  }, [contagem, recarregar])

  const atualizadoLabel = atualizadoEm
    ? atualizadoEm.toLocaleString('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—'

  const headerAction = (
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
      <div className="ipt-header-meta" title="Janela de campo e referência de atualização">
        <span>30 / 31–60 dias</span>
        <span>{atualizadoLabel}</span>
      </div>
      <button
        type="button"
        onClick={handleExportar}
        className="ipt-btn-exportar"
        disabled={loading || municipiosMissao.length === 0}
        title={`Exportar ${municipiosMissao.length} município(s) da missão`}
      >
        <CockpitIcon icon={Download} size="sm" />
        Exportar
        <span className="ipt-btn-exportar__count">{municipiosMissao.length}</span>
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
      {!isNativeFullscreen ? (
        <DashboardPageChrome>
          <IptPageHeader
            compact={topbarVisible}
            title={IPT_PAGE_TITLE}
            description={IPT_PAGE_DESCRIPTION}
            action={headerAction}
          />
        </DashboardPageChrome>
      ) : null}

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
          <IptMissoesStrip
            contagem={contagem}
            variacoes={variacoes}
            missaoAtiva={missaoAtiva}
            loading={loading}
            onSelect={handleMissaoSelect}
          />
        ) : null}

        <div
          ref={mapContainerRef}
          className={cn(
            'ipt-operacional__trio',
            missaoAtiva !== 'todas' && 'ipt-operacional__trio--missao',
            isNativeFullscreen && 'ipt-operacional__trio--fullscreen'
          )}
        >
          <section className="ipt-bloco ipt-bloco-mapa">
            <div className="ipt-bloco-mapa__head">
              <div className="ipt-bloco-mapa__intro">
                <h2 className="ipt-bloco__title">Mapa estratégico</h2>
                <p className="ipt-bloco__sub">
                  {missaoAtiva === 'todas'
                    ? 'Selecione uma missão para visualizar os municípios no mapa.'
                    : `Exibindo somente municípios de ${iptMissaoConfig(missaoAtiva).titulo}.`}
                </p>
              </div>
              <div
                className="ipt-operacional__map-filters"
                role="radiogroup"
                aria-label="Legenda e filtro de missão"
              >
                {IPT_MISSAO_FILTRO_OPCOES.map((opcao) => {
                  const ativo = missaoAtiva === opcao.id
                  const missaoCfg =
                    opcao.id === 'todas' ? null : IPT_MISSOES.find((m) => m.id === opcao.id) ?? null
                  const Icon = missaoCfg ? MISSAO_FILTRO_ICONE[missaoCfg.id] : null
                  return (
                    <button
                      key={opcao.id}
                      type="button"
                      role="radio"
                      aria-checked={ativo}
                      disabled={loading}
                      onClick={() => {
                        setMissaoAtiva(opcao.id)
                      }}
                      className={cn(
                        'ipt-operacional__map-filter',
                        ativo && 'ipt-operacional__map-filter--active',
                        missaoCfg && 'ipt-operacional__map-filter--missao'
                      )}
                      style={
                        missaoCfg
                          ? ({
                              '--missao-cor': missaoCfg.cor,
                              '--missao-tint': missaoCfg.corTint,
                              '--missao-texto': missaoCfg.corTexto,
                            } as CSSProperties)
                          : undefined
                      }
                    >
                      {Icon ? (
                        <span className="ipt-operacional__map-filter-ico" aria-hidden>
                          <CockpitIcon icon={Icon} size="sm" />
                        </span>
                      ) : null}
                      <span className="ipt-operacional__map-filter-label">{opcao.label}</span>
                      <span className="tabular-nums">
                        {opcao.id === 'todas'
                          ? municipiosEmMissaoTodas.length
                          : contagem[opcao.id]}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="ipt-bloco-mapa__body">
              {loading ? (
                <div className="ipt-operacional__map-loading">
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Calculando missões…
                </div>
              ) : (
                <IptMapSection
                  municipios={municipiosMissao}
                  indicadorFiltro={indicadorMapa}
                  evolucaoFiltro="todos"
                  filtroTd={filtroTd}
                  municipiosBoundsTd={municipiosMissao}
                  missaoFiltro={missaoAtiva}
                  isFullscreen={isNativeFullscreen}
                  onInsightSaved={recarregar}
                  onMunicipioSelect={handleMunicipioSelect}
                />
              )}

              <div className="ipt-mapa-legenda" aria-label="Legenda das missões">
                {IPT_MISSOES.map((m) => (
                  <div key={m.id} className="ipt-mapa-legenda__item">
                    <span
                      className="ipt-mapa-legenda__dot"
                      style={{ background: m.cor }}
                      aria-hidden
                    />
                    {m.titulo}
                  </div>
                ))}
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

          {!isNativeFullscreen ? (
            <>
              <IptMissaoLista
                municipios={municipiosMissao}
                missaoAtiva={missaoAtiva}
                selecionado={municipioSelecionado}
                onSelect={handleMunicipioSelect}
                podeVerExpectativa={podeVerExpectativa}
              />
              <IptMissaoDetalhe
                municipio={municipioDetalhe}
                missaoAtiva={missaoAtiva}
                podeVerExpectativa={podeVerExpectativa}
                onClear={municipioDetalhe ? () => setMunicipioSelecionado(null) : undefined}
              />
            </>
          ) : null}
        </div>

        {!isNativeFullscreen ? (
          <IptResumoCampanhaBar
            resumo={resumo}
            missaoAtiva={missaoAtiva}
            onSelectMunicipio={handleMunicipioSelect}
          />
        ) : null}
      </div>
    </DashboardPageShell>
  )
}
