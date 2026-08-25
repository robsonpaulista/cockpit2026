'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  ExternalLink,
  FileText,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { IconFileTypePdf } from '@tabler/icons-react'
import { IptMunicipioSelect } from '@/components/ipt/ipt-municipio-select'
import { useWarRoomCidade } from '@/components/war-room/war-room-cidade-context'
import type { EmendaRegistro } from '@/lib/emendas-filtro'
import {
  demandasToObrasMapa,
  type CampoDemandaObraRow,
} from '@/lib/campo-demandas-obras'
import { valorExibidoMapaObra, type ObraMapaRow } from '@/lib/obras-mapa'
import { exportRelatorioExecutivoPdf } from '@/lib/war-room/relatorio-executivo-export'
import type { RelatorioAcervoSalvo } from '@/lib/war-room/relatorio-executivo-acervo'
import {
  buildRelatorioExecutivoMunicipio,
  formatRelatorioBrl,
  formatRelatorioBrlCompact,
  type RelatorioAcervoItem,
  type RelatorioExecutivoMunicipio,
} from '@/lib/war-room/relatorio-executivo-municipio'
import { cn } from '@/lib/utils'

type BlocoId = 'capa' | 'emendas' | 'obras' | 'acervo'

type PlanoDriveRow = {
  obra_id: string
  drive_web_view_link?: string | null
  drive_file_name?: string | null
}

function StatusPill({
  status,
  tone,
}: {
  status: string
  tone?:
    | 'pago'
    | 'empenhado'
    | 'indicado'
    | 'obra'
    | 'execucao'
    | 'aguardando'
    | 'aguardando-exec'
    | 'neutral'
}) {
  return (
    <span
      className={cn(
        'wr-relatorio-exec__pill',
        tone === 'pago' && 'wr-relatorio-exec__pill--pago',
        tone === 'empenhado' && 'wr-relatorio-exec__pill--empenhado',
        tone === 'indicado' && 'wr-relatorio-exec__pill--indicado',
        tone === 'obra' && 'wr-relatorio-exec__pill--obra',
        tone === 'execucao' && 'wr-relatorio-exec__pill--execucao',
        tone === 'aguardando' && 'wr-relatorio-exec__pill--aguardando',
        tone === 'aguardando-exec' && 'wr-relatorio-exec__pill--aguardando-exec',
      )}
    >
      {status}
    </span>
  )
}

type StatusTone = NonNullable<Parameters<typeof StatusPill>[0]['tone']>

function toneStatusRelatorio(status: string): StatusTone {
  const s = status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  if (s.includes('PAGO') || s.includes('EXECUTAD') || s.includes('CONCLUID')) {
    return 'pago'
  }
  if (s.includes('EMPENHAD')) return 'empenhado'
  if (s.includes('INDICAD')) return 'indicado'
  if (s.includes('AGUARD') && s.includes('EXEC')) return 'aguardando-exec'
  if (s.includes('AGUARD') || s.includes('A INICIAR') || s.includes('PENDENTE')) {
    return 'aguardando'
  }
  if (s.includes('EXECU') || s.includes('ANDAMENTO')) return 'execucao'
  return 'neutral'
}

