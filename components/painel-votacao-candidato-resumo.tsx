'use client'

import { forwardRef, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronUp, Loader2, MapPin, X, ArrowUpRight } from 'lucide-react'
import { TabelaMatrizVotacaoSecao } from '@/components/tabela-matriz-votacao-secao'
import { SeletorCandidatoComBusca } from '@/components/seletor-candidato-com-busca'
import type { DistribuicaoCandidatoBweb } from '@/lib/candidato-distribuicao-bweb'
import { chaveMatchFromResumo, encontrarIdCandidatoMatriz, resumoTemVotacaoSecao } from '@/lib/candidato-votacao-secao-match'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import { nomeCandidatoResumoExibicao, parseVotosEleicao } from '@/lib/resumo-eleicoes-dados'
import { cn } from '@/lib/utils'
import type { VotacaoSecaoItem } from '@/lib/votacao-secao'
import { serializarAnosVotacaoSecao, serializarCargosComparacao } from '@/lib/votacao-secao'
import {
  contarSecoesSemelhantes,
  mapaParesSemelhantesPorSecao,
  MARGEM_VOTOS_PARECIDOS,
} from '@/lib/votacao-secao-correlacao'
import {
  ANOS_COMPARACAO_VEREADOR_TRIPLA,
  CARGO_VEREADOR,
  CARGOS_COMPARACAO_VEREADOR_TRIPLA,
  encontrarDepEstadualPorNome,
  encontrarJadyelDepFederal,
  idsComparacaoVereadorComDepId,
  isVereadorResumo2024,
  listarDepEstaduais2022Secao,
} from '@/lib/votacao-secao-jadyel-comparacao'
import {
  listarCandidatosSecao,
  montarMatrizVotacaoSecao,
  type CandidatoMatrizColuna,
} from '@/lib/votacao-secao-matriz'
import {
  type CenarioVotosLideranca,
  type LiderancaExpectativaSecao,
  encontrarLiderancaDoVereador,
  expectativaVotosLideranca,
  injetarColunaExpectativaLideranca,
  isColunaExpectativaLideranca,
} from '@/lib/lideranca-expectativa-secao'
import {
  resumoEleicoesHubHref,
  RESUMO_ELEICOES_TAB_SECAO,
} from '@/lib/resumo-eleicoes-hub-route'

function chaveLideranca(l: Pick<LiderancaExpectativaSecao, 'nome' | 'cargo'>): string {
  return `${l.nome}::${l.cargo}`
}

function formatVotos(n: number): string {
  return n.toLocaleString('pt-BR')
}

export function isMesmoCandidatoResumo(
  a: ResultadoEleicao,
  b: ResultadoEleicao | null | undefined,
): boolean {
  if (!b) return false
  return (
    a.numeroUrna === b.numeroUrna &&
    a.codigoCargo === b.codigoCargo &&
    a.anoEleicao === b.anoEleicao &&
    a.nomeUrnaCandidato === b.nomeUrnaCandidato
  )
}

function urlSecaoCandidato(
  municipio: string,
  distribuicao: DistribuicaoCandidatoBweb,
): string {
  const base: Record<string, string> = {
    cidade: municipio,
    ano: String(distribuicao.chave.ano),
    cargo: distribuicao.chave.dsCargo,
    nr: String(distribuicao.chave.nrVotavel),
  }

  if (distribuicao.chave.dsCargo === CARGO_VEREADOR) {
    return resumoEleicoesHubHref(RESUMO_ELEICOES_TAB_SECAO, {
      ...base,
      anos: ANOS_COMPARACAO_VEREADOR_TRIPLA.join(','),
      modo: 'comparar',
      cargos: serializarCargosComparacao([...CARGOS_COMPARACAO_VEREADOR_TRIPLA]),
    })
  }

  return resumoEleicoesHubHref(RESUMO_ELEICOES_TAB_SECAO, base)
}

