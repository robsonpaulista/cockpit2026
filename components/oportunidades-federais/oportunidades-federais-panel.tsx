'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { AlertTriangle, ExternalLink, Info, Loader2, RefreshCw } from 'lucide-react'
import {
  AREA_LABELS,
  linkTransferegovConsultaProgramas,
  linkTransferegovDetalhePrograma,
  rotuloExpiracao,
  urgenciaExpiracao,
  type AreaOportunidade,
  type OportunidadeFederal,
} from '@/lib/oportunidades-federais'
import {
  classificarNaturezaArticulacao,
  rotuloNaturezaArticulacao,
  topMunicipiosParaPrograma,
  type AlertaPrazoOportunidade,
  type BaseCruzamento,
  type NaturezaArticulacao,
} from '@/lib/services/oportunidades-federais-cruzamento'
import {
  fetchOportunidadesFederais,
  sincronizarOportunidadesFederais,
} from '@/lib/services/oportunidades-federais-client'
import { cn, formatDateShort } from '@/lib/utils'
import {
  TseBusca,
  TseCarregando,
  TseErro,
  TseFilterBar,
  TsePage,
  TsePillSelect,
  TseSegmentado,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseCardClass,
  tseTabela,
} from '@/components/tse/tse-ui'

type FiltroPrazo = 'todos' | 'muito_prox' | 'prox' | 'distante'
type FiltroNatureza = 'todas' | NaturezaArticulacao

const OPCOES_PRAZO: { id: FiltroPrazo; label: string }[] = [
  { id: 'todos', label: 'Todos os prazos' },
  { id: 'muito_prox', label: 'Muito próximo' },
  { id: 'prox', label: 'Próximo' },
  { id: 'distante', label: 'Mais longo' },
]

const EXP_POR_FILTRO: Record<Exclude<FiltroPrazo, 'todos'>, string> = {
  muito_prox: 'EXPIRACAO_PROG_MUITO_PROX',
  prox: 'EXPIRACAO_PROG_PROX',
  distante: 'EXPIRACAO_PROG_DISTANTE',
}

function formatarData(iso: string | null | undefined): string {
  if (!iso) return '—'
  return formatDateShort(iso) || iso
}

function formatarVotos(n: number): string {
  return n.toLocaleString('pt-BR')
}

function badgePrazo(exp: string | null | undefined): string {
  if (exp === 'EXPIRACAO_PROG_MUITO_PROX') {
    return 'bg-[var(--tse-yellow-soft)] text-[var(--tse-text)] ring-1 ring-[var(--tse-yellow)]'
  }
  if (exp === 'EXPIRACAO_PROG_PROX') return 'bg-[var(--tse-bar)] text-[var(--tse-text)]'
  return 'bg-white text-[var(--tse-muted)] ring-1 ring-[#EEEEEE]'
}

function aplicarResposta(
  res: Awaited<ReturnType<typeof fetchOportunidadesFederais>>,
  setters: {
    setItens: (v: OportunidadeFederal[]) => void
    setOrigem: (v: 'db' | 'live') => void
    setAviso: (v: string | null) => void
    setExcluidosForaPi: (v: number) => void
    setFonteAtualizacao: (v: string | null) => void
    setBase: (v: BaseCruzamento | null) => void
    setAlertas: (v: AlertaPrazoOportunidade[]) => void
  },
) {
  setters.setItens(res.itens)
  setters.setOrigem(res.origem)
  setters.setAviso(res.aviso ?? null)
  setters.setExcluidosForaPi(res.excluidosForaPi ?? 0)
  setters.setFonteAtualizacao(res.sync?.last_source_update ?? res.sync?.last_sync_at ?? null)
  setters.setBase(res.base ?? null)
  setters.setAlertas(res.alertas ?? [])
}

