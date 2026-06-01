'use client'

import { forwardRef, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronUp, Loader2, MapPin, X, ArrowUpRight } from 'lucide-react'
import { TabelaMatrizVotacaoSecao } from '@/components/tabela-matriz-votacao-secao'
import type { DistribuicaoCandidatoBweb } from '@/lib/candidato-distribuicao-bweb'
import { chaveMatchFromResumo, resumoTemVotacaoSecao } from '@/lib/candidato-votacao-secao-match'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import { parseVotosEleicao } from '@/lib/resumo-eleicoes-dados'
import { cn } from '@/lib/utils'
import type { VotacaoSecaoItem } from '@/lib/votacao-secao'
import { montarMatrizVotacaoSecao } from '@/lib/votacao-secao-matriz'

type Props = {
  candidato: ResultadoEleicao
  municipio: string
  onClose: () => void
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
  const params = new URLSearchParams({
    cidade: municipio,
    ano: String(distribuicao.chave.ano),
    cargo: distribuicao.chave.dsCargo,
    nr: String(distribuicao.chave.nrVotavel),
  })
  return `/dashboard/resumo-eleicoes/secao?${params.toString()}`
}

export function BotaoNomeCandidatoDistribuicao({
  item,
  candidatoAtivo,
  onVerDistribuicao,
}: {
  item: ResultadoEleicao
  candidatoAtivo?: ResultadoEleicao | null
  onVerDistribuicao: (item: ResultadoEleicao) => void
}) {
  const temSecao = resumoTemVotacaoSecao(item)
  const ativo = isMesmoCandidatoResumo(item, candidatoAtivo ?? null)

  if (!temSecao) {
    return <span>{item.nomeUrnaCandidato}</span>
  }

  return (
    <button
      type="button"
      onClick={() => onVerDistribuicao(item)}
      className={cn(
        'group inline-flex max-w-full items-baseline gap-1 text-left',
        ativo
          ? 'font-semibold text-accent-gold underline decoration-accent-gold/60'
          : 'hover:underline',
      )}
      title={
        ativo
          ? 'Ocultar votação por seção'
          : 'Ver votação por seção (bairro, local e seção)'
      }
      aria-pressed={ativo}
    >
      <span className="truncate">{item.nomeUrnaCandidato}</span>
      <span
        className={cn(
          'shrink-0 font-mono text-[10px]',
          ativo ? 'text-accent-gold' : 'text-text-secondary group-hover:text-accent-gold',
        )}
      >
        {item.numeroUrna}
      </span>
    </button>
  )
}

export const PainelVotacaoCandidatoResumo = forwardRef<HTMLElement, Props>(
  function PainelVotacaoCandidatoResumo({ candidato, municipio, onClose }, ref) {
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [distribuicao, setDistribuicao] = useState<DistribuicaoCandidatoBweb | null>(null)
    const [secoes, setSecoes] = useState<VotacaoSecaoItem[]>([])
    const [candidatoId, setCandidatoId] = useState<string | null>(null)
    const [municipioResolvido, setMunicipioResolvido] = useState(municipio)
    const [totalSecoes, setTotalSecoes] = useState(0)

    const chave = useMemo(() => chaveMatchFromResumo(candidato), [candidato])

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
      setCandidatoId(null)

      const params = new URLSearchParams({
        cidade: municipio,
        ano: String(chave.ano),
        cargo: chave.dsCargo,
        cd_cargo: String(chave.cdCargo),
        nr: String(chave.nrVotavel),
        votos_resumo: candidato.quantidadeVotosNominais,
      })
      if (chave.sqCandidato != null) {
        params.set('sq', String(chave.sqCandidato))
      }

      void (async () => {
        try {
          const res = await fetch(
            `/api/resumo-eleicoes/votacao-secao/distribuicao?${params.toString()}`,
            { signal: controller.signal },
          )
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            throw new Error(data.error || `Erro ${res.status}`)
          }
          setMunicipioResolvido(String(data.municipio ?? municipio))
          setDistribuicao(data.distribuicao as DistribuicaoCandidatoBweb)
          setSecoes((data.secoes ?? []) as VotacaoSecaoItem[])
          setCandidatoId(typeof data.candidatoId === 'string' ? data.candidatoId : null)
          setTotalSecoes(Number(data.resumoSecao?.totalSecoes ?? 0))
        } catch (e: unknown) {
          if (e instanceof DOMException && e.name === 'AbortError') return
          setError(e instanceof Error ? e.message : 'Erro ao carregar distribuição')
        } finally {
          setLoading(false)
        }
      })()

      return () => controller.abort()
    }, [candidato, chave, municipio])

    const matriz = useMemo(() => {
      if (!candidatoId || secoes.length === 0) return null
      return montarMatrizVotacaoSecao(secoes, [candidatoId])
    }, [candidatoId, secoes])

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
            </p>
            <h2 className="truncate text-base font-semibold text-text-primary">
              {candidato.nomeUrnaCandidato}
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
              Carregando matriz por seção…
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

              {matriz && matriz.candidatos.length > 0 && (
                <TabelaMatrizVotacaoSecao matriz={matriz} mostrarToolbarSemelhanca={false} />
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
