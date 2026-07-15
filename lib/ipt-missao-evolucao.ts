import {
  IPT_SINAL_LABEL,
  normalizeIptMunicipio,
  type IptMunicipio,
  type IptSinal,
} from '@/lib/ipt'
import {
  IPT_MISSOES,
  diffMembrosMissao,
  iptMissaoConfig,
  membrosPorMissao,
  municipioNaMissao,
  votosProjetadosPesquisa,
  type IptMissaoId,
  type IptMissaoMudancaSentido,
} from '@/lib/ipt-missoes'

export type IptMissaoEventoFonte = 'sync' | 'manual' | 'bootstrap'

/** Snapshot das métricas que explicam entrada/saída de missão. */
export type IptMissaoMetricaSnap = {
  expectativaVotos: number
  pesoExpectativaPct: number
  sinalVisitas: string
  visitasPeriodo: number
  visitasUltimos15Dias: number
  evolucaoVisitas: string
  sinalPesquisa: string
  pesquisaPosicaoTop5: number | null
  pesquisaMediaPct: number | null
  votosProjetados: number | null
  sinalDigital: string
  digitalSeguidores: number | null
  sinalObras: string
  obrasQtd: number
  obrasDivulgacaoPosts: number
}

export type IptMissaoComparativo = {
  metrica: string
  anterior: string
  atual: string
}

export type IptMissaoEvento = {
  id: string
  municipio: string
  municipioNormalizado: string
  missao: IptMissaoId
  sentido: IptMissaoMudancaSentido
  motivo: string
  detalhes: Record<string, string | number | boolean | null>
  fonte: IptMissaoEventoFonte
  createdAt: string
}

export type IptMissaoEventoInput = Omit<IptMissaoEvento, 'id' | 'createdAt'> & {
  id?: string
  createdAt?: string
}

const SYNC_MEMBROS_KEY = 'ipt-missao-membros-sync-v1'
const SYNC_METRICAS_KEY = 'ipt-missao-metricas-sync-v1'
const EVENTOS_LOCAL_KEY = 'ipt-missao-eventos-local-v1'
const MAX_EVENTOS_LOCAL = 800

function sinalLabel(sinal: IptSinal): string {
  return IPT_SINAL_LABEL[sinal] ?? sinal
}

function fmtInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return n.toLocaleString('pt-BR')
}

function fmtPct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
}

export function snapshotMetricasMunicipio(m: IptMunicipio): IptMissaoMetricaSnap {
  return {
    expectativaVotos: m.expectativaVotos,
    pesoExpectativaPct: m.pesoExpectativaPct,
    sinalVisitas: m.sinais.visitas,
    visitasPeriodo: m.detalhes.visitasNoPeriodo,
    visitasUltimos15Dias: m.detalhes.visitasUltimos15Dias,
    evolucaoVisitas: m.evolucao.visitas,
    sinalPesquisa: m.sinais.pesquisa,
    pesquisaPosicaoTop5: m.detalhes.pesquisaPosicaoTop5,
    pesquisaMediaPct: m.detalhes.pesquisaMediaPct,
    votosProjetados: votosProjetadosPesquisa(m),
    sinalDigital: m.sinais.digital,
    digitalSeguidores: m.detalhes.digitalSeguidores,
    sinalObras: m.sinais.obras,
    obrasQtd: m.detalhes.obrasQuantidade,
    obrasDivulgacaoPosts: m.detalhes.obrasDivulgacaoPosts ?? 0,
  }
}

export function metricasPorMunicipio(
  municipios: IptMunicipio[]
): Record<string, IptMissaoMetricaSnap> {
  const out: Record<string, IptMissaoMetricaSnap> = {}
  for (const m of municipios) {
    out[m.municipio] = snapshotMetricasMunicipio(m)
  }
  return out
}

