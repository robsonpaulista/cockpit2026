'use client'

import {
  coberturaCampoRotulo,
  estimativaDiasSemVisita,
  iptMissaoConfig,
  missaoPrincipal,
  motivoCurtoMissao,
  municipioNoRecorteMissao,
  prioridadeImpactoMissao,
  relevanciaCurta,
  rotuloEngajamentoDigital,
  rotuloSeguidoresDigital,
  subtituloListaMissao,
  type IptMissaoFiltro,
  type IptMissaoId,
  type IptVisaoUniverso,
} from '@/lib/ipt-missoes'
import { formatObrasValorAbreviado, type IptMunicipio } from '@/lib/ipt'
import { cn } from '@/lib/utils'

type Props = {
  municipios: IptMunicipio[]
  missaoAtiva: IptMissaoFiltro
  visaoUniverso?: IptVisaoUniverso
  onVisaoUniversoChange?: (visao: IptVisaoUniverso) => void
  selecionado: string | null
  onSelect: (municipio: string) => void
  podeVerExpectativa?: boolean
}

function formatExpectativa(n: number): string {
  return n.toLocaleString('pt-BR')
}

function intensidadeLabel(impacto: 'alta' | 'media' | 'baixa'): string {
  if (impacto === 'alta') return 'Alta'
  if (impacto === 'media') return 'Média'
  return 'Baixa'
}

function colunasMissao(missao: IptMissaoId | null): string[] {
  if (missao === 'expectativa') return ['Exp. votos', 'Peso', 'Prioridade']
  if (missao === 'campo') return ['Última visita', 'Cobertura de campo', 'Prioridade']
  if (missao === 'pesquisa') return ['Posição', 'Média (válidos)', 'Prioridade']
  if (missao === 'digital') return ['Seguidores', 'Engajamento', 'Cobertura', 'Prioridade']
  if (missao === 'obras') return ['Recursos', 'Obras', 'Prioridade']
  return ['Motivo', 'Missão', 'Prioridade']
}

function valoresVisaoGeral(m: IptMunicipio): string[] {
  const impacto = prioridadeImpactoMissao(m, 'todas')
  const intensidade = intensidadeLabel(impacto)
  const principal = missaoPrincipal(m)
  if (!principal) return ['—', '—', intensidade]
  return [
    motivoCurtoMissao(m, principal),
    iptMissaoConfig(principal).tagline,
    intensidade,
  ]
}

