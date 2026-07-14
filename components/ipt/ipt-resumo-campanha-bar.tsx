'use client'

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import {
  BarChart3,
  Building2,
  Crosshair,
  LineChart,
  RefreshCw,
  Smartphone,
  Users,
  Zap,
  X,
  type LucideIcon,
} from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { formatObrasValorAbreviado } from '@/lib/ipt'
import {
  textoAcaoRecomendada,
  textoFocoMissao,
  type IptMissaoFiltro,
  type IptResumoCampanha,
} from '@/lib/ipt-missoes'

type Props = {
  resumo: IptResumoCampanha
  missaoAtiva?: IptMissaoFiltro
  onSelectMunicipio?: (municipio: string) => void
}

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

type Metric = {
  key: string
  icon: LucideIcon
  cor: string
  value: string
  valueSuffix?: string
  descricao: string
  detalhe?: string
}

function metricsParaMissao(resumo: IptResumoCampanha, missao: IptMissaoFiltro): Metric[] {
  if (missao === 'campo') {
    return [
      {
        key: 'relevantes',
        icon: Crosshair,
        cor: '#ff9800',
        value: formatInt(resumo.municipiosExpectativaRelevante),
        valueSuffix: 'municípios',
        descricao: 'concentram o maior potencial ainda pouco visitado',
      },
      {
        key: 'cobertura',
        icon: Users,
        cor: '#e28000',
        value: `${resumo.municipiosCampoSuficientePct}%`,
        valueSuffix: 'do grupo',
        descricao: 'tem cobertura de campo considerada suficiente',
      },
      {
        key: 'visitas',
        icon: LineChart,
        cor: '#ff9800',
        value: formatInt(resumo.visitasRealizadas),
        valueSuffix: 'visitas realizadas',
        descricao: 'nos últimos 30 dias',
      },
      {
        key: 'tempo',
        icon: RefreshCw,
        cor: '#666666',
        value: resumo.tempoMedioSemVisita,
        descricao: 'é o tempo médio sem visita',
      },
      {
        key: 'expectativa',
        icon: BarChart3,
        cor: '#8c8c8c',
        value: formatInt(resumo.expectativaTotal),
        descricao: 'é a expectativa total do grupo',
        detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
      },
    ]
  }

  if (missao === 'pesquisa') {
    return [
      {
        key: 'relevantes',
        icon: Crosshair,
        cor: '#ff9800',
        value: formatInt(resumo.municipiosExpectativaRelevante),
        valueSuffix: 'municípios',
        descricao: 'concentram potencial com pesquisa abaixo do esperado',
      },
      {
        key: 'pesquisa',
        icon: LineChart,
        cor: '#ff9800',
        value: formatInt(resumo.municipiosComPesquisa),
        valueSuffix: 'com pesquisa',
        descricao: `${resumo.municipiosComPesquisaPct}% do grupo já tem leitura disponível`,
      },
      {
        key: 'visitas',
        icon: Users,
        cor: '#e28000',
        value: formatInt(resumo.visitasRealizadas),
        valueSuffix: 'visitas',
        descricao: 'realizadas nos últimos 30 dias no grupo',
      },
      {
        key: 'grupo',
        icon: RefreshCw,
        cor: '#666666',
        value: formatInt(resumo.municipiosTotal),
        valueSuffix: 'municípios',
        descricao: 'entram nesta missão hoje',
      },
      {
        key: 'expectativa',
        icon: BarChart3,
        cor: '#8c8c8c',
        value: formatInt(resumo.expectativaTotal),
        descricao: 'é a expectativa total do grupo',
        detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
      },
    ]
  }

  if (missao === 'digital') {
    return [
      {
        key: 'relevantes',
        icon: Crosshair,
        cor: '#ff9800',
        value: formatInt(resumo.municipiosExpectativaRelevante),
        valueSuffix: 'municípios',
        descricao: 'concentram oportunidade digital mal aproveitada',
      },
      {
        key: 'digital',
        icon: Smartphone,
        cor: '#666666',
        value: `${resumo.digitalCoberturaPct}%`,
        valueSuffix: 'do grupo',
        descricao: 'já aparece na base digital da campanha',
      },
      {
        key: 'seguidores',
        icon: Users,
        cor: '#ff9800',
        value: formatInt(resumo.seguidoresDigitais),
        valueSuffix: 'seguidores',
        descricao: 'concentrados nos municípios do recorte',
      },
      {
        key: 'grupo',
        icon: RefreshCw,
        cor: '#e28000',
        value: formatInt(resumo.municipiosTotal),
        valueSuffix: 'municípios',
        descricao: 'pedem apontamento digital agora',
      },
      {
        key: 'expectativa',
        icon: BarChart3,
        cor: '#8c8c8c',
        value: formatInt(resumo.expectativaTotal),
        descricao: 'é a expectativa total do grupo',
        detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
      },
    ]
  }

  if (missao === 'obras') {
    return [
      {
        key: 'relevantes',
        icon: Crosshair,
        cor: '#ff9800',
        value: formatInt(resumo.municipiosExpectativaRelevante),
        valueSuffix: 'municípios',
        descricao: 'concentram entregas ainda pouco aproveitadas',
      },
      {
        key: 'obras',
        icon: Building2,
        cor: '#8c8c8c',
        value: formatObrasValorAbreviado(resumo.obrasValorTotal).replace(/ obras$/, ''),
        descricao: `em ${formatInt(resumo.municipiosComObras)} municípios do grupo`,
      },
      {
        key: 'cobertura',
        icon: Users,
        cor: '#e28000',
        value: `${resumo.obrasCoberturaPct}%`,
        valueSuffix: 'do grupo',
        descricao: 'já tem obra cadastrada no território',
      },
      {
        key: 'grupo',
        icon: RefreshCw,
        cor: '#666666',
        value: formatInt(resumo.municipiosTotal),
        valueSuffix: 'municípios',
        descricao: 'entram na missão Onde acelerar',
      },
      {
        key: 'expectativa',
        icon: BarChart3,
        cor: '#ff9800',
        value: formatInt(resumo.expectativaTotal),
        descricao: 'é a expectativa total do grupo',
        detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
      },
    ]
  }

  // Visão geral (Todas)
  return [
    {
      key: 'expectativa',
      icon: BarChart3,
      cor: '#8c8c8c',
      value: formatInt(resumo.expectativaTotal),
      descricao: 'é a expectativa total de votos do recorte',
      detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
    },
    {
      key: 'cobertos',
      icon: Users,
      cor: '#e28000',
      value: formatInt(resumo.municipiosCobertos),
      valueSuffix: 'municípios',
      descricao: `${resumo.municipiosCobertosPct}% do grupo com alguma cobertura`,
    },
    {
      key: 'visitas',
      icon: LineChart,
      cor: '#ff9800',
      value: formatInt(resumo.visitasRealizadas),
      valueSuffix: 'visitas realizadas',
      descricao: 'nos últimos 30 dias',
    },
    {
      key: 'obras',
      icon: Building2,
      cor: '#666666',
      value: formatObrasValorAbreviado(resumo.obrasValorTotal).replace(/ obras$/, ''),
      descricao: 'em obras e recursos no território',
    },
    {
      key: 'digital',
      icon: Smartphone,
      cor: '#ff9800',
      value: formatInt(resumo.seguidoresDigitais),
      valueSuffix: 'seguidores',
      descricao: 'na presença digital do grupo',
    },
  ]
}