function formatSnapMissao(
  missao: IptMissaoId,
  snap: IptMissaoMetricaSnap | null | undefined
): string {
  if (!snap) return '—'

  if (missao === 'expectativa') {
    if (snap.expectativaVotos <= 0) return 'Sem meta'
    return `${fmtInt(snap.expectativaVotos)} votos · ${fmtPct(snap.pesoExpectativaPct)}`
  }

  if (missao === 'campo') {
    const sinal = IPT_SINAL_LABEL[snap.sinalVisitas as IptSinal] ?? snap.sinalVisitas
    const cob =
      snap.visitasUltimos15Dias > 0
        ? `${fmtInt(snap.visitasUltimos15Dias)} em 15d`
        : 'sem cobertura 15d'
    return `${cob} · ${fmtInt(snap.visitasPeriodo)} em 30d · ${sinal}`
  }

  if (missao === 'pesquisa') {
    const pos =
      snap.pesquisaPosicaoTop5 != null ? `${snap.pesquisaPosicaoTop5}º` : 'Fora do Top 5'
    const media = fmtPct(snap.pesquisaMediaPct)
    const proj =
      snap.votosProjetados != null ? `≈ ${fmtInt(snap.votosProjetados)} proj.` : 'sem projetados'
    return `${pos} · ${media} · ${proj}`
  }

  if (missao === 'digital') {
    const sinal = IPT_SINAL_LABEL[snap.sinalDigital as IptSinal] ?? snap.sinalDigital
    const seg =
      snap.digitalSeguidores != null && snap.digitalSeguidores > 0
        ? `${fmtInt(snap.digitalSeguidores)} seg.`
        : 'fora da base'
    return `${seg} · ${sinal}`
  }

  const sinal = IPT_SINAL_LABEL[snap.sinalObras as IptSinal] ?? snap.sinalObras
  return `${fmtInt(snap.obrasQtd)} obra(s) · ${fmtInt(snap.obrasDivulgacaoPosts)} post(s) · ${sinal}`
}

export function metricaLabelMissao(missao: IptMissaoId): string {
  if (missao === 'expectativa') return 'Expectativa 2026'
  if (missao === 'campo') return 'Campo (visitas)'
  if (missao === 'pesquisa') return 'Pesquisa vs potencial'
  if (missao === 'digital') return 'Presença digital'
  return 'Obras / divulgação'
}

export function comparativoMissao(
  missao: IptMissaoId,
  anterior: IptMissaoMetricaSnap | null | undefined,
  atual: IptMissaoMetricaSnap | null | undefined
): IptMissaoComparativo {
  return {
    metrica: metricaLabelMissao(missao),
    anterior: formatSnapMissao(missao, anterior),
    atual: formatSnapMissao(missao, atual),
  }
}

/** Lê comparativo persistido no evento (novo) ou deriva do detalhe legado. */
export function leituraComparativoEvento(e: IptMissaoEvento): IptMissaoComparativo {
  const d = e.detalhes
  const metrica =
    typeof d.metrica === 'string' && d.metrica
      ? d.metrica
      : metricaLabelMissao(e.missao)
  const anterior =
    typeof d.valorAnterior === 'string' && d.valorAnterior
      ? d.valorAnterior
      : '—'
  if (typeof d.valorAtual === 'string' && d.valorAtual) {
    return { metrica, anterior, atual: d.valorAtual }
  }

  // Eventos antigos: só tinham o estado "atual" no momento do sync.
  const snapAtual: IptMissaoMetricaSnap = {
    expectativaVotos: Number(d.expectativaVotos ?? 0),
    pesoExpectativaPct: Number(d.pesoExpectativaPct ?? 0),
    sinalVisitas: String(d.sinalVisitas ?? 'sem_dado'),
    visitasPeriodo: Number(d.visitasPeriodo ?? 0),
    visitasUltimos15Dias: Number(d.visitasUltimos15Dias ?? 0),
    evolucaoVisitas: String(d.evolucaoVisitas ?? 'sem_dado'),
    sinalPesquisa: String(d.sinalPesquisa ?? 'sem_dado'),
    pesquisaPosicaoTop5:
      d.pesquisaPosicaoTop5 == null || d.pesquisaPosicaoTop5 === ''
        ? null
        : Number(d.pesquisaPosicaoTop5),
    pesquisaMediaPct:
      d.pesquisaMediaPct == null || d.pesquisaMediaPct === ''
        ? null
        : Number(d.pesquisaMediaPct),
    votosProjetados:
      d.votosProjetados == null || d.votosProjetados === ''
        ? null
        : Number(d.votosProjetados),
    sinalDigital: String(d.sinalDigital ?? 'sem_dado'),
    digitalSeguidores:
      d.digitalSeguidores == null || d.digitalSeguidores === ''
        ? null
        : Number(d.digitalSeguidores),
    sinalObras: String(d.sinalObras ?? 'sem_dado'),
    obrasQtd: Number(d.obrasQtd ?? 0),
    obrasDivulgacaoPosts: Number(d.obrasDivulgacaoPosts ?? 0),
  }
  return {
    metrica,
    anterior,
    atual: formatSnapMissao(e.missao, snapAtual),
  }
}