function valoresLinha(
  m: IptMunicipio,
  missao: IptMissaoId | null,
  saudavel: boolean
): string[] {
  const impacto = prioridadeImpactoMissao(m, missao ?? 'todas')
  const intensidade = saudavel ? 'Saudável' : intensidadeLabel(impacto)

  if (missao == null) {
    if (saudavel) return ['Sem tensão crítica', '—', 'Saudável']
    return valoresVisaoGeral(m)
  }

  if (missao === 'expectativa') {
    return [
      formatExpectativa(m.expectativaVotos),
      `${m.pesoExpectativaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`,
      intensidade,
    ]
  }

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
        ? `${m.detalhes.pesquisaMediaPct.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
        : '—'
    return [pos, media, intensidade]
  }
  if (missao === 'digital') {
    return [
      rotuloSeguidoresDigital(m, { compacto: true }),
      rotuloEngajamentoDigital(m, { compacto: true }),
      m.sinais.digital === 'sem_dado' ? 'Fora da base' : 'Na base',
      intensidade,
    ]
  }
  if (missao === 'obras') {
    return [
      formatObrasValorAbreviado(m.detalhes.obrasValorTotal).replace(/ obras$/, ''),
      `${m.detalhes.obrasQuantidade}`,
      intensidade,
    ]
  }
  return valoresVisaoGeral(m)
}

export function IptMissaoLista({
  municipios,
  missaoAtiva,
  visaoUniverso = 'prioridade',
  onVisaoUniversoChange,
  selecionado,
  onSelect,
  podeVerExpectativa = false,
}: Props) {
  const missaoLista: IptMissaoId | null =
    missaoAtiva === 'todas' ? null : missaoAtiva
  const colunas = colunasMissao(missaoLista)
  const isDigital = missaoLista === 'digital'
  const mostrarUniversoToggle = Boolean(onVisaoUniversoChange)
  const qtdNaMissao = municipios.filter((m) =>
    municipioNoRecorteMissao(m, missaoAtiva)
  ).length
  const qtdSaudaveis = Math.max(0, municipios.length - qtdNaMissao)

  return (
    <section
      className={cn(
        'ipt-bloco ipt-bloco-lista',
        missaoAtiva !== 'todas' && 'ipt-bloco-lista--missao',
        visaoUniverso === 'com_expectativa' && 'ipt-bloco-lista--universo',
        isDigital && 'ipt-bloco-lista--digital'
      )}
    >
      <div className="ipt-bloco-lista__head">
        <div className="min-w-0">
          <h3 className="ipt-bloco__title">
            {visaoUniverso === 'com_expectativa'
              ? 'Universo com expectativa'
              : 'Prioridades da missão'}
          </h3>
          <p className="ipt-bloco__sub">
            {subtituloListaMissao(missaoAtiva, visaoUniverso)}
          </p>
        </div>
        <span className="ipt-bloco-lista__badge">
          <strong>{municipios.length}</strong> municípios
          {visaoUniverso === 'com_expectativa' && qtdSaudaveis > 0 ? (
            <em>
              {qtdNaMissao} prioridade · {qtdSaudaveis} saudável
              {qtdSaudaveis === 1 ? '' : 's'}
            </em>
          ) : null}
        </span>
      </div>

      {mostrarUniversoToggle ? (
        <div
          className="ipt-bloco-lista__universo"
          role="radiogroup"
          aria-label="Universo da lista"
        >
          <button
            type="button"
            role="radio"
            aria-checked={visaoUniverso === 'prioridade'}
            className={cn(
              'ipt-bloco-lista__universo-btn',
              visaoUniverso === 'prioridade' && 'ipt-bloco-lista__universo-btn--active'
            )}
            onClick={() => onVisaoUniversoChange?.('prioridade')}
          >
            Na missão
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={visaoUniverso === 'com_expectativa'}
            className={cn(
              'ipt-bloco-lista__universo-btn',
              visaoUniverso === 'com_expectativa' && 'ipt-bloco-lista__universo-btn--active'
            )}
            onClick={() => onVisaoUniversoChange?.('com_expectativa')}
          >
            Com expectativa
          </button>
        </div>
      ) : null}

      {municipios.length === 0 ? (
        <p className="ipt-bloco-lista__empty">
          {visaoUniverso === 'com_expectativa'
            ? 'Nenhum município com expectativa no recorte atual.'
            : 'Nenhum município apresenta essa incompatibilidade no recorte atual.'}
        </p>
      ) : (
        <>
          <div className="ipt-bloco-lista__cols" aria-hidden>
            <span />
            <span>Município</span>
            <span>
              {podeVerExpectativa && missaoLista == null ? 'Exp. votos' : 'Relevância'}
            </span>
            {colunas.map((col) => (
              <span key={col}>{col}</span>
            ))}
          </div>
          <ul className="ipt-bloco-lista__rows">
            {municipios.map((m, idx) => {
              const ativo = selecionado === m.municipio
              const naMissao = municipioNoRecorteMissao(m, missaoAtiva)
              const saudavel =
                visaoUniverso === 'com_expectativa' &&
                missaoAtiva !== 'expectativa' &&
                !naMissao
              const impacto = saudavel
                ? 'baixa'
                : prioridadeImpactoMissao(m, missaoAtiva)
              const principal = missaoPrincipal(m)
              const missaoLinha: IptMissaoId | null = missaoLista ?? principal
              const missaoCor = saudavel
                ? '#8c8c8c'
                : missaoLinha
                  ? iptMissaoConfig(missaoLinha).cor
                  : '#8c8c8c'
              const relevancia =
                podeVerExpectativa && missaoLista == null
                  ? formatExpectativa(m.expectativaVotos)
                  : relevanciaCurta(m)
              const valores = valoresLinha(m, missaoLista, saudavel)
              const prio = valores[valores.length - 1]
              const metricas = valores.slice(0, -1)

              return (
                <li key={m.municipio}>
                  <button
                    type="button"
                    className={cn(
                      'ipt-bloco-lista__row',
                      'ipt-bloco-lista__row--cols',
                      ativo && 'ipt-bloco-lista__row--active',
                      saudavel && 'ipt-bloco-lista__row--saudavel'
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
                    <span className="ipt-bloco-lista__muni">
                      {m.municipio}
                      {saudavel ? (
                        <em className="ipt-bloco-lista__status">Saudável</em>
                      ) : visaoUniverso === 'com_expectativa' &&
                        missaoAtiva !== 'expectativa' &&
                        naMissao ? (
                        <em className="ipt-bloco-lista__status ipt-bloco-lista__status--missao">
                          Na missão
                        </em>
                      ) : null}
                    </span>
                    <span className="ipt-bloco-lista__metric">{relevancia}</span>
                    {metricas.map((valor, i) => (
                      <span
                        key={`${m.municipio}-${colunas[i]}`}
                        className="ipt-bloco-lista__metric"
                      >
                        {valor}
                      </span>
                    ))}
                    <span
                      className={cn(
                        'ipt-bloco-lista__prio',
                        impacto === 'alta' && 'ipt-bloco-lista__prio--alta',
                        impacto === 'media' && 'ipt-bloco-lista__prio--media',
                        impacto === 'baixa' && 'ipt-bloco-lista__prio--baixa',
                        saudavel && 'ipt-bloco-lista__prio--saudavel'
                      )}
                    >
                      {prio}
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