/** Copiloto · Relatório Executivo municipal (modelo Teresina). */
export function WarRoomCopilotoRelatorioView() {
  const { municipio, setMunicipio } = useWarRoomCidade()
  const [bloco, setBloco] = useState<BlocoId>('capa')
  const [emendasAll, setEmendasAll] = useState<EmendaRegistro[]>([])
  const [obrasAll, setObrasAll] = useState<ObraMapaRow[]>([])
  const [planosDrive, setPlanosDrive] = useState<PlanoDriveRow[]>([])
  const [acervoSalvo, setAcervoSalvo] = useState<RelatorioAcervoSalvo[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [exportingPdf, setExportingPdf] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadAcervo = useCallback(async (muni: string) => {
    if (!muni.trim()) {
      setAcervoSalvo([])
      return
    }
    try {
      const res = await fetch(
        `/api/war-room/relatorio-executivo/acervo?municipio=${encodeURIComponent(muni)}`,
        { cache: 'no-store' },
      )
      const json = (await res.json().catch(() => null)) as {
        items?: RelatorioAcervoSalvo[]
      } | null
      setAcervoSalvo(Array.isArray(json?.items) ? json.items : [])
    } catch {
      setAcervoSalvo([])
    }
  }, [])

  const load = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (silent) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const [emRes, demRes, driveRes] = await Promise.all([
        fetch('/api/emendas', { cache: 'no-store' }),
        fetch('/api/campo/demands', { cache: 'no-store' }),
        fetch('/api/campo/obras-mapa/plano-drive', { cache: 'no-store' }),
      ])

      if (!emRes.ok) throw new Error('Falha ao carregar emendas')
      const emJson = (await emRes.json()) as { emendas?: EmendaRegistro[] }
      setEmendasAll(Array.isArray(emJson.emendas) ? emJson.emendas : [])

      if (!demRes.ok) throw new Error('Falha ao carregar obras')
      const demJson = await demRes.json().catch(() => null)
      setObrasAll(
        demandasToObrasMapa(
          Array.isArray(demJson) ? (demJson as CampoDemandaObraRow[]) : [],
        ),
      )

      if (driveRes.ok) {
        const driveJson = (await driveRes.json()) as { links?: PlanoDriveRow[] }
        setPlanosDrive(Array.isArray(driveJson.links) ? driveJson.links : [])
      } else {
        setPlanosDrive([])
      }

      if (municipio) await loadAcervo(municipio)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao montar o relatório')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [loadAcervo, municipio])

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!municipio) setMunicipio('Teresina')
  }, [municipio, setMunicipio])

  useEffect(() => {
    if (municipio) void loadAcervo(municipio)
  }, [loadAcervo, municipio])

  const relatorio: RelatorioExecutivoMunicipio | null = useMemo(() => {
    if (!municipio) return null
    return buildRelatorioExecutivoMunicipio({
      municipio,
      emendas: emendasAll,
      obras: obrasAll,
      planosDrive,
      acervoSalvo: acervoSalvo.map((s) => ({
        id: s.id,
        obra_id: s.obra_id,
        titulo: s.titulo,
        status: s.status,
        url: s.url,
        label: s.label,
      })),
    })
  }, [acervoSalvo, emendasAll, municipio, obrasAll, planosDrive])

  const cidade = municipio ?? 'Município'

  const exportarPdf = () => {
    if (!relatorio || exportingPdf) return
    setExportingPdf(true)
    try {
      exportRelatorioExecutivoPdf(relatorio)
    } finally {
      setExportingPdf(false)
    }
  }

  return (
    <div className="wr-relatorio-exec wr-copiloto-reveal">
      <header
        className="wr-relatorio-exec__toolbar wr-copiloto-reveal__card"
        style={{ ['--wr-reveal-i' as string]: 0 }}
      >
        <div className="wr-relatorio-exec__toolbar-meta">
          <h2 className="wr-relatorio-exec__title">Relatório</h2>
          <p className="wr-relatorio-exec__hint">
            Executivo municipal · A4 paisagem · emendas e obras separados (sem dupla contagem)
          </p>
        </div>
        <div className="wr-relatorio-exec__toolbar-actions">
          <div className="wr-relatorio-exec__muni">
            <IptMunicipioSelect value={municipio} onChange={setMunicipio} />
          </div>
          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            disabled={!relatorio || loading || exportingPdf}
            onClick={exportarPdf}
            aria-label="Exportar PDF completo"
            title="PDF completo"
          >
            {exportingPdf ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <IconFileTypePdf className="h-3.5 w-3.5" stroke={1.5} aria-hidden />
            )}
            PDF
          </button>
          <button
            type="button"
            className="wr-copiloto-redes__ghost-btn"
            disabled={loading || refreshing}
            onClick={() => void load({ silent: true })}
          >
            {refreshing ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
            )}
            Atualizar
          </button>
        </div>
      </header>

      <nav className="wr-relatorio-exec__blocos" aria-label="Blocos do relatório">
        {(
          [
            { id: 'capa' as const, label: 'Capa' },
            {
              id: 'emendas' as const,
              label: `Bloco 01 · Emendas${relatorio ? ` (${relatorio.emendasCount})` : ''}`,
            },
            {
              id: 'obras' as const,
              label: `Bloco 02 · Obras${relatorio ? ` (${relatorio.obrasCount})` : ''}`,
            },
            {
              id: 'acervo' as const,
              label: 'Bloco 03 · Acervo',
            },
          ] as const
        ).map((b) => (
          <button
            key={b.id}
            type="button"
            className={cn(
              'wr-copiloto-redes__period-tab',
              bloco === b.id && 'wr-copiloto-redes__period-tab--active',
            )}
            aria-pressed={bloco === b.id}
            onClick={() => setBloco(b.id)}
          >
            {b.label}
          </button>
        ))}
      </nav>

      <div className="wr-relatorio-exec__body wr-copiloto-reveal__board">
        {loading && !relatorio ? (
          <div className="wr-relatorio-exec__state">
            <Loader2
              className="h-5 w-5 animate-spin text-[var(--wr-brand,#F2D06B)]"
              strokeWidth={1.5}
            />
            <span>Montando relatório…</span>
          </div>
        ) : error && !relatorio ? (
          <div className="wr-relatorio-exec__state">
            <p>{error}</p>
            <button
              type="button"
              className="wr-copiloto-view__retry"
              onClick={() => void load()}
            >
              Tentar de novo
            </button>
          </div>
        ) : !relatorio ? (
          <div className="wr-relatorio-exec__state">
            <FileText className="h-5 w-5 opacity-50" strokeWidth={1.5} />
            <span>Selecione um município para montar o relatório.</span>
          </div>
        ) : bloco === 'capa' ? (
          <CapaSection cidade={cidade} data={relatorio} onGo={setBloco} />
        ) : bloco === 'emendas' ? (
          <EmendasSection cidade={cidade} data={relatorio} />
        ) : bloco === 'obras' ? (
          <ObrasSection cidade={cidade} data={relatorio} />
        ) : (
          <AcervoSection
            cidade={cidade}
            data={relatorio}
            onAcervoChanged={() => void loadAcervo(cidade)}
          />
        )}
      </div>
    </div>
  )
}

