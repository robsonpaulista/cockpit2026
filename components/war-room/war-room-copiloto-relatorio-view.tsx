'use client'

import { useCallback, useEffect, useMemo, useState, type ComponentType, type ReactNode } from 'react'
import {
  Download,
  ExternalLink,
  HardHat,
  Landmark,
  Loader2,
  MapPin,
  Plus,
  RefreshCw,
  Save,
  Trash2,
} from 'lucide-react'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import {
  TseBarraRotulo,
  TseCard,
  TseCarregando,
  TseErro,
  TseMenu,
  TseMenuItem,
  TseSelectGrande,
  TseStatus,
  TseTabs,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseCardClass,
  tseRotuloCampoClass,
  tseTabela,
  type TseAba,
} from '@/components/tse/tse-ui'
import { useWarRoomCidade } from '@/components/war-room/war-room-cidade-context'
import type { CampoDemandaObraRow } from '@/lib/campo-demandas-obras'
import { demandasToObrasMapa } from '@/lib/campo-demandas-obras'
import type { EmendaRegistro } from '@/lib/emendas-filtro'
import type { IptMunicipio } from '@/lib/ipt'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { valorExibidoMapaObra } from '@/lib/obras-mapa'
import {
  carregarDadosRelatorioExecutivo,
  listarAcervoRelatorio,
  removerAcervoRelatorio,
  salvarAcervoRelatorio,
} from '@/lib/services/relatorio-executivo-client'
import type { RelatorioAcervoSalvo } from '@/lib/war-room/relatorio-executivo-acervo'
import { exportRelatorioEmendasDemandasCsv } from '@/lib/war-room/relatorio-executivo-csv-export'
import { exportRelatorioExecutivoPdf } from '@/lib/war-room/relatorio-executivo-export'
import {
  buildRelatorioExecutivoMunicipio,
  formatRelatorioBrl,
  type PlanoDriveLinkLite,
  type RelatorioAcervoItem,
  type RelatorioExecutivoMunicipio,
  type RelatorioStatusValor,
} from '@/lib/war-room/relatorio-executivo-municipio'
import { cn } from '@/lib/utils'

type BlocoId = 'capa' | 'emendas' | 'obras' | 'acervo'

const MUNICIPIOS_PI = (municipiosPiaui as Array<{ nome: string }>)
  .map((m) => m.nome)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))

const fmt = (n: number): string => n.toLocaleString('pt-BR')
const plural = (n: number, singular: string, pluralTxt: string): string => `${fmt(n)} ${n === 1 ? singular : pluralTxt}`

function corStatusRelatorio(status: string): string {
  const s = status
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
  if (s.includes('PAGO') || s.includes('EXECUTAD') || s.includes('CONCLUID')) return 'var(--tse-green)'
  if (s.includes('EMPENHAD')) return '#5D8AA7'
  if (s.includes('INDICAD')) return 'var(--tse-yellow)'
  if (s.includes('AGUARD') || s.includes('A INICIAR') || s.includes('PENDENTE')) return 'var(--tse-gold-text)'
  if (s.includes('EXECU') || s.includes('ANDAMENTO')) return 'var(--tse-olive)'
  return 'var(--tse-zero)'
}

