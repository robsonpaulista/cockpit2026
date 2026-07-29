import { normalizeIptMunicipio } from '@/lib/ipt'
import {
  demandaExcluidaPorTermo,
  type CampoDemandaObraRow,
} from '@/lib/campo-demandas-obras'
import {
  emendaEstaPaga,
  filtrarEmendasPorMunicipio,
  type EmendaRegistro,
} from '@/lib/emendas-filtro'
import type { WarRoomDisparo } from '@/lib/war-room/mock-data'

export type AgendaFluxoStatus =
  | 'pendente'
  | 'em_andamento'
  | 'concluido'
  | 'nao_se_aplica'

export type AgendaFluxoStepId =
  | 'agendamento'
  | 'comunicacao_lideres'
  | 'obras_cidade'
  | 'emendas_destinadas'
  | 'material_impulso'
  | 'impulso_autorizado'
  | 'envio_material'
  | 'mobilizacao'

export type AgendaFluxoStepDef = {
  id: AgendaFluxoStepId
  titulo: string
  descricao: string
  /** Se true, o status inicial pode ser derivado dos dados da cidade/agenda. */
  automatico?: boolean
}

export type AgendaFluxoStepState = {
  status: AgendaFluxoStatus
  nota?: string
  updatedAt?: string
}

/** Item da planilha Cadastro de Demandas (Google Sheets). */
export type AgendaFluxoDemandaItem = {
  id: string
  titulo: string
  status: string | null
  lideranca: string | null
}

/** Item do cadastro Emendas (mesma base de /dashboard/emendas). */
export type AgendaFluxoEmendaItem = {
  id: string
  titulo: string
  status: string | null
  meta: string | null
  /** Valor formatado (indicado / empenhado / pago). */
  valor: string | null
  /** Exercício da emenda (ano). */
  ano: number | null
}

export type AgendaFluxoEmendaColuna = {
  key: string
  label: string
  itens: AgendaFluxoEmendaItem[]
}

export type AgendaFluxoDisparoItem = {
  id: string
  campanha: string
  publico: string
  enviados: number
  clicksPct: number
}

export const AGENDA_FLUXO_STEPS: AgendaFluxoStepDef[] = [
  {
    id: 'agendamento',
    titulo: 'Agendamento',
    descricao: 'Compromisso confirmado na agenda com data, horário e local.',
    automatico: true,
  },
  {
    id: 'comunicacao_lideres',
    titulo: 'Comunicação com lideranças',
    descricao: 'Disparos recentes de WhatsApp vinculados ao município.',
    automatico: true,
  },
  {
    id: 'obras_cidade',
    titulo: 'Obras na cidade',
    descricao: 'Demandas do município na planilha Cadastro de Demandas (Google Sheets).',
    automatico: true,
  },
  {
    id: 'emendas_destinadas',
    titulo: 'Emendas destinadas',
    descricao: 'Emendas do mandato com município beneficiário nesta cidade (cadastro Emendas).',
    automatico: true,
  },
  {
    id: 'material_impulso',
    titulo: 'Material de impulsionamento',
    descricao: 'Peça/criativo de impulso pronto para uso.',
  },
  {
    id: 'impulso_autorizado',
    titulo: 'Impulsionamento autorizado',
    descricao: 'Autorização formal para impulsionar o conteúdo.',
  },
  {
    id: 'envio_material',
    titulo: 'Envio de material',
    descricao: 'Definição se haverá envio físico de material de campanha.',
  },
  {
    id: 'mobilizacao',
    titulo: 'Ação de mobilização',
    descricao: 'Ação de mobilização planejada para a visita.',
  },
]

export const AGENDA_FLUXO_STATUS_LABEL: Record<AgendaFluxoStatus, string> = {
  pendente: 'Pendente',
  em_andamento: 'Em andamento',
  concluido: 'Concluído',
  nao_se_aplica: 'N/A',
}

/** Texto do badge por etapa (presença, não “concluído”). */
export function agendaFluxoBadgeLabel(
  stepId: AgendaFluxoStepId,
  status: AgendaFluxoStatus,
): string {
  if (stepId === 'obras_cidade') {
    if (status === 'concluido') return 'Com demandas'
    if (status === 'nao_se_aplica') return 'Sem demandas'
  }
  if (stepId === 'emendas_destinadas') {
    if (status === 'concluido') return 'Com emendas'
    if (status === 'nao_se_aplica') return 'Sem emendas'
  }
  if (stepId === 'comunicacao_lideres') {
    if (status === 'concluido') return 'Com disparo'
    if (status === 'nao_se_aplica') return 'Sem disparo'
  }
  return AGENDA_FLUXO_STATUS_LABEL[status]
}