function CapaSection({
  cidade,
  data,
  onGo,
}: {
  cidade: string
  data: RelatorioExecutivoMunicipio
  onGo: (b: BlocoId) => void
}) {
  return (
    <article className="wr-relatorio-exec__sheet">
      <header className="wr-relatorio-exec__sheet-head">
        <p className="wr-relatorio-exec__eyebrow">Cockpit 2026</p>
        <h3 className="wr-relatorio-exec__sheet-title">
          {cidade.toUpperCase()} <span>|</span> RELATÓRIO EXECUTIVO
        </h3>
        <p className="wr-relatorio-exec__sheet-sub">
          Emendas federais e obras/ações — valores apresentados separadamente para
          evitar dupla contagem
        </p>
      </header>

      <div className="wr-relatorio-exec__hero-kpis">
        <div className="wr-relatorio-exec__hero-kpi">
          <p className="wr-relatorio-exec__hero-value">
            {formatRelatorioBrl(data.emendasTotalIndicado)}
          </p>
          <p className="wr-relatorio-exec__hero-label">EMENDAS FEDERAIS</p>
          <p className="wr-relatorio-exec__hero-hint">
            Valor indicado · {data.emendasCount} registro
            {data.emendasCount === 1 ? '' : 's'}
          </p>
        </div>
        <div className="wr-relatorio-exec__hero-kpi">
          <p className="wr-relatorio-exec__hero-value">
            {formatRelatorioBrl(data.obrasValorMapeado)}
          </p>
          <p className="wr-relatorio-exec__hero-label">OBRAS E AÇÕES</p>
          <p className="wr-relatorio-exec__hero-hint">
            Somente registros com valor informado · {data.obrasCount} registro
            {data.obrasCount === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      <section className="wr-relatorio-exec__section">
        <h4 className="wr-relatorio-exec__section-title">
          POR ANO › STATUS (EMENDAS E OBRAS SEPARADAS)
        </h4>
        {data.porAno.length === 0 ? (
          <p className="wr-relatorio-exec__empty">Sem registros no município.</p>
        ) : (
          <div className="wr-relatorio-exec__anos">
            {data.porAno.map((ano) => (
              <article key={String(ano.ano)} className="wr-relatorio-exec__ano-card">
                <header className="wr-relatorio-exec__ano-head">
                  <h5 className="wr-relatorio-exec__ano-title">{ano.ano}</h5>
                </header>
                <div className="wr-relatorio-exec__ano-body">
                  <div className="wr-relatorio-exec__ano-block">
                    <div className="wr-relatorio-exec__ano-block-head">
                      <span>EMENDAS FEDERAIS</span>
                      <strong className="tabular-nums">
                        {ano.emendasSemRegistro
                          ? 'SEM REGISTROS'
                          : formatRelatorioBrl(ano.emendasTotal)}
                      </strong>
                    </div>
                    {ano.emendasSemRegistro ? (
                      <p className="wr-relatorio-exec__muted">Sem registros no período.</p>
                    ) : (
                      <ul className="wr-relatorio-exec__status-list">
                        {ano.emendasPorStatus.map((s) => (
                          <li key={s.status}>
                            <StatusPill
                              status={s.status}
                              tone={toneStatusRelatorio(s.status)}
                            />
                            <span className="wr-relatorio-exec__status-valor tabular-nums">
                              {formatRelatorioBrl(s.valor)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  <div className="wr-relatorio-exec__ano-block">
                    <div className="wr-relatorio-exec__ano-block-head">
                      <span>OBRAS E AÇÕES</span>
                      <strong className="tabular-nums">
                        {ano.obrasPorStatus.length === 0
                          ? 'SEM REGISTROS'
                          : ano.obrasSemValor && ano.obrasTotal === 0
                            ? 'SEM VALOR'
                            : formatRelatorioBrl(ano.obrasTotal)}
                      </strong>
                    </div>
                    {ano.obrasPorStatus.length === 0 ? (
                      <p className="wr-relatorio-exec__muted">Sem registros no período.</p>
                    ) : (
                      <ul className="wr-relatorio-exec__status-list">
                        {ano.obrasPorStatus.map((s) => (
                          <li key={s.status}>
                            <StatusPill
                              status={s.status}
                              tone={toneStatusRelatorio(s.status)}
                            />
                            <span className="wr-relatorio-exec__status-valor tabular-nums">
                              {formatRelatorioBrlCompact(s.valor)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="wr-relatorio-exec__blocos-nav">
        <button type="button" className="wr-relatorio-exec__bloco-card" onClick={() => onGo('emendas')}>
          <span className="wr-relatorio-exec__bloco-id">BLOCO 01</span>
          <span className="wr-relatorio-exec__bloco-name">
            Emendas federais — {data.emendasCount} registro
            {data.emendasCount === 1 ? '' : 's'}
          </span>
        </button>
        <button type="button" className="wr-relatorio-exec__bloco-card" onClick={() => onGo('obras')}>
          <span className="wr-relatorio-exec__bloco-id">BLOCO 02</span>
          <span className="wr-relatorio-exec__bloco-name">
            Obras e ações — {data.obrasCount} registro
            {data.obrasCount === 1 ? '' : 's'}
          </span>
        </button>
        <button type="button" className="wr-relatorio-exec__bloco-card" onClick={() => onGo('acervo')}>
          <span className="wr-relatorio-exec__bloco-id">BLOCO 03</span>
          <span className="wr-relatorio-exec__bloco-name">
            Acervo — {data.acervo.length > 0 ? `${data.acervo.length} item(ns)` : 'a preencher'}
          </span>
        </button>
      </div>

      <p className="wr-relatorio-exec__footnote">
        Emendas e obras não são somadas entre si para evitar dupla contagem de um
        mesmo investimento. {cidade} · Cockpit 2026
      </p>
    </article>
  )
}

function EmendasSection({
  cidade,
  data,
}: {
  cidade: string
  data: RelatorioExecutivoMunicipio
}) {
  return (
    <article className="wr-relatorio-exec__sheet">
      <header className="wr-relatorio-exec__sheet-head">
        <h3 className="wr-relatorio-exec__sheet-title">
          {cidade.toUpperCase()} <span>|</span> EMENDAS FEDERAIS
        </h3>
        <p className="wr-relatorio-exec__sheet-sub">
          {data.emendasCount} registro{data.emendasCount === 1 ? '' : 's'} · Indicado:{' '}
          {formatRelatorioBrl(data.emendasTotais.indicado)}
        </p>
      </header>

      <div className="wr-relatorio-exec__mini-kpis">
        <div>
          <p className="wr-relatorio-exec__mini-value">
            {formatRelatorioBrl(data.emendasTotais.indicado)}
          </p>
          <p className="wr-relatorio-exec__mini-label">INDICADOS</p>
        </div>
        <div>
          <p className="wr-relatorio-exec__mini-value">
            {formatRelatorioBrl(data.emendasTotais.empenhado)}
          </p>
          <p className="wr-relatorio-exec__mini-label">EMPENHADOS</p>
        </div>
        <div>
          <p className="wr-relatorio-exec__mini-value">
            {formatRelatorioBrl(data.emendasTotais.pago)}
          </p>
          <p className="wr-relatorio-exec__mini-label">PAGOS</p>
        </div>
      </div>

      {data.emendas.length === 0 ? (
        <p className="wr-relatorio-exec__empty">Nenhuma emenda neste município.</p>
      ) : (
        <div className="wr-relatorio-exec__table-wrap">
          <table className="wr-relatorio-exec__table">
            <thead>
              <tr>
                <th>ANO</th>
                <th>EMENDA</th>
                <th>OBJETO</th>
                <th className="wr-relatorio-exec__num">INDICADO</th>
                <th className="wr-relatorio-exec__num">EMPENHADO</th>
                <th className="wr-relatorio-exec__num">PAGO</th>
                <th>STATUS</th>
              </tr>
            </thead>
            <tbody>
              {data.emendas.map((row) => (
                <tr key={row.id}>
                  <td>{row.exercicio ?? '—'}</td>
                  <td>{row.emenda}</td>
                  <td>{row.objeto}</td>
                  <td className="wr-relatorio-exec__num tabular-nums">
                    {row.indicado > 0 ? formatRelatorioBrl(row.indicado) : '—'}
                  </td>
                  <td className="wr-relatorio-exec__num tabular-nums">
                    {row.empenhado > 0 ? formatRelatorioBrl(row.empenhado) : '—'}
                  </td>
                  <td className="wr-relatorio-exec__num tabular-nums">
                    {row.pago > 0 ? formatRelatorioBrl(row.pago) : '—'}
                  </td>
                  <td>
                    <StatusPill status={row.status} tone={toneStatusRelatorio(row.status)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.leiturasRapidas.length > 0 ? (
        <section className="wr-relatorio-exec__section">
          <h4 className="wr-relatorio-exec__section-title">
            TERMOS QUE A AGÊNCIA PRECISA SABER
          </h4>
          <div className="wr-relatorio-exec__leituras">
            {data.leiturasRapidas.map((l) => (
              <div key={l.id} className="wr-relatorio-exec__leitura">
                <p className="wr-relatorio-exec__leitura-title">{l.titulo}</p>
                <p className="wr-relatorio-exec__leitura-text">{l.texto}</p>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <p className="wr-relatorio-exec__footnote">Bloco 01 — Emendas Federais</p>
    </article>
  )
}

function ObrasSection({
  cidade,
  data,
}: {
  cidade: string
  data: RelatorioExecutivoMunicipio
}) {
  const k = data.obrasKpis
  return (
    <article className="wr-relatorio-exec__sheet">
      <header className="wr-relatorio-exec__sheet-head">
        <h3 className="wr-relatorio-exec__sheet-title">
          {cidade.toUpperCase()} <span>|</span> OBRAS, ENTREGAS E AÇÕES
        </h3>
        <p className="wr-relatorio-exec__sheet-sub">
          {k.registros} registro{k.registros === 1 ? '' : 's'} · Total informado:{' '}
          {formatRelatorioBrl(k.valorMapeado)}
        </p>
      </header>

      <div className="wr-relatorio-exec__mini-kpis wr-relatorio-exec__mini-kpis--5">
        <div>
          <p className="wr-relatorio-exec__mini-value tabular-nums">{k.registros}</p>
          <p className="wr-relatorio-exec__mini-label">REGISTROS</p>
        </div>
        <div>
          <p className="wr-relatorio-exec__mini-value">
            {formatRelatorioBrl(k.valorMapeado)}
          </p>
          <p className="wr-relatorio-exec__mini-label">VALOR MAPEADO</p>
        </div>
        <div>
          <p className="wr-relatorio-exec__mini-value tabular-nums">{k.acoesExecutadas}</p>
          <p className="wr-relatorio-exec__mini-label">AÇÕES EXECUTADAS</p>
        </div>
        <div>
          <p className="wr-relatorio-exec__mini-value tabular-nums">{k.emExecucao}</p>
          <p className="wr-relatorio-exec__mini-label">EM EXECUÇÃO</p>
        </div>
        <div>
          <p className="wr-relatorio-exec__mini-value tabular-nums">{k.aguardando}</p>
          <p className="wr-relatorio-exec__mini-label">AGUARDANDO</p>
        </div>
      </div>

      {data.obrasPorTipo.length === 0 ? (
        <p className="wr-relatorio-exec__empty">Nenhuma obra/ação neste município.</p>
      ) : (
        <div className="wr-relatorio-exec__tipos">
          {data.obrasPorTipo.map((bloco) => (
            <section key={bloco.tipoKey} className="wr-relatorio-exec__tipo">
              <header className="wr-relatorio-exec__tipo-head">
                <h4>
                  {bloco.tipoLabel.toUpperCase()}{' '}
                  <span>
                    {bloco.count} registro{bloco.count === 1 ? '' : 's'} |{' '}
                    {formatRelatorioBrl(bloco.valor)}
                  </span>
                </h4>
              </header>
              <ul className="wr-relatorio-exec__obra-list">
                {bloco.obras.map((obra) => {
                  const valor = valorExibidoMapaObra(obra)
                  const status = (obra.status ?? 'SEM STATUS').trim().toUpperCase() || 'SEM STATUS'
                  return (
                    <li key={obra.id}>
                      <div className="wr-relatorio-exec__obra-main">
                        <StatusPill status={status} tone={toneStatusRelatorio(status)} />
                        <span className="wr-relatorio-exec__obra-title">
                          {obra.obra?.trim() || obra.tipo?.trim() || 'Sem título'}
                        </span>
                      </div>
                      <span className="wr-relatorio-exec__obra-valor tabular-nums">
                        {valor != null && valor > 0
                          ? formatRelatorioBrl(valor)
                          : 'SEM VALOR'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </section>
          ))}
        </div>
      )}

      <p className="wr-relatorio-exec__footnote">Bloco 02 — Obras, Entregas e Ações</p>
    </article>
  )
}

function AcervoSection({
  cidade,
  data,
  onAcervoChanged,
}: {
  cidade: string
  data: RelatorioExecutivoMunicipio
  onAcervoChanged: () => void
}) {
  const [drafts, setDrafts] = useState<
    Record<string, { url: string; label: string; titulo: string }>
  >({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [novoTitulo, setNovoTitulo] = useState('')
  const [novoUrl, setNovoUrl] = useState('')
  const [novoLabel, setNovoLabel] = useState('')
  const [adding, setAdding] = useState(false)

  useEffect(() => {
    const next: Record<string, { url: string; label: string; titulo: string }> =
      {}
    for (const item of data.acervo) {
      const key = acervoItemKey(item)
      next[key] = {
        url: item.driveUrl ?? '',
        label: item.driveName ?? '',
        titulo: item.titulo,
      }
    }
    setDrafts(next)
    setMsg(null)
  }, [data.acervo, cidade])

  const salvarItem = async (item: RelatorioAcervoItem) => {
    const key = acervoItemKey(item)
    const draft = drafts[key]
    if (!draft) return
    const url = draft.url.trim()
    if (!url) {
      setMsg('Informe a URL do repositório (http:// ou https://).')
      return
    }
    setSavingKey(key)
    setMsg(null)
    try {
      const res = await fetch('/api/war-room/relatorio-executivo/acervo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: item.id,
          municipio: cidade,
          obraId: item.obraId,
          titulo: draft.titulo.trim() || item.titulo,
          status: item.status,
          url,
          label: draft.label.trim() || null,
        }),
      })
      const json = (await res.json().catch(() => null)) as {
        error?: string
        setupRequired?: boolean
      } | null
      if (!res.ok) {
        throw new Error(json?.error ?? 'Falha ao salvar link')
      }
      setMsg('Link salvo.')
      onAcervoChanged()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSavingKey(null)
    }
  }

  const removerItem = async (item: RelatorioAcervoItem) => {
    if (!item.id) return
    setRemovingId(item.id)
    setMsg(null)
    try {
      const res = await fetch(
        `/api/war-room/relatorio-executivo/acervo?id=${encodeURIComponent(item.id)}`,
        { method: 'DELETE' },
      )
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? 'Falha ao remover')
      setMsg('Link removido.')
      onAcervoChanged()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao remover')
    } finally {
      setRemovingId(null)
    }
  }

  const adicionarLivre = async () => {
    const titulo = novoTitulo.trim()
    const url = novoUrl.trim()
    if (!titulo || !url) {
      setMsg('Preencha título e URL para adicionar.')
      return
    }
    setAdding(true)
    setMsg(null)
    try {
      const res = await fetch('/api/war-room/relatorio-executivo/acervo', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipio: cidade,
          titulo,
          status: 'ACERVO',
          url,
          label: novoLabel.trim() || null,
        }),
      })
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      if (!res.ok) throw new Error(json?.error ?? 'Falha ao adicionar')
      setNovoTitulo('')
      setNovoUrl('')
      setNovoLabel('')
      setMsg('Item adicionado ao acervo.')
      onAcervoChanged()
    } catch (e) {
      setMsg(e instanceof Error ? e.message : 'Erro ao adicionar')
    } finally {
      setAdding(false)
    }
  }

  return (
    <article className="wr-relatorio-exec__sheet">
      <header className="wr-relatorio-exec__sheet-head">
        <h3 className="wr-relatorio-exec__sheet-title">
          {cidade.toUpperCase()} <span>|</span> ACERVO FOTOGRÁFICO E DOCUMENTAÇÃO
        </h3>
        <p className="wr-relatorio-exec__sheet-sub">
          Links do repositório editáveis e salvos no banco · clicáveis no PDF ·
          Bloco 03 — Comunicação
        </p>
      </header>

      {msg ? <p className="wr-relatorio-exec__acervo-msg">{msg}</p> : null}

      {data.acervo.length === 0 ? (
        <div className="wr-relatorio-exec__acervo-empty">
          <p className="wr-relatorio-exec__empty">Acervo — a preencher</p>
          <p className="wr-relatorio-exec__muted">
            Adicione um link abaixo ou salve URLs nas obras finalizadas quando
            elas aparecerem neste bloco.
          </p>
        </div>
      ) : (
        <>
          <div className="wr-relatorio-exec__acervo-grid">
            {data.acervo.map((item) => {
              const key = acervoItemKey(item)
              const draft = drafts[key] ?? {
                url: item.driveUrl ?? '',
                label: item.driveName ?? '',
                titulo: item.titulo,
              }
              const saving = savingKey === key
              return (
                <div key={key} className="wr-relatorio-exec__acervo-card">
                  <label className="wr-relatorio-exec__acervo-field">
                    <span>Título</span>
                    <input
                      type="text"
                      value={draft.titulo}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, titulo: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <p className="wr-relatorio-exec__muted">{item.status}</p>
                  <label className="wr-relatorio-exec__acervo-field">
                    <span>URL do repositório</span>
                    <input
                      type="url"
                      placeholder="https://drive.google.com/..."
                      value={draft.url}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, url: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <label className="wr-relatorio-exec__acervo-field">
                    <span>Texto do link (PDF)</span>
                    <input
                      type="text"
                      placeholder="Abrir repositório"
                      value={draft.label}
                      onChange={(e) =>
                        setDrafts((prev) => ({
                          ...prev,
                          [key]: { ...draft, label: e.target.value },
                        }))
                      }
                    />
                  </label>
                  <div className="wr-relatorio-exec__acervo-actions">
                    <button
                      type="button"
                      className="wr-relatorio-exec__acervo-btn"
                      disabled={saving}
                      onClick={() => void salvarItem(item)}
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                      ) : (
                        <Save className="h-3.5 w-3.5" strokeWidth={1.5} />
                      )}
                      Salvar
                    </button>
                    {draft.url.trim() ? (
                      <a
                        href={draft.url.trim()}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="wr-relatorio-exec__acervo-btn wr-relatorio-exec__acervo-btn--ghost"
                      >
                        <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.5} />
                        Abrir
                      </a>
                    ) : null}
                    {item.id ? (
                      <button
                        type="button"
                        className="wr-relatorio-exec__acervo-btn wr-relatorio-exec__acervo-btn--ghost"
                        disabled={removingId === item.id}
                        onClick={() => void removerItem(item)}
                        title="Remover link salvo"
                      >
                        {removingId === item.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" strokeWidth={1.5} />
                        )}
                      </button>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>

          <section className="wr-relatorio-exec__section">
            <h4 className="wr-relatorio-exec__section-title">
              RELAÇÃO COM O BLOCO DE OBRAS E AÇÕES
            </h4>
            <ul className="wr-relatorio-exec__relacao">
              {data.acervo.map((item) => (
                <li key={`rel-${acervoItemKey(item)}`}>
                  <span>{item.titulo}</span>
                  <StatusPill status={item.status} tone={toneStatusRelatorio(item.status)} />
                </li>
              ))}
            </ul>
          </section>
        </>
      )}

      <section className="wr-relatorio-exec__section">
        <h4 className="wr-relatorio-exec__section-title">ADICIONAR LINK AO ACERVO</h4>
        <div className="wr-relatorio-exec__acervo-add">
          <label className="wr-relatorio-exec__acervo-field">
            <span>Título</span>
            <input
              type="text"
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              placeholder="Ex.: Pasta de fotos da Areninha"
            />
          </label>
          <label className="wr-relatorio-exec__acervo-field">
            <span>URL</span>
            <input
              type="url"
              value={novoUrl}
              onChange={(e) => setNovoUrl(e.target.value)}
              placeholder="https://..."
            />
          </label>
          <label className="wr-relatorio-exec__acervo-field">
            <span>Texto do link</span>
            <input
              type="text"
              value={novoLabel}
              onChange={(e) => setNovoLabel(e.target.value)}
              placeholder="Abrir repositório"
            />
          </label>
          <button
            type="button"
            className="wr-relatorio-exec__acervo-btn"
            disabled={adding}
            onClick={() => void adicionarLivre()}
          >
            {adding ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} />
            ) : (
              <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
            )}
            Adicionar
          </button>
        </div>
      </section>

      <p className="wr-relatorio-exec__footnote">
        {cidade} — Acervo de Comunicação
      </p>
    </article>
  )
}

function acervoItemKey(item: RelatorioAcervoItem): string {
  if (item.id) return `id:${item.id}`
  if (item.obraId) return `obra:${item.obraId}`
  return `tmp:${item.titulo}`
}