function newId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID()
  }
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/** Motivo operacional (por que entrou / por que saiu), com base no estado atual. */
export function motivoMissaoDetalhado(
  m: IptMunicipio | undefined,
  missao: IptMissaoId,
  sentido: IptMissaoMudancaSentido
): { motivo: string; detalhes: Record<string, string | number | boolean | null> } {
  const cfg = iptMissaoConfig(missao)
  if (!m) {
    return {
      motivo:
        sentido === 'entrou'
          ? `Entrou na missão ${cfg.titulo} (sem snapshot detalhado).`
          : `Saiu da missão ${cfg.titulo} (município fora do recorte atual).`,
      detalhes: {},
    }
  }

  const snap = snapshotMetricasMunicipio(m)
  const detalhes: Record<string, string | number | boolean | null> = {
    expectativaVotos: snap.expectativaVotos,
    pesoExpectativaPct: snap.pesoExpectativaPct,
    prioridade: m.prioridade,
    sinalVisitas: snap.sinalVisitas,
    sinalPesquisa: snap.sinalPesquisa,
    sinalDigital: snap.sinalDigital,
    sinalObras: snap.sinalObras,
    visitasPeriodo: snap.visitasPeriodo,
    visitasUltimos15Dias: snap.visitasUltimos15Dias,
    evolucaoVisitas: snap.evolucaoVisitas,
    pesquisaPosicaoTop5: snap.pesquisaPosicaoTop5,
    pesquisaMediaPct: snap.pesquisaMediaPct,
    votosProjetados: snap.votosProjetados,
    digitalSeguidores: snap.digitalSeguidores,
    obrasQtd: snap.obrasQtd,
    obrasDivulgacaoPosts: snap.obrasDivulgacaoPosts,
  }

  if (missao === 'expectativa') {
    if (sentido === 'entrou') {
      return {
        motivo: `Passou a ter expectativa 2026 (${m.expectativaVotos.toLocaleString('pt-BR')} votos · ${m.pesoExpectativaPct.toFixed(1)}%).`,
        detalhes,
      }
    }
    return {
      motivo:
        m.expectativaVotos <= 0
          ? 'Expectativa 2026 zerada ou removida.'
          : 'Deixou de contabilizar expectativa no recorte.',
      detalhes,
    }
  }

  if (missao === 'campo') {
    if (sentido === 'entrou') {
      const partes: string[] = []
      if (m.sinais.visitas === 'mal' || m.sinais.visitas === 'neutro') {
        partes.push(`campo ${sinalLabel(m.sinais.visitas).toLowerCase()} (${m.detalhes.visitasNoPeriodo} visitas no período)`)
      }
      if (m.evolucao.visitas === 'diminuiu') partes.push('visitas em queda vs período anterior')
      if (m.prioridade === 'critico' || m.prioridade === 'atencao') {
        partes.push(`diagnóstico ${m.prioridade}`)
      }
      return {
        motivo: partes.length
          ? `Entrou em Campo: ${partes.join('; ')}.`
          : 'Entrou em Campo por potencial alto com presença insuficiente.',
        detalhes,
      }
    }
    const partes: string[] = []
    if (m.sinais.visitas === 'bem') partes.push('cobertura de campo ok')
    if (m.evolucao.visitas === 'cresceu' || m.evolucao.visitas === 'estavel') {
      partes.push(`visitas ${m.evolucao.visitas}`)
    }
    if (m.expectativaVotos <= 0) partes.push('sem expectativa')
    return {
      motivo: partes.length
        ? `Saiu de Campo: ${partes.join('; ')}.`
        : 'Saiu de Campo — presença deixou de ser incompatível com o potencial.',
      detalhes,
    }
  }

  if (missao === 'pesquisa') {
    if (sentido === 'entrou') {
      const partes: string[] = []
      if (m.sinais.pesquisa === 'mal' || m.sinais.pesquisa === 'neutro') {
        partes.push(`pesquisa ${sinalLabel(m.sinais.pesquisa).toLowerCase()}`)
      }
      if (m.sinais.pesquisa === 'sem_dado') partes.push('sem dado de pesquisa com potencial alto')
      if (m.evolucao.pesquisa === 'diminuiu') partes.push('intenção em queda')
      if (m.detalhes.pesquisaPosicaoTop5 != null) {
        partes.push(`posição #${m.detalhes.pesquisaPosicaoTop5} no top 5`)
      }
      return {
        motivo: partes.length
          ? `Entrou em Pesquisa: ${partes.join('; ')}.`
          : 'Entrou em Pesquisa — intenção abaixo do potencial.',
        detalhes,
      }
    }
    const partes: string[] = []
    if (m.sinais.pesquisa === 'bem') partes.push('pesquisa ok')
    if (m.evolucao.pesquisa === 'cresceu') partes.push('intenção em alta')
    if (m.expectativaVotos <= 0) partes.push('sem expectativa')
    return {
      motivo: partes.length
        ? `Saiu de Pesquisa: ${partes.join('; ')}.`
        : 'Saiu de Pesquisa — leitura voltou a acompanhar o potencial.',
      detalhes,
    }
  }

  if (missao === 'digital') {
    if (sentido === 'entrou') {
      const partes: string[] = []
      if (m.sinais.digital === 'sem_dado') partes.push('sem cobertura digital na base')
      if (m.evolucao.digitalSeguidores === 'diminuiu') partes.push('seguidores em queda')
      return {
        motivo: partes.length
          ? `Entrou em Digital: ${partes.join('; ')}.`
          : 'Entrou em Digital — oportunidade mal aproveitada.',
        detalhes,
      }
    }
    const partes: string[] = []
    if (m.sinais.digital === 'bem' || m.sinais.digital === 'neutro') {
      partes.push(`presença digital ${sinalLabel(m.sinais.digital).toLowerCase()}`)
    }
    if ((m.detalhes.digitalSeguidores ?? 0) > 0) {
      partes.push(`${(m.detalhes.digitalSeguidores ?? 0).toLocaleString('pt-BR')} seguidores`)
    }
    if (m.expectativaVotos <= 0) partes.push('sem expectativa')
    return {
      motivo: partes.length
        ? `Saiu de Digital: ${partes.join('; ')}.`
        : 'Saiu de Digital — gap de cobertura fechado.',
      detalhes,
    }
  }

  // obras
  if (sentido === 'entrou') {
    const partes: string[] = []
    if (m.detalhes.obrasQuantidade > 0) {
      partes.push(`${m.detalhes.obrasQuantidade} obra(s) no território`)
    }
    if ((m.detalhes.obrasDivulgacaoPosts ?? 0) === 0) partes.push('sem divulgação Instagram vinculada')
    if (m.sinais.obras === 'mal') partes.push('sinal de obras negativo')
    return {
      motivo: partes.length
        ? `Entrou em Obras: ${partes.join('; ')}.`
        : 'Entrou em Obras — entregas pedem valorização.',
      detalhes,
    }
  }
  const partes: string[] = []
  if ((m.detalhes.obrasDivulgacaoPosts ?? 0) > 0) {
    partes.push(`${m.detalhes.obrasDivulgacaoPosts} post(s) vinculados à obra`)
  }
  if (m.detalhes.obrasQuantidade === 0 && m.sinais.obras !== 'mal') {
    partes.push('sem obra pedindo atenção')
  }
  if (m.expectativaVotos <= 0) partes.push('sem expectativa')
  return {
    motivo: partes.length
      ? `Saiu de Obras: ${partes.join('; ')}.`
      : 'Saiu de Obras — divulgação/aproveitamento recuperados.',
    detalhes,
  }
}

