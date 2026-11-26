'use client'

import { useEffect, useMemo, useState } from 'react'
import { ArrowRight, Flag, Landmark, Layers, MapPin, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  formatarVotos2026,
  type ResultadoSecao2026Candidato,
  type ResultadoSecao2026Payload,
} from '@/lib/resultado-secao-2026'
import { siglaSituacao2026 } from '@/lib/resultado-situacao-2026'
import { abreviarCargo, nomeProprio, normalizarTexto } from './tse-ui'

type CandidatoComIndice = {
  candidato: ResultadoSecao2026Candidato
  indice: number
  ehFederal: boolean
  ehEleito: boolean
}

type GavetaFiltro =
  | { tipo: 'casa'; titulo: string; subtitulo: string; cargo: 'federal' | 'estadual' }
  | { tipo: 'partido'; titulo: string; subtitulo: string; partido: string }

function ehCargoFederal(cargo: string): boolean {
  return /federal/i.test(cargo)
}

function IndicadorSituacaoMinimo({ situacao }: { situacao?: string }) {
  const s = siglaSituacao2026(situacao)
  return (
    <span
      title={situacao || undefined}
      className={cn(
        'inline-flex items-center gap-1 text-[10px] font-bold',
        s.tom === 'verde' && 'text-[var(--tse-olive)]',
        s.tom === 'amarelo' && 'text-[var(--tse-gold-text)]',
        s.tom === 'neutro' && 'text-[var(--tse-muted)]',
      )}
    >
      <span
        className={cn(
          'h-1.5 w-1.5 rounded-full',
          s.tom === 'verde' && 'bg-[var(--tse-olive)]',
          s.tom === 'amarelo' && 'bg-[var(--tse-yellow)]',
          s.tom === 'neutro' && 'bg-[#C9C9C2]',
        )}
        aria-hidden
      />
      {s.sigla}
    </span>
  )
}

