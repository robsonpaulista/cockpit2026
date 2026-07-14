'use client'

import { useEffect, useId, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Crosshair, X } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { formatObrasValorAbreviado } from '@/lib/ipt'
import {
  iptMissaoConfig,
  textoFocoMissao,
  type IptMissaoFiltro,
  type IptResumoCampanha,
} from '@/lib/ipt-missoes'
import { cn } from '@/lib/utils'

type Props = {
  resumo: IptResumoCampanha
  missaoAtiva?: IptMissaoFiltro
  onSelectMunicipio?: (municipio: string) => void
}

function formatInt(n: number): string {
  return n.toLocaleString('pt-BR')
}

function formatPctBadge(pct: number | null, withArrow = false): string | null {
  if (pct == null || !Number.isFinite(pct)) return null
  const abs = Math.abs(pct)
  if (withArrow) {
    if (pct > 0) return `↗ ${abs}%`
    if (pct < 0) return `↘ ${abs}%`
    return '0%'
  }
  return `${pct}%`
}

type Metric = {
  key: string
  label: string
  value: string
  detalhe: string
  badge: string | null
  badgeTone: 'ok' | 'warn' | 'neutral'
}

function metricsParaMissao(resumo: IptResumoCampanha, missao: IptMissaoFiltro): Metric[] {
  if (missao === 'campo') {
    return [
      {
        key: 'relevantes',
        label: 'Expectativa relevante',
        value: formatInt(resumo.municipiosExpectativaRelevante),
        detalhe: `De ${formatInt(resumo.municipiosTotal)} no grupo`,
        badge: null,
        badgeTone: 'neutral',
      },
      {
        key: 'cobertura-campo',
        label: 'Cobertura de campo suficiente',
        value: formatInt(resumo.municipiosCampoSuficiente),
        detalhe: `${resumo.municipiosCampoSuficientePct}% do grupo`,
        badge: `${resumo.municipiosCampoSuficientePct}%`,
        badgeTone: resumo.municipiosCampoSuficientePct >= 40 ? 'ok' : 'warn',
      },
      {
        key: 'visitas',
        label: 'Visitas realizadas',
        value: formatInt(resumo.visitasRealizadas),
        detalhe: 'Últimos 30 dias',
        badge: formatPctBadge(resumo.visitasVariacaoPct, true),
        badgeTone:
          resumo.visitasVariacaoPct == null
            ? 'neutral'
            : resumo.visitasVariacaoPct >= 0
              ? 'ok'
              : 'warn',
      },
      {
        key: 'tempo',
        label: 'Tempo médio sem visita',
        value: resumo.tempoMedioSemVisita,
        detalhe: 'Proxy no grupo da missão',
        badge: null,
        badgeTone: 'neutral',
      },
      {
        key: 'expectativa',
        label: 'Expectativa total do grupo',
        value: formatInt(resumo.expectativaTotal),
        detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
        badge: formatPctBadge(resumo.expectativaVsMetaPct),
        badgeTone:
          resumo.expectativaVsMetaPct == null
            ? 'neutral'
            : resumo.expectativaVsMetaPct >= 100
              ? 'ok'
              : 'warn',
      },
    ]
  }

  if (missao === 'pesquisa') {
    return [
      {
        key: 'relevantes',
        label: 'Expectativa relevante',
        value: formatInt(resumo.municipiosExpectativaRelevante),
        detalhe: `De ${formatInt(resumo.municipiosTotal)} no grupo`,
        badge: null,
        badgeTone: 'neutral',
      },
      {
        key: 'pesquisa',
        label: 'Com pesquisa disponível',
        value: formatInt(resumo.municipiosComPesquisa),
        detalhe: `${resumo.municipiosComPesquisaPct}% do grupo`,
        badge: `${resumo.municipiosComPesquisaPct}%`,
        badgeTone: resumo.municipiosComPesquisaPct >= 40 ? 'ok' : 'warn',
      },
      {
        key: 'expectativa',
        label: 'Expectativa total do grupo',
        value: formatInt(resumo.expectativaTotal),
        detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
        badge: formatPctBadge(resumo.expectativaVsMetaPct),
        badgeTone:
          resumo.expectativaVsMetaPct == null
            ? 'neutral'
            : resumo.expectativaVsMetaPct >= 100
              ? 'ok'
              : 'warn',
      },
      {
        key: 'cobertos',
        label: 'Municípios no grupo',
        value: formatInt(resumo.municipiosTotal),
        detalhe: 'Missão Para onde olhar',
        badge: null,
        badgeTone: 'neutral',
      },
    ]
  }

  if (missao === 'digital') {
    return [
      {
        key: 'relevantes',
        label: 'Expectativa relevante',
        value: formatInt(resumo.municipiosExpectativaRelevante),
        detalhe: `De ${formatInt(resumo.municipiosTotal)} no grupo`,
        badge: null,
        badgeTone: 'neutral',
      },
      {
        key: 'digital',
        label: 'Presença digital no grupo',
        value: formatInt(resumo.seguidoresDigitais),
        detalhe: 'Seguidores somados',
        badge: `${resumo.digitalCoberturaPct}%`,
        badgeTone: resumo.digitalCoberturaPct >= 20 ? 'ok' : 'warn',
      },
      {
        key: 'cobertura',
        label: 'Municípios com dado digital',
        value: formatInt(resumo.municipiosComDigital),
        detalhe: `${resumo.digitalCoberturaPct}% do grupo`,
        badge: null,
        badgeTone: 'neutral',
      },
      {
        key: 'expectativa',
        label: 'Expectativa total do grupo',
        value: formatInt(resumo.expectativaTotal),
        detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
        badge: formatPctBadge(resumo.expectativaVsMetaPct),
        badgeTone:
          resumo.expectativaVsMetaPct == null
            ? 'neutral'
            : resumo.expectativaVsMetaPct >= 100
              ? 'ok'
              : 'warn',
      },
    ]
  }

  if (missao === 'obras') {
    return [
      {
        key: 'relevantes',
        label: 'Expectativa relevante',
        value: formatInt(resumo.municipiosExpectativaRelevante),
        detalhe: `De ${formatInt(resumo.municipiosTotal)} no grupo`,
        badge: null,
        badgeTone: 'neutral',
      },
      {
        key: 'obras',
        label: 'Obras e recursos no grupo',
        value: formatObrasValorAbreviado(resumo.obrasValorTotal).replace(/ obras$/, ''),
        detalhe: `Em ${formatInt(resumo.municipiosComObras)} municípios`,
        badge: `${resumo.obrasCoberturaPct}%`,
        badgeTone: resumo.obrasCoberturaPct >= 40 ? 'ok' : 'warn',
      },
      {
        key: 'expectativa',
        label: 'Expectativa total do grupo',
        value: formatInt(resumo.expectativaTotal),
        detalhe: `Meta estadual: ${formatInt(resumo.metaExpectativa)}`,
        badge: formatPctBadge(resumo.expectativaVsMetaPct),
        badgeTone:
          resumo.expectativaVsMetaPct == null
            ? 'neutral'
            : resumo.expectativaVsMetaPct >= 100
              ? 'ok'
              : 'warn',
      },
      {
        key: 'visitas',
        label: 'Visitas no grupo',
        value: formatInt(resumo.visitasRealizadas),
        detalhe: 'Últimos 30 dias',
        badge: formatPctBadge(resumo.visitasVariacaoPct, true),
        badgeTone:
          resumo.visitasVariacaoPct == null
            ? 'neutral'
            : resumo.visitasVariacaoPct >= 0
              ? 'ok'
              : 'warn',
      },
    ]
  }

  return [
    {
      key: 'expectativa',
      label: 'Expectativa total de votos',
      value: formatInt(resumo.expectativaTotal),
      detalhe: `Meta: ${formatInt(resumo.metaExpectativa)}`,
      badge: formatPctBadge(resumo.expectativaVsMetaPct),
      badgeTone:
        resumo.expectativaVsMetaPct == null
          ? 'neutral'
          : resumo.expectativaVsMetaPct >= 100
            ? 'ok'
            : 'warn',
    },
    {
      key: 'cobertos',
      label: 'Municípios cobertos',
      value: formatInt(resumo.municipiosCobertos),
      detalhe: `${resumo.municipiosCobertosPct}% do total`,
      badge: `${resumo.municipiosCobertosPct}%`,
      badgeTone: resumo.municipiosCobertosPct >= 40 ? 'ok' : 'warn',
    },
    {
      key: 'visitas',
      label: 'Visitas realizadas',
      value: formatInt(resumo.visitasRealizadas),
      detalhe: 'Últimos 30 dias',
      badge: formatPctBadge(resumo.visitasVariacaoPct, true),
      badgeTone:
        resumo.visitasVariacaoPct == null
          ? 'neutral'
          : resumo.visitasVariacaoPct >= 0
            ? 'ok'
            : 'warn',
    },
    {
      key: 'obras',
      label: 'Obras e recursos',
      value: formatObrasValorAbreviado(resumo.obrasValorTotal).replace(/ obras$/, ''),
      detalhe: `Em ${formatInt(resumo.municipiosComObras)} municípios`,
      badge: `${resumo.obrasCoberturaPct}%`,
      badgeTone: resumo.obrasCoberturaPct >= 40 ? 'ok' : 'warn',
    },
    {
      key: 'digital',
      label: 'Presença digital',
      value: formatInt(resumo.seguidoresDigitais),
      detalhe: 'Seguidores totais',
      badge: `${resumo.digitalCoberturaPct}%`,
      badgeTone: resumo.digitalCoberturaPct >= 20 ? 'ok' : 'warn',
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
  const focoLabel =
    resumo.focoPrincipal.length > 0
      ? resumo.focoPrincipal.join(', ')
      : 'Sem municípios em missão'
  const metrics = useMemo(() => metricsParaMissao(resumo, missao), [resumo, missao])
  const tituloResumo =
    missao !== 'todas'
      ? `Resumo · ${iptMissaoConfig(missao).titulo}`
      : 'Resumo geral da campanha'
  const focoTexto = textoFocoMissao(missao)

  return (
    <>
      <section className="ipt-resumo-bar" aria-label={tituloResumo}>
        <div className="ipt-resumo-bar__body">
          <h2 className="ipt-resumo-bar__title">{tituloResumo}</h2>
          <div className="ipt-resumo-bar__metrics">
            {metrics.map((m) => (
              <div key={m.key} className="ipt-resumo-bar__metric">
                <span>{m.label}</span>
                <strong>{m.value}</strong>
                <div className="ipt-resumo-bar__metric-foot">
                  <em>{m.detalhe}</em>
                  {m.badge ? (
                    <b
                      className={cn(
                        'ipt-resumo-bar__badge',
                        m.badgeTone === 'ok' && 'ipt-resumo-bar__badge--ok',
                        m.badgeTone === 'warn' && 'ipt-resumo-bar__badge--warn'
                      )}
                    >
                      {m.badge}
                    </b>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          className="ipt-resumo-bar__foco"
          onClick={() => setModalAberto(true)}
          disabled={resumo.focoPrincipal.length === 0}
        >
          <span className="ipt-resumo-bar__foco-ico" aria-hidden>
            <CockpitIcon icon={Crosshair} size="sm" />
          </span>
          <span className="ipt-resumo-bar__foco-copy">
            <span className="ipt-resumo-bar__foco-label">
              Maiores incompatibilidades da missão
            </span>
            <strong className="ipt-resumo-bar__foco-cidades">{focoLabel}</strong>
            <em>{focoTexto}</em>
          </span>
          <span className="ipt-resumo-bar__foco-action" aria-hidden>
            ›
          </span>
        </button>
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