/** Classe visual do badge (etapas de presença usam tons próprios). */
export function agendaFluxoBadgeTone(
  stepId: AgendaFluxoStepId,
  status: AgendaFluxoStatus,
): string {
  if (stepId === 'obras_cidade') {
    if (status === 'concluido') return 'com_obras'
    if (status === 'nao_se_aplica') return 'sem_obras'
  }
  if (stepId === 'emendas_destinadas') {
    if (status === 'concluido') return 'com_emendas'
    if (status === 'nao_se_aplica') return 'sem_emendas'
  }
  if (stepId === 'comunicacao_lideres') {
    if (status === 'concluido') return 'com_disparo'
    if (status === 'nao_se_aplica') return 'sem_disparo'
  }
  return status
}

export type AgendaFluxoStateMap = Partial<Record<AgendaFluxoStepId, AgendaFluxoStepState>>

function storageKey(municipio: string, dataKey: string): string {
  return `wr-agenda-fluxo:${normalizeIptMunicipio(municipio)}:${dataKey}`
}

/** @deprecated Use `demandaExcluidaPorTermo` (mesmo filtro da Base Eleitoral · Demandas). */
export function demandaAgendaFluxoExcluidaPorTermo(
  ...partes: Array<string | null | undefined>
): boolean {
  const row: CampoDemandaObraRow = {
    title: partes.filter(Boolean).join(' '),
  }
  return demandaExcluidaPorTermo(row)
}

/** Normaliza resposta de `/api/campo/demands` para o fluxo da agenda. */
export function mapDemandasAgendaFluxo(raw: unknown[]): AgendaFluxoDemandaItem[] {
  return raw
    .map((item, index) => {
      if (!item || typeof item !== 'object') return null
      const row = item as Record<string, unknown>
      const id =
        typeof row.id === 'string' && row.id.trim()
          ? row.id.trim()
          : `demanda-${index}`
      const titulo =
        (typeof row.title === 'string' && row.title.trim()) ||
        (typeof row.titulo === 'string' && row.titulo.trim()) ||
        'Demanda sem título'
      const descricao =
        (typeof row.description === 'string' && row.description.trim()) ||
        (typeof row.descricao === 'string' && row.descricao.trim()) ||
        null
      const status =
        typeof row.status === 'string' && row.status.trim()
          ? row.status.trim()
          : null
      const theme =
        typeof row.theme === 'string' && row.theme.trim() ? row.theme.trim() : null
      const lideranca =
        (typeof row.lideranca === 'string' && row.lideranca.trim()) ||
        (typeof row.liderança === 'string' && row.liderança.trim()) ||
        null
      const sheetsData =
        row.sheets_data && typeof row.sheets_data === 'object'
          ? (row.sheets_data as CampoDemandaObraRow['sheets_data'])
          : undefined

      const demandaRow: CampoDemandaObraRow = {
        id,
        title: titulo,
        description: descricao,
        status,
        theme,
        lideranca,
        from_sheets: row.from_sheets === true,
        sheets_data: sheetsData,
      }

      // Mesmo filtro da Base Eleitoral · Demandas (custeio, recurso, transferência…).
      if (demandaExcluidaPorTermo(demandaRow)) return null

      return { id, titulo, status, lideranca }
    })
    .filter((item): item is AgendaFluxoDemandaItem => item !== null)
}

export type AgendaFluxoDemandaColuna = {
  key: string
  label: string
  itens: AgendaFluxoDemandaItem[]
}

