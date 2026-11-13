'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ExternalLink,
  RefreshCw,
  Landmark,
  Wallet,
  Banknote,
  Users,
  Target,
  MapPin,
} from 'lucide-react'
import {
  EMENDAS_COMPARATIVO_ANOS_MANDATO,
  filterEmendasComparativoPorAnos,
  formatEmendaBrl,
  formatEmendaBrlCompact,
  sortEmendasComparativoRanking,
  temValorIndicadoNoRanking,
  valorOrdenacaoEmenda,
  type EmendasComparativoAnoKey,
  type EmendasComparativoDeputado,
  type EmendasComparativoOrdenacao,
  type EmendasComparativoPayload,
} from '@/lib/war-room/emendas-comparativo-pi'
import { cn } from '@/lib/utils'
import {
  TseCarregando,
  TseErro,
  TseRank,
  TseSegmentado,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
} from '@/components/tse/tse-ui'

const ANO_BOTOES: EmendasComparativoAnoKey[] = [...EMENDAS_COMPARATIVO_ANOS_MANDATO].reverse()

const ORDENACAO_BASE: Array<{ id: EmendasComparativoOrdenacao; label: string }> = [
  { id: 'pago', label: 'Pago' },
  { id: 'empenhado', label: 'Empenhado' },
  { id: 'indicado', label: 'Indicado' },
]

const ORDENACAO_LABEL: Record<EmendasComparativoOrdenacao, string> = {
  pago: 'pago',
  empenhado: 'empenhado',
  indicado: 'indicado',
}

function formatGeradoEm(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function RankBar({ value, max }: { value: number; max: number }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 1000) / 10) : 0
  return (
    <div className="wr-emendas-cmp__bar" aria-hidden>
      <span style={{ width: `${pct}%` }} />
    </div>
  )
}

function DeputadoRow({
  dep,
  ordenacao,
  maxValor,
  selected,
  onSelect,
}: {
  dep: EmendasComparativoDeputado
  ordenacao: EmendasComparativoOrdenacao
  maxValor: number
  selected: boolean
  onSelect: () => void
}) {
  const valor = valorOrdenacaoEmenda(dep, ordenacao)
  return (
    <button
      type="button"
      className={cn('wr-emendas-cmp__row', selected && 'wr-emendas-cmp__row--on')}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <TseRank posicao={dep.rank} />
      <span className="wr-emendas-cmp__avatar">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={dep.foto} alt="" width={40} height={40} loading="lazy" />
      </span>
      <span className="wr-emendas-cmp__who">
        <strong>{dep.nome}</strong>
        <em>{dep.partido}</em>
      </span>
      <span className="wr-emendas-cmp__metrics">
        <RankBar value={valor} max={maxValor} />
        <span className="wr-emendas-cmp__pago tabular-nums">{formatEmendaBrlCompact(valor)}</span>
        <span className="wr-emendas-cmp__meta">
          {ORDENACAO_LABEL[ordenacao]} · {dep.qtdEmendas} emenda
          {dep.qtdEmendas === 1 ? '' : 's'}
          {ordenacao !== 'pago' ? ` · pago ${formatEmendaBrlCompact(dep.valorPago)}` : ''}
        </span>
      </span>
    </button>
  )
}

function AnoChip({
  pressed,
  onClick,
  children,
}: {
  pressed: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onClick}
      className={cn(
        'rounded-md border px-2.5 py-1 text-[12px] font-semibold transition-colors',
        pressed
          ? 'border-[var(--tse-yellow)] bg-[var(--tse-yellow-strong)] text-[var(--tse-text)]'
          : 'border-[var(--tse-border)] bg-white text-[var(--tse-muted)] hover:bg-[var(--tse-bar)]',
      )}
    >
      {children}
    </button>
  )
}

