'use client'

import {
  coberturaCampoRotulo,
  estimativaDiasSemVisita,
  iptMissaoConfig,
  missaoPrincipal,
  prioridadeImpactoMissao,
  relevanciaCurta,
  type IptMissaoFiltro,
  type IptMissaoId,
} from '@/lib/ipt-missoes'
import { formatObrasValorAbreviado, type IptMunicipio } from '@/lib/ipt'
import { cn } from '@/lib/utils'

type Props = {
  municipios: IptMunicipio[]
  missaoAtiva: IptMissaoFiltro
  selecionado: string | null
  onSelect: (municipio: string) => void
  podeVerExpectativa?: boolean
}

function formatExpectativa(n: number): string {
  return n.toLocaleString('pt-BR')
}

function textoSeguidores(m: IptMunicipio): string {
  const seg = m.detalhes.digitalSeguidores
  if (seg == null || seg <= 0) return 'Fora dos 45 da base'
  return seg.toLocaleString('pt-BR')
}

function intensidadeLabel(impacto: 'alta' | 'media' | 'baixa'): string {
  if (impacto === 'alta') return 'Alta'
  if (impacto === 'media') return 'Média'
  return 'Baixa'
}

function colunasMissao(missao: IptMissaoId | null): [string, string, string] {
  if (missao === 'campo') return ['Última visita', 'Cobertura de campo', 'Intensidade']
  if (missao === 'pesquisa') return ['Posição', 'Média', 'Intensidade']
  if (missao === 'digital') return ['Seguidores', 'Cobertura', 'Intensidade']
  if (missao === 'obras') return ['Recursos', 'Obras', 'Intensidade']
  return ['Evidência', 'Detalhe', 'Intensidade']
}

function valoresLinha(
  m: IptMunicipio,
  missao: IptMissaoId | null
): [string, string, string] {
  const impacto = prioridadeImpactoMissao(m, missao ?? 'todas')
  const intensidade = intensidadeLabel(impacto)

  if (missao === 'campo') {
    return [estimativaDiasSemVisita(m), coberturaCampoRotulo(m), intensidade]
  }
  if (missao === 'pesquisa') {
    const pos =
      m.detalhes.pesquisaPosicaoTop5 != null
        ? `${m.detalhes.pesquisaPosicaoTop5}º`
        : m.sinais.pesquisa === 'sem_dado'
          ? 'Sem dado'
          : 'Fora do Top 5'
    const media =
      m.detalhes.pesquisaMediaPct != null
        ? `${m.detalhes.pesquisaMediaPct.toLocaleString('pt-BR', {
            maximumFractionDigits: 1,
          })}%`
        : '—'
    return [pos, media, intensidade]
  }
  if (missao === 'digital') {
    const cobertura =
      m.detalhes.digitalSeguidoresPct != null
        ? `${m.detalhes.digitalSeguidoresPct.toLocaleString('pt-BR', {
            maximumFractionDigits: 1,
          })}%`
        : m.sinais.digital === 'sem_dado'
          ? 'Abaixo'
          : '—'
    return [textoSeguidores(m), cobertura, intensidade]
  }
  if (missao === 'obras') {
    const valor =
      m.detalhes.obrasQuantidade > 0
        ? formatObrasValorAbreviado(m.detalhes.obrasValorTotal).replace(/ obras$/, '')
        : 'Sem obras'
    const qtd =
      m.detalhes.obrasQuantidade > 0
        ? `${m.detalhes.obrasQuantidade} cadastrada${m.detalhes.obrasQuantidade === 1 ? '' : 's'}`
        : '—'
    return [valor, qtd, intensidade]
  }

  const principal = missaoPrincipal(m)
  if (principal) return valoresLinha(m, principal)
  return ['—', '—', intensidade]
}

export function IptMissaoLista({
  municipios,
  missaoAtiva,
  selecionado,
  onSelect,
  podeVerExpectativa = false,
}: Props) {
  const missaoLista: IptMissaoId | null =
    missaoAtiva === 'todas' ? null : missaoAtiva
  const [colA, colB, colC] = colunasMissao(missaoLista)

  return (
    <section
      className={cn(
        'ipt-bloco ipt-bloco-lista',
        missaoAtiva !== 'todas' && 'ipt-bloco-lista--missao'
      )}
    >
      <div className="ipt-bloco-lista__head">
        <div className="min-w-0">
          <h3 className="ipt-bloco__title">Municípios da missão selecionada</h3>
          <p className="ipt-bloco__sub">
            {missaoLista
              ? `Leitura específica de ${iptMissaoConfig(missaoLista).titulo}`
              : 'Ordenados por prioridade de impacto'}
          </p>
        </div>
        <span className="ipt-bloco-lista__badge">
          <strong>{municipios.length}</strong> municípios
        </span>
      </div>

      {municipios.length === 0 ? (
        <p className="ipt-bloco-lista__empty">
          Nenhum município apresenta essa incompatibilidade no recorte atual.
        </p>
      ) : (
        <>
          <div className="ipt-bloco-lista__cols" aria-hidden>
            <span />
            <span>Município</span>
            <span>{podeVerExpectativa && missaoLista == null ? 'Exp. votos' : 'Relevância'}</span>
            <span>{colA}</span>
            <span>{colB}</span>
            <span>{colC}</span>
          </div>
          <ul className="ipt-bloco-lista__rows">
            {municipios.map((m, idx) => {
              const ativo = selecionado === m.municipio
              const impacto = prioridadeImpactoMissao(m, missaoAtiva)
              const principal = missaoPrincipal(m)
              const missaoLinha: IptMissaoId | null =
                missaoLista ?? principal
              const missaoCor = missaoLinha
                ? iptMissaoConfig(missaoLinha).cor
                : '#64748b'
              const relevancia = podeVerExpectativa && missaoLista == null
                ? formatExpectativa(m.expectativaVotos)
                : relevanciaCurta(m)
              const [vA, vB, vC] = valoresLinha(m, missaoLinha)

              return (
                <li key={m.municipio}>
                  <button
                    type="button"
                    className={cn(
                      'ipt-bloco-lista__row',
                      'ipt-bloco-lista__row--cols',
                      ativo && 'ipt-bloco-lista__row--active'
                    )}
                    onClick={() => onSelect(m.municipio)}
                  >
                    <span
                      className="ipt-bloco-lista__rank"
                      style={{ background: missaoCor }}
                      aria-hidden
                    >
                      {idx + 1}
                    </span>
                    <span className="ipt-bloco-lista__muni">{m.municipio}</span>
                    <span className="ipt-bloco-lista__metric">{relevancia}</span>
                    <span className="ipt-bloco-lista__metric">{vA}</span>
                    <span className="ipt-bloco-lista__metric">{vB}</span>
                    <span
                      className={cn(
                        'ipt-bloco-lista__prio',
                        impacto === 'alta' && 'ipt-bloco-lista__prio--alta',
                        impacto === 'media' && 'ipt-bloco-lista__prio--media',
                        impacto === 'baixa' && 'ipt-bloco-lista__prio--baixa'
                      )}
                    >
                      {vC}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