type Props = {
  candidato: ResultadoEleicao
  municipio: string
  /** Nome do dep. estadual da liderança (planilha Base Eleitoral). */
  depEstadualLideranca?: string | null
  liderancasDetalhe?: readonly LiderancaExpectativaSecao[]
  cenarioVotos?: CenarioVotosLideranca
  labelExpectativa?: string
  onClose: () => void
}

export function BotaoNomeCandidatoDistribuicao({
  item,
  candidatoAtivo,
  onVerDistribuicao,
  habilitado = true,
}: {
  item: ResultadoEleicao
  candidatoAtivo?: ResultadoEleicao | null
  onVerDistribuicao: (item: ResultadoEleicao) => void
  habilitado?: boolean
}) {
  const temSecao = resumoTemVotacaoSecao(item)
  const ativo = isMesmoCandidatoResumo(item, candidatoAtivo ?? null)
  const nomeExibicao = nomeCandidatoResumoExibicao(item.nomeUrnaCandidato, item.numeroUrna)
  const compararJadyel = isVereadorResumo2024(item)

  if (!temSecao || !habilitado) {
    return (
      <span title={temSecao && !habilitado ? 'Selecione uma cidade para ver votação por seção' : undefined}>
        {nomeExibicao}
      </span>
    )
  }

  return (
    <button
      type="button"
      onClick={() => onVerDistribuicao(item)}
      className={cn(
        'group inline-flex max-w-full items-baseline text-left',
        ativo
          ? 'font-semibold text-accent-gold underline decoration-accent-gold/60'
          : 'hover:underline',
      )}
      title={
        ativo
          ? 'Ocultar votação por seção'
          : compararJadyel
            ? 'Ver votação por seção comparada com Jadyel Alencar e dep. estadual da liderança'
            : 'Ver votação por seção (bairro, local e seção)'
      }
      aria-pressed={ativo}
    >
      <span className="truncate">{nomeExibicao}</span>
    </button>
  )
}

