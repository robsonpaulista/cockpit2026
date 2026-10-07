'use client'

import { forwardRef, useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { MapPin, X, ArrowUpRight } from 'lucide-react'
import { TabelaMatrizVotacaoSecao } from '@/components/tabela-matriz-votacao-secao'
import {
  TseCarregando,
  TseVazio,
  tseCampoClass,
  tseLinkAcaoClass,
  tseRotuloCampoClass,
} from '@/components/tse/tse-ui'
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
  aplicarValorMeta,
  type AtendimentoMetaTerritorioMap,
} from '@/lib/atendimento-meta-territorio'
import {
  resumoEleicoesHref,
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
    return resumoEleicoesHref(RESUMO_ELEICOES_TAB_SECAO, {
      ...base,
      anos: ANOS_COMPARACAO_VEREADOR_TRIPLA.join(','),
      modo: 'comparar',
      cargos: serializarCargosComparacao([...CARGOS_COMPARACAO_VEREADOR_TRIPLA]),
    })
  }

  return resumoEleicoesHref(RESUMO_ELEICOES_TAB_SECAO, base)
}

type Props = {
  candidato: ResultadoEleicao
  municipio: string
  /** Nome do dep. estadual da liderança (planilha Base Eleitoral). */
  depEstadualLideranca?: string | null
  liderancasDetalhe?: readonly LiderancaExpectativaSecao[]
  cenarioVotos?: CenarioVotosLideranca
  labelExpectativa?: string
  /** Exibe coluna editável Meta (bairro/local) — padrão no atendimento. */
  habilitarMetaManual?: boolean
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
          ? 'font-bold text-[var(--tse-olive)] underline decoration-[var(--tse-yellow)] decoration-2 underline-offset-2'
          : 'hover:text-[var(--tse-olive)] hover:underline',
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
      habilitarMetaManual = true,
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
    const [metasManuais, setMetasManuais] = useState<AtendimentoMetaTerritorioMap>({})
    const [metaSetupRequired, setMetaSetupRequired] = useState(false)
    const [metaSaveError, setMetaSaveError] = useState('')
    const [metaSaving, setMetaSaving] = useState(false)

    const chave = useMemo(() => chaveMatchFromResumo(candidato), [candidato])
    const compararComReferentes = useMemo(() => isVereadorResumo2024(candidato), [candidato])
    const nomeDepEstadualPlanilha = depEstadualLideranca?.trim() || null

    const vereadorNomeMeta = useMemo(
      () => nomeCandidatoResumoExibicao(candidato.nomeUrnaCandidato, candidato.numeroUrna),
      [candidato.nomeUrnaCandidato, candidato.numeroUrna],
    )
    const vereadorNumeroMeta = String(candidato.numeroUrna ?? chave?.nrVotavel ?? '').trim()
    const anoMeta = Number(chave?.ano ?? candidato.anoEleicao ?? 2024)

    useEffect(() => {
      if (!habilitarMetaManual || !municipio.trim() || !vereadorNomeMeta.trim()) {
        setMetasManuais({})
        setMetaSetupRequired(false)
        return
      }

      const controller = new AbortController()
      void (async () => {
        try {
          const params = new URLSearchParams({
            cidade: municipio,
            vereador: vereadorNomeMeta,
            numero: vereadorNumeroMeta,
            ano: String(anoMeta),
          })
          const res = await fetch(`/api/resumo-eleicoes/meta-territorio?${params}`, {
            cache: 'no-store',
            signal: controller.signal,
          })
          const json = (await res.json().catch(() => ({}))) as {
            valores?: AtendimentoMetaTerritorioMap
            setupRequired?: boolean
            error?: string
          }
          if (controller.signal.aborted) return
          if (!res.ok) {
            setMetaSaveError(json.error ?? 'Falha ao carregar metas.')
            return
          }
          setMetaSetupRequired(Boolean(json.setupRequired))
          setMetasManuais(json.valores ?? {})
          setMetaSaveError('')
        } catch (e) {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setMetaSaveError(e instanceof Error ? e.message : 'Falha ao carregar metas.')
        }
      })()

      return () => controller.abort()
    }, [habilitarMetaManual, municipio, vereadorNomeMeta, vereadorNumeroMeta, anoMeta])

    const persistirMetas = useCallback(
      async (valores: AtendimentoMetaTerritorioMap) => {
        setMetaSaving(true)
        setMetaSaveError('')
        try {
          const res = await fetch('/api/resumo-eleicoes/meta-territorio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              cidade: municipio,
              vereadorNome: vereadorNomeMeta,
              vereadorNumero: vereadorNumeroMeta,
              anoEleicao: anoMeta,
              valores,
            }),
          })
          const json = (await res.json().catch(() => ({}))) as {
            error?: string
            setupRequired?: boolean
            valores?: AtendimentoMetaTerritorioMap
          }
          if (res.status === 503 || json.setupRequired) {
            setMetaSetupRequired(true)
            throw new Error(
              json.error ??
                'Execute database/create-atendimento-meta-territorio.sql no Supabase.',
            )
          }
          if (!res.ok) throw new Error(json.error ?? 'Falha ao salvar meta.')
          if (json.valores) setMetasManuais(json.valores)
        } catch (e) {
          setMetaSaveError(e instanceof Error ? e.message : 'Falha ao salvar meta.')
        } finally {
          setMetaSaving(false)
        }
      },
      [municipio, vereadorNomeMeta, vereadorNumeroMeta, anoMeta],
    )

    const onMetaManualChange = useCallback(
      (metaChave: string, valor: number | null) => {
        setMetasManuais((prev) => {
          const next = aplicarValorMeta(prev, metaChave, valor)
          void persistirMetas(next)
          return next
        })
      },
      [persistirMetas],
    )

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

    const expectativaResult = useMemo(() => {
      if (candidatoIds.length === 0 || secoes.length === 0) {
        return {
          matriz: null as ReturnType<typeof montarMatrizVotacaoSecao> | null,
          detalhesPorSecao: new Map<string, never>(),
          detalhesPorBairro: new Map<string, never>(),
          totalMapaEleitoral: 0,
          totalReferenciaPlanilha: 0,
        }
      }
      const base = montarMatrizVotacaoSecao(secoes, candidatoIds)
      if (
        !compararComReferentes ||
        !vereadorId ||
        !liderancaSelecionada
      ) {
        return {
          matriz: base,
          detalhesPorSecao: new Map(),
          detalhesPorBairro: new Map(),
          totalMapaEleitoral: 0,
          totalReferenciaPlanilha: 0,
        }
      }
      const injetado = injetarColunaExpectativaLideranca(base, {
        nomeLideranca: liderancaSelecionada.nome,
        totalExpectativa: expectativaLiderancaTotal,
        candidatoIdReferencia: vereadorId,
        candidatoIdEstadual: depEstadualSelecionadoId || null,
        rotuloCargo: labelExpectativa,
      })
      return {
        matriz: injetado.matriz,
        detalhesPorSecao: injetado.detalhesPorSecao,
        detalhesPorBairro: injetado.detalhesPorBairro,
        totalMapaEleitoral: injetado.totalMapaEleitoral,
        totalReferenciaPlanilha: injetado.totalReferenciaPlanilha,
      }
    }, [
      candidatoIds,
      secoes,
      compararComReferentes,
      vereadorId,
      depEstadualSelecionadoId,
      liderancaSelecionada,
      expectativaLiderancaTotal,
      labelExpectativa,
    ])

    const matriz = expectativaResult.matriz

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
        className="mt-4 scroll-mt-4 rounded-2xl bg-white shadow-sm"
        aria-label="Votação por seção do candidato"
      >
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-[#EEEEEE] px-5 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
              Votação por seção
              {compararComReferentes && (jadyelNome || depEstadualSelecionado) ? ' · comparativo' : ''}
            </p>
            <h2 className="truncate text-[17px] font-bold">
              {nomeCandidatoResumoExibicao(candidato.nomeUrnaCandidato, candidato.numeroUrna)}
            </h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-[var(--tse-muted)]">
              <span>
                {chave?.dsCargo ?? candidato.cargo} · {chave?.ano ?? candidato.anoEleicao}
              </span>
              <span className="tabular-nums">nº {candidato.numeroUrna}</span>
              <span className="inline-flex items-center gap-0.5">
                <MapPin className="h-3 w-3 fill-[var(--tse-yellow)] text-[var(--tse-yellow)]" />
                {municipioResolvido}
              </span>
            </p>
            {(jadyelNome || depEstadualSelecionado) && compararComReferentes && (
              <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
                Comparando com{' '}
                {jadyelNome ? (
                  <>
                    <strong className="text-[var(--tse-text)]">{jadyelNome}</strong> (Dep. Federal 2022)
                  </>
                ) : null}
                {jadyelNome && depEstadualSelecionado ? ' · ' : null}
                {depEstadualSelecionado ? (
                  <>
                    <strong className="text-[var(--tse-text)]">{depEstadualSelecionado.nmVotavel}</strong>{' '}
                    (Dep. Estadual 2022)
                  </>
                ) : null}
              </p>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {!loading && distribuicao?.encontrado && (
              <Link href={urlSecaoCandidato(municipioResolvido, distribuicao)} className={tseLinkAcaoClass}>
                Página completa
                <ArrowUpRight className="ml-0.5 inline h-3.5 w-3.5" />
              </Link>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-md p-1 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]"
              aria-label="Fechar painel"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </header>

        <div className="px-5 py-4">
          {loading && (
            <TseCarregando
              className="min-h-[160px]"
              texto={
                compararComReferentes
                  ? 'Carregando comparação com Jadyel e dep. estadual da liderança…'
                  : 'Carregando matriz por seção…'
              }
            />
          )}

          {!loading && error && <TseVazio>{error}</TseVazio>}

          {!loading && !error && distribuicao && (
            <>
              <div className="mb-3 grid grid-cols-2 gap-x-5 gap-y-3 rounded-xl bg-[var(--tse-bar)] px-4 py-3 sm:grid-cols-5">
                <StatBox rotulo="Resumo (planilha)" valor={formatVotos(votosResumo)} />
                <StatBox rotulo="Bweb (seções)" valor={formatVotos(distribuicao.totalVotos)} />
                <StatBox rotulo="Seções c/ voto" valor={String(distribuicao.totalSecoesComVoto)} />
                <StatBox rotulo="Seções no município" valor={String(totalSecoes || matriz?.linhas.length || 0)} />
                <StatBox rotulo="Bairros" valor={String(distribuicao.bairros.length)} />
              </div>

              {distribuicao.diferencaResumo != null && distribuicao.diferencaResumo !== 0 && (
                <p className="mb-3 text-[11px] text-[var(--tse-muted)]">
                  Diferença resumo × bweb:{' '}
                  <strong className="text-[var(--tse-text)]">
                    {distribuicao.diferencaResumo > 0 ? '+' : ''}
                    {formatVotos(distribuicao.diferencaResumo)}
                  </strong>{' '}
                  (totais podem divergir por turno, abstenção ou atualização da base)
                </p>
              )}

              {!distribuicao.encontrado && (
                <div className="mb-3">
                  <TseVazio>
                    Nenhum voto encontrado na base por seção para nº {candidato.numeroUrna} em {municipioResolvido}.
                  </TseVazio>
                </div>
              )}

              {compararComReferentes && (liderancasDetalhe.length > 0 || depEstaduaisOpcoes.length > 0) && (
                <div className="mb-3 grid gap-3 lg:grid-cols-2">
                  {liderancasDetalhe.length > 0 && (
                    <div className="min-w-0">
                      <label htmlFor="lideranca-expectativa-comparativo" className={tseRotuloCampoClass}>
                        Liderança ({labelExpectativa})
                      </label>
                      <select
                        id="lideranca-expectativa-comparativo"
                        value={liderancaSelecionadaKey}
                        onChange={(e) => setLiderancaSelecionadaKey(e.target.value)}
                        className={tseCampoClass}
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
                      {liderancaSelecionada && vereadorId && expectativaResult.totalMapaEleitoral > 0 && (
                        <p className="mt-1.5 text-[10px] text-[var(--tse-muted)]">
                          Coluna <strong className="text-[var(--tse-text)]">Exp. 2026</strong> projeta o território
                          pelas urnas de 2024 do vereador
                          {depEstadualSelecionadoId ? (
                            <span> (com ajuste onde vereador × dep. estadual divergem no bairro)</span>
                          ) : null}
                          . Total do mapa:{' '}
                          <strong className="text-[var(--tse-text)]">
                            {expectativaResult.totalMapaEleitoral.toLocaleString('pt-BR')} votos
                          </strong>
                          {expectativaResult.totalReferenciaPlanilha > 0 ? (
                            <span>
                              {' '}
                              · referência na planilha:{' '}
                              <strong className="text-[var(--tse-text)]">
                                {expectativaResult.totalReferenciaPlanilha.toLocaleString('pt-BR')}
                              </strong>
                              {expectativaResult.totalMapaEleitoral !== expectativaResult.totalReferenciaPlanilha ? (
                                <span>
                                  {' '}
                                  (diferença:{' '}
                                  {expectativaResult.totalMapaEleitoral - expectativaResult.totalReferenciaPlanilha > 0
                                    ? '+'
                                    : ''}
                                  {(
                                    expectativaResult.totalMapaEleitoral - expectativaResult.totalReferenciaPlanilha
                                  ).toLocaleString('pt-BR')}
                                  )
                                </span>
                              ) : null}
                            </span>
                          ) : null}{' '}
                          · clique no valor Exp. 2026 para ver como chegamos no número
                          {liderancaMatchInicial && chaveLideranca(liderancaMatchInicial) !== liderancaSelecionadaKey ? (
                            <span> · substituída manualmente</span>
                          ) : liderancaMatchInicial ? (
                            <span> · match automático (Marcar)</span>
                          ) : null}
                        </p>
                      )}
                    </div>
                  )}

                  {depEstaduaisOpcoes.length > 0 && (
                    <div className="min-w-0">
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
                        <p className="mt-1.5 text-[10px] text-[var(--tse-muted)]">
                          Planilha (liderança):{' '}
                          <span className="text-[var(--tse-text)]">{nomeDepEstadualPlanilha}</span>
                          {depPlanilhaNaoEncontrado ? (
                            <span className="font-bold text-red-700"> — não encontrado; escolha na lista</span>
                          ) : depEstadualSelecionado &&
                            depPlanilhaMatch &&
                            depEstadualSelecionado.id !== depPlanilhaMatch.id ? (
                            <span> — substituído manualmente</span>
                          ) : null}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}

              {compararComReferentes && !jadyelNome && distribuicao.encontrado && (
                <p className="mb-3 text-[12px] text-[var(--tse-muted)]">
                  Jadyel Alencar (Dep. Federal 2022) não encontrado na base por seção deste município.
                </p>
              )}

              {habilitarMetaManual && metaSetupRequired ? (
                <p className="mb-3 rounded-xl bg-[var(--tse-yellow-soft)] px-3 py-2 text-[12px]">
                  Para salvar metas no banco, execute{' '}
                  <code className="rounded bg-white/80 px-1">database/create-atendimento-meta-territorio.sql</code> no
                  Supabase.
                </p>
              ) : null}
              {habilitarMetaManual && metaSaveError ? (
                <p className="mb-3 text-[12px] text-red-700">{metaSaveError}</p>
              ) : null}
              {habilitarMetaManual && metaSaving ? (
                <p className="mb-2 text-[11px] text-[var(--tse-muted)]">Salvando meta de {vereadorNomeMeta}…</p>
              ) : null}

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
                  detalhesExpectativaPorSecao={expectativaResult.detalhesPorSecao}
                  detalhesExpectativaPorBairro={expectativaResult.detalhesPorBairro}
                  colunaManual={
                    habilitarMetaManual
                      ? {
                          label: 'Meta',
                          valores: metasManuais,
                          onChange: onMetaManualChange,
                        }
                      : null
                  }
                />
              )}

              {distribuicao.encontrado && !matriz?.candidatos.length && (
                <TseVazio>Candidato encontrado na planilha, mas não foi possível montar a matriz por seção.</TseVazio>
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
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">{rotulo}</p>
      <p className="text-[17px] font-bold tabular-nums">{valor}</p>
    </div>
  )
}