function normalizeStatusDemanda(status: string | null | undefined): string {
  return (status ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .trim()
}

function metaColunaStatusDemanda(status: string | null | undefined): {
  key: string
  label: string
  order: number
} {
  const raw = (status ?? '').trim()
  const n = normalizeStatusDemanda(raw)
  if (!n) return { key: 'sem_status', label: 'Sem status', order: 90 }
  if (n.includes('andamento') || n.includes('progresso')) {
    return { key: 'em_andamento', label: raw || 'Em andamento', order: 10 }
  }
  if (n.includes('encaminhad')) {
    return { key: 'encaminhada', label: raw || 'Encaminhada', order: 20 }
  }
  if (n.includes('finaliz') || n.includes('conclu') || n.includes('resolvid')) {
    return { key: 'finalizada', label: raw || 'Finalizada', order: 30 }
  }
  if (n.includes('pendente') || n.includes('aguard')) {
    return { key: 'pendente', label: raw || 'Pendente', order: 40 }
  }
  return { key: `outro:${n}`, label: raw, order: 50 }
}

/** Agrupa demandas em colunas por status (ordem: andamento → demais → finalizada). */
export function groupDemandasAgendaFluxoPorStatus(
  demandas: AgendaFluxoDemandaItem[],
): AgendaFluxoDemandaColuna[] {
  const map = new Map<string, AgendaFluxoDemandaColuna & { order: number }>()
  for (const item of demandas) {
    const meta = metaColunaStatusDemanda(item.status)
    const prev = map.get(meta.key)
    if (prev) {
      prev.itens.push(item)
    } else {
      map.set(meta.key, {
        key: meta.key,
        label: meta.label,
        order: meta.order,
        itens: [item],
      })
    }
  }
  return [...map.values()]
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.label.localeCompare(b.label, 'pt-BR', { sensitivity: 'base' })
    })
    .map(({ order: _order, ...col }) => col)
}

function formatValorEmenda(n: number | null | undefined): string | null {
  if (n == null || !Number.isFinite(Number(n))) return null
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function parseEmendaRegistro(item: unknown, index: number): EmendaRegistro | null {
  if (!item || typeof item !== 'object') return null
  const row = item as Record<string, unknown>
  const id =
    typeof row.id === 'string' && row.id.trim()
      ? row.id.trim()
      : `emenda-${index}`
  const emenda =
    typeof row.emenda === 'string' && row.emenda.trim()
      ? row.emenda.trim()
      : ''
  const numOrNull = (v: unknown): number | null => {
    if (v == null || v === '') return null
    const n = typeof v === 'number' ? v : Number(v)
    return Number.isFinite(n) ? n : null
  }
  const strOrNull = (v: unknown): string | null => {
    if (typeof v !== 'string') return null
    const s = v.trim()
    return s || null
  }
  return {
    id,
    bloco: strOrNull(row.bloco),
    exercicio: numOrNull(row.exercicio),
    emenda,
    municipio_beneficiario: strOrNull(row.municipio_beneficiario),
    funcional: strOrNull(row.funcional),
    gnd: strOrNull(row.gnd),
    valor_indicado: numOrNull(row.valor_indicado),
    valor_empenhado: numOrNull(row.valor_empenhado),
    valor_a_empenhar: numOrNull(row.valor_a_empenhar),
    valor_pago: numOrNull(row.valor_pago),
    valor_a_ser_pago: numOrNull(row.valor_a_ser_pago),
    empenho: strOrNull(row.empenho),
    data_empenho: strOrNull(row.data_empenho),
    portaria_convenio: strOrNull(row.portaria_convenio),
    numero_proposta: strOrNull(row.numero_proposta),
    data_pagamento: strOrNull(row.data_pagamento),
    liderancas: strOrNull(row.liderancas),
    alteracao: strOrNull(row.alteracao),
    objeto: strOrNull(row.objeto),
  }
}

/** Emendas do município (mesma regra da página Emendas / ficha). */
export function listEmendasAgendaFluxo(
  raw: unknown[],
  municipio: string,
): AgendaFluxoEmendaItem[] {
  const registros = raw
    .map((item, index) => parseEmendaRegistro(item, index))
    .filter((item): item is EmendaRegistro => item !== null)

  return filtrarEmendasPorMunicipio(registros, municipio).map((e) => {
    const titulo = e.objeto?.trim() || e.emenda.trim() || 'Emenda sem objeto'
    const valor =
      formatValorEmenda(e.valor_indicado) ||
      formatValorEmenda(e.valor_empenhado) ||
      formatValorEmenda(e.valor_pago)
    const ano =
      e.exercicio != null && Number.isFinite(e.exercicio) ? Math.trunc(e.exercicio) : null
    const meta = [e.emenda.trim() || null, valor, e.bloco].filter(Boolean).join(' · ')
    return {
      id: e.id,
      titulo,
      status: emendaEstaPaga(e) ? 'Paga' : 'Em aberto',
      meta: meta || null,
      valor,
      ano,
    }
  })
}

/** Agrupa emendas em colunas por ano (mais recente primeiro). */
export function groupEmendasAgendaFluxoPorAno(
  emendas: AgendaFluxoEmendaItem[],
): AgendaFluxoEmendaColuna[] {
  const map = new Map<string, AgendaFluxoEmendaColuna & { order: number }>()
  for (const item of emendas) {
    const temAno = item.ano != null && Number.isFinite(item.ano)
    const key = temAno ? String(item.ano) : 'sem_ano'
    const label = temAno ? String(item.ano) : 'Sem ano'
    const order = temAno ? -(item.ano as number) : 1
    const prev = map.get(key)
    if (prev) {
      prev.itens.push(item)
    } else {
      map.set(key, { key, label, order, itens: [item] })
    }
  }
  return [...map.values()]
    .sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order
      return a.label.localeCompare(b.label, 'pt-BR')
    })
    .map(({ order: _order, ...col }) => col)
}