export function IptResumoCampanhaBar({
  resumo,
  missaoAtiva = 'todas',
  onSelectMunicipio,
}: Props) {
  const [modalAberto, setModalAberto] = useState(false)
  const tituloId = useId()
  const missao = missaoAtiva !== 'todas' ? missaoAtiva : resumo.missao
  const metrics = useMemo(() => metricsParaMissao(resumo, missao), [resumo, missao])
  const tituloResumo = 'Leitura executiva da missão'
  const focoTexto = textoFocoMissao(missao)
  const acaoTexto = textoAcaoRecomendada(missao, resumo.focoPrincipal)

  return (
    <>
      <section className="ipt-resumo-bar" aria-label={tituloResumo}>
        <div className="ipt-resumo-bar__body">
          <h2 className="ipt-resumo-bar__title">{tituloResumo}</h2>
          <div className="ipt-resumo-bar__row">
            <div className="ipt-resumo-bar__metrics">
              {metrics.map((m) => {
                const Icon = m.icon
                return (
                  <div
                    key={m.key}
                    className="ipt-resumo-bar__metric"
                    style={{ '--metric-cor': m.cor } as CSSProperties}
                  >
                    <span className="ipt-resumo-bar__metric-ico" aria-hidden>
                      <CockpitIcon icon={Icon} size="sm" />
                    </span>
                    <div className="ipt-resumo-bar__metric-copy">
                      <strong>
                        {m.value}
                        {m.valueSuffix ? <span> {m.valueSuffix}</span> : null}
                      </strong>
                      <em>{m.descricao}</em>
                      {m.detalhe ? <small>{m.detalhe}</small> : null}
                    </div>
                  </div>
                )
              })}
            </div>

            <button
              type="button"
              className="ipt-resumo-bar__foco"
              onClick={() => setModalAberto(true)}
              disabled={resumo.focoPrincipal.length === 0}
            >
              <span className="ipt-resumo-bar__foco-ico" aria-hidden>
                <CockpitIcon icon={Zap} size="sm" />
              </span>
              <span className="ipt-resumo-bar__foco-copy">
                <span className="ipt-resumo-bar__foco-label">Ação recomendada hoje</span>
                <strong className="ipt-resumo-bar__foco-cidades">{acaoTexto}</strong>
                <em className="ipt-resumo-bar__foco-alerta">{focoTexto}</em>
              </span>
              <span className="ipt-resumo-bar__foco-action" aria-hidden>
                ›
              </span>
            </button>
          </div>
        </div>
      </section>

      {modalAberto ? (
        <FocoPrincipalModal
          tituloId={tituloId}
          municipios={resumo.focoPrincipal}
          focoTexto={focoTexto}
          onClose={() => setModalAberto(false)}
          onSelect={(nome) => {
            onSelectMunicipio?.(nome)
            setModalAberto(false)
          }}
        />
      ) : null}
    </>
  )
}