export function ResumoEstadual2026({
  payload,
  onAbrirCandidato,
  onAbrirMunicipio,
  onAbrirTodosMunicipios,
  onAbrirTerritorio,
}: {
  payload: ResultadoSecao2026Payload
  onAbrirCandidato: (indice: number) => void
  onAbrirMunicipio: (codigoMunicipio: string) => void
  onAbrirTodosMunicipios: () => void
  onAbrirTerritorio: () => void
}) {
  const [busca, setBusca] = useState<string>('')
  const [gaveta, setGaveta] = useState<GavetaFiltro | null>(null)
  const [somenteEleitosGaveta, setSomenteEleitosGaveta] = useState<boolean>(true)
  const [buscaGaveta, setBuscaGaveta] = useState<string>('')

  useEffect(() => {
    if (!gaveta) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setGaveta(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [gaveta])

  const { federais, estaduais, eleitosFederais, eleitosEstaduais, partidosResumo, todos } = useMemo(() => {
    const lista: CandidatoComIndice[] = payload.candidatos
      .map((candidato, indice) => ({
        candidato,
        indice,
        ehFederal: ehCargoFederal(candidato.cargo),
        ehEleito: siglaSituacao2026(candidato.situacao).sigla === 'E',
      }))
      .sort((a, b) => b.candidato.totalVotos - a.candidato.totalVotos)

    const fed = lista.filter((item) => item.ehFederal)
    const est = lista.filter((item) => !item.ehFederal)
    const elFed = fed.filter((item) => item.ehEleito)
    const elEst = est.filter((item) => item.ehEleito)

    const porPartido = new Map<
      string,
      { partido: string; eleitos: number; federais: number; estaduais: number; votos: number; candidatos: number }
    >()
    for (const item of lista) {
      const sigla = (item.candidato.partido || 'SEM PARTIDO').trim().toUpperCase()
      const atual = porPartido.get(sigla) ?? {
        partido: sigla,
        eleitos: 0,
        federais: 0,
        estaduais: 0,
        votos: 0,
        candidatos: 0,
      }
      atual.candidatos += 1
      atual.votos += item.candidato.totalVotos
      if (item.ehEleito) {
        atual.eleitos += 1
        if (item.ehFederal) atual.federais += 1
        else atual.estaduais += 1
      }
      porPartido.set(sigla, atual)
    }

    const partidosOrdenados = Array.from(porPartido.values()).sort(
      (a, b) => b.eleitos - a.eleitos || b.votos - a.votos || a.partido.localeCompare(b.partido, 'pt-BR'),
    )

    return {
      federais: fed,
      estaduais: est,
      eleitosFederais: elFed,
      eleitosEstaduais: elEst,
      partidosResumo: partidosOrdenados,
      todos: lista,
    }
  }, [payload.candidatos])

  const resultadosBusca = useMemo(() => {
    const q = normalizarTexto(busca)
    if (q.length < 2) return null
    const candidatos = todos
      .filter((item) => {
        const nome = normalizarTexto(item.candidato.nome)
        const partido = normalizarTexto(item.candidato.partido ?? '')
        const numero = normalizarTexto(item.candidato.numero)
        return nome.includes(q) || partido.includes(q) || numero.includes(q)
      })
      .slice(0, 6)
    const municipios = payload.municipios
      .filter((m) => normalizarTexto(m.nome).includes(q))
      .slice(0, 5)
    return { candidatos, municipios }
  }, [busca, todos, payload.municipios])

  const itensGaveta = useMemo(() => {
    if (!gaveta) return []
    const base =
      gaveta.tipo === 'casa'
        ? gaveta.cargo === 'federal'
          ? federais
          : estaduais
        : todos.filter((item) => (item.candidato.partido || 'SEM PARTIDO').trim().toUpperCase() === gaveta.partido)
    const filtradoSituacao = somenteEleitosGaveta ? base.filter((item) => item.ehEleito) : base
    const q = normalizarTexto(buscaGaveta)
    if (!q) return filtradoSituacao
    return filtradoSituacao.filter(
      (item) =>
        normalizarTexto(item.candidato.nome).includes(q) ||
        normalizarTexto(item.candidato.partido ?? '').includes(q) ||
        normalizarTexto(item.candidato.numero).includes(q),
    )
  }, [gaveta, federais, estaduais, todos, somenteEleitosGaveta, buscaGaveta])

  const abrirGaveta = (filtro: GavetaFiltro, apenasEleitos = true) => {
    setGaveta(filtro)
    setSomenteEleitosGaveta(apenasEleitos)
    setBuscaGaveta('')
  }

  const votosFederais = useMemo(
    () => federais.reduce((acc, item) => acc + item.candidato.totalVotos, 0),
    [federais],
  )
  const votosEstaduais = useMemo(
    () => estaduais.reduce((acc, item) => acc + item.candidato.totalVotos, 0),
    [estaduais],
  )

  return (
    <div className="space-y-4">
      {/* Faixa Hero Executiva */}
      <section className="overflow-hidden rounded-[10px] border border-[#EAEAE5] bg-white shadow-sm">
        <div className="grid gap-6 p-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:items-center">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-[var(--tse-yellow)]" aria-hidden />
              <p className="text-[11px] font-semibold text-[var(--tse-muted)]">
                Eleições {payload.meta.eleicao} · Piauí · {payload.meta.turno}º turno
              </p>
            </div>
            <h2 className="mt-2 text-[22px] font-extrabold tracking-tight text-[var(--tse-text)] sm:text-[26px]">
              Veja quem se elegeu no Piauí em 2026
            </h2>
            <p className="mt-1.5 max-w-2xl text-[13px] leading-relaxed text-[var(--tse-muted)]">
              Explore os <strong className="text-[var(--tse-text)]">{payload.candidatos.length}</strong> candidatos de
              Deputado Federal e Estadual em{' '}
              <strong className="text-[var(--tse-text)]">{payload.meta.totalMunicipios}</strong> municípios e{' '}
              <strong className="text-[var(--tse-text)]">{formatarVotos2026(payload.meta.totalSecoes)}</strong> seções.
            </p>

            {/* Busca rápida */}
            <div className="relative mt-4 max-w-xl">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--tse-muted)]"
                aria-hidden
              />
              <input
                type="search"
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar candidato, partido, número ou município…"
                aria-label="Buscar candidato, partido, número ou município"
                className="w-full rounded-full border border-[#E2E2DC] bg-[#FAFAF8] py-2.5 pl-10 pr-4 text-[13px] text-[var(--tse-text)] outline-none transition-colors placeholder:text-[var(--tse-muted)] focus:border-[var(--tse-olive)] focus:bg-white"
              />
              {resultadosBusca ? (
                <div className="absolute left-0 right-0 top-full z-30 mt-1.5 overflow-hidden rounded-[10px] border border-[#E5E5DF] bg-white shadow-lg">
                  {resultadosBusca.candidatos.length === 0 && resultadosBusca.municipios.length === 0 ? (
                    <p className="px-4 py-3 text-[12px] text-[var(--tse-muted)]">
                      Nenhum candidato ou município encontrado para &ldquo;{busca}&rdquo;.
                    </p>
                  ) : (
                    <div className="divide-y divide-[#F2F2EE]">
                      {resultadosBusca.candidatos.length > 0 ? (
                        <div className="py-1.5">
                          <p className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--tse-muted)]">
                            Candidatos
                          </p>
                          {resultadosBusca.candidatos.map((item) => (
                            <button
                              key={item.candidato.id}
                              type="button"
                              onClick={() => {
                                setBusca('')
                                onAbrirCandidato(item.indice)
                              }}
                              className="flex w-full items-center justify-between gap-3 px-3.5 py-2 text-left text-[12px] transition-colors hover:bg-[#F7F7F4]"
                            >
                              <div className="min-w-0">
                                <span className="font-bold text-[var(--tse-text)]">
                                  {nomeProprio(item.candidato.nome)}
                                </span>
                                <span className="ml-2 text-[11px] text-[var(--tse-muted)]">
                                  {abreviarCargo(item.candidato.cargo)}
                                  {item.candidato.partido ? ` · ${item.candidato.partido}` : ''}
                                </span>
                              </div>
                              <div className="flex shrink-0 items-center gap-2.5">
                                <span className="font-semibold tabular-nums text-[var(--tse-text)]">
                                  {formatarVotos2026(item.candidato.totalVotos)}
                                </span>
                                <IndicadorSituacaoMinimo situacao={item.candidato.situacao} />
                              </div>
                            </button>
                          ))}
                        </div>
                      ) : null}

                      {resultadosBusca.municipios.length > 0 ? (
                        <div className="py-1.5">
                          <p className="px-3.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] text-[var(--tse-muted)]">
                            Municípios
                          </p>
                          {resultadosBusca.municipios.map((m) => (
                            <button
                              key={m.codigo}
                              type="button"
                              onClick={() => {
                                setBusca('')
                                onAbrirMunicipio(m.codigo)
                              }}
                              className="flex w-full items-center justify-between gap-2 px-3.5 py-2 text-left text-[12px] transition-colors hover:bg-[#F7F7F4]"
                            >
                              <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--tse-text)]">
                                <MapPin className="h-3.5 w-3.5 text-[var(--tse-yellow)]" aria-hidden />
                                {nomeProprio(m.nome)}
                              </span>
                              <span className="text-[11px] text-[var(--tse-muted)]">Ver locais →</span>
                            </button>
                          ))}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              ) : null}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onAbrirTodosMunicipios}
                className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--tse-olive)] px-3.5 py-2 text-[12px] font-bold text-white transition-opacity hover:opacity-90"
              >
                Ver resultado por município
              </button>
              <button
                type="button"
                onClick={onAbrirTerritorio}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#E2E2DC] bg-white px-3.5 py-2 text-[12px] font-semibold text-[var(--tse-text)] transition-colors hover:bg-[#F7F7F4]"
              >
                Explorar territórios
              </button>
            </div>
          </div>

          {/* KPIs estaduais resumidos (sem cards aninhados) */}
          <div className="grid grid-cols-2 divide-y divide-[#F0F0EC] rounded-[10px] border border-[#F0F0EC] bg-[#FAFAF8] sm:divide-x sm:divide-y-0">
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--tse-muted)]">
                Bancada Federal
              </p>
              <div className="mt-1 text-[24px] font-extrabold leading-none tabular-nums text-[var(--tse-text)]">
                {eleitosFederais.length}
              </div>
              <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
                eleitos · {federais.length} candidatos
              </p>
            </div>
            <div className="px-4 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--tse-muted)]">
                Assembleia (ALEPI)
              </p>
              <div className="mt-1 text-[24px] font-extrabold leading-none tabular-nums text-[var(--tse-text)]">
                {eleitosEstaduais.length}
              </div>
              <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
                eleitos · {estaduais.length} candidatos
              </p>
            </div>
            <div className="border-t border-[#F0F0EC] px-4 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--tse-muted)]">
                Municípios
              </p>
              <div className="mt-1 text-[20px] font-extrabold leading-none tabular-nums text-[var(--tse-text)]">
                {payload.meta.totalMunicipios}
              </div>
              <p className="mt-1 text-[11px] text-[var(--tse-muted)]">Piauí completo</p>
            </div>
            <div className="border-t border-[#F0F0EC] px-4 py-3.5">
              <p className="text-[10px] font-bold uppercase tracking-[0.05em] text-[var(--tse-muted)]">
                Partidos com eleitos
              </p>
              <div className="mt-1 text-[20px] font-extrabold leading-none tabular-nums text-[var(--tse-text)]">
                {partidosResumo.filter((p) => p.eleitos > 0).length}
              </div>
              <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
                de {partidosResumo.length} siglas na disputa
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Grid das Casas & Partidos (3 colunas) */}
      <div className="grid gap-4 lg:grid-cols-3">
        {/* Card 1: Câmara Federal */}
        <section className="flex flex-col rounded-[10px] border border-[#EAEAE5] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tse-olive)]" aria-hidden />
              <p className="text-[11px] font-semibold lowercase text-[var(--tse-muted)]">câmara federal · pi</p>
            </div>
            <Landmark className="h-4 w-4 text-[var(--tse-muted)]" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="mt-2.5">
            <h3 className="text-[14px] font-bold text-[var(--tse-text)]">Deputados Federais</h3>
            <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
              <strong className="text-[20px] font-extrabold leading-none tabular-nums text-[var(--tse-text)]">
                {eleitosFederais.length}
              </strong>{' '}
              eleitos · {formatarVotos2026(votosFederais)} votos
            </p>
          </div>

          <ul className="mt-4 flex-1 divide-y divide-[#F2F2EE]">
            {eleitosFederais.slice(0, 5).map((item, pos) => (
              <li key={item.candidato.id}>
                <button
                  type="button"
                  onClick={() => onAbrirCandidato(item.indice)}
                  className="flex w-full items-center justify-between gap-2 py-2 text-left text-[12px] transition-colors hover:bg-[#FAFAF8]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-[var(--tse-muted)]">
                      {pos + 1}
                    </span>
                    <span className="truncate font-semibold text-[var(--tse-text)]">
                      {nomeProprio(item.candidato.nome)}
                    </span>
                    {item.candidato.partido ? (
                      <span className="shrink-0 text-[10px] font-semibold text-[var(--tse-muted)]">
                        {item.candidato.partido}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-[var(--tse-text)]">
                    {formatarVotos2026(item.candidato.totalVotos)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() =>
              abrirGaveta(
                {
                  tipo: 'casa',
                  titulo: 'Deputados Federais · Piauí 2026',
                  subtitulo: `${eleitosFederais.length} eleitos · ${federais.length} candidatos`,
                  cargo: 'federal',
                },
                true,
              )
            }
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-[#EAEAE5] px-3 py-2 text-[12px] font-semibold text-[var(--tse-text)] transition-colors hover:bg-[#F7F7F4]"
          >
            <span>Ver os {eleitosFederais.length} deputados federais</span>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--tse-olive)]" aria-hidden />
          </button>
        </section>

        {/* Card 2: Assembleia Legislativa */}
        <section className="flex flex-col rounded-[10px] border border-[#EAEAE5] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tse-yellow)]" aria-hidden />
              <p className="text-[11px] font-semibold lowercase text-[var(--tse-muted)]">assembleia · alepi</p>
            </div>
            <Layers className="h-4 w-4 text-[var(--tse-muted)]" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="mt-2.5">
            <h3 className="text-[14px] font-bold text-[var(--tse-text)]">Deputados Estaduais</h3>
            <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
              <strong className="text-[20px] font-extrabold leading-none tabular-nums text-[var(--tse-text)]">
                {eleitosEstaduais.length}
              </strong>{' '}
              eleitos · {formatarVotos2026(votosEstaduais)} votos
            </p>
          </div>

          <ul className="mt-4 flex-1 divide-y divide-[#F2F2EE]">
            {eleitosEstaduais.slice(0, 5).map((item, pos) => (
              <li key={item.candidato.id}>
                <button
                  type="button"
                  onClick={() => onAbrirCandidato(item.indice)}
                  className="flex w-full items-center justify-between gap-2 py-2 text-left text-[12px] transition-colors hover:bg-[#FAFAF8]"
                >
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="w-4 shrink-0 text-[11px] font-bold tabular-nums text-[var(--tse-muted)]">
                      {pos + 1}
                    </span>
                    <span className="truncate font-semibold text-[var(--tse-text)]">
                      {nomeProprio(item.candidato.nome)}
                    </span>
                    {item.candidato.partido ? (
                      <span className="shrink-0 text-[10px] font-semibold text-[var(--tse-muted)]">
                        {item.candidato.partido}
                      </span>
                    ) : null}
                  </span>
                  <span className="shrink-0 font-bold tabular-nums text-[var(--tse-text)]">
                    {formatarVotos2026(item.candidato.totalVotos)}
                  </span>
                </button>
              </li>
            ))}
          </ul>

          <button
            type="button"
            onClick={() =>
              abrirGaveta(
                {
                  tipo: 'casa',
                  titulo: 'Deputados Estaduais · ALEPI 2026',
                  subtitulo: `${eleitosEstaduais.length} eleitos · ${estaduais.length} candidatos`,
                  cargo: 'estadual',
                },
                true,
              )
            }
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-[#EAEAE5] px-3 py-2 text-[12px] font-semibold text-[var(--tse-text)] transition-colors hover:bg-[#F7F7F4]"
          >
            <span>Ver os {eleitosEstaduais.length} deputados estaduais</span>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--tse-olive)]" aria-hidden />
          </button>
        </section>

        {/* Card 3: Bancadas por partido */}
        <section className="flex flex-col rounded-[10px] border border-[#EAEAE5] bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--tse-olive)]" aria-hidden />
              <p className="text-[11px] font-semibold lowercase text-[var(--tse-muted)]">bancadas · partidos</p>
            </div>
            <Flag className="h-4 w-4 text-[var(--tse-muted)]" strokeWidth={1.5} aria-hidden />
          </div>
          <div className="mt-2.5">
            <h3 className="text-[14px] font-bold text-[var(--tse-text)]">Partidos no Piauí</h3>
            <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
              Clique em uma sigla para ver eleitos e candidatos
            </p>
          </div>

          <div className="mt-4 grid flex-1 grid-cols-3 content-start gap-2">
            {partidosResumo.slice(0, 12).map((p) => (
              <button
                key={p.partido}
                type="button"
                onClick={() =>
                  abrirGaveta(
                    {
                      tipo: 'partido',
                      titulo: `${p.partido} · Piauí 2026`,
                      subtitulo: `${p.eleitos} eleito(s) (${p.federais} fed. · ${p.estaduais} est.) · ${p.candidatos} candidatos`,
                      partido: p.partido,
                    },
                    p.eleitos > 0,
                  )
                }
                title={`${p.partido}: ${p.eleitos} eleito(s), ${formatarVotos2026(p.votos)} votos`}
                className={cn(
                  'flex flex-col items-start rounded-lg border px-2.5 py-2 text-left transition-colors hover:border-[var(--tse-olive)] hover:bg-[#FAFAF8]',
                  p.eleitos > 0 ? 'border-[#E5E5DF] bg-white' : 'border-[#F0F0EC] bg-[#FAFAF8] opacity-75',
                )}
              >
                <span className="truncate text-[11px] font-extrabold text-[var(--tse-text)]">{p.partido}</span>
                <span className="mt-0.5 text-[10px] tabular-nums text-[var(--tse-muted)]">
                  {p.eleitos > 0 ? `${p.eleitos} eleito${p.eleitos > 1 ? 's' : ''}` : `${p.candidatos} cand.`}
                </span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={onAbrirTerritorio}
            className="mt-3 flex w-full items-center justify-between rounded-lg border border-[#EAEAE5] px-3 py-2 text-[12px] font-semibold text-[var(--tse-text)] transition-colors hover:bg-[#F7F7F4]"
          >
            <span>Explorar por território</span>
            <ArrowRight className="h-3.5 w-3.5 text-[var(--tse-olive)]" aria-hidden />
          </button>
        </section>
      </div>

      {/* Painel lateral (drawer) para lista completa sem deslocar a página */}
      {gaveta ? (
        <div
          className="fixed inset-0 z-50 flex justify-end"
          role="dialog"
          aria-modal="true"
          aria-label={gaveta.titulo}
        >
          <div
            className="fixed inset-0 bg-black/20 backdrop-blur-[1px]"
            onClick={() => setGaveta(null)}
            aria-hidden
          />
          <aside className="relative z-10 flex h-full w-full max-w-[540px] flex-col border-l border-[#E5E5DF] bg-white shadow-2xl">
            <div className="flex items-center justify-between gap-3 border-b border-[#EAEAE5] px-5 py-3.5">
              <div className="min-w-0">
                <h3 className="truncate text-[15px] font-bold text-[var(--tse-text)]">{gaveta.titulo}</h3>
                <p className="truncate text-[11px] text-[var(--tse-muted)]">{gaveta.subtitulo}</p>
              </div>
              <button
                type="button"
                onClick={() => setGaveta(null)}
                aria-label="Fechar painel lateral"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[var(--tse-muted)] transition-colors hover:bg-[#F4F4F0] hover:text-[var(--tse-text)]"
              >
                <X className="h-4 w-4" aria-hidden />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-[#F2F2EE] bg-[#FAFAF8] px-5 py-2.5">
              <div className="relative min-w-0 flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--tse-muted)]"
                  aria-hidden
                />
                <input
                  type="search"
                  value={buscaGaveta}
                  onChange={(e) => setBuscaGaveta(e.target.value)}
                  placeholder="Filtrar por nome ou partido…"
                  className="w-full rounded-lg border border-[#E5E5DF] bg-white py-1.5 pl-8 pr-3 text-[12px] outline-none focus:border-[var(--tse-olive)]"
                />
              </div>
              <div className="flex rounded-lg border border-[#E5E5DF] bg-white p-0.5 text-[11px] font-semibold">
                <button
                  type="button"
                  onClick={() => setSomenteEleitosGaveta(true)}
                  className={cn(
                    'rounded-md px-2.5 py-1 transition-colors',
                    somenteEleitosGaveta
                      ? 'bg-[var(--tse-olive)] text-white'
                      : 'text-[var(--tse-muted)] hover:text-[var(--tse-text)]',
                  )}
                >
                  Eleitos
                </button>
                <button
                  type="button"
                  onClick={() => setSomenteEleitosGaveta(false)}
                  className={cn(
                    'rounded-md px-2.5 py-1 transition-colors',
                    !somenteEleitosGaveta
                      ? 'bg-[var(--tse-olive)] text-white'
                      : 'text-[var(--tse-muted)] hover:text-[var(--tse-text)]',
                  )}
                >
                  Todos
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-2">
              {itensGaveta.length === 0 ? (
                <p className="py-8 text-center text-[12px] text-[var(--tse-muted)]">
                  Nenhum candidato encontrado com esse filtro.
                </p>
              ) : (
                <ul className="divide-y divide-[#F2F2EE]">
                  {itensGaveta.map((item, idx) => (
                    <li key={item.candidato.id}>
                      <button
                        type="button"
                        onClick={() => {
                          setGaveta(null)
                          onAbrirCandidato(item.indice)
                        }}
                        className="flex w-full items-center justify-between gap-3 py-2.5 text-left text-[12px] transition-colors hover:bg-[#FAFAF8]"
                      >
                        <div className="flex min-w-0 items-center gap-2.5">
                          <span className="w-5 shrink-0 text-[11px] font-bold tabular-nums text-[var(--tse-muted)]">
                            {idx + 1}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-bold text-[var(--tse-text)]">
                              {nomeProprio(item.candidato.nome)}
                            </p>
                            <p className="truncate text-[11px] text-[var(--tse-muted)]">
                              {abreviarCargo(item.candidato.cargo)}
                              {item.candidato.partido ? ` · ${item.candidato.partido}` : ''} · nº{' '}
                              {item.candidato.numero}
                            </p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center gap-3">
                          <span className="font-bold tabular-nums text-[var(--tse-text)]">
                            {formatarVotos2026(item.candidato.totalVotos)}
                          </span>
                          <IndicadorSituacaoMinimo situacao={item.candidato.situacao} />
                        </div>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </div>
  )
}
