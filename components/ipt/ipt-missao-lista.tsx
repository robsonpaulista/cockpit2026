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
  temExpectativa,
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
  /** Filtro explícito da página (diferente do destaque automático do top da lista). */
  municipioFiltro?: string | null
  onSelect: (municipio: string) => void
  /** Duplo clique: aplica/limpa o filtro de município na página. */
  onToggleFiltro?: (municipio: string) => void
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
  foraPrioridade: boolean
): string[] {
  const impacto = prioridadeImpactoMissao(m, missao ?? 'todas')
  const intensidade = foraPrioridade ? 'Saudável' : intensidadeLabel(impacto)

  if (missao == null) {
    if (foraPrioridade) return ['Sem tensão crítica', '—', 'Saudável']
    return valoresVisaoGeral(m)
  }

  if (missao === 'expectativa') {
    if (m.expectativaVotos <= 0) {
      return ['—', '—', 'Sem meta']
    }
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
      m.detalhes.pesquisaPosicaoTop5 != null && m.detalhes.pesquisaMediaPct != null
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
  municipioFiltro = null,
  onSelect,
  onToggleFiltro,
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
  const qtdComMeta = municipios.filter((m) => temExpectativa(m)).length
  const qtdSemMeta = Math.max(0, municipios.length - qtdComMeta)
  const qtdSaudaveis = Math.max(0, municipios.length - qtdNaMissao)
  const badgeUniversoExpectativa =
    visaoUniverso === 'com_expectativa' &&
    missaoAtiva === 'expectativa' &&
    qtdSemMeta > 0
  const badgeUniversoSaudaveis =
    visaoUniverso === 'com_expectativa' &&
    missaoAtiva !== 'expectativa' &&
    qtdSaudaveis > 0

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
              ? missaoAtiva === 'expectativa'
                ? 'Universo com e sem meta'
                : 'Universo com expectativa'
              : 'Prioridades da missão'}
          </h3>
          <p className="ipt-bloco__sub">
            {subtituloListaMissao(missaoAtiva, visaoUniverso)}
          </p>
        </div>
        <div className="ipt-bloco-lista__head-actions">
          {mostrarUniversoToggle ? (
            <button
              type="button"
              aria-pressed={visaoUniverso === 'com_expectativa'}
              className={cn(
                'ipt-bloco-lista__ver-todos',
                visaoUniverso === 'com_expectativa' && 'ipt-bloco-lista__ver-todos--active'
              )}
              title={
                visaoUniverso === 'com_expectativa'
                  ? 'Voltar a mostrar só as prioridades da missão'
                  : missaoAtiva === 'expectativa'
                    ? 'Incluir também os municípios sem expectativa cadastrada'
                    : 'Incluir também os municípios com expectativa (saudáveis)'
              }
              onClick={() =>
                onVisaoUniversoChange?.(
                  visaoUniverso === 'com_expectativa' ? 'prioridade' : 'com_expectativa'
                )
              }
            >
              Ver todos
            </button>
          ) : null}
          <span
            className="ipt-bloco-lista__badge"
            title={
              badgeUniversoExpectativa
                ? `${municipios.length} municípios · ${qtdComMeta} com meta · ${qtdSemMeta} sem meta`
                : badgeUniversoSaudaveis
                  ? `${municipios.length} municípios · ${qtdNaMissao} na missão · ${qtdSaudaveis} saudáveis`
                  : `${municipios.length} municípios`
            }
          >
            {badgeUniversoExpectativa ? (
              <>
                <strong>{municipios.length}</strong>
                <span>mun.</span>
                <em>
                  {qtdComMeta}+{qtdSemMeta}
                </em>
              </>
            ) : badgeUniversoSaudaveis ? (
              <>
                <strong>{municipios.length}</strong>
                <span>mun.</span>
                <em>
                  {qtdNaMissao}+{qtdSaudaveis}
                </em>
              </>
            ) : (
              <>
                <strong>{municipios.length}</strong>
                <span>mun.</span>
              </>
            )}
          </span>
        </div>
      </div>

      {municipios.length === 0 ? (
        <p className="ipt-bloco-lista__empty">
          {visaoUniverso === 'com_expectativa'
            ? 'Nenhum município no recorte atual.'
            : 'Nenhum município apresenta essa incompatibilidade no recorte atual.'}
        </p>
      ) : (
        <>
          <div className="ipt-bloco-lista__cols" aria-hidden>
            <span />
            <span>Município</span>
            <span>
              {podeVerExpectativa &&
              (missaoLista == null || missaoLista === 'pesquisa')
                ? 'Exp. votos'
                : 'Relevância'}
            </span>
            {colunas.map((col) => (
              <span key={col}>{col}</span>
            ))}
          </div>
          <ul className="ipt-bloco-lista__rows">
            {municipios.map((m, idx) => {
              const ativo = selecionado === m.municipio
              const naMissao = municipioNoRecorteMissao(m, missaoAtiva)
              const semMeta =
                visaoUniverso === 'com_expectativa' &&
                missaoAtiva === 'expectativa' &&
                !temExpectativa(m)
              const saudavel =
                visaoUniverso === 'com_expectativa' &&
                missaoAtiva !== 'expectativa' &&
                !naMissao
              const impacto = semMeta || saudavel
                ? 'baixa'
                : prioridadeImpactoMissao(m, missaoAtiva)
              const principal = missaoPrincipal(m)
              const missaoLinha: IptMissaoId | null = missaoLista ?? principal
              const missaoCor = semMeta || saudavel
                ? '#8c8c8c'
                : missaoLinha
                  ? iptMissaoConfig(missaoLinha).cor
                  : '#8c8c8c'
              const mostraExpVotos =
                podeVerExpectativa &&
                (missaoLista == null || missaoLista === 'pesquisa')
              const relevancia = mostraExpVotos
                ? formatExpectativa(m.expectativaVotos)
                : semMeta
                  ? 'Sem meta'
                  : relevanciaCurta(m)
              const valores = valoresLinha(m, missaoLista, saudavel || semMeta)
              const prio = semMeta ? 'Sem meta' : valores[valores.length - 1]
              const metricas = valores.slice(0, -1)

              return (
                <li key={m.municipio}>
                  <button
                    type="button"
                    className={cn(
                      'ipt-bloco-lista__row',
                      'ipt-bloco-lista__row--cols',
                      ativo && 'ipt-bloco-lista__row--active',
                      (saudavel || semMeta) && 'ipt-bloco-lista__row--saudavel'
                    )}
                    onClick={() => onSelect(m.municipio)}
                    onDoubleClick={(event) => {
                      event.preventDefault()
                      onToggleFiltro?.(m.municipio)
                    }}
                    title={
                      municipioFiltro === m.municipio
                        ? 'Duplo clique para limpar o filtro'
                        : 'Clique para detalhar · Duplo clique para filtrar a página'
                    }
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
                      {semMeta ? (
                        <em className="ipt-bloco-lista__status">Sem meta</em>
                      ) : saudavel ? (
                        <em className="ipt-bloco-lista__status">Saudável</em>
                      ) : visaoUniverso === 'com_expectativa' &&
                        missaoAtiva !== 'expectativa' &&
                        naMissao ? (
                        <em className="ipt-bloco-lista__status ipt-bloco-lista__status--missao">
                          Na missão
                        </em>
                      ) : visaoUniverso === 'com_expectativa' &&
                        missaoAtiva === 'expectativa' &&
                        temExpectativa(m) ? (
                        <em className="ipt-bloco-lista__status ipt-bloco-lista__status--missao">
                          Com meta
                        </em>
                      ) : null}
                    </span>
                    <span
                      className={cn(
                        'ipt-bloco-lista__metric',
                        mostraExpVotos && 'ipt-bloco-lista__metric--exp'
                      )}
                    >
                      {relevancia}
                    </span>
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
                        (saudavel || semMeta) && 'ipt-bloco-lista__prio--saudavel'
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