export function lerMembrosSync(): Record<IptMissaoId, string[]> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SYNC_MEMBROS_KEY)
    if (!raw) return null
    return JSON.parse(raw) as Record<IptMissaoId, string[]>
  } catch {
    return null
  }
}

export function salvarMembrosSync(membros: Record<IptMissaoId, string[]>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SYNC_MEMBROS_KEY, JSON.stringify(membros))
  } catch {
    // ignore
  }
}

export function lerMetricasSync(): Record<string, IptMissaoMetricaSnap> | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(SYNC_METRICAS_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Record<string, IptMissaoMetricaSnap>
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

export function salvarMetricasSync(metricas: Record<string, IptMissaoMetricaSnap>): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(SYNC_METRICAS_KEY, JSON.stringify(metricas))
  } catch {
    // ignore
  }
}

export function lerEventosLocais(): IptMissaoEvento[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = window.localStorage.getItem(EVENTOS_LOCAL_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as IptMissaoEvento[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function salvarEventosLocais(eventos: IptMissaoEvento[]): void {
  if (typeof window === 'undefined') return
  try {
    const trimmed = eventos
      .slice()
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .slice(0, MAX_EVENTOS_LOCAL)
    window.localStorage.setItem(EVENTOS_LOCAL_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore
  }
}

export function appendEventosLocais(novos: IptMissaoEvento[]): IptMissaoEvento[] {
  const merged = [...novos, ...lerEventosLocais()]
  // Dedup por id
  const seen = new Set<string>()
  const unique: IptMissaoEvento[] = []
  for (const e of merged) {
    if (seen.has(e.id)) continue
    seen.add(e.id)
    unique.push(e)
  }
  salvarEventosLocais(unique)
  return unique
}

export function buildEventosMissaoDiff(
  municipios: IptMunicipio[],
  membrosAnteriores: Record<IptMissaoId, string[]> | null,
  fonte: IptMissaoEventoFonte = 'sync',
  metricasAnteriores: Record<string, IptMissaoMetricaSnap> | null = null
): {
  membrosAtuais: Record<IptMissaoId, string[]>
  metricasAtuais: Record<string, IptMissaoMetricaSnap>
  eventos: IptMissaoEvento[]
} {
  const membrosAtuais = membrosPorMissao(municipios)
  const metricasAtuais = metricasPorMunicipio(municipios)
  if (!membrosAnteriores) {
    return { membrosAtuais, metricasAtuais, eventos: [] }
  }

  const porNome = new Map(municipios.map((m) => [m.municipio, m]))
  const agora = new Date().toISOString()
  const eventos: IptMissaoEvento[] = []

  for (const missao of IPT_MISSOES.map((m) => m.id)) {
    const mudancas = diffMembrosMissao(
      missao,
      membrosAtuais[missao],
      membrosAnteriores[missao]
    )
    for (const mud of mudancas) {
      const muni = porNome.get(mud.municipio)
      const { motivo, detalhes } = motivoMissaoDetalhado(muni, missao, mud.sentido)
      const snapAnterior = metricasAnteriores?.[mud.municipio] ?? null
      const snapAtual = muni ? metricasAtuais[mud.municipio] : null
      const comp = comparativoMissao(missao, snapAnterior, snapAtual)
      eventos.push({
        id: newId(),
        municipio: mud.municipio,
        municipioNormalizado: normalizeIptMunicipio(mud.municipio),
        missao,
        sentido: mud.sentido,
        motivo,
        detalhes: {
          ...detalhes,
          metrica: comp.metrica,
          valorAnterior: comp.anterior,
          valorAtual: comp.atual,
        },
        fonte,
        createdAt: agora,
      })
    }
  }

  eventos.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt)
    return a.municipio.localeCompare(b.municipio, 'pt-BR')
  })

  return { membrosAtuais, metricasAtuais, eventos }
}

/** Primeira carga: marca sync sem gerar eventos (bootstrap). */
export function bootstrapMissaoSync(municipios: IptMunicipio[]): void {
  salvarMembrosSync(membrosPorMissao(municipios))
  salvarMetricasSync(metricasPorMunicipio(municipios))
}

export async function persistirEventosMissao(
  eventos: IptMissaoEventoInput[]
): Promise<{ ok: boolean; error?: string }> {
  if (eventos.length === 0) return { ok: true }
  try {
    const res = await fetch('/api/ipt/missao-eventos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ eventos }),
    })
    if (!res.ok) {
      const json = (await res.json().catch(() => null)) as { error?: string } | null
      return { ok: false, error: json?.error ?? `HTTP ${res.status}` }
    }
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Falha de rede' }
  }
}