/** Disparos recentes associados ao município (campo cidade ou nome na campanha). */
export function listDisparosAgendaFluxo(
  municipio: string,
  disparos: WarRoomDisparo[],
): AgendaFluxoDisparoItem[] {
  const key = normalizeIptMunicipio(municipio)
  if (!key) return []

  return disparos
    .filter((d) => {
      if (d.cidade?.trim() && normalizeIptMunicipio(d.cidade) === key) return true
      const campanha = normalizeIptMunicipio(d.campanha)
      return campanha.includes(key)
    })
    .map((d, index) => ({
      id: `${normalizeIptMunicipio(d.campanha)}:${index}`,
      campanha: d.campanha,
      publico: d.publico,
      enviados: d.enviados,
      clicksPct: d.clicksPct,
    }))
}

export function loadAgendaFluxoState(
  municipio: string,
  dataKey: string,
): AgendaFluxoStateMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(storageKey(municipio, dataKey))
    if (!raw) return {}
    const parsed = JSON.parse(raw) as AgendaFluxoStateMap
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

export const AGENDA_FLUXO_CHANGED_EVENT = 'wr-agenda-fluxo-changed'
export const WR_OPEN_AGENDA_FLUXO_EVENT = 'wr-open-agenda-fluxo'

export type WrOpenAgendaFluxoDetail = {
  municipioKey: string
}

export function saveAgendaFluxoState(
  municipio: string,
  dataKey: string,
  state: AgendaFluxoStateMap,
): void {
  if (typeof window === 'undefined') return
  try {
    const manual: AgendaFluxoStateMap = {}
    for (const step of AGENDA_FLUXO_STEPS) {
      if (step.automatico) continue
      const st = state[step.id]
      if (st) manual[step.id] = st
    }
    window.localStorage.setItem(storageKey(municipio, dataKey), JSON.stringify(manual))
    window.dispatchEvent(
      new CustomEvent(AGENDA_FLUXO_CHANGED_EVENT, {
        detail: { municipio, dataKey },
      }),
    )
  } catch {
    /* ignore quota */
  }
}

export function isAgendaFluxoIncompleto(state: AgendaFluxoStateMap): boolean {
  return AGENDA_FLUXO_STEPS.some((s) => !isAgendaFluxoStepDone(state[s.id]?.status))
}

/** Etapas ainda não concluídas / N/A (para texto da fila). */
export function listAgendaFluxoEtapasPendentes(
  state: AgendaFluxoStateMap,
): AgendaFluxoStepDef[] {
  return AGENDA_FLUXO_STEPS.filter((s) => !isAgendaFluxoStepDone(state[s.id]?.status))
}

/**
 * Estado do fluxo para a fila de decisões (sem fetch de Demandas/Emendas).
 * Presença automática usa disparos locais; Demandas/Emendas entram como N/A
 * até o modal carregar a fonte real — a incompletude da fila é puxada sobretudo
 * pelas etapas manuais ainda pendentes.
 */
export function resolveAgendaFluxoStateForFila(opts: {
  municipio: string
  fluxoKey: string
  temAgendamento: boolean
  disparos: WarRoomDisparo[]
}): AgendaFluxoStateMap {
  const seed = buildAgendaFluxoSeed({
    temAgendamento: opts.temAgendamento,
    municipio: opts.municipio,
    demandas: [],
    demandasCarregadas: true,
    emendas: [],
    emendasCarregadas: true,
    disparos: opts.disparos,
  })
  return mergeAgendaFluxoState(
    seed,
    loadAgendaFluxoState(opts.municipio, opts.fluxoKey),
  )
}

