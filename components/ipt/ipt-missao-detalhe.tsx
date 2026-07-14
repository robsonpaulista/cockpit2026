'use client'

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { BarChart3, Building2, MapPin, Smartphone, X } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { PerfilPopulacaoPanel } from '@/components/perfil-populacao-panel'
import { getEleitoradoByCity, getEleitoradoTotalPiaui } from '@/lib/eleitores'
import {
  calcularIndicadoresDemograficos,
  formatDemografiaPercent,
  getDemografiaMunicipio,
  getPopulacaoTotalPiaui,
} from '@/lib/demografia-municipio'
import {
  formatObrasValorAbreviado,
  type IptMunicipio,
  type IptSinal,
} from '@/lib/ipt'
import {
  chipsEvidenciaMissao,
  estimativaDiasSemVisita,
  frasePorQueMissao,
  iptMissaoConfig,
  missaoPrincipal,
  prioridadeImpactoMissao,
  resumoDiagnosticoMissao,
  rotuloRelevanciaTerritorial,
  rotuloSinalCurto,
  type IptMissaoFiltro,
  type IptMissaoId,
} from '@/lib/ipt-missoes'
import { cn } from '@/lib/utils'

type Props = {
  municipio: IptMunicipio | null
  missaoAtiva: IptMissaoFiltro
  podeVerExpectativa?: boolean
  onClear?: () => void
}

type IndicadorId = 'pesquisa' | 'campo' | 'digital' | 'obras'

function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR')
}

function formatPctDoTotal(parte: number | null | undefined, total: number): string {
  if (parte == null || !Number.isFinite(parte) || total <= 0) return '—'
  const pct = (parte / total) * 100
  return `${pct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do total estadual`
}

function evolucaoPesquisa(m: IptMunicipio): string {
  if (m.evolucao.pesquisa === 'diminuiu') {
    const delta = m.detalhes.pesquisaDeltaPp
    if (delta != null && delta < 0) {
      return `↓ ${Math.abs(delta).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} p.p.`
    }
    return '↓ Em queda'
  }
  if (m.evolucao.pesquisa === 'cresceu') return '↑ Em alta'
  if (m.evolucao.pesquisa === 'estavel') return 'Estável'
  return rotuloSinalCurto(m.sinais.pesquisa)
}

function evolucaoCampo(m: IptMunicipio): string {
  if (m.detalhes.visitasNoPeriodo === 0) return 'Crítico'
  if (m.evolucao.visitas === 'diminuiu') return '↓ Redução'
  if (m.evolucao.visitas === 'cresceu') return '↑ Mais presença'
  return rotuloSinalCurto(m.sinais.visitas)
}

function evolucaoDigital(m: IptMunicipio): string {
  if (m.sinais.digital === 'sem_dado') return '↓ Baixo'
  if (m.evolucao.digitalSeguidores === 'diminuiu') return '↓ Em queda'
  if (m.evolucao.digitalSeguidores === 'cresceu') return '↑ Em alta'
  return rotuloSinalCurto(m.sinais.digital)
}

function evolucaoObras(m: IptMunicipio): string {
  if (m.detalhes.obrasQuantidade > 0) {
    return `↑ ${m.detalhes.obrasQuantidade} entrega${m.detalhes.obrasQuantidade === 1 ? '' : 's'}`
  }
  return rotuloSinalCurto(m.sinais.obras)
}

function resumoIndicador(m: IptMunicipio, id: IndicadorId): { valor: string; detalhe: string } {
  if (id === 'pesquisa') {
    return {
      valor:
        m.detalhes.pesquisaPosicaoTop5 != null
          ? `${m.detalhes.pesquisaPosicaoTop5}º`
          : m.sinais.pesquisa === 'sem_dado'
            ? 'Sem dado'
            : 'Fora do Top 5',
      detalhe:
        m.detalhes.pesquisaMediaPct != null
          ? `Média ${m.detalhes.pesquisaMediaPct.toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })}%`
          : 'Posição vs. potencial',
    }
  }
  if (id === 'campo') {
    return {
      valor:
        m.detalhes.visitasNoPeriodo > 0
          ? `${m.detalhes.visitasNoPeriodo} em 30d`
          : estimativaDiasSemVisita(m),
      detalhe:
        m.detalhes.visitasNoPeriodo > 0
          ? `${m.detalhes.visitasPeriodoAnterior} em 31–60d`
          : 'Sem visita recente',
    }
  }
  if (id === 'digital') {
    return {
      valor:
        m.detalhes.digitalSeguidoresPct != null
          ? `${m.detalhes.digitalSeguidoresPct.toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })}%`
          : m.detalhes.digitalSeguidores != null && m.detalhes.digitalSeguidores > 0
            ? formatInt(m.detalhes.digitalSeguidores)
            : 'Fora dos 45 da base',
      detalhe: 'Seguidores vs. exp. votos',
    }
  }
  return {
    valor:
      m.detalhes.obrasQuantidade > 0
        ? formatObrasValorAbreviado(m.detalhes.obrasValorTotal).replace(/ obras$/, '')
        : 'Sem obras',
    detalhe:
      m.detalhes.obrasQuantidade > 0
        ? `${m.detalhes.obrasQuantidade} cadastrada${m.detalhes.obrasQuantidade === 1 ? '' : 's'}`
        : 'Sem destinação',
  }
}

