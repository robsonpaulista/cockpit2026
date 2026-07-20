'use client'

import { useEffect, useId, useMemo, useState, type CSSProperties } from 'react'
import { createPortal } from 'react-dom'
import { AlertTriangle, BarChart3, Building2, CheckCircle2, HelpCircle, MapPin, MinusCircle, Smartphone, TrendingDown, TrendingUp, X, type LucideIcon } from 'lucide-react'
import { CockpitIcon } from '@/components/ui/cockpit-icon'
import { PerfilPopulacaoPanel } from '@/components/perfil-populacao-panel'
import { IptPesquisaRankingModal } from '@/components/ipt/ipt-pesquisa-ranking-modal'
import { IptObrasMunicipioModal } from '@/components/ipt/ipt-obras-municipio-modal'
import { IptCampoUltimaVisitaModal } from '@/components/ipt/ipt-campo-ultima-visita-modal'
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
  motivoInclusaoCurto,
  municipioNaMissao,
  prioridadeImpactoMissao,
  resumoDiagnosticoMissao,
  rotuloSeguidoresDigital,
  rotuloSinalCurto,
  temExpectativa,
  type IptMissaoFiltro,
  type IptMissaoId,
} from '@/lib/ipt-missoes'
import { cn } from '@/lib/utils'
import type { ObraMapaRow } from '@/lib/obras-mapa'

type Props = {
  municipio: IptMunicipio | null
  missaoAtiva: IptMissaoFiltro
  obras?: ObraMapaRow[]
  onClear?: () => void
  /** Sem card próprio — usado abaixo da tabela no mesmo bloco. */
  embedded?: boolean
  /** Dentro do painel cidade (direita): sem header duplicado. */
  panel?: boolean
}

