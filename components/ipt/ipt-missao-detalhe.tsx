'use client'

import { useMemo, useState } from 'react'
import { BarChart3, Building2, ChevronDown, MapPin, Smartphone } from 'lucide-react'
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
  estimativaDiasSemVisita,
  iptMissaoConfig,
  missaoPrincipal,
  prioridadeImpactoMissao,
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
  pesquisa: { label: 'PESQUISA', cor: '#3269C8', icon: BarChart3 },
  campo: { label: 'CAMPO', cor: '#D79A19', icon: MapPin },
  digital: { label: 'DIGITAL', cor: '#29935F', icon: Smartphone },
  obras: { label: 'OBRAS', cor: '#7851B8', icon: Building2 },
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
  const [mostrarDemo, setMostrarDemo] = useState(false)

  const missaoContexto: IptMissaoId | null = useMemo(() => {
    if (!municipio) return null
    if (missaoAtiva !== 'todas') return missaoAtiva
    return missaoPrincipal(municipio)
  }, [municipio, missaoAtiva])

  const hierarquiaAtiva = missaoAtiva !== 'todas' && missaoContexto != null

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
  const missaoTitulo = missaoContexto ? iptMissaoConfig(missaoContexto).titulo : null
  const demografiaPrincipal =
    indicadores?.pct1559 != null
      ? `${formatDemografiaPercent(indicadores.pct1559)} em idade ativa`
      : demo?.urbanizacao?.taxa_urbana != null
        ? `${formatDemografiaPercent(demo.urbanizacao.taxa_urbana)} urbana`
        : '—'

  return (
    <section
      className={cn(
        'ipt-bloco ipt-bloco-detalhe',
        hierarquiaAtiva && 'ipt-bloco-detalhe--hierarquia'
      )}
    >
      <div className="ipt-bloco-detalhe__head">
        <div className="min-w-0">
          <h3 className="ipt-bloco-detalhe__title">
            {municipio.municipio.toUpperCase()}
            <span>— PI</span>
          </h3>
          {missaoTitulo && hierarquiaAtiva ? (
            <p className="ipt-bloco-detalhe__missao-eyebrow">
              Missão: {missaoTitulo}
            </p>
          ) : null}
        </div>
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
          <span>Expec. 2026</span>
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
          <span>IDH</span>
          <strong>{demografiaPrincipal}</strong>
          <em>15–59 / urbanização</em>
        </div>
      </div>

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

      {!hierarquiaAtiva ? (
      <div className="ipt-bloco-detalhe__demo">
        <button
          type="button"
          className="ipt-bloco-detalhe__demo-toggle"
          aria-expanded={mostrarDemo}
          onClick={() => setMostrarDemo((v) => !v)}
        >
          <span>
            <strong>Perfil de quem vive no município</strong>
            <em>Contexto demográfico para compreender o público local.</em>
          </span>
          <CockpitIcon icon={ChevronDown} size="sm" className={mostrarDemo ? 'rotate-180' : undefined} />
        </button>
        {mostrarDemo ? (
          <div className="ipt-bloco-detalhe__demo-body">
            <PerfilPopulacaoPanel municipio={municipio.municipio} appearance="light" />
          </div>
        ) : null}
      </div>
      ) : null}
    </section>
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