export async function carregarEventosMissao(params?: {
  missao?: IptMissaoId | 'todas'
  municipio?: string
  sentido?: IptMissaoMudancaSentido | 'todos'
  limit?: number
}): Promise<IptMissaoEvento[]> {
  const qs = new URLSearchParams()
  if (params?.missao && params.missao !== 'todas') qs.set('missao', params.missao)
  if (params?.municipio) qs.set('municipio', params.municipio)
  if (params?.sentido && params.sentido !== 'todos') qs.set('sentido', params.sentido)
  if (params?.limit) qs.set('limit', String(params.limit))

  let remotos: IptMissaoEvento[] = []
  try {
    const res = await fetch(`/api/ipt/missao-eventos?${qs.toString()}`, { cache: 'no-store' })
    if (res.ok) {
      const json = (await res.json()) as { eventos?: IptMissaoEventoDto[] }
      remotos = (json.eventos ?? []).map(dtoToEvento)
    }
  } catch {
    // fallback local
  }

  const locais = lerEventosLocais().filter((e) => {
    if (params?.missao && params.missao !== 'todas' && e.missao !== params.missao) return false
    if (params?.sentido && params.sentido !== 'todos' && e.sentido !== params.sentido) return false
    if (params?.municipio) {
      const alvo = normalizeIptMunicipio(params.municipio)
      if (e.municipioNormalizado !== alvo) return false
    }
    return true
  })

  const byId = new Map<string, IptMissaoEvento>()
  for (const e of [...remotos, ...locais]) byId.set(e.id, e)
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, params?.limit ?? 300)
}

type IptMissaoEventoDto = {
  id: string
  municipio: string
  municipio_normalizado: string
  missao: IptMissaoId
  sentido: IptMissaoMudancaSentido
  motivo: string
  detalhes?: Record<string, string | number | boolean | null>
  fonte?: IptMissaoEventoFonte
  created_at: string
}

function dtoToEvento(row: IptMissaoEventoDto): IptMissaoEvento {
  return {
    id: row.id,
    municipio: row.municipio,
    municipioNormalizado: row.municipio_normalizado,
    missao: row.missao,
    sentido: row.sentido,
    motivo: row.motivo,
    detalhes: row.detalhes ?? {},
    fonte: row.fonte ?? 'sync',
    createdAt: row.created_at,
  }
}

export function labelSentidoMissao(sentido: IptMissaoMudancaSentido): string {
  return sentido === 'entrou' ? 'Entrou' : 'Saiu'
}

/** Ainda está na missão? (útil no modal) */
export function municipioAindaNaMissao(
  municipios: IptMunicipio[],
  municipio: string,
  missao: IptMissaoId
): boolean {
  const m = municipios.find((x) => x.municipio === municipio)
  return m ? municipioNaMissao(m, missao) : false
}