type IndicadorId = 'pesquisa' | 'campo' | 'digital' | 'obras'

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
        m.detalhes.pesquisaPosicaoTop5 != null && m.detalhes.pesquisaMediaPct != null
          ? `Média ${m.detalhes.pesquisaMediaPct.toLocaleString('pt-BR', {
              maximumFractionDigits: 1,
            })}% válidos`
          : m.detalhes.pesquisaTop5.length > 0 && m.detalhes.pesquisaPosicaoTop5 == null
            ? 'Sem intenção própria no ranking'
            : 'Posição vs. potencial',
    }
  }
  if (id === 'campo') {
    if (m.detalhes.visitasUltimos15Dias > 0) {
      return {
        valor: `${m.detalhes.visitasUltimos15Dias} em 15d`,
        detalhe: 'Coberto · visita recente',
      }
    }
    return {
      valor:
        m.detalhes.visitasNoPeriodo > 0
          ? `${m.detalhes.visitasNoPeriodo} em 30d`
          : estimativaDiasSemVisita(m),
      detalhe:
        m.detalhes.visitasNoPeriodo > 0
          ? 'Sem cobertura nos últimos 15 dias'
          : 'Sem visita recente',
    }
  }
  if (id === 'digital') {
    return {
      valor: rotuloSeguidoresDigital(m, { compacto: true }),
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
  pesquisa: { label: 'Pesquisa', cor: '#e28000', icon: BarChart3 },
  campo: { label: 'Campo', cor: '#ff9800', icon: MapPin },
  digital: { label: 'Digital', cor: '#8c8c8c', icon: Smartphone },
  obras: { label: 'Obras', cor: '#666666', icon: Building2 },
}

function sinalDoIndicador(m: IptMunicipio, id: IndicadorId): IptSinal {
  if (id === 'pesquisa') return m.sinais.pesquisa
  if (id === 'campo') return m.sinais.visitas
  if (id === 'digital') return m.sinais.digital
  return m.sinais.obras
}

function evolucaoDoIndicador(m: IptMunicipio, id: IndicadorId): string {
  if (id === 'pesquisa') return evolucaoPesquisa(m)
  if (id === 'campo') return evolucaoCampo(m)
  if (id === 'digital') return evolucaoDigital(m)
  return evolucaoObras(m)
}

function temPesquisaRanking(m: IptMunicipio): boolean {
  return (
    m.detalhes.pesquisaTop5.length > 0 ||
    m.detalhes.pesquisaMediaPct != null ||
    m.detalhes.pesquisaPosicaoTop5 != null
  )
}

export function IptMissaoDetalhe({
  municipio,
  missaoAtiva,
  obras = [],
  onClear,
  embedded = false,
  panel = false,
}: Props) {
  const [modalPerfilAberto, setModalPerfilAberto] = useState(false)
  const [modalPesquisaAberto, setModalPesquisaAberto] = useState(false)
  const [modalObrasAberto, setModalObrasAberto] = useState(false)
  const [modalCampoAberto, setModalCampoAberto] = useState(false)
  const perfilTituloId = useId()

  const missaoContexto: IptMissaoId | null = useMemo(() => {
    if (!municipio) return null
    if (missaoAtiva !== 'todas') return missaoAtiva
    return missaoPrincipal(municipio)
  }, [municipio, missaoAtiva])

  // Expectativa 2026 é a base estrutural: mostra painel operacional completo.
  const missaoSelecionada = missaoAtiva !== 'todas'
  const missaoOperacional =
    missaoAtiva === 'campo' ||
    missaoAtiva === 'pesquisa' ||
    missaoAtiva === 'digital' ||
    missaoAtiva === 'obras'
      ? missaoAtiva
      : null
  const indicadorFoco: IndicadorId | null = missaoOperacional
  const hierarquiaAtiva = missaoSelecionada && missaoContexto != null
  const mostrarIndicadoresGerais = true
  const naMissaoAtiva =
    missaoSelecionada && municipio != null
      ? municipioNaMissao(municipio, missaoAtiva)
      : false
  const tituloPorQue = naMissaoAtiva
    ? 'Motivo da inclusão'
    : 'Leitura nesta missão'

  useEffect(() => {
    setModalPerfilAberto(false)
    setModalPesquisaAberto(false)
    setModalObrasAberto(false)
    setModalCampoAberto(false)
  }, [municipio?.municipio])

  if (!municipio) {
    if (panel) return null
    return (
      <section
        className={cn(
          !embedded && 'ipt-bloco',
          'ipt-bloco-detalhe ipt-bloco-detalhe--empty',
          embedded && 'ipt-bloco-detalhe--embedded'
        )}
      >
        <div className="ipt-bloco-detalhe__section-head">
          <h2 className="ipt-bloco__title">
            <MapPin className="ipt-bloco-detalhe__section-ico" aria-hidden />
            Detalhe do município
          </h2>
        </div>
        <p className="ipt-bloco-detalhe__empty-msg">
          Selecione um município nas prioridades ou no mapa para ver o motivo da
          inclusão e os sinais da missão.
        </p>
      </section>
    )
  }

  const impacto = prioridadeImpactoMissao(municipio, missaoAtiva)
  const missaoCfg = missaoContexto ? iptMissaoConfig(missaoContexto) : null
  const missaoTitulo = missaoCfg?.titulo ?? null
  const porQue =
    missaoContexto != null ? frasePorQueMissao(municipio, missaoContexto) : null
  const motivoInclusao =
    missaoContexto != null && naMissaoAtiva
      ? motivoInclusaoCurto(municipio, missaoContexto)
      : null
  const diagnostico =
    missaoContexto != null ? resumoDiagnosticoMissao(municipio, missaoContexto) : null
  const chips =
    missaoContexto != null ? chipsEvidenciaMissao(municipio, missaoContexto) : []
  const indicadoresOrdem: IndicadorId[] = indicadorFoco
    ? [
        indicadorFoco,
        ...(['pesquisa', 'campo', 'digital', 'obras'] as IndicadorId[]).filter(
          (id) => id !== indicadorFoco
        ),
      ]
    : ['pesquisa', 'campo', 'digital', 'obras']
  const podeAbrirPesquisa = temPesquisaRanking(municipio)
  const podeAbrirObras = municipio.detalhes.obrasQuantidade > 0

  return (
    <>
      <section
        className={cn(
          !embedded && !panel && 'ipt-bloco',
          'ipt-bloco-detalhe',
          embedded && !panel && 'ipt-bloco-detalhe--embedded',
          panel && 'ipt-bloco-detalhe--panel',
          hierarquiaAtiva && 'ipt-bloco-detalhe--hierarquia',
          mostrarIndicadoresGerais && 'ipt-bloco-detalhe--com-inds'
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
        {!panel ? (
          <div className="ipt-bloco-detalhe__section-head">
            <h2 className="ipt-bloco__title">
              <MapPin className="ipt-bloco-detalhe__section-ico" aria-hidden />
              Detalhe do município
            </h2>
            <div className="ipt-bloco-detalhe__head-actions">
              {missaoAtiva === 'expectativa' && !temExpectativa(municipio) ? (
                <span className="ipt-bloco-detalhe__badge ipt-bloco-detalhe__badge--neutro">
                  Sem meta
                </span>
              ) : impacto !== 'baixa' ? (
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
        ) : null}

        <div className="ipt-bloco-detalhe__body">
          <div className="ipt-bloco-detalhe__head">
            <div className="ipt-bloco-detalhe__muni">
              {!embedded || panel ? (
                <div className="ipt-bloco-detalhe__muni-top">
                  {!panel ? (
                    <h3 className="ipt-bloco-detalhe__title">
                      {municipio.municipio.toUpperCase()}
                      <span>— PI</span>
                    </h3>
                  ) : null}
                </div>
              ) : null}
              {diagnostico ? <p className="ipt-bloco-detalhe__lead">{diagnostico}</p> : null}
              {missaoTitulo && hierarquiaAtiva ? (
                <p className="ipt-bloco-detalhe__missao-eyebrow">
                  {naMissaoAtiva ? `Missão: ${missaoTitulo}` : `Fora da missão: ${missaoTitulo}`}
                </p>
              ) : null}
            </div>
          </div>

          {motivoInclusao || (hierarquiaAtiva && porQue) ? (
            <div className="ipt-bloco-detalhe__por-que">
              <h4>{tituloPorQue}</h4>
              <p>
                {motivoInclusao ?? porQue}
              </p>
              {chips.length > 0 ? (
                <ul className="ipt-bloco-detalhe__chips">
                  {chips.map((chip) => (
                    <li key={chip}>{chip}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          ) : null}

        {mostrarIndicadoresGerais ? (
          <div
            className={cn(
              'ipt-bloco-detalhe__inds',
              indicadorFoco && 'ipt-bloco-detalhe__inds--com-foco'
            )}
          >
            {indicadoresOrdem.map((id) => {
              const meta = INDICADOR_META[id]
              const resumo = resumoIndicador(municipio, id)
              const clickable =
                (id === 'pesquisa' && podeAbrirPesquisa) ||
                (id === 'obras' && podeAbrirObras) ||
                id === 'campo'
              const emFoco = indicadorFoco === id
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
                  destaque={emFoco}
                  complementar={Boolean(indicadorFoco) && !emFoco}
                  onClick={
                    clickable
                      ? () => {
                          if (id === 'pesquisa') setModalPesquisaAberto(true)
                          else if (id === 'obras') setModalObrasAberto(true)
                          else if (id === 'campo') setModalCampoAberto(true)
                        }
                      : undefined
                  }
                />
              )
            })}
          </div>
        ) : null}

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
        </div>
      </section>

      {modalPerfilAberto ? (
        <PerfilMunicipioModal
          tituloId={perfilTituloId}
          municipio={municipio.municipio}
          onClose={() => setModalPerfilAberto(false)}
        />
      ) : null}

      {modalPesquisaAberto ? (
        <IptPesquisaRankingModal
          municipio={municipio}
          onClose={() => setModalPesquisaAberto(false)}
        />
      ) : null}

      {modalObrasAberto ? (
        <IptObrasMunicipioModal
          municipio={municipio.municipio}
          obras={obras}
          onClose={() => setModalObrasAberto(false)}
        />
      ) : null}

      {modalCampoAberto ? (
        <IptCampoUltimaVisitaModal
          municipio={municipio.municipio}
          onClose={() => setModalCampoAberto(false)}
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
  destaque = false,
  complementar = false,
  onClick,
}: {
  icon: typeof MapPin
  label: string
  cor: string
  valor: string
  detalhe: string
  evolucao: string
  sinal: IptSinal
  destaque?: boolean
  complementar?: boolean
  onClick?: () => void
}) {
  const status = statusDoIndicador(sinal, evolucao)
  const body = (
    <>
      <div className="ipt-bloco-detalhe__ind-top">
        <span className="ipt-bloco-detalhe__ind-ico" style={{ background: cor }} aria-hidden>
          <CockpitIcon icon={icon} size="sm" />
        </span>
        <span>{label}</span>
        {destaque ? (
          <span className="ipt-bloco-detalhe__ind-foco-tag">Motivo</span>
        ) : null}
      </div>
      <strong>{valor}</strong>
      <p>{detalhe}</p>
      <em>
        <CockpitIcon icon={status.Icon} size="sm" className="ipt-bloco-detalhe__ind-status-ico" />
        <span>{status.label}</span>
      </em>
    </>
  )

  const className = cn(
    'ipt-bloco-detalhe__ind',
    `ipt-bloco-detalhe__ind--${sinal}`,
    destaque && 'ipt-bloco-detalhe__ind--destaque',
    complementar && 'ipt-bloco-detalhe__ind--complementar',
    onClick && 'ipt-bloco-detalhe__ind--clickable'
  )

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {body}
      </button>
    )
  }

  return <div className={className}>{body}</div>
}

function statusDoIndicador(
  sinal: IptSinal,
  evolucao: string
): { Icon: LucideIcon; label: string } {
  const texto = evolucao.trim()
  if (texto.startsWith('↓')) {
    return { Icon: TrendingDown, label: texto.replace(/^↓\s*/, '') }
  }
  if (texto.startsWith('↑')) {
    return { Icon: TrendingUp, label: texto.replace(/^↑\s*/, '') }
  }
  if (sinal === 'mal') return { Icon: AlertTriangle, label: texto }
  if (sinal === 'bem') return { Icon: CheckCircle2, label: texto }
  if (sinal === 'neutro') return { Icon: MinusCircle, label: texto }
  return { Icon: HelpCircle, label: texto }
}
