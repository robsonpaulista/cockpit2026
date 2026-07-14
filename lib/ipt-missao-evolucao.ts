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
  type IptMissaoId,
  type IptMissaoMudancaSentido,
} from '@/lib/ipt-missoes'

export type IptMissaoEventoFonte = 'sync' | 'manual' | 'bootstrap'

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
const EVENTOS_LOCAL_KEY = 'ipt-missao-eventos-local-v1'
const MAX_EVENTOS_LOCAL = 800

function sinalLabel(sinal: IptSinal): string {
  return IPT_SINAL_LABEL[sinal] ?? sinal
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

  const detalhes: Record<string, string | number | boolean | null> = {
    expectativaVotos: m.expectativaVotos,
    pesoExpectativaPct: m.pesoExpectativaPct,
    prioridade: m.prioridade,
    sinalVisitas: m.sinais.visitas,
    sinalPesquisa: m.sinais.pesquisa,
    sinalDigital: m.sinais.digital,
    sinalObras: m.sinais.obras,
    visitasPeriodo: m.detalhes.visitasNoPeriodo,
    obrasQtd: m.detalhes.obrasQuantidade,
    obrasDivulgacaoPosts: m.detalhes.obrasDivulgacaoPosts ?? 0,
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
  fonte: IptMissaoEventoFonte = 'sync'
): { membrosAtuais: Record<IptMissaoId, string[]>; eventos: IptMissaoEvento[] } {
  const membrosAtuais = membrosPorMissao(municipios)
  if (!membrosAnteriores) {
    return { membrosAtuais, eventos: [] }
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
      eventos.push({
        id: newId(),
        municipio: mud.municipio,
        municipioNormalizado: normalizeIptMunicipio(mud.municipio),
        missao,
        sentido: mud.sentido,
        motivo,
        detalhes,
        fonte,
        createdAt: agora,
      })
    }
  }

  eventos.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return b.createdAt.localeCompare(a.createdAt)
    return a.municipio.localeCompare(b.municipio, 'pt-BR')
  })

  return { membrosAtuais, eventos }
}

/** Primeira carga: marca sync sem gerar eventos (bootstrap). */
export function bootstrapMissaoSync(municipios: IptMunicipio[]): void {
  salvarMembrosSync(membrosPorMissao(municipios))
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
