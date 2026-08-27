'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ExternalLink,
  Loader2,
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
      <span className="wr-emendas-cmp__rank tabular-nums">{String(dep.rank).padStart(2, '0')}</span>
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
    <div className="wr-emendas-cmp">
      <header className="wr-emendas-cmp__head">
        <div>
          <h3 className="wr-emendas-cmp__title">Comparativo · Federais do Piauí</h3>
          <p className="wr-emendas-cmp__sub">
            {periodoLabel} · valor pago em emendas individuais (Pix + projeto definido). A cor mede
            magnitude, não celebração do repasse. Selecione um ou mais anos.
          </p>
        </div>
        <div className="wr-emendas-cmp__head-actions">
          <div className="wr-emendas-cmp__anos" role="group" aria-label="Anos do mandato">
            <button
              type="button"
              aria-pressed={mandatoCompleto}
              className={cn(
                'wr-emendas-cmp__ano',
                mandatoCompleto && 'wr-emendas-cmp__ano--on',
              )}
              onClick={selecionarMandato}
            >
              Mandato
            </button>
            {ANO_BOTOES.map((ano) => {
              const on = anosSelecionados.includes(ano)
              return (
                <button
                  key={ano}
                  type="button"
                  aria-pressed={on}
                  className={cn('wr-emendas-cmp__ano', on && 'wr-emendas-cmp__ano--on')}
                  onClick={() => toggleAno(ano)}
                >
                  {ano}
                </button>
              )
            })}
          </div>
          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            onClick={() => void load()}
            disabled={loading}
          >
            <RefreshCw
              className={cn('h-3.5 w-3.5', loading && 'animate-spin')}
              strokeWidth={1.5}
              aria-hidden
            />
            Atualizar
          </button>
        </div>
      </header>

      {loading && !data ? (
        <div className="wr-emendas-cmp__state">
          <Loader2 className="h-5 w-5 animate-spin" strokeWidth={1.5} aria-hidden />
          Carregando ranking…
        </div>
      ) : error && !data ? (
        <div className="wr-emendas-cmp__state">
          <p>{error}</p>
          <button type="button" className="wr-copiloto-view__retry" onClick={() => void load()}>
            Tentar de novo
          </button>
        </div>
      ) : data ? (
        <>
          <div className="wr-emendas-cmp__kpis" role="list">
            <article className="wr-emendas-cmp__kpi" role="listitem">
              <span className="wr-emendas-cmp__kpi-ico">
                <Wallet size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <div>
                <p className="wr-emendas-cmp__kpi-label">Valor pago</p>
                <p className="wr-emendas-cmp__kpi-val tabular-nums">
                  {formatEmendaBrlCompact(data.kpis.valorPago)}
                </p>
              </div>
            </article>
            <article className="wr-emendas-cmp__kpi" role="listitem">
              <span className="wr-emendas-cmp__kpi-ico">
                <Banknote size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <div>
                <p className="wr-emendas-cmp__kpi-label">Emendas Pix</p>
                <p className="wr-emendas-cmp__kpi-val tabular-nums">
                  {formatEmendaBrlCompact(data.kpis.valorPix)}
                </p>
              </div>
            </article>
            <article className="wr-emendas-cmp__kpi" role="listitem">
              <span className="wr-emendas-cmp__kpi-ico">
                <Landmark size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <div>
                <p className="wr-emendas-cmp__kpi-label">Projeto definido</p>
                <p className="wr-emendas-cmp__kpi-val tabular-nums">
                  {formatEmendaBrlCompact(data.kpis.valorProjeto)}
                </p>
              </div>
            </article>
            <article className="wr-emendas-cmp__kpi" role="listitem">
              <span className="wr-emendas-cmp__kpi-ico">
                <Users size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <div>
                <p className="wr-emendas-cmp__kpi-label">Parlamentares</p>
                <p className="wr-emendas-cmp__kpi-val tabular-nums">
                  {data.kpis.parlamentares}
                  <span> · {data.kpis.qtdEmendas} emendas</span>
                </p>
              </div>
            </article>
            <article className="wr-emendas-cmp__kpi" role="listitem">
              <span className="wr-emendas-cmp__kpi-ico">
                <Target size={14} strokeWidth={2.2} aria-hidden />
              </span>
              <div>
                <p className="wr-emendas-cmp__kpi-label">Média / emenda</p>
                <p className="wr-emendas-cmp__kpi-val tabular-nums">
                  {formatEmendaBrlCompact(data.kpis.valorMedio)}
                </p>
              </div>
            </article>
          </div>

          <p className="wr-emendas-cmp__disclaimer">{data.disclaimer}</p>

          <div className="wr-emendas-cmp__body">
            <section className="wr-emendas-cmp__ranking" aria-label="Ranking de deputados">
              <header className="wr-emendas-cmp__section-head">
                <div className="wr-emendas-cmp__section-head-main">
                  <h4>Ranking — bancada PI</h4>
                  <span>{rankingOrdenado.length} deputados</span>
                </div>
                <div
                  className="wr-emendas-cmp__sort"
                  role="tablist"
                  aria-label="Ordenar ranking por"
                >
                  {ordenacaoOpcoes.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      role="tab"
                      aria-selected={ordenacao === opt.id}
                      className={cn(
                        'wr-emendas-cmp__sort-btn',
                        ordenacao === opt.id && 'wr-emendas-cmp__sort-btn--on',
                      )}
                      onClick={() => setOrdenacao(opt.id)}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
              </header>
              <div className="wr-emendas-cmp__list">
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

            <aside className="wr-emendas-cmp__detail" aria-label="Detalhe do parlamentar">
              {selected ? (
                <>
                  <div className="wr-emendas-cmp__detail-hero">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={selected.foto} alt="" width={64} height={64} />
                    <div>
                      <p className="wr-emendas-cmp__detail-rank">#{selected.rank}</p>
                      <h4>{selected.nome}</h4>
                      <p>{selected.partido} · PI</p>
                    </div>
                  </div>
                  <dl className="wr-emendas-cmp__detail-stats">
                    {(selected.valorIndicado ?? 0) > 0 ? (
                      <div>
                        <dt>Indicado</dt>
                        <dd className="tabular-nums">
                          {formatEmendaBrl(selected.valorIndicado ?? 0)}
                        </dd>
                      </div>
                    ) : null}
                    <div>
                      <dt>Pago</dt>
                      <dd className="tabular-nums">{formatEmendaBrl(selected.valorPago)}</dd>
                    </div>
                    <div>
                      <dt>Empenhado</dt>
                      <dd className="tabular-nums">{formatEmendaBrl(selected.valorEmpenhado)}</dd>
                    </div>
                    <div>
                      <dt>Pix</dt>
                      <dd className="tabular-nums">{formatEmendaBrl(selected.valorPix)}</dd>
                    </div>
                    <div>
                      <dt>Projeto</dt>
                      <dd className="tabular-nums">{formatEmendaBrl(selected.valorProjeto)}</dd>
                    </div>
                  </dl>
                  <div className="wr-emendas-cmp__munis">
                    <header>
                      <MapPin size={14} strokeWidth={2.2} aria-hidden />
                      <span>Top municípios (nomeados)</span>
                    </header>
                    {selected.municipiosTop.length === 0 ? (
                      <p className="wr-emendas-cmp__empty">
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
                <p className="wr-emendas-cmp__empty">Selecione um deputado no ranking.</p>
              )}
            </aside>
          </div>

          <footer className="wr-emendas-cmp__foot">
            <span>
              Fonte:{' '}
              <a href={data.fonteUrl} target="_blank" rel="noreferrer">
                Portal da Transparência
                <ExternalLink className="inline h-3 w-3" strokeWidth={1.5} aria-hidden />
              </a>
              {' · '}
              Elenco:{' '}
              <a
                href="https://dadosabertos.camara.leg.br"
                target="_blank"
                rel="noreferrer"
              >
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
