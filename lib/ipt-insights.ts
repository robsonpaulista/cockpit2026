import { z } from 'zod'
import {
  classificarPrioridade,
  iptLabelIndicador,
  IPT_SINAL_LABEL,
  normalizeIptMunicipio,
  type IptIndicador,
  type IptMunicipio,
  type IptPrioridade,
  type IptSinal,
} from '@/lib/ipt'

export const IPT_INDICADORES: IptIndicador[] = ['visitas', 'obras', 'pesquisa']

export const IPT_SINAIS: IptSinal[] = ['bem', 'mal', 'neutro', 'sem_dado']

export type IptMunicipioInsightRow = {
  id: string
  municipio: string
  municipio_normalizado: string
  indicador: IptIndicador
  body: string
  altera_avaliacao: boolean
  sinal_override: IptSinal | null
  restaurar_automatico: boolean
  sinal_visitas_calculado: IptSinal | null
  sinal_obras_calculado: IptSinal | null
  sinal_pesquisa_calculado: IptSinal | null
  prioridade_calculada: IptPrioridade | null
  created_by: string | null
  created_at: string
  profiles?: { name: string | null; email: string | null } | null
}

export type IptInsightOverrideMap = Map<string, Partial<Record<IptIndicador, IptSinal>>>

export const createIptInsightSchema = z
  .object({
    municipio: z.string().min(1),
    indicador: z.enum(['visitas', 'obras', 'pesquisa']),
    body: z.string().trim().min(3, 'Descreva o insight em pelo menos 3 caracteres'),
    altera_avaliacao: z.boolean().optional().default(false),
    acao_avaliacao: z.enum(['nenhuma', 'definir', 'automatico']).optional(),
    sinal_override: z.enum(['bem', 'mal', 'neutro', 'sem_dado']).nullable().optional(),
    sinal_visitas_calculado: z.enum(['bem', 'mal', 'neutro', 'sem_dado']).nullable().optional(),
    sinal_obras_calculado: z.enum(['bem', 'mal', 'neutro', 'sem_dado']).nullable().optional(),
    sinal_pesquisa_calculado: z.enum(['bem', 'mal', 'neutro', 'sem_dado']).nullable().optional(),
    prioridade_calculada: z
      .enum(['critico', 'atencao', 'estavel', 'forte', 'sem_expectativa'])
      .nullable()
      .optional(),
  })
  .superRefine((data, ctx) => {
    const acao =
      data.acao_avaliacao ??
      (data.altera_avaliacao ? (data.sinal_override ? 'definir' : 'nenhuma') : 'nenhuma')

    if (acao === 'definir' && !data.sinal_override) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Informe o novo status do indicador',
        path: ['sinal_override'],
      })
    }
  })

export type CreateIptInsightInput = z.infer<typeof createIptInsightSchema>

export function resolveAcaoAvaliacao(input: CreateIptInsightInput): {
  altera_avaliacao: boolean
  sinal_override: IptSinal | null
  restaurar_automatico: boolean
} {
  const acao =
    input.acao_avaliacao ??
    (input.altera_avaliacao ? (input.sinal_override ? 'definir' : 'nenhuma') : 'nenhuma')

  if (acao === 'automatico') {
    return { altera_avaliacao: true, sinal_override: null, restaurar_automatico: true }
  }
  if (acao === 'definir' && input.sinal_override) {
    return { altera_avaliacao: true, sinal_override: input.sinal_override, restaurar_automatico: false }
  }
  return { altera_avaliacao: false, sinal_override: null, restaurar_automatico: false }
}

/** Último override ativo por município + indicador (ordem cronológica). */
export function buildOverrideMapFromInsights(rows: IptMunicipioInsightRow[]): IptInsightOverrideMap {
  const sorted = [...rows].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const map: IptInsightOverrideMap = new Map()

  for (const row of sorted) {
    if (!row.altera_avaliacao) continue
    const key = row.municipio_normalizado
    const cur = map.get(key) ?? {}
    if (row.restaurar_automatico) {
      delete cur[row.indicador]
    } else if (row.sinal_override) {
      cur[row.indicador] = row.sinal_override
    }
    map.set(key, cur)
  }

  return map
}

export function aplicarOverridesIpt(
  municipios: IptMunicipio[],
  overrides: IptInsightOverrideMap
): IptMunicipio[] {
  if (overrides.size === 0) return municipios

  return municipios.map((m) => {
    const key = normalizeIptMunicipio(m.municipio)
    const patch = overrides.get(key)
    if (!patch || Object.keys(patch).length === 0) return m

    const sinaisOriginais = { ...m.sinais }
    const sinais = { ...m.sinais }
    const overridesAtivos: NonNullable<IptMunicipio['overridesAtivos']> = {}

    for (const ind of IPT_INDICADORES) {
      const novo = patch[ind]
      if (novo) {
        sinais[ind] = novo
        overridesAtivos[ind] = { sinal: novo }
      }
    }

    const prioridade: IptPrioridade =
      m.expectativaVotos <= 0
        ? 'sem_expectativa'
        : classificarPrioridade(m.pesoExpectativaPct, sinais, m.expectativaVotos)

    return {
      ...m,
      prioridade,
      sinais,
      sinaisOriginais,
      overridesAtivos,
    }
  })
}

export function formatInsightAcaoLabel(row: IptMunicipioInsightRow): string | null {
  if (!row.altera_avaliacao) return null
  if (row.restaurar_automatico) return 'Voltou ao automático'
  if (row.sinal_override) {
    return `Avaliação → ${IPT_SINAL_LABEL[row.sinal_override]}`
  }
  return null
}

export function formatInsightIndicadorLabel(indicador: IptIndicador): string {
  return iptLabelIndicador(indicador)
}