function FocoPrincipalModal({
  tituloId,
  municipios,
  focoTexto,
  onClose,
  onSelect,
}: {
  tituloId: string
  municipios: string[]
  focoTexto: string
  onClose: () => void
  onSelect: (municipio: string) => void
}) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  if (!mounted) return null

  return createPortal(
    <div className="ipt-foco-modal" role="presentation">
      <button type="button" className="ipt-foco-modal__backdrop" aria-label="Fechar" onClick={onClose} />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="ipt-foco-modal__panel"
      >
        <div className="ipt-foco-modal__head">
          <div>
            <p className="ipt-foco-modal__eyebrow">Maiores incompatibilidades</p>
            <h2 id={tituloId} className="ipt-foco-modal__title">
              Municípios prioritários do recorte atual
            </h2>
          </div>
          <button type="button" className="ipt-foco-modal__close" onClick={onClose} aria-label="Fechar">
            <CockpitIcon icon={X} size="sm" />
          </button>
        </div>
        <p className="ipt-foco-modal__lead">{focoTexto}</p>
        <ul className="ipt-foco-modal__list">
          {municipios.map((nome, idx) => (
            <li key={nome}>
              <button type="button" onClick={() => onSelect(nome)}>
                <span aria-hidden>{idx + 1}</span>
                <strong>{nome}</strong>
                <em>Abrir no diagnóstico →</em>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  )
}