export const PainelVotacaoCandidatoResumo = forwardRef<HTMLElement, Props>(
  function PainelVotacaoCandidatoResumo(
    {
      candidato,
      municipio,
      depEstadualLideranca,
      liderancasDetalhe = [],
      cenarioVotos = 'aferido_jadyel',
      labelExpectativa = 'Expectativa 2026',
      onClose,
    },
    ref,
  ) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [distribuicao, setDistribuicao] = useState<DistribuicaoCandidatoBweb | null>(null)
    const [secoes, setSecoes] = useState<VotacaoSecaoItem[]>([])
    const [vereadorId, setVereadorId] = useState<string | null>(null)
    const [candidatosSecao, setCandidatosSecao] = useState<CandidatoMatrizColuna[]>([])
    const [depEstadualSelecionadoId, setDepEstadualSelecionadoId] = useState<string>('')
    const [municipioResolvido, setMunicipioResolvido] = useState(municipio)
    const [totalSecoes, setTotalSecoes] = useState(0)
    const [jadyelNome, setJadyelNome] = useState<string | null>(null)
    const [liderancaSelecionadaKey, setLiderancaSelecionadaKey] = useState<string>('')

    const chave = useMemo(() => chaveMatchFromResumo(candidato), [candidato])
    const compararComReferentes = useMemo(() => isVereadorResumo2024(candidato), [candidato])
    const nomeDepEstadualPlanilha = depEstadualLideranca?.trim() || null

    const depEstaduaisOpcoes = useMemo(
      () => listarDepEstaduais2022Secao(candidatosSecao),
      [candidatosSecao],
    )

    const depEstadualSelecionado = useMemo(
      () => depEstaduaisOpcoes.find((c) => c.id === depEstadualSelecionadoId) ?? null,
      [depEstaduaisOpcoes, depEstadualSelecionadoId],
    )

    const candidatoIds = useMemo(() => {
      if (!vereadorId) return []
      if (!compararComReferentes) return [vereadorId]
      if (candidatosSecao.length === 0) return []
      return idsComparacaoVereadorComDepId(
        vereadorId,
        candidatosSecao,
        depEstadualSelecionadoId || null,
      )
    }, [vereadorId, candidatosSecao, depEstadualSelecionadoId, compararComReferentes])

    const depPlanilhaMatch = useMemo(
      () => encontrarDepEstadualPorNome(candidatosSecao, nomeDepEstadualPlanilha),
      [candidatosSecao, nomeDepEstadualPlanilha],
    )

    const depPlanilhaNaoEncontrado = Boolean(
      compararComReferentes && nomeDepEstadualPlanilha && !depPlanilhaMatch,
    )

    const liderancaMatchInicial = useMemo(
      () => encontrarLiderancaDoVereador(liderancasDetalhe, candidato),
      [liderancasDetalhe, candidato],
    )

    useEffect(() => {
      if (!compararComReferentes) {
        setLiderancaSelecionadaKey('')
        return
      }
      const match = liderancaMatchInicial ?? liderancasDetalhe[0] ?? null
      setLiderancaSelecionadaKey(match ? chaveLideranca(match) : '')
    }, [compararComReferentes, liderancaMatchInicial, liderancasDetalhe, candidato])

    const liderancaSelecionada = useMemo(
      () =>
        liderancasDetalhe.find((l) => chaveLideranca(l) === liderancaSelecionadaKey) ?? null,
      [liderancasDetalhe, liderancaSelecionadaKey],
    )

    const expectativaLiderancaTotal = useMemo(
      () =>
        liderancaSelecionada
          ? expectativaVotosLideranca(liderancaSelecionada, cenarioVotos)
          : 0,
      [liderancaSelecionada, cenarioVotos],
    )

    useEffect(() => {
      if (!chave) {
        setLoading(false)
        setError('Este candidato não possui dados de votação por seção para o ano/cargo informado.')
        return
      }

      const controller = new AbortController()
      setLoading(true)
      setError(null)
      setDistribuicao(null)
      setSecoes([])
      setVereadorId(null)
      setCandidatosSecao([])
      setDepEstadualSelecionadoId('')
      setJadyelNome(null)

      const paramsDistribuicao = new URLSearchParams({
        cidade: municipio,
        ano: String(chave.ano),
        cargo: chave.dsCargo,
        cd_cargo: String(chave.cdCargo),
        nr: String(chave.nrVotavel),
        votos_resumo: candidato.quantidadeVotosNominais,
      })
      if (chave.sqCandidato != null) {
        paramsDistribuicao.set('sq', String(chave.sqCandidato))
      }

      void (async () => {
        try {
          const fetchDistribuicao = fetch(
            `/api/resumo-eleicoes/votacao-secao/distribuicao?${paramsDistribuicao.toString()}`,
            { signal: controller.signal },
          )

          const fetchSecoes = compararComReferentes
            ? fetch(
                `/api/resumo-eleicoes/votacao-secao?${new URLSearchParams({
                  cidade: municipio,
                  cargo: 'todos',
                  anos: serializarAnosVotacaoSecao(ANOS_COMPARACAO_VEREADOR_TRIPLA),
                }).toString()}`,
                { signal: controller.signal },
              )
            : null

          const [resDist, resSecoes] = await Promise.all([
            fetchDistribuicao,
            fetchSecoes,
          ])

          const dataDist = await resDist.json().catch(() => ({}))
          if (!resDist.ok) {
            throw new Error(dataDist.error || `Erro ${resDist.status}`)
          }

          const municipioAtual = String(dataDist.municipio ?? municipio)
          setMunicipioResolvido(municipioAtual)
          setDistribuicao(dataDist.distribuicao as DistribuicaoCandidatoBweb)

          if (compararComReferentes && resSecoes) {
            const dataSecoes = await resSecoes.json().catch(() => ({}))
            if (!resSecoes.ok) {
              throw new Error(dataSecoes.error || `Erro ${resSecoes.status}`)
            }

            const secoesMulti = (dataSecoes.secoes ?? []) as VotacaoSecaoItem[]
            setSecoes(secoesMulti)
            setTotalSecoes(Number(dataSecoes.resumo?.totalSecoes ?? secoesMulti.length))

            const todos = listarCandidatosSecao(secoesMulti, [...CARGOS_COMPARACAO_VEREADOR_TRIPLA])
            const jadyel = encontrarJadyelDepFederal(todos)
            const depPlanilha = encontrarDepEstadualPorNome(todos, nomeDepEstadualPlanilha)
            const idVereador =
              encontrarIdCandidatoMatriz(secoesMulti, chave) ??
              (typeof dataDist.candidatoId === 'string' ? dataDist.candidatoId : null)

            setCandidatosSecao(todos)
            setVereadorId(idVereador)
            setDepEstadualSelecionadoId(depPlanilha?.id ?? '')
            setJadyelNome(jadyel?.nmVotavel ?? null)
          } else {
            const secoesUnico = (dataDist.secoes ?? []) as VotacaoSecaoItem[]
            setSecoes(secoesUnico)
            setTotalSecoes(Number(dataDist.resumoSecao?.totalSecoes ?? 0))
            setVereadorId(typeof dataDist.candidatoId === 'string' ? dataDist.candidatoId : null)
          }
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setError(e instanceof Error ? e.message : 'Erro ao carregar distribuição')
        } finally {
          setLoading(false)
        }
      })()

      return () => controller.abort()
    }, [candidato, chave, municipio, compararComReferentes, nomeDepEstadualPlanilha])

    const matriz = useMemo(() => {
      if (candidatoIds.length === 0 || secoes.length === 0) return null
      const base = montarMatrizVotacaoSecao(secoes, candidatoIds)
      if (
        !compararComReferentes ||
        !vereadorId ||
        !liderancaSelecionada ||
        expectativaLiderancaTotal <= 0
      ) {
        return base
      }
      return injetarColunaExpectativaLideranca(base, {
        nomeLideranca: liderancaSelecionada.nome,
        totalExpectativa: expectativaLiderancaTotal,
        candidatoIdReferencia: vereadorId,
        rotuloCargo: labelExpectativa,
      })
    }, [
      candidatoIds,
      secoes,
      compararComReferentes,
      vereadorId,
      liderancaSelecionada,
      expectativaLiderancaTotal,
      labelExpectativa,
    ])

    const candidatosSemelhanca = useMemo(
      () => matriz?.candidatos.filter((c) => !isColunaExpectativaLideranca(c.id)) ?? [],
      [matriz],
    )

    const paresPorSecao = useMemo(
      () =>
        compararComReferentes && matriz && candidatosSemelhanca.length >= 2
          ? mapaParesSemelhantesPorSecao(
              matriz.linhas,
              candidatosSemelhanca,
              MARGEM_VOTOS_PARECIDOS,
            )
          : new Map(),
      [compararComReferentes, matriz, candidatosSemelhanca],
    )

    const totalSecoesSemelhantes = useMemo(
      () => contarSecoesSemelhantes(paresPorSecao),
      [paresPorSecao],
    )

    const votosResumo = parseVotosEleicao(candidato.quantidadeVotosNominais)

    return (
      <section
        ref={ref}
        className="mt-4 scroll-mt-4 rounded-2xl border border-accent-gold/35 bg-surface shadow-card"
        aria-label="Votação por seção do candidato"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-card px-4 py-3">
          <div className="min-w-0">
            <p className="text-[11px] uppercase tracking-wide text-text-secondary">
              Votação por seção
              {compararComReferentes && (jadyelNome || depEstadualSelecionado) ? ' · comparativo' : ''}
            </p>
            <h2 className="truncate text-base font-semibold text-text-primary">
              {nomeCandidatoResumoExibicao(candidato.nomeUrnaCandidato, candidato.numeroUrna)}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-text-secondary">
              <span>
                {chave?.dsCargo ?? candidato.cargo} · {chave?.ano ?? candidato.anoEleicao}
              </span>
              <span className="font-mono">nº {candidato.numeroUrna}</span>
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3" />
                {municipioResolvido}
              </span>
            </p>
            {(jadyelNome || depEstadualSelecionado) && compararComReferentes && (
              <p className="mt-1 text-[11px] text-text-secondary">
                Comparando com{' '}
                {jadyelNome ? (
                  <>
                    <strong className="text-text-primary">{jadyelNome}</strong> (Dep. Federal 2022)
                  </>
                ) : null}
                {jadyelNome && depEstadualSelecionado ? ' · ' : null}
                {depEstadualSelecionado ? (
                  <>
                    <strong className="text-text-primary">{depEstadualSelecionado.nmVotavel}</strong>{' '}
                    (Dep. Estadual 2022)
                  </>
                ) : null}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!loading && distribuicao?.encontrado && (
              <Link
                href={urlSecaoCandidato(municipioResolvido, distribuicao)}
                className="inline-flex items-center gap-1 rounded border border-card bg-background px-2.5 py-1.5 text-[11px] text-text-primary hover:bg-surface"
              >
                Página completa
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1 rounded border border-card bg-background px-2.5 py-1.5 text-[11px] text-text-secondary hover:bg-surface hover:text-text-primary"
            >
              <ChevronUp className="h-3.5 w-3.5" />
              Ocultar
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-card p-1.5 text-text-secondary hover:bg-background"
              aria-label="Fechar painel"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="px-4 py-3">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              {compararComReferentes
                ? 'Carregando comparação com Jadyel e dep. estadual da liderança…'
                : 'Carregando matriz por seção…'}
            </div>
          )}

          {!loading && error && (
            <p className="rounded-lg border border-dashed border-card bg-background/60 px-3 py-4 text-sm text-text-secondary">
              {error}
            </p>
          )}

          {!loading && !error && distribuicao && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
                <StatBox rotulo="Resumo (planilha)" valor={formatVotos(votosResumo)} />
                <StatBox rotulo="Bweb (seções)" valor={formatVotos(distribuicao.totalVotos)} />
                <StatBox
                  rotulo="Seções c/ voto"
                  valor={String(distribuicao.totalSecoesComVoto)}
                />
                <StatBox
                  rotulo="Seções no município"
                  valor={String(totalSecoes || matriz?.linhas.length || 0)}
                />
                <StatBox rotulo="Bairros" valor={String(distribuicao.bairros.length)} />
              </div>

              {distribuicao.diferencaResumo != null && distribuicao.diferencaResumo !== 0 && (
                <p className="mb-3 rounded-lg border border-card bg-background/70 px-2 py-1.5 text-[11px] text-text-secondary">
                  Diferença resumo × bweb:{' '}
                  <strong className="text-text-primary">
                    {distribuicao.diferencaResumo > 0 ? '+' : ''}
                    {formatVotos(distribuicao.diferencaResumo)}
                  </strong>{' '}
                  (totais podem divergir por turno, abstenção ou atualização da base)
                </p>
              )}

              {!distribuicao.encontrado && (
                <p className="mb-3 rounded-lg border border-dashed border-card bg-background/60 px-3 py-4 text-sm text-text-secondary">
                  Nenhum voto encontrado na base por seção para nº {candidato.numeroUrna} em{' '}
                  {municipioResolvido}.
                </p>
              )}

              {compararComReferentes && liderancasDetalhe.length > 0 && (
                <div className="mb-3 rounded-lg border border-card bg-background/60 px-3 py-2.5">
                  <label
                    htmlFor="lideranca-expectativa-comparativo"
                    className="mb-1.5 block text-[11px] font-medium text-text-secondary"
                  >
                    Liderança ({labelExpectativa})
                  </label>
                  <select
                    id="lideranca-expectativa-comparativo"
                    value={liderancaSelecionadaKey}
                    onChange={(e) => setLiderancaSelecionadaKey(e.target.value)}
                    className="h-9 w-full max-w-xl rounded-lg border border-card bg-surface px-2.5 text-xs text-text-primary"
                  >
                    <option value="">Sem coluna de expectativa</option>
                    {liderancasDetalhe.map((l) => {
                      const key = chaveLideranca(l)
                      const votos = expectativaVotosLideranca(l, cenarioVotos)
                      return (
                        <option key={key} value={key}>
                          {l.nome} — {votos.toLocaleString('pt-BR')} votos ({labelExpectativa})
                        </option>
                      )
                    })}
                  </select>
                  {liderancaSelecionada && expectativaLiderancaTotal > 0 && vereadorId && (
                    <p className="mt-1.5 text-[10px] text-text-secondary">
                      Coluna <strong className="text-text-primary">Exp. 2026</strong> distribuída
                      proporcionalmente aos votos do vereador em cada seção (
                      {expectativaLiderancaTotal.toLocaleString('pt-BR')} no município).
                      {liderancaMatchInicial &&
                      chaveLideranca(liderancaMatchInicial) !== liderancaSelecionadaKey ? (
                        <span> · substituída manualmente</span>
                      ) : liderancaMatchInicial ? (
                        <span> · match automático (Marcar)</span>
                      ) : null}
                    </p>
                  )}
                </div>
              )}

              {compararComReferentes && depEstaduaisOpcoes.length > 0 && (
                <div className="mb-3 rounded-lg border border-card bg-background/60 px-3 py-2.5">
                  <SeletorCandidatoComBusca
                    id="dep-estadual-comparativo"
                    label="Dep. Estadual 2022 (comparativo)"
                    value={depEstadualSelecionadoId}
                    onChange={setDepEstadualSelecionadoId}
                    opcoes={depEstaduaisOpcoes}
                    emptyOption={{
                      id: '',
                      label: 'Nenhum (só vereador e Jadyel)',
                    }}
                    placeholderBusca="Buscar dep. estadual por nome ou número…"
                  />
                  {nomeDepEstadualPlanilha && (
                    <p className="mt-1.5 text-[10px] text-text-secondary">
                      Planilha (liderança):{' '}
                      <span className="text-text-primary">{nomeDepEstadualPlanilha}</span>
                      {depPlanilhaNaoEncontrado ? (
                        <span className="text-status-warning"> — não encontrado; escolha na lista</span>
                      ) : depEstadualSelecionado &&
                        depPlanilhaMatch &&
                        depEstadualSelecionado.id !== depPlanilhaMatch.id ? (
                        <span> — substituído manualmente</span>
                      ) : null}
                    </p>
                  )}
                </div>
              )}

              {compararComReferentes && !jadyelNome && distribuicao.encontrado && (
                <p className="mb-3 rounded-lg border border-dashed border-card bg-background/60 px-3 py-3 text-xs text-text-secondary">
                  Jadyel Alencar (Dep. Federal 2022) não encontrado na base por seção deste município.
                </p>
              )}

              {matriz && matriz.candidatos.length > 0 && (
                <TabelaMatrizVotacaoSecao
                  matriz={matriz}
                  modoComparar={compararComReferentes && matriz.candidatos.length >= 2}
                  multiAno={compararComReferentes && matriz.candidatos.length >= 2}
                  destacarSemelhanca={compararComReferentes && matriz.candidatos.length >= 2}
                  margemSemelhancaPct={Math.round(MARGEM_VOTOS_PARECIDOS * 100)}
                  paresPorSecao={paresPorSecao}
                  totalSecoesSemelhantes={totalSecoesSemelhantes}
                  mostrarToolbarSemelhanca={compararComReferentes && matriz.candidatos.length >= 2}
                  compacto
                />
              )}

              {distribuicao.encontrado && !matriz?.candidatos.length && (
                <p className="rounded-lg border border-dashed border-card bg-background/60 px-3 py-4 text-sm text-text-secondary">
                  Candidato encontrado na planilha, mas não foi possível montar a matriz por seção.
                </p>
              )}
            </>
          )}
        </div>
      </section>
    )
  },
)

function StatBox({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="rounded-lg border border-card bg-background/60 px-2 py-1.5">
      <p className="text-[10px] text-text-secondary">{rotulo}</p>
      <p className="text-sm font-semibold tabular-nums text-text-primary">{valor}</p>
    </div>
  )
}