/** Copiloto · Relatório Executivo municipal no padrão TSE. */
export function WarRoomCopilotoRelatorioView({ municipios = [] }: { municipios?: IptMunicipio[] }) {
  const { municipio, setMunicipio } = useWarRoomCidade()
  const [bloco, setBloco] = useState<BlocoId>('capa')
  const [emendasAll, setEmendasAll] = useState<EmendaRegistro[]>([])
  const [demandasAll, setDemandasAll] = useState<CampoDemandaObraRow[]>([])
  const [planosDrive, setPlanosDrive] = useState<PlanoDriveLinkLite[]>([])
  const [acervoSalvo, setAcervoSalvo] = useState<RelatorioAcervoSalvo[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [refreshing, setRefreshing] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const loadAcervo = useCallback(async (muni: string) => {
    setAcervoSalvo(await listarAcervoRelatorio(muni))
  }, [])

  const load = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (opts?.silent) setRefreshing(true)
      else setLoading(true)
      setError(null)
      try {
        const dados = await carregarDadosRelatorioExecutivo()
        setEmendasAll(dados.emendas)
        setDemandasAll(dados.demandas)
        setPlanosDrive(dados.planosDrive)
        if (municipio) await loadAcervo(municipio)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao montar o relatório')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [loadAcervo, municipio],
  )

  useEffect(() => {
    void load()
  }, [load])

  useEffect(() => {
    if (!municipio) setMunicipio('Teresina')
  }, [municipio, setMunicipio])

  useEffect(() => {
    if (municipio) void loadAcervo(municipio)
  }, [loadAcervo, municipio])

  const obrasAll = useMemo(() => demandasToObrasMapa(demandasAll), [demandasAll])

  const relatorio: RelatorioExecutivoMunicipio | null = useMemo(() => {
    if (!municipio) return null
    return buildRelatorioExecutivoMunicipio({
      municipio,
      emendas: emendasAll,
      obras: obrasAll,
      planosDrive,
      acervoSalvo,
    })
  }, [acervoSalvo, emendasAll, municipio, obrasAll, planosDrive])

  const cidade = municipio ?? 'Município'

  const abas: TseAba<BlocoId>[] = [
    { id: 'capa', label: 'Capa' },
    { id: 'emendas', label: `Emendas${relatorio ? ` (${fmt(relatorio.emendasCount)})` : ''}` },
    { id: 'obras', label: `Obras e ações${relatorio ? ` (${fmt(relatorio.obrasCount)})` : ''}` },
    { id: 'acervo', label: `Acervo${relatorio && relatorio.acervo.length > 0 ? ` (${fmt(relatorio.acervo.length)})` : ''}` },
  ]

  return (
    <div
      style={TSE_TOKENS}
      data-tse-escopo
      className="min-h-0 flex-1 overflow-y-auto bg-[var(--tse-bg)] font-sans text-[var(--tse-text)]"
    >
      <div className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-white px-6 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-8">
            <TseSelectGrande
              icone={MapPin}
              rotulo="Município"
              value={municipio ?? ''}
              onChange={(e) => setMunicipio(e.target.value || null)}
            >
              {MUNICIPIOS_PI.map((nome) => (
                <option key={nome} value={nome}>
                  {nome}
                </option>
              ))}
            </TseSelectGrande>
            <div className="text-[12px] text-[var(--tse-muted)]">
              <div className="text-[13px] font-bold uppercase tracking-wide text-[var(--tse-text)]">
                Relatório executivo
              </div>
              A4 paisagem · emendas e obras separadas, sem dupla contagem
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <TseMenu icone={Download} rotulo="Exportar">
              {(fechar) => (
                <>
                  <TseMenuItem
                    titulo="PDF do relatório"
                    descricao={`Capa, emendas, obras e acervo de ${cidade}`}
                    onClick={() => {
                      fechar()
                      if (relatorio) exportRelatorioExecutivoPdf(relatorio)
                    }}
                  />
                  <TseMenuItem
                    titulo="CSV de emendas e demandas"
                    descricao="Todas as cidades, por expectativa"
                    onClick={() => {
                      fechar()
                      exportRelatorioEmendasDemandasCsv({ emendas: emendasAll, demandas: demandasAll, municipios })
                    }}
                  />
                </>
              )}
            </TseMenu>
            <button
              type="button"
              onClick={() => void load({ silent: true })}
              disabled={loading || refreshing}
              className={tseBotaoCinzaClass}
            >
              <RefreshCw className={cn(tseBotaoIconeClass, refreshing && 'animate-spin')} />
              Atualizar
            </button>
          </div>
        </div>

        <TseTabs abas={abas} ativa={bloco} onChange={setBloco} />

        {loading && !relatorio ? (
          <TseCarregando texto="Montando relatório…" />
        ) : error && !relatorio ? (
          <TseErro>
            {error}{' '}
            <button type="button" onClick={() => void load()} className="ml-2 font-bold underline">
              Tentar de novo
            </button>
          </TseErro>
        ) : !relatorio ? (
          <TseVazio>Selecione um município para montar o relatório.</TseVazio>
        ) : (
          <>
            {error ? <TseErro>{error}</TseErro> : null}
            {bloco === 'capa' ? (
              <CapaSection cidade={cidade} data={relatorio} />
            ) : bloco === 'emendas' ? (
              <EmendasSection cidade={cidade} data={relatorio} />
            ) : bloco === 'obras' ? (
              <ObrasSection cidade={cidade} data={relatorio} />
            ) : (
              <AcervoSection cidade={cidade} data={relatorio} onAcervoChanged={() => void loadAcervo(cidade)} />
            )}
          </>
        )}
      </div>
    </div>
  )
}

function Faixa({
  titulo,
  selo,
  resumo,
  children,
}: {
  titulo: string
  selo: string
  resumo: ReactNode
  children: ReactNode
}) {
  return (
    <section className="flex flex-wrap items-center gap-x-10 gap-y-3 rounded-xl bg-white px-5 py-4 shadow-sm">
      <div className="min-w-[200px] flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <div className="text-[20px] font-bold uppercase">{titulo}</div>
          <span className="inline-flex rounded-full bg-[var(--tse-green)] px-3 py-0.5 text-[12px] font-bold text-white">
            {selo}
          </span>
        </div>
        <div className="text-[14px] text-[var(--tse-muted)]">{resumo}</div>
      </div>
      {children}
    </section>
  )
}

function Numero({ valor, rotulo }: { valor: ReactNode; rotulo: ReactNode }) {
  return (
    <div className="text-right">
      <div className="text-[26px] font-black leading-tight tabular-nums">{valor}</div>
      <div className="text-[13px] text-[var(--tse-muted)]">{rotulo}</div>
    </div>
  )
}

type AnoDoTipo = {
  ano: number | string
  itens: RelatorioStatusValor[]
  total: number
  semValor: boolean
}

function CartaoTipo({
  titulo,
  icone: Icone,
  cor,
  anos,
  rotuloTotal,
}: {
  titulo: string
  icone: ComponentType<{ className?: string }>
  cor: string
  anos: AnoDoTipo[]
  rotuloTotal: string
}) {
  const comRegistro = anos.filter((a) => a.itens.length > 0)
  const totalGeral = comRegistro.reduce((acc, a) => acc + a.total, 0)
  const registros = comRegistro.reduce((acc, a) => acc + a.itens.reduce((n, s) => n + s.count, 0), 0)
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div
        className="flex items-center justify-between gap-3 border-b border-[#EEEEEE] px-4 py-3"
        style={{ boxShadow: `inset 4px 0 0 ${cor}` }}
      >
        <div className="flex items-center gap-2">
          <Icone className="h-5 w-5 text-[var(--tse-muted)]" />
          <div className="text-[15px] font-bold uppercase tracking-wide">{titulo}</div>
        </div>
        {registros > 0 ? (
          <div className="text-[12px] text-[var(--tse-muted)]">{plural(registros, 'registro', 'registros')}</div>
        ) : null}
      </div>

      {comRegistro.length === 0 ? (
        <div className="px-4 py-4 text-[13px] text-[var(--tse-muted)]">Sem registros no município.</div>
      ) : (
        <>
          <div className="divide-y divide-[#EEEEEE]">
            {comRegistro.map((a) => (
              <div key={String(a.ano)} className="px-4 py-3">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
                  <div className="text-[18px] font-black leading-none tabular-nums">{a.ano}</div>
                  <div className="ml-auto whitespace-nowrap text-[13px]">
                    <span className="text-[11px] font-bold uppercase tracking-wide text-[var(--tse-muted)]">
                      Subtotal {a.ano}{' '}
                    </span>
                    <span className="font-bold tabular-nums">
                      {a.semValor && a.total === 0 ? 'Sem valor informado' : formatRelatorioBrl(a.total)}
                    </span>
                  </div>
                </div>
                <ul className="mt-2 space-y-1 border-l-2 border-[#EEEEEE] pl-3">
                  {a.itens.map((s) => (
                    <li key={s.status} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-0.5 text-[13px]">
                      <TseStatus cor={corStatusRelatorio(s.status)}>{s.status}</TseStatus>
                      <span className="text-[11px] text-[var(--tse-muted)]">
                        {plural(s.count, 'registro', 'registros')}
                      </span>
                      <span
                        className={cn(
                          'ml-auto whitespace-nowrap tabular-nums',
                          s.valor > 0 ? 'font-medium' : 'text-[12px] text-[var(--tse-muted)]',
                        )}
                      >
                        {s.valor > 0 ? formatRelatorioBrl(s.valor) : 'Sem valor informado'}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 border-t-2 border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] px-4 py-3">
            <span className="text-[13px] font-bold uppercase tracking-wide">{rotuloTotal}</span>
            <span className="ml-auto whitespace-nowrap text-[18px] font-black tabular-nums">
              {formatRelatorioBrl(totalGeral)}
            </span>
          </div>
        </>
      )}
    </section>
  )
}

function Rodape({ children }: { children: ReactNode }) {
  return <div className="text-[11px] text-[var(--tse-muted)]">{children}</div>
}

function CapaSection({ cidade, data }: { cidade: string; data: RelatorioExecutivoMunicipio }) {
  return (
    <div className="space-y-4">
      <Faixa
        titulo="Relatório executivo"
        selo={cidade}
        resumo="Emendas federais e obras/ações apresentadas separadamente para evitar dupla contagem"
      >
        <Numero
          valor={formatRelatorioBrl(data.emendasTotalIndicado)}
          rotulo={`emendas federais · ${plural(data.emendasCount, 'registro', 'registros')}`}
        />
        <Numero
          valor={formatRelatorioBrl(data.obrasValorMapeado)}
          rotulo={`obras e ações · ${plural(data.obrasCount, 'registro', 'registros')}`}
        />
      </Faixa>

      <div className="grid items-start gap-4 lg:grid-cols-2">
        <CartaoTipo
          titulo="Emendas federais"
          icone={Landmark}
          cor="var(--tse-yellow)"
          rotuloTotal="Total de emendas"
          anos={data.porAno.map((a) => ({
            ano: a.ano,
            itens: a.emendasSemRegistro ? [] : a.emendasPorStatus,
            total: a.emendasTotal,
            semValor: false,
          }))}
        />
        <CartaoTipo
          titulo="Obras e ações"
          icone={HardHat}
          cor="var(--tse-olive)"
          rotuloTotal="Total de obras e ações"
          anos={data.porAno.map((a) => ({
            ano: a.ano,
            itens: a.obrasPorStatus,
            total: a.obrasTotal,
            semValor: a.obrasSemValor,
          }))}
        />
      </div>

      <Rodape>
        Emendas e obras não são somadas entre si para evitar dupla contagem de um mesmo investimento. {cidade} ·
        Cockpit 2026
      </Rodape>
    </div>
  )
}

function EmendasSection({ cidade, data }: { cidade: string; data: RelatorioExecutivoMunicipio }) {
  const t = data.emendasTotais
  const pctPago = t.indicado > 0 ? (t.pago / t.indicado) * 100 : 0
  return (
    <div className="space-y-4">
      <Faixa
        titulo="Emendas federais"
        selo={cidade}
        resumo={`${plural(data.emendasCount, 'registro', 'registros')} · indicado ${formatRelatorioBrl(t.indicado)}`}
      >
        <Numero valor={formatRelatorioBrl(t.indicado)} rotulo="indicados" />
        <Numero valor={formatRelatorioBrl(t.empenhado)} rotulo="empenhados" />
        <Numero valor={formatRelatorioBrl(t.pago)} rotulo="pagos" />
        <div className="w-full">
          <TseBarraRotulo
            pct={pctPago}
            rotulo={`${pctPago.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`}
          />
          <div className="mt-1 text-[11px] text-[var(--tse-muted)]">Pago sobre o indicado</div>
        </div>
      </Faixa>

      {data.emendas.length === 0 ? (
        <TseVazio>Nenhuma emenda neste município.</TseVazio>
      ) : (
        <div className={tseTabela.container}>
          <table className={tseTabela.table} data-tse-tabela>
            <thead className={tseTabela.thead}>
              <tr>
                <th className={tseTabela.th}>Ano</th>
                <th className={tseTabela.th}>Emenda</th>
                <th className={tseTabela.th}>Objeto</th>
                <th className={cn(tseTabela.th, 'text-right')}>Indicado</th>
                <th className={cn(tseTabela.th, 'text-right')}>Empenhado</th>
                <th className={cn(tseTabela.th, 'text-right')}>Pago</th>
                <th className={tseTabela.th}>Status</th>
              </tr>
            </thead>
            <tbody>
              {data.emendas.map((row) => (
                <tr key={row.id} className={tseTabela.tr}>
                  <td className={cn(tseTabela.td, 'tabular-nums')}>{row.exercicio ?? '—'}</td>
                  <td className={cn(tseTabela.td, 'font-semibold')}>{row.emenda}</td>
                  <td className={tseTabela.td}>{row.objeto}</td>
                  <td className={cn(tseTabela.td, 'text-right font-bold tabular-nums')}>
                    {row.indicado > 0 ? formatRelatorioBrl(row.indicado) : '—'}
                  </td>
                  <td className={cn(tseTabela.td, 'text-right tabular-nums')}>
                    {row.empenhado > 0 ? formatRelatorioBrl(row.empenhado) : '—'}
                  </td>
                  <td className={cn(tseTabela.td, 'text-right tabular-nums')}>
                    {row.pago > 0 ? formatRelatorioBrl(row.pago) : '—'}
                  </td>
                  <td className={tseTabela.td}>
                    <TseStatus cor={corStatusRelatorio(row.status)}>{row.status}</TseStatus>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] font-bold">
                <td colSpan={3} className="px-3 py-2.5 uppercase">
                  Total
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatRelatorioBrl(t.indicado)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatRelatorioBrl(t.empenhado)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{formatRelatorioBrl(t.pago)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {data.leiturasRapidas.length > 0 ? (
        <TseCard titulo="Termos que a agência precisa saber">
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {data.leiturasRapidas.map((l) => (
              <div key={l.id} className="rounded-lg bg-[var(--tse-bar)] p-3">
                <div className="text-[13px] font-bold">{l.titulo}</div>
                <div className="mt-1 text-[12px] leading-relaxed text-[var(--tse-muted)]">{l.texto}</div>
              </div>
            ))}
          </div>
        </TseCard>
      ) : null}
    </div>
  )
}

function ObrasSection({ cidade, data }: { cidade: string; data: RelatorioExecutivoMunicipio }) {
  const k = data.obrasKpis
  return (
    <div className="space-y-4">
      <Faixa
        titulo="Obras, entregas e ações"
        selo={cidade}
        resumo={`${plural(k.registros, 'registro', 'registros')} · total informado ${formatRelatorioBrl(k.valorMapeado)}`}
      >
        <Numero valor={formatRelatorioBrl(k.valorMapeado)} rotulo="valor mapeado" />
        <Numero valor={fmt(k.acoesExecutadas)} rotulo="executadas" />
        <Numero valor={fmt(k.emExecucao)} rotulo="em execução" />
        <Numero valor={fmt(k.aguardando)} rotulo="aguardando" />
      </Faixa>

      {data.obrasPorTipo.length === 0 ? (
        <TseVazio>Nenhuma obra ou ação neste município.</TseVazio>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {data.obrasPorTipo.map((grupo) => (
            <TseCard
              key={grupo.tipoKey}
              titulo={grupo.tipoLabel}
              subtitulo={`${plural(grupo.count, 'registro', 'registros')} · ${formatRelatorioBrl(grupo.valor)}`}
            >
              <ul className="mt-3 divide-y divide-[#EEEEEE]">
                {grupo.obras.map((obra) => {
                  const valor = valorExibidoMapaObra(obra)
                  const status = (obra.status ?? '').trim().toUpperCase() || 'SEM STATUS'
                  return (
                    <li key={obra.id} className="flex items-center justify-between gap-3 py-2 text-[13px]">
                      <div className="flex min-w-0 items-center gap-2">
                        <TseStatus cor={corStatusRelatorio(status)}>{status}</TseStatus>
                        <span className="truncate">{obra.obra?.trim() || obra.tipo?.trim() || 'Sem título'}</span>
                      </div>
                      <span
                        className={cn(
                          'shrink-0 font-bold tabular-nums',
                          !(valor != null && valor > 0) && 'font-semibold text-[var(--tse-muted)]',
                        )}
                      >
                        {valor != null && valor > 0 ? formatRelatorioBrl(valor) : 'Sem valor'}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </TseCard>
          ))}
        </div>
      )}
    </div>
  )
}

type RascunhoAcervo = { url: string; label: string; titulo: string }

function acervoItemKey(item: RelatorioAcervoItem): string {
  if (item.id) return `id:${item.id}`
  if (item.obraId) return `obra:${item.obraId}`
  return `tmp:${item.titulo}`
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
  const [drafts, setDrafts] = useState<Record<string, RascunhoAcervo>>({})
  const [savingKey, setSavingKey] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [novoTitulo, setNovoTitulo] = useState<string>('')
  const [novoUrl, setNovoUrl] = useState<string>('')
  const [novoLabel, setNovoLabel] = useState<string>('')
  const [adding, setAdding] = useState<boolean>(false)

  useEffect(() => {
    const next: Record<string, RascunhoAcervo> = {}
    for (const item of data.acervo) {
      next[acervoItemKey(item)] = { url: item.driveUrl ?? '', label: item.driveName ?? '', titulo: item.titulo }
    }
    setDrafts(next)
    setMsg(null)
  }, [data.acervo, cidade])

  const atualizarDraft = (key: string, atual: RascunhoAcervo, campo: keyof RascunhoAcervo, valor: string) =>
    setDrafts((prev) => ({ ...prev, [key]: { ...atual, [campo]: valor } }))

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
      await salvarAcervoRelatorio({
        id: item.id,
        municipio: cidade,
        obraId: item.obraId,
        titulo: draft.titulo.trim() || item.titulo,
        status: item.status,
        url,
        label: draft.label.trim() || null,
      })
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
      await removerAcervoRelatorio(item.id)
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
      await salvarAcervoRelatorio({ municipio: cidade, titulo, status: 'ACERVO', url, label: novoLabel.trim() || null })
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
    <div className="space-y-4">
      <Faixa
        titulo="Acervo fotográfico e documentação"
        selo={cidade}
        resumo="Links do repositório salvos no banco e clicáveis no PDF"
      >
        <Numero valor={fmt(data.acervo.length)} rotulo={data.acervo.length === 1 ? 'item' : 'itens'} />
      </Faixa>

      {msg ? (
        <div className="rounded-xl border border-[var(--tse-yellow)] bg-[var(--tse-yellow-soft)] px-4 py-2.5 text-[13px] font-semibold">
          {msg}
        </div>
      ) : null}

      {data.acervo.length === 0 ? (
        <TseVazio>
          Acervo a preencher. Adicione um link abaixo ou salve URLs nas obras finalizadas quando elas aparecerem
          aqui.
        </TseVazio>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {data.acervo.map((item) => {
            const key = acervoItemKey(item)
            const draft = drafts[key] ?? { url: item.driveUrl ?? '', label: item.driveName ?? '', titulo: item.titulo }
            const saving = savingKey === key
            return (
              <section key={key} className={cn(tseCardClass, 'space-y-3')}>
                <div className="flex items-center justify-between gap-2">
                  <TseStatus cor={corStatusRelatorio(item.status)}>{item.status}</TseStatus>
                  {item.id ? (
                    <button
                      type="button"
                      disabled={removingId === item.id}
                      onClick={() => void removerItem(item)}
                      title="Remover link salvo"
                      aria-label="Remover link salvo"
                      className="rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[#B42318] disabled:opacity-60"
                    >
                      {removingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  ) : null}
                </div>
                <label className="block">
                  <span className={tseRotuloCampoClass}>Título</span>
                  <input
                    type="text"
                    value={draft.titulo}
                    onChange={(e) => atualizarDraft(key, draft, 'titulo', e.target.value)}
                    className={tseCampoClass}
                  />
                </label>
                <label className="block">
                  <span className={tseRotuloCampoClass}>URL do repositório</span>
                  <input
                    type="url"
                    placeholder="https://drive.google.com/..."
                    value={draft.url}
                    onChange={(e) => atualizarDraft(key, draft, 'url', e.target.value)}
                    className={tseCampoClass}
                  />
                </label>
                <label className="block">
                  <span className={tseRotuloCampoClass}>Texto do link no PDF</span>
                  <input
                    type="text"
                    placeholder="Abrir repositório"
                    value={draft.label}
                    onChange={(e) => atualizarDraft(key, draft, 'label', e.target.value)}
                    className={tseCampoClass}
                  />
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void salvarItem(item)}
                    className={tseBotaoPrimarioClass}
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Salvar
                  </button>
                  {draft.url.trim() ? (
                    <a
                      href={draft.url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={tseBotaoCinzaClass}
                    >
                      <ExternalLink className={tseBotaoIconeClass} />
                      Abrir
                    </a>
                  ) : null}
                </div>
              </section>
            )
          })}
        </div>
      )}

      <TseCard titulo="Adicionar link ao acervo" subtitulo="Pasta de fotos, vídeos ou documentos do município">
        <div className="mt-3 grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <label className="block">
            <span className={tseRotuloCampoClass}>Título</span>
            <input
              type="text"
              value={novoTitulo}
              onChange={(e) => setNovoTitulo(e.target.value)}
              placeholder="Ex.: Pasta de fotos da Areninha"
              className={tseCampoClass}
            />
          </label>
          <label className="block">
            <span className={tseRotuloCampoClass}>URL</span>
            <input
              type="url"
              value={novoUrl}
              onChange={(e) => setNovoUrl(e.target.value)}
              placeholder="https://..."
              className={tseCampoClass}
            />
          </label>
          <label className="block">
            <span className={tseRotuloCampoClass}>Texto do link</span>
            <input
              type="text"
              value={novoLabel}
              onChange={(e) => setNovoLabel(e.target.value)}
              placeholder="Abrir repositório"
              className={tseCampoClass}
            />
          </label>
          <button
            type="button"
            disabled={adding}
            onClick={() => void adicionarLivre()}
            className={cn(tseBotaoPrimarioClass, 'h-9')}
          >
            {adding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Adicionar
          </button>
        </div>
      </TseCard>

      <Rodape>{cidade} · Acervo de comunicação · Bloco 03 do PDF</Rodape>
    </div>
  )
}
