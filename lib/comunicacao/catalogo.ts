import { createAdminClient } from '@/lib/supabase/admin'
import {
  CANVA_REGRA_BIBLIOTECA,
  COMUNICACAO_CATEGORIAS,
  COMUNICACAO_TEMPLATES_SEED,
  buildNomeCanva,
  categoriaFromLegacyTemplate,
  formatoFromLegacy,
  type ComunicacaoCategoria,
  type ComunicacaoCategoriaCodigo,
  type ComunicacaoFormato,
  type ComunicacaoTemplate,
} from '@/lib/comunicacao/types'

function mapRow(row: Record<string, unknown>): ComunicacaoTemplate {
  return {
    codigo: String(row.codigo),
    categoria: String(row.categoria) as ComunicacaoCategoriaCodigo,
    versao: String(row.versao ?? 'V1'),
    formato: String(row.formato) as ComunicacaoFormato,
    nomeCanva: String(row.nome_canva),
    canvaDesignUrl: (row.canva_design_url as string | null) ?? null,
    canvaBrandTemplateId: (row.canva_brand_template_id as string | null) ?? null,
    ativo: Boolean(row.ativo ?? true),
    padrao: Boolean(row.padrao ?? false),
    slots: Array.isArray(row.slots)
      ? (row.slots as ComunicacaoTemplate['slots'])
      : COMUNICACAO_TEMPLATES_SEED[0].slots,
  }
}

export async function listarCategoriasComunicacao(): Promise<ComunicacaoCategoria[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('comunicacao_categorias')
      .select('*')
      .eq('ativo', true)
      .order('codigo')
    if (error || !data?.length) return COMUNICACAO_CATEGORIAS
    return data.map((r) => ({
      codigo: String(r.codigo) as ComunicacaoCategoriaCodigo,
      nome: String(r.nome),
      pastaCanva: String(r.pasta_canva),
      objetivo: String(r.objetivo ?? ''),
      quandoUsar: String(r.quando_usar ?? ''),
      descricao: String(r.descricao ?? ''),
    }))
  } catch {
    return COMUNICACAO_CATEGORIAS
  }
}

export async function listarTemplatesComunicacao(): Promise<ComunicacaoTemplate[]> {
  try {
    const supabase = createAdminClient()
    const { data, error } = await supabase
      .from('comunicacao_templates')
      .select('*')
      .eq('ativo', true)
      .order('codigo')
    if (error || !data?.length) return COMUNICACAO_TEMPLATES_SEED
    return data.map((r) => mapRow(r as Record<string, unknown>))
  } catch {
    return COMUNICACAO_TEMPLATES_SEED
  }
}

/**
 * Resolve o template ativo: prioriza codigo TPL; senão categoria + formato (versão padrão).
 */
export async function resolverTemplateComunicacao(opts: {
  codigoTpl?: string | null
  categoria?: string | null
  formato?: string | null
  /** legado conteudos_planejados.template */
  legacyTemplate?: string | null
  /** legado conteudos_planejados.formato */
  legacyFormato?: string | null
}): Promise<{
  template: ComunicacaoTemplate
  categoria: ComunicacaoCategoria | null
  regra: string
} | null> {
  const all = await listarTemplatesComunicacao()
  const cats = await listarCategoriasComunicacao()

  if (opts.codigoTpl?.trim()) {
    const found = all.find((t) => t.codigo === opts.codigoTpl!.trim() && t.ativo)
    if (found) {
      return {
        template: found,
        categoria: cats.find((c) => c.codigo === found.categoria) ?? null,
        regra: CANVA_REGRA_BIBLIOTECA,
      }
    }
  }

  const categoria =
    (opts.categoria?.trim().toUpperCase() as ComunicacaoCategoriaCodigo | undefined) ||
    categoriaFromLegacyTemplate(opts.legacyTemplate)
  const formato =
    (opts.formato?.trim().toLowerCase() as ComunicacaoFormato | undefined) ||
    formatoFromLegacy(opts.legacyFormato)

  if (!categoria) return null

  const candidatos = all.filter(
    (t) => t.categoria === categoria && t.formato === formato && t.ativo
  )
  const padrao = candidatos.find((t) => t.padrao) ?? candidatos[0]
  if (padrao) {
    return {
      template: padrao,
      categoria: cats.find((c) => c.codigo === categoria) ?? null,
      regra: CANVA_REGRA_BIBLIOTECA,
    }
  }

  // Fallback sintético se seed/DB ainda sem essa combinação
  const synth: ComunicacaoTemplate = {
    codigo: `TPL-TMP-${categoria}-${formato}`,
    categoria,
    versao: 'V1',
    formato,
    nomeCanva: buildNomeCanva(categoria, 'V1', formato),
    canvaDesignUrl: null,
    canvaBrandTemplateId: null,
    ativo: true,
    padrao: true,
    slots: COMUNICACAO_TEMPLATES_SEED[0].slots,
  }
  return {
    template: synth,
    categoria: cats.find((c) => c.codigo === categoria) ?? null,
    regra: CANVA_REGRA_BIBLIOTECA,
  }
}

export async function catalogoBibliotecaComunicacao() {
  const [categorias, templates] = await Promise.all([
    listarCategoriasComunicacao(),
    listarTemplatesComunicacao(),
  ])
  return {
    regra: CANVA_REGRA_BIBLIOTECA,
    pastasCanva: [
      'Prestação de Contas',
      'Obras',
      'Agenda',
      'Bandeiras',
      'Institucional',
      'Mobilização',
    ],
    convencaoNome: 'Cockpit | CATEGORIA | VERSAO | Formato',
    exemplo: 'Cockpit | OBRA_IMPACTO | V1 | Feed',
    slotsPadrao: COMUNICACAO_TEMPLATES_SEED[0].slots,
    categorias,
    templates,
    comoOrganizarCanva: [
      'Crie pastas por OBJETIVO (Obras, Agenda, Prestação de Contas…), não por Story/Feed.',
      'Dentro de Obras: vários formatos da mesma categoria (Feed, Story, Reels, WhatsApp).',
      'Nomeie: Cockpit | OBRA_IMPACTO | V1 | Feed — versões V2/V3 para testes A/B.',
      'No Cockpit, cadastre a URL/ID em comunicacao_templates (codigo TPL*).',
      'O Fluxo Digital pede a CATEGORIA; a versão ativa é a marcada padrao=true.',
    ],
  }
}