export function OportunidadesFederaisPanel() {
  const [itens, setItens] = useState<OportunidadeFederal[]>([])
  const [base, setBase] = useState<BaseCruzamento | null>(null)
  const [alertas, setAlertas] = useState<AlertaPrazoOportunidade[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [sincronizando, setSincronizando] = useState<boolean>(false)
  const [erro, setErro] = useState<string | null>(null)
  const [aviso, setAviso] = useState<string | null>(null)
  const [origem, setOrigem] = useState<'db' | 'live'>('live')
  const [fonteAtualizacao, setFonteAtualizacao] = useState<string | null>(null)
  const [excluidosForaPi, setExcluidosForaPi] = useState<number>(0)
  const [busca, setBusca] = useState<string>('')
  const [area, setArea] = useState<string>('todas')
  const [orgao, setOrgao] = useState<string>('todos')
  const [natureza, setNatureza] = useState<FiltroNatureza>('todas')
  const [prazo, setPrazo] = useState<FiltroPrazo>('todos')
  const [soComLideranca, setSoComLideranca] = useState<boolean>(true)
  const [selecionado, setSelecionado] = useState<OportunidadeFederal | null>(null)

  const setters = useMemo(
    () => ({
      setItens,
      setOrigem,
      setAviso,
      setExcluidosForaPi,
      setFonteAtualizacao,
      setBase,
      setAlertas,
    }),
    [],
  )

  const carregar = useCallback(async () => {
    setLoading(true)
    setErro(null)
    try {
      aplicarResposta(await fetchOportunidadesFederais(), setters)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar')
      setItens([])
      setExcluidosForaPi(0)
      setBase(null)
      setAlertas([])
    } finally {
      setLoading(false)
    }
  }, [setters])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const sincronizar = async () => {
    setSincronizando(true)
    setErro(null)
    try {
      aplicarResposta(await sincronizarOportunidadesFederais(), setters)
    } catch (e: unknown) {
      setErro(e instanceof Error ? e.message : 'Erro ao sincronizar')
    } finally {
      setSincronizando(false)
    }
  }

  const orgaos = useMemo(() => {
    const set = new Set<string>()
    for (const i of itens) if (i.orgaoSuperior) set.add(i.orgaoSuperior)
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [itens])

  const areasPresentes = useMemo(() => {
    const set = new Set<string>()
    for (const i of itens) set.add(i.area)
    return [...set].sort()
  }, [itens])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    return itens
      .filter((i) => {
        if (area !== 'todas' && i.area !== area) return false
        if (orgao !== 'todos' && i.orgaoSuperior !== orgao) return false
        if (prazo !== 'todos' && i.expiracaoProp !== EXP_POR_FILTRO[prazo]) return false
        if (natureza !== 'todas' && classificarNaturezaArticulacao(i.naturezaJuridica) !== natureza) {
          return false
        }
        if (!q) return true
        const blob = [i.nome, i.descricao, i.orgaoSuperior, i.orgaoExecutor, i.codPrograma]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return blob.includes(q)
      })
      .sort(
        (a, b) =>
          urgenciaExpiracao(a.expiracaoProp) - urgenciaExpiracao(b.expiracaoProp) ||
          (a.dtFimRecebProp ?? '').localeCompare(b.dtFimRecebProp ?? ''),
      )
  }, [itens, busca, area, orgao, prazo, natureza])

  const resumo = useMemo(() => {
    const muito = itens.filter((i) => i.expiracaoProp === 'EXPIRACAO_PROG_MUITO_PROX').length
    const prox = itens.filter((i) => i.expiracaoProp === 'EXPIRACAO_PROG_PROX').length
    const dist = itens.filter((i) => i.expiracaoProp === 'EXPIRACAO_PROG_DISTANTE').length
    return { muito, prox, dist, total: itens.length }
  }, [itens])

  const topMunicipios = useMemo(() => {
    if (!base) return []
    return topMunicipiosParaPrograma(base, { soComLideranca, limite: 12 })
  }, [base, soComLideranca])

  const hrefDetalheSelecionado = selecionado
    ? linkTransferegovDetalhePrograma(selecionado.idPrograma)
    : null

  const naturezaSelecionada = selecionado
    ? classificarNaturezaArticulacao(selecionado.naturezaJuridica)
    : null

  return (
    <TsePage>
      <TseFilterBar>
        <TseBusca
          value={busca}
          onChange={setBusca}
          placeholder="Buscar programa, órgão ou código"
        />
        <TsePillSelect rotulo="Área" value={area} onChange={(e) => setArea(e.target.value)}>
          <option value="todas">Todas</option>
          {areasPresentes.map((a) => (
            <option key={a} value={a}>
              {AREA_LABELS[a as AreaOportunidade] ?? a}
            </option>
          ))}
        </TsePillSelect>
        <TsePillSelect rotulo="Órgão" value={orgao} onChange={(e) => setOrgao(e.target.value)}>
          <option value="todos">Todos</option>
          {orgaos.map((o) => (
            <option key={o} value={o}>
              {o}
            </option>
          ))}
        </TsePillSelect>
        <TsePillSelect
          rotulo="Proponente"
          value={natureza}
          onChange={(e) => setNatureza(e.target.value as FiltroNatureza)}
        >
          <option value="todas">Todos</option>
          <option value="prefeitura">Prefeituras</option>
          <option value="osc">OSC / sociedade civil</option>
          <option value="estado">Estado</option>
          <option value="outro">Outros</option>
        </TsePillSelect>
        <TseSegmentado opcoes={OPCOES_PRAZO} valor={prazo} onChange={setPrazo} />
        <button
          type="button"
          onClick={() => void sincronizar()}
          disabled={sincronizando || loading}
          className={cn(tseBotaoCinzaClass, 'disabled:opacity-50')}
        >
          {sincronizando ? (
            <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} />
          ) : (
            <RefreshCw className={tseBotaoIconeClass} />
          )}
          {sincronizando ? 'Sincronizando…' : 'Sincronizar Transferegov'}
        </button>
      </TseFilterBar>

      <section className={`${tseCardClass} mt-4`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-[18px] font-bold">Oportunidades federais</h1>
            <p className="mt-1 max-w-3xl text-[13px] text-[var(--tse-muted)]">
              Programas discricionários abertos no PI, cruzados com a{' '}
              <strong className="font-semibold text-[var(--tse-text)]">base territorial</strong> do
              gabinete (lideranças e expectativa) e com municípios que já têm emenda.
            </p>
          </div>
          <div className="text-right text-[12px] text-[var(--tse-muted)]">
            <div>Fonte: Transferegov · {origem === 'db' ? 'cache local' : 'ao vivo'}</div>
            {fonteAtualizacao ? (
              <div>Atualização da base: {formatDateShort(fonteAtualizacao) || fonteAtualizacao}</div>
            ) : null}
            {excluidosForaPi > 0 ? (
              <div>
                {excluidosForaPi}{' '}
                {excluidosForaPi === 1
                  ? 'programa oculto (fora do PI)'
                  : 'programas ocultos (fora do PI)'}
              </div>
            ) : null}
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4 xl:grid-cols-7">
          <div className="rounded-lg bg-[var(--tse-bar)] px-3 py-2">
            <div className="text-[11px] text-[var(--tse-muted)]">Programas abertos</div>
            <div className="text-[22px] font-black tabular-nums">{resumo.total}</div>
          </div>
          <div className="rounded-lg bg-[var(--tse-yellow-soft)] px-3 py-2 ring-1 ring-[var(--tse-yellow)]">
            <div className="text-[11px] text-[var(--tse-muted)]">Prazo muito próximo</div>
            <div className="text-[22px] font-black tabular-nums">{resumo.muito}</div>
          </div>
          <div className="rounded-lg bg-[var(--tse-bar)] px-3 py-2">
            <div className="text-[11px] text-[var(--tse-muted)]">Prazo próximo</div>
            <div className="text-[22px] font-black tabular-nums">{resumo.prox}</div>
          </div>
          <div className="rounded-lg bg-[var(--tse-bar)] px-3 py-2">
            <div className="text-[11px] text-[var(--tse-muted)]">Municípios na base</div>
            <div className="text-[22px] font-black tabular-nums">{base?.total ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-[var(--tse-bar)] px-3 py-2">
            <div className="text-[11px] text-[var(--tse-muted)]">Com liderança</div>
            <div className="text-[22px] font-black tabular-nums">{base?.comLideranca ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-[var(--tse-bar)] px-3 py-2">
            <div className="text-[11px] text-[var(--tse-muted)]">Já têm emenda</div>
            <div className="text-[22px] font-black tabular-nums">{base?.comEmenda ?? '—'}</div>
          </div>
          <div className="rounded-lg bg-[var(--tse-bar)] px-3 py-2">
            <div className="text-[11px] text-[var(--tse-muted)]">Expectativa (legado)</div>
            <div className="text-[18px] font-black tabular-nums">
              {base ? formatarVotos(base.expectativaTotal) : '—'}
            </div>
          </div>
        </div>

        {alertas.length > 0 ? (
          <div className="mt-3 rounded-lg border-2 border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] px-3 py-2.5">
            <div className="flex items-center gap-2 text-[13px] font-bold">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {alertas.length}{' '}
              {alertas.length === 1 ? 'programa com prazo crítico' : 'programas com prazo crítico'}
              {base && base.comLideranca > 0
                ? ` · priorize articulação em ${base.comLideranca} municípios com liderança`
                : null}
            </div>
            <ul className="mt-2 space-y-1 text-[12px]">
              {alertas.slice(0, 5).map((a) => (
                <li key={a.idPrograma}>
                  <button
                    type="button"
                    className="text-left font-semibold hover:underline"
                    onClick={() => {
                      const item = itens.find((i) => i.idPrograma === a.idPrograma)
                      if (item) setSelecionado(item)
                    }}
                  >
                    {a.nome}
                  </button>
                  <span className="text-[var(--tse-muted)]">
                    {' '}
                    · fim {formatarData(a.dtFimRecebProp)}
                    {a.diasRestantes != null
                      ? a.diasRestantes < 0
                        ? ` (${Math.abs(a.diasRestantes)}d atrás)`
                        : ` (${a.diasRestantes}d)`
                      : ''}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {aviso ? (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-[var(--tse-yellow-soft)] px-3 py-2 text-[12px] text-[var(--tse-text)]">
            <Info className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{aviso}</span>
          </p>
        ) : null}
      </section>

      {loading ? <TseCarregando texto="Carregando oportunidades e base territorial…" /> : null}
      {erro ? <TseErro>{erro}</TseErro> : null}

      {!loading && !erro && filtrados.length === 0 ? (
        <TseVazio>Nenhum programa aberto com os filtros atuais.</TseVazio>
      ) : null}

      {!loading && filtrados.length > 0 ? (
        <div className="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(300px,0.85fr)]">
          <div className={tseTabela.container}>
            <table className="w-full min-w-[760px] text-[12px]" data-tse-tabela>
              <thead>
                <tr>
                  <th className={tseTabela.th}>Programa</th>
                  <th className={tseTabela.th}>Órgão</th>
                  <th className={tseTabela.th}>Proponente</th>
                  <th className={tseTabela.th}>Área</th>
                  <th className={tseTabela.th}>Prazo</th>
                  <th className={cn(tseTabela.th, 'text-right')}>Fim</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((i) => {
                  const ativo = selecionado?.idPrograma === i.idPrograma
                  const nat = classificarNaturezaArticulacao(i.naturezaJuridica)
                  return (
                    <tr
                      key={`${i.idPrograma}-${i.uf}`}
                      className={cn(tseTabela.trClicavel, ativo && 'bg-[var(--tse-yellow-soft)]')}
                      onClick={() => setSelecionado(i)}
                    >
                      <td className={cn(tseTabela.td, 'max-w-[260px]')}>
                        <div className="line-clamp-2 font-semibold text-[var(--tse-text)]">{i.nome}</div>
                        <div className="mt-0.5 text-[11px] text-[var(--tse-muted)]">
                          {i.codPrograma ?? `ID ${i.idPrograma}`} · {i.modalidade ?? '—'}
                        </div>
                      </td>
                      <td className={cn(tseTabela.td, 'max-w-[160px]')}>
                        <span className="line-clamp-2">{i.orgaoSuperior ?? '—'}</span>
                      </td>
                      <td className={tseTabela.td}>
                        <span className="text-[11px]">{rotuloNaturezaArticulacao(nat)}</span>
                      </td>
                      <td className={tseTabela.td}>
                        {AREA_LABELS[i.area as AreaOportunidade] ?? i.area}
                      </td>
                      <td className={tseTabela.td}>
                        <span
                          className={cn(
                            'inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold',
                            badgePrazo(i.expiracaoProp),
                          )}
                        >
                          {rotuloExpiracao(i.expiracaoProp)}
                        </span>
                      </td>
                      <td className={cn(tseTabela.td, 'text-right font-semibold tabular-nums')}>
                        {formatarData(i.dtFimRecebProp)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <aside className={tseCardClass}>
            {selecionado ? (
              <div className="space-y-3 text-[13px]">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-[var(--tse-muted)]">
                    Detalhe · articulação
                  </div>
                  <h2 className="mt-1 text-[15px] font-bold leading-snug">{selecionado.nome}</h2>
                </div>
                <dl className="space-y-2 text-[var(--tse-muted)]">
                  <div className="flex justify-between gap-3">
                    <dt>Órgão</dt>
                    <dd className="text-right font-semibold text-[var(--tse-text)]">
                      {selecionado.orgaoSuperior ?? '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Proponente</dt>
                    <dd className="text-right text-[var(--tse-text)]">
                      {naturezaSelecionada
                        ? rotuloNaturezaArticulacao(naturezaSelecionada)
                        : '—'}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Código</dt>
                    <dd className="tabular-nums text-[var(--tse-text)]">
                      {selecionado.codPrograma ?? selecionado.idPrograma}
                    </dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt>Propostas</dt>
                    <dd className="text-right text-[var(--tse-text)]">
                      {formatarData(selecionado.dtIniRecebProp)} →{' '}
                      {formatarData(selecionado.dtFimRecebProp)}
                    </dd>
                  </div>
                </dl>

                {selecionado.descricao ? (
                  <p className="rounded-lg bg-[var(--tse-bar)] p-3 text-[12px] leading-relaxed text-[var(--tse-text)]">
                    {selecionado.descricao}
                  </p>
                ) : null}

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-[11px] font-semibold uppercase text-[var(--tse-muted)]">
                      Municípios da base para articular
                    </div>
                    <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[var(--tse-muted)]">
                      <input
                        type="checkbox"
                        className="h-3.5 w-3.5 accent-[var(--tse-olive)]"
                        checked={soComLideranca}
                        onChange={(e) => setSoComLideranca(e.target.checked)}
                      />
                      Só com liderança
                    </label>
                  </div>
                  <p className="mt-1 text-[11px] text-[var(--tse-muted)]">
                    O programa é estadual no Transferegov; a lista abaixo prioriza onde o gabinete
                    já tem presença
                    {naturezaSelecionada === 'prefeitura'
                      ? ' — foque prefeitos/secretarias'
                      : naturezaSelecionada === 'osc'
                        ? ' — foque OSCs parceiras no município'
                        : ''}
                    .
                  </p>
                  {topMunicipios.length === 0 ? (
                    <p className="mt-2 text-[12px] text-[var(--tse-muted)]">
                      Base territorial sem municípios{soComLideranca ? ' com liderança' : ''}.
                    </p>
                  ) : (
                    <ul className="mt-2 max-h-[280px] space-y-1 overflow-y-auto pr-1">
                      {topMunicipios.map((m) => (
                        <li
                          key={m.chave}
                          className="flex items-baseline justify-between gap-2 rounded-md bg-[var(--tse-bar)] px-2 py-1.5 text-[12px]"
                        >
                          <span className="min-w-0">
                            <span className="font-semibold text-[var(--tse-text)]">{m.nome}</span>
                            <span className="mt-0.5 block text-[11px] text-[var(--tse-muted)]">
                              {m.liderancas}{' '}
                              {m.liderancas === 1 ? 'liderança' : 'lideranças'}
                              {m.temEmenda ? ' · já tem emenda' : ''}
                            </span>
                          </span>
                          <span className="shrink-0 tabular-nums text-[var(--tse-muted)]">
                            {formatarVotos(m.expectativaLegado)}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  {hrefDetalheSelecionado ? (
                    <a
                      href={hrefDetalheSelecionado}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[var(--tse-olive)] hover:underline"
                    >
                      Abrir detalhe do programa no Transferegov
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                  <a
                    href={linkTransferegovConsultaProgramas()}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-[var(--tse-muted)] hover:text-[var(--tse-olive)] hover:underline"
                  >
                    Consultar programas (Acesso Livre)
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  {selecionado.codPrograma ? (
                    <p className="text-[11px] text-[var(--tse-muted)]">
                      Se pedir login, busque pelo código{' '}
                      <span className="font-bold tabular-nums text-[var(--tse-text)]">
                        {selecionado.codPrograma}
                      </span>
                      .
                    </p>
                  ) : null}
                </div>
              </div>
            ) : (
              <p className="text-[13px] text-[var(--tse-muted)]">
                Selecione um programa para ver com quem articular na base territorial.
              </p>
            )}
          </aside>
        </div>
      ) : null}
    </TsePage>
  )
}