const INDICADOR_META: Record<
  IndicadorId,
  { label: string; cor: string; icon: typeof MapPin }
> = {
  pesquisa: { label: 'PESQUISA', cor: '#e28000', icon: BarChart3 },
  campo: { label: 'CAMPO', cor: '#ff9800', icon: MapPin },
  digital: { label: 'DIGITAL', cor: '#ffc340', icon: Smartphone },
  obras: { label: 'OBRAS', cor: '#666666', icon: Building2 },
}

function sinalDoIndicador(m: IptMunicipio, id: IndicadorId): IptSinal {
  if (id === 'campo') return m.sinais.visitas
  if (id === 'pesquisa') return m.sinais.pesquisa
  if (id === 'digital') return m.sinais.digital
  return m.sinais.obras
}

function evolucaoDoIndicador(m: IptMunicipio, id: IndicadorId): string {
  if (id === 'campo') return evolucaoCampo(m)
  if (id === 'pesquisa') return evolucaoPesquisa(m)
  if (id === 'digital') return evolucaoDigital(m)
  return evolucaoObras(m)
}

export function IptMissaoDetalhe({
  municipio,
  missaoAtiva,
  podeVerExpectativa = false,
  onClear,
}: Props) {
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false)
  const perfilTituloId = useId()

  const missaoContexto: IptMissaoId | null = useMemo(() => {
    if (!municipio) return null
    if (missaoAtiva !== 'todas') return missaoAtiva
    return missaoPrincipal(municipio)
  }, [municipio, missaoAtiva])

  const hierarquiaAtiva = missaoAtiva !== 'todas' && missaoContexto != null

  useEffect(() => {
    setModalPerfilAberto(false)
  }, [municipio?.municipio])

  if (!municipio) {
    return (
      <section className="ipt-bloco ipt-bloco-detalhe ipt-bloco-detalhe--empty">
        <p>Selecione um município na lista ou no mapa para ver o diagnóstico.</p>
      </section>
    )
  }

  const demo = getDemografiaMunicipio(municipio.municipio)
  const indicadores = calcularIndicadoresDemograficos(demo)
  const pop =
    demo?.populacao_estimada_ultimo_ano ?? demo?.populacao_censo_2022 ?? null
  const eleitorado = getEleitoradoByCity(municipio.municipio)
  const impacto = prioridadeImpactoMissao(municipio, missaoAtiva)
  const missaoCfg = missaoContexto ? iptMissaoConfig(missaoContexto) : null
  const missaoTitulo = missaoCfg?.titulo ?? null
  const porQue =
    missaoContexto != null ? frasePorQueMissao(municipio, missaoContexto) : null
  const diagnostico =
    missaoContexto != null ? resumoDiagnosticoMissao(municipio, missaoContexto) : null
  const chips =
    missaoContexto != null ? chipsEvidenciaMissao(municipio, missaoContexto) : []
  const demografiaPrincipal =
    indicadores?.pct1559 != null
      ? `${formatDemografiaPercent(indicadores.pct1559)} em idade ativa`
      : demo?.urbanizacao?.taxa_urbana != null
        ? `${formatDemografiaPercent(demo.urbanizacao.taxa_urbana)} urbana`
        : '—'

  return (
    <>
    <section
      className={cn(
        'ipt-bloco ipt-bloco-detalhe',
        hierarquiaAtiva && 'ipt-bloco-detalhe--hierarquia'
      )}
      style={
        missaoCfg
          ? ({
              '--missao-cor': missaoCfg.cor,
              '--missao-suave': missaoCfg.corSuave,
              '--missao-texto': missaoCfg.corTexto,
            } as CSSProperties)
          : undefined
      }
    >
      <div className="ipt-bloco-detalhe__head">
        <h3 className="ipt-bloco-detalhe__title">
          {municipio.municipio.toUpperCase()}
          <span>— PI</span>
        </h3>
        {diagnostico ? <p className="ipt-bloco-detalhe__lead">{diagnostico}</p> : null}
        {missaoTitulo && hierarquiaAtiva ? (
          <p className="ipt-bloco-detalhe__missao-eyebrow">
            Missão: {missaoTitulo}
          </p>
        ) : null}
        <div className="ipt-bloco-detalhe__head-actions">
          {impacto !== 'baixa' ? (
            <span
              className={cn(
                'ipt-bloco-detalhe__badge',
                impacto === 'alta'
                  ? 'ipt-bloco-detalhe__badge--alta'
                  : 'ipt-bloco-detalhe__badge--media'
              )}
            >
              Prioridade {impacto === 'alta' ? 'alta' : 'média'}
            </span>
          ) : null}
          {onClear ? (
            <button type="button" className="ipt-bloco-detalhe__clear" onClick={onClear}>
              Fechar
            </button>
          ) : null}
        </div>
      </div>

      <div className="ipt-bloco-detalhe__stats">
        <div>
          <span>Expectativa 2026</span>
          {podeVerExpectativa ? (
            <>
              <strong>{formatInt(municipio.expectativaVotos)}</strong>
              <em>
                {municipio.pesoExpectativaPct.toLocaleString('pt-BR', {
                  maximumFractionDigits: 1,
                })}
                % do total estadual
              </em>
            </>
          ) : (
            <>
              <strong>{rotuloRelevanciaTerritorial(municipio)}</strong>
              <em>Classificação sem número</em>
            </>
          )}
        </div>
        <div>
          <span>POPULAÇÃO</span>
          <strong>{formatInt(pop)}</strong>
          <em>{formatPctDoTotal(pop, getPopulacaoTotalPiaui())}</em>
        </div>
        <div>
          <span>ELEITORADO</span>
          <strong>{formatInt(eleitorado)}</strong>
          <em>{formatPctDoTotal(eleitorado, getEleitoradoTotalPiaui())}</em>
        </div>
        <div>
          <span>IDH / FAIXA</span>
          <strong>{demografiaPrincipal}</strong>
          <em>15–59 / urbanização</em>
        </div>
      </div>

      {hierarquiaAtiva && porQue ? (
        <div className="ipt-bloco-detalhe__por-que">
          <h4>Por que entrou nesta missão?</h4>
          <p>{porQue}</p>
          {chips.length > 0 ? (
            <ul className="ipt-bloco-detalhe__chips">
              {chips.map((chip) => (
                <li key={chip}>{chip}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      {hierarquiaAtiva ? null : (
        <div className="ipt-bloco-detalhe__inds">
          {(['pesquisa', 'campo', 'digital', 'obras'] as IndicadorId[]).map((id) => {
            const meta = INDICADOR_META[id]
            const resumo = resumoIndicador(municipio, id)
            return (
              <Indicador
                key={id}
                icon={meta.icon}
                label={meta.label}
                cor={meta.cor}
                valor={resumo.valor}
                detalhe={resumo.detalhe}
                evolucao={evolucaoDoIndicador(municipio, id)}
                sinal={sinalDoIndicador(municipio, id)}
              />
            )
          })}
        </div>
      )}

      <div className="ipt-bloco-detalhe__demo">
        <button
          type="button"
          className="ipt-bloco-detalhe__demo-toggle"
          onClick={() => setModalPerfilAberto(true)}
        >
          <span>
            <strong>Abrir perfil do município</strong>
            <em>Contexto demográfico para compreender o público local.</em>
          </span>
          <span className="ipt-bloco-detalhe__demo-action" aria-hidden>
            →
          </span>
        </button>
      </div>
    </section>

    {modalPerfilAberto ? (
      <PerfilMunicipioModal
        tituloId={perfilTituloId}
        municipio={municipio.municipio}
        onClose={() => setModalPerfilAberto(false)}
      />
    ) : null}
    </>
  )
}

function PerfilMunicipioModal({
  tituloId,
  municipio,
  onClose,
}: {
  tituloId: string
  municipio: string
  onClose: () => void
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
      <button
        type="button"
        className="ipt-foco-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="ipt-perfil-modal__panel"
      >
        <div className="ipt-foco-modal__head">
          <div>
            <p className="ipt-foco-modal__eyebrow">Demografia</p>
            <h2 id={tituloId} className="ipt-foco-modal__title">
              Perfil de quem vive em {municipio}
            </h2>
          </div>
          <button
            type="button"
            className="ipt-foco-modal__close"
            onClick={onClose}
            aria-label="Fechar"
          >
            <CockpitIcon icon={X} size="sm" />
          </button>
        </div>
        <p className="ipt-foco-modal__lead">
          Contexto demográfico para compreender o público local.
        </p>
        <div className="ipt-perfil-modal__body">
          <PerfilPopulacaoPanel municipio={municipio} appearance="light" />
        </div>
      </div>
    </div>,
    document.body
  )
}

function Indicador({
  icon,
  label,
  cor,
  valor,
  detalhe,
  evolucao,
  sinal,
}: {
  icon: typeof MapPin
  label: string
  cor: string
  valor: string
  detalhe: string
  evolucao: string
  sinal: IptSinal
}) {
  return (
    <div className={cn('ipt-bloco-detalhe__ind', `ipt-bloco-detalhe__ind--${sinal}`)}>
      <div className="ipt-bloco-detalhe__ind-top">
        <span className="ipt-bloco-detalhe__ind-ico" style={{ background: cor }} aria-hidden>
          <CockpitIcon icon={icon} size="sm" />
        </span>
        <span>{label}</span>
      </div>
      <strong>{valor}</strong>
      <p>{detalhe}</p>
      <em>{evolucao}</em>
    </div>
  )
}