/** Copiloto · Emendas Comparativo PI — ranking bancada federal (Portal da Transparência). */
export function WarRoomCopilotoEmendasComparativoView() {
  const [anosSelecionados, setAnosSelecionados] = useState<EmendasComparativoAnoKey[]>([
    ...EMENDAS_COMPARATIVO_ANOS_MANDATO,
  ])
  const [ordenacao, setOrdenacao] = useState<EmendasComparativoOrdenacao>('pago')
  const [dataBase, setDataBase] = useState<EmendasComparativoPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/war-room/emendas-comparativo?ano=todos', {
        cache: 'no-store',
      })
      const json = (await res.json()) as EmendasComparativoPayload & { error?: string }
      if (!res.ok) throw new Error(json.error || 'Falha ao carregar comparativo')
      setDataBase(json)
      setSelectedId((prev) => {
        if (prev && json.ranking.some((r) => r.id === prev)) return prev
        return json.ranking[0]?.id ?? null
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao carregar')
      setDataBase(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const data = useMemo(() => {
    if (!dataBase) return null
    return filterEmendasComparativoPorAnos(dataBase, anosSelecionados)
  }, [dataBase, anosSelecionados])

  useEffect(() => {
    if (!data) return
    if (!temValorIndicadoNoRanking(data.ranking) && ordenacao === 'indicado') {
      setOrdenacao('pago')
    }
  }, [data, ordenacao])

  const mandatoCompleto =
    anosSelecionados.length === EMENDAS_COMPARATIVO_ANOS_MANDATO.length &&
    EMENDAS_COMPARATIVO_ANOS_MANDATO.every((a) => anosSelecionados.includes(a))

  const toggleAno = useCallback((ano: EmendasComparativoAnoKey) => {
    setAnosSelecionados((prev) => {
      const on = prev.includes(ano)
      if (on) {
        const next = prev.filter((a) => a !== ano)
        return next.length === 0 ? [ano] : next
      }
      return [...prev, ano].sort() as EmendasComparativoAnoKey[]
    })
  }, [])

  const selecionarMandato = useCallback(() => {
    setAnosSelecionados([...EMENDAS_COMPARATIVO_ANOS_MANDATO])
  }, [])

  const temIndicado = useMemo(
    () => (data ? temValorIndicadoNoRanking(data.ranking) : false),
    [data],
  )

  const ordenacaoOpcoes = useMemo(
    () => ORDENACAO_BASE.filter((o) => o.id !== 'indicado' || temIndicado),
    [temIndicado],
  )

  const rankingOrdenado = useMemo(() => {
    if (!data) return []
    return sortEmendasComparativoRanking(data.ranking, ordenacao)
  }, [data, ordenacao])

  const selected = useMemo(
    () => rankingOrdenado.find((r) => r.id === selectedId) ?? null,
    [rankingOrdenado, selectedId],
  )

  const maxValor = rankingOrdenado[0]
    ? valorOrdenacaoEmenda(rankingOrdenado[0], ordenacao)
    : 0

  const periodoLabel = mandatoCompleto
    ? 'Mandato 2023–2026'
    : [...anosSelecionados].sort().join(' · ')

  return (
    <div className="wr-emendas-cmp flex flex-col gap-4" data-tse-emendas-cmp="">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-[15px] font-bold text-[var(--tse-text)]">
            Comparativo · Federais do Piauí
          </h3>
          <p className="mt-0.5 max-w-3xl text-[13px] text-[var(--tse-muted)]">
            {periodoLabel} · valor pago em emendas individuais (Pix + projeto definido). A cor mede
            magnitude, não celebração do repasse. Selecione um ou mais anos.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Anos do mandato">
            <AnoChip pressed={mandatoCompleto} onClick={selecionarMandato}>
              Mandato
            </AnoChip>
            {ANO_BOTOES.map((ano) => (
              <AnoChip
                key={ano}
                pressed={anosSelecionados.includes(ano)}
                onClick={() => toggleAno(ano)}
              >
                {ano}
              </AnoChip>
            ))}
          </div>
          <button
            type="button"
            className={tseBotaoCinzaClass}
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={cn(tseBotaoIconeClass, loading && 'animate-spin')}
              strokeWidth={1.5}
              aria-hidden
            />
            Atualizar
          </button>
        </div>
      </header>

      {loading && !data ? (
        <TseCarregando texto="Carregando ranking…" className="min-h-[30vh]" />
      ) : error && !data ? (
        <div className="flex flex-col items-start gap-3">
          <TseErro>{error}</TseErro>
          <button type="button" className={tseBotaoCinzaClass} onClick={() => void load()}>
            Tentar de novo
          </button>
        </div>
      ) : data ? (
        <>
          <div
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5"
            role="list"
            aria-label="Indicadores do comparativo"
          >
            <article className={cn(tseCardClass, '!p-3')} role="listitem">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--tse-yellow-soft)] text-[var(--tse-yellow)]">
                <Wallet size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                Valor pago
              </p>
              <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[var(--tse-text)]">
                {formatEmendaBrlCompact(data.kpis.valorPago)}
              </p>
            </article>
            <article className={cn(tseCardClass, '!p-3')} role="listitem">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--tse-yellow-soft)] text-[var(--tse-yellow)]">
                <Banknote size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                Emendas Pix
              </p>
              <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[var(--tse-text)]">
                {formatEmendaBrlCompact(data.kpis.valorPix)}
              </p>
            </article>
            <article className={cn(tseCardClass, '!p-3')} role="listitem">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--tse-yellow-soft)] text-[var(--tse-yellow)]">
                <Landmark size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                Projeto definido
              </p>
              <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[var(--tse-text)]">
                {formatEmendaBrlCompact(data.kpis.valorProjeto)}
              </p>
            </article>
            <article className={cn(tseCardClass, '!p-3')} role="listitem">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--tse-yellow-soft)] text-[var(--tse-yellow)]">
                <Users size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                Parlamentares
              </p>
              <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[var(--tse-text)]">
                {data.kpis.parlamentares}
                <span className="text-[12px] font-semibold text-[var(--tse-muted)]">
                  {' '}
                  · {data.kpis.qtdEmendas} emendas
                </span>
              </p>
            </article>
            <article className={cn(tseCardClass, '!p-3')} role="listitem">
              <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-[var(--tse-yellow-soft)] text-[var(--tse-yellow)]">
                <Target size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <p className="mt-2 text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                Média / emenda
              </p>
              <p className="mt-0.5 text-[18px] font-bold tabular-nums text-[var(--tse-text)]">
                {formatEmendaBrlCompact(data.kpis.valorMedio)}
              </p>
            </article>
          </div>

          <p className="text-[12px] leading-relaxed text-[var(--tse-muted)]">{data.disclaimer}</p>

          <div className="grid gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(18rem,0.9fr)]">
            <section className={cn(tseCardClass, '!p-0')} aria-label="Ranking de deputados">
              <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--tse-border)] px-4 py-3">
                <div>
                  <h4 className="text-[15px] font-bold text-[var(--tse-text)]">
                    Ranking — bancada PI
                  </h4>
                  <span className="text-[12px] text-[var(--tse-muted)]">
                    {rankingOrdenado.length} deputados
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-[13px] font-semibold text-[var(--tse-text)]">
                  Ordenar por
                  <TseSegmentado
                    opcoes={ordenacaoOpcoes}
                    valor={ordenacao}
                    onChange={setOrdenacao}
                  />
                </div>
              </header>
              <div className="flex flex-col gap-1 p-2">
                {rankingOrdenado.map((dep) => (
                  <DeputadoRow
                    key={dep.id}
                    dep={dep}
                    ordenacao={ordenacao}
                    maxValor={maxValor}
                    selected={dep.id === selectedId}
                    onSelect={() => setSelectedId(dep.id)}
                  />
                ))}
              </div>
            </section>

            <aside className={tseCardClass} aria-label="Detalhe do parlamentar">
              {selected ? (
                <>
                  <div className="wr-emendas-cmp__detail-hero flex items-center gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.foto} alt="" width={64} height={64} />
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                        #{selected.rank}
                      </p>
                      <h4 className="text-[16px] font-bold text-[var(--tse-text)]">{selected.nome}</h4>
                      <p className="text-[13px] text-[var(--tse-muted)]">
                        {selected.partido} · PI
                      </p>
                    </div>
                  </div>
                  <dl className="mt-4 space-y-2 text-[13px]">
                    {(selected.valorIndicado ?? 0) > 0 ? (
                      <div className="flex justify-between gap-3">
                        <dt className="text-[var(--tse-muted)]">Indicado</dt>
                        <dd className="font-bold tabular-nums">
                          {formatEmendaBrl(selected.valorIndicado ?? 0)}
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--tse-muted)]">Pago</dt>
                      <dd className="font-bold tabular-nums">{formatEmendaBrl(selected.valorPago)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--tse-muted)]">Empenhado</dt>
                      <dd className="font-bold tabular-nums">
                        {formatEmendaBrl(selected.valorEmpenhado)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--tse-muted)]">Pix</dt>
                      <dd className="font-bold tabular-nums">{formatEmendaBrl(selected.valorPix)}</dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-[var(--tse-muted)]">Projeto</dt>
                      <dd className="font-bold tabular-nums">
                        {formatEmendaBrl(selected.valorProjeto)}
                      </dd>
                    </div>
                  </dl>
                  <div className="wr-emendas-cmp__munis mt-4 border-t border-[var(--tse-border)] pt-3">
                    <header className="mb-2 flex items-center gap-1.5 text-[12px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                      <MapPin size={14} className="text-[var(--tse-yellow)]" strokeWidth={2.2} aria-hidden />
                      <span>Top municípios (nomeados)</span>
                    </header>
                    {selected.municipiosTop.length === 0 ? (
                      <p className="text-[13px] text-[var(--tse-muted)]">
                        Sem município nominado no CSV (múltiplo / UF / nacional).
                      </p>
                    ) : (
                      <ul>
                        {selected.municipiosTop.map((m) => (
                          <li key={m.municipio}>
                            <span>{m.municipio}</span>
                            <strong className="tabular-nums">
                              {formatEmendaBrlCompact(m.valorPago)}
                            </strong>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-[13px] text-[var(--tse-muted)]">
                  Selecione um deputado no ranking.
                </p>
              )}
            </aside>
          </div>

          <footer className="wr-emendas-cmp__foot flex flex-wrap items-center justify-between gap-2 text-[12px] text-[var(--tse-muted)]">
            <span>
              Fonte:{' '}
              <a href={data.fonteUrl} target="_blank" rel="noreferrer">
                Portal da Transparência
                <ExternalLink className="ml-0.5 inline h-3 w-3" strokeWidth={1.5} aria-hidden />
              </a>
              {' · '}
              Elenco:{' '}
              <a href="https://dadosabertos.camara.leg.br" target="_blank" rel="noreferrer">
                Câmara dos Deputados
              </a>
            </span>
            <span>Atualizado {formatGeradoEm(data.geradoEm)}</span>
          </footer>
        </>
      ) : null}
    </div>
  )
}