/** Status iniciais derivados de agenda + disparos + Demandas + Emendas. */
export function buildAgendaFluxoSeed(opts: {
  temAgendamento: boolean
  municipio: string
  demandas: AgendaFluxoDemandaItem[]
  demandasCarregadas: boolean
  emendas: AgendaFluxoEmendaItem[]
  emendasCarregadas: boolean
  disparos: WarRoomDisparo[]
}): AgendaFluxoStateMap {
  const disparosMunicipio = listDisparosAgendaFluxo(opts.municipio, opts.disparos)
  const demandasQtd = opts.demandas.length
  const emendasQtd = opts.emendas.length
  const disparosQtd = disparosMunicipio.length
  const enviadosTotal = disparosMunicipio.reduce((acc, d) => acc + d.enviados, 0)

  return {
    agendamento: {
      status: opts.temAgendamento ? 'concluido' : 'pendente',
      nota: opts.temAgendamento
        ? 'Compromisso encontrado na agenda'
        : 'Sem compromisso nos próximos dias',
    },
    comunicacao_lideres: {
      status: disparosQtd > 0 ? 'concluido' : 'nao_se_aplica',
      nota:
        disparosQtd > 0
          ? `${disparosQtd} disparo${disparosQtd === 1 ? '' : 's'} · ${enviadosTotal.toLocaleString('pt-BR')} enviados`
          : 'Nenhum disparo recente vinculado a este município',
    },
    obras_cidade: opts.demandasCarregadas
      ? {
          status: demandasQtd > 0 ? 'concluido' : 'nao_se_aplica',
          nota:
            demandasQtd > 0
              ? `${demandasQtd} demanda${demandasQtd === 1 ? '' : 's'} na planilha Cadastro de Demandas`
              : 'Nenhuma demanda deste município na planilha Cadastro de Demandas',
        }
      : {
          status: 'pendente',
          nota: 'Carregando planilha Cadastro de Demandas',
        },
    emendas_destinadas: opts.emendasCarregadas
      ? {
          status: emendasQtd > 0 ? 'concluido' : 'nao_se_aplica',
          nota:
            emendasQtd > 0
              ? `${emendasQtd} emenda${emendasQtd === 1 ? '' : 's'} no cadastro Emendas para este município`
              : 'Nenhuma emenda destinada a este município no cadastro Emendas',
        }
      : {
          status: 'pendente',
          nota: 'Carregando cadastro Emendas',
        },
  }
}

export function mergeAgendaFluxoState(
  seed: AgendaFluxoStateMap,
  saved: AgendaFluxoStateMap,
): AgendaFluxoStateMap {
  const next: AgendaFluxoStateMap = {}
  for (const step of AGENDA_FLUXO_STEPS) {
    if (step.automatico && seed[step.id]) {
      next[step.id] = seed[step.id]
    } else if (saved[step.id]) {
      next[step.id] = saved[step.id]
    } else if (seed[step.id]) {
      next[step.id] = seed[step.id]
    } else {
      next[step.id] = { status: 'pendente' }
    }
  }
  return next
}

export function countAgendaFluxoProgress(state: AgendaFluxoStateMap): {
  done: number
  total: number
  pct: number
} {
  const total = AGENDA_FLUXO_STEPS.length
  const done = AGENDA_FLUXO_STEPS.filter((s) => {
    const st = state[s.id]?.status
    return st === 'concluido' || st === 'nao_se_aplica'
  }).length
  return {
    done,
    total,
    pct: total > 0 ? Math.round((done / total) * 100) : 0,
  }
}

export function isAgendaFluxoStepDone(status: AgendaFluxoStatus | undefined): boolean {
  return status === 'concluido' || status === 'nao_se_aplica'
}

export function agendaFluxoDependencias(
  stepId: AgendaFluxoStepId,
  state: AgendaFluxoStateMap,
): Array<{ id: AgendaFluxoStepId; titulo: string; ok: boolean }> {
  const idx = AGENDA_FLUXO_STEPS.findIndex((s) => s.id === stepId)
  if (idx <= 0) return []
  return AGENDA_FLUXO_STEPS.slice(0, idx).map((s) => ({
    id: s.id,
    titulo: s.titulo,
    ok: isAgendaFluxoStepDone(state[s.id]?.status),
  }))
}

export type AgendaFluxoPrioridade = 'alta' | 'media' | 'baixa'

export const AGENDA_FLUXO_PRIORIDADE_LABEL: Record<AgendaFluxoPrioridade, string> = {
  alta: 'Alta',
  media: 'Média',
  baixa: 'Baixa',
}
