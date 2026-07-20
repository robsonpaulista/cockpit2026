/**
 * Biblioteca de Comunicação — linguagem oficial do Cockpit.
 * Canva é só repositório visual; o Cockpit resolve por código TPL* / categoria.
 */

export const COMUNICACAO_SLOTS = [
  'cidade',
  'titulo',
  'subtitulo',
  'descricao',
  'numero',
  'metragem',
  'rua',
  'data',
  'parceiro',
  'logo',
  'foto_principal',
  'foto_secundaria',
  'cta',
  'qr_code',
  'hashtag',
  'assinatura',
  'legenda',
] as const

export type ComunicacaoSlot = (typeof COMUNICACAO_SLOTS)[number]

export type ComunicacaoFormato = 'feed' | 'story' | 'reels' | 'whatsapp' | 'banner'

export type ComunicacaoCategoriaCodigo =
  | 'OBRA_IMPACTO'
  | 'CIDADE_BENEFICIADA'
  | 'PRESTACAO_CONTAS'
  | 'AGENDA_CHEGADA'
  | 'FRASE_LOCAL'
  | 'ANTES_DEPOIS'
  | 'AGRADECIMENTO'
  | 'DADO_ESTATISTICO'
  | 'PESQUISA'
  | 'HOSPITAL_AMOR'
  | 'ECA_DIGITAL'
  | 'CAUSA_ANIMAL'

export type ComunicacaoCategoria = {
  codigo: ComunicacaoCategoriaCodigo
  nome: string
  pastaCanva: string
  objetivo: string
  quandoUsar: string
  descricao: string
}

export type ComunicacaoTemplate = {
  codigo: string
  categoria: ComunicacaoCategoriaCodigo
  versao: string
  formato: ComunicacaoFormato
  nomeCanva: string
  canvaDesignUrl: string | null
  canvaBrandTemplateId: string | null
  ativo: boolean
  padrao: boolean
  slots: ComunicacaoSlot[]
}

/** Pastas no Canva = por objetivo, não por formato. */
export const COMUNICACAO_PASTAS_CANVA = [
  'Prestação de Contas',
  'Obras',
  'Agenda',
  'Bandeiras',
  'Institucional',
  'Mobilização',
] as const

export const COMUNICACAO_CATEGORIAS: ComunicacaoCategoria[] = [
  {
    codigo: 'OBRA_IMPACTO',
    nome: 'Obra impacto',
    pastaCanva: 'Obras',
    objetivo: 'Prestação de contas; impulsionamento',
    quandoUsar: 'Obra concluída, inaugurada ou em destaque',
    descricao: 'Divulgação de obra entregue / impacto',
  },
  {
    codigo: 'CIDADE_BENEFICIADA',
    nome: 'Cidade beneficiada',
    pastaCanva: 'Obras',
    objetivo: 'Prestação de contas; mobilização',
    quandoUsar: 'Cidade contemplada por entrega',
    descricao: 'Cidade contemplada',
  },
  {
    codigo: 'PRESTACAO_CONTAS',
    nome: 'Prestação de contas',
    pastaCanva: 'Prestação de Contas',
    objetivo: 'Prestação de contas',
    quandoUsar: 'Resultado do mandato / entrega',
    descricao: 'Resultado institucional',
  },
  {
    codigo: 'AGENDA_CHEGADA',
    nome: 'Agenda chegada',
    pastaCanva: 'Agenda',
    objetivo: 'Agenda; mobilização',
    quandoUsar: 'Antes/durante visita',
    descricao: 'Aviso de agenda / presença',
  },
  {
    codigo: 'FRASE_LOCAL',
    nome: 'Frase local',
    pastaCanva: 'Mobilização',
    objetivo: 'Mobilização; pós-visita',
    quandoUsar: 'Story humanizado',
    descricao: 'Frase emocional local',
  },
  {
    codigo: 'ANTES_DEPOIS',
    nome: 'Antes e depois',
    pastaCanva: 'Obras',
    objetivo: 'Prestação de contas',
    quandoUsar: 'Comparativo visual',
    descricao: 'Comparativo',
  },
  {
    codigo: 'AGRADECIMENTO',
    nome: 'Agradecimento',
    pastaCanva: 'Agenda',
    objetivo: 'Pós-evento',
    quandoUsar: 'Após visita/evento',
    descricao: 'Pós-evento',
  },
  {
    codigo: 'DADO_ESTATISTICO',
    nome: 'Dado estatístico',
    pastaCanva: 'Institucional',
    objetivo: 'Institucional; pesquisa',
    quandoUsar: 'KPI / indicador',
    descricao: 'KPI/Indicadores',
  },
  {
    codigo: 'PESQUISA',
    nome: 'Pesquisa',
    pastaCanva: 'Institucional',
    objetivo: 'Pesquisa eleitoral',
    quandoUsar: 'Divulgação de pesquisa',
    descricao: 'Pesquisa eleitoral',
  },
  {
    codigo: 'HOSPITAL_AMOR',
    nome: 'Hospital do Amor',
    pastaCanva: 'Bandeiras',
    objetivo: 'Bandeira',
    quandoUsar: 'Campanha bandeira',
    descricao: 'Bandeira Hospital do Amor',
  },
  {
    codigo: 'ECA_DIGITAL',
    nome: 'ECA Digital',
    pastaCanva: 'Bandeiras',
    objetivo: 'Bandeira',
    quandoUsar: 'Campanha bandeira',
    descricao: 'Bandeira ECA Digital',
  },
  {
    codigo: 'CAUSA_ANIMAL',
    nome: 'Causa animal',
    pastaCanva: 'Bandeiras',
    objetivo: 'Bandeira',
    quandoUsar: 'Campanha bandeira',
    descricao: 'Bandeira causa animal',
  },
]

/** Seed estático V1 — URLs vêm do banco quando cadastradas. */
export const COMUNICACAO_TEMPLATES_SEED: ComunicacaoTemplate[] = [
  tpl('TPL001', 'OBRA_IMPACTO', 'V1', 'feed'),
  tpl('TPL002', 'OBRA_IMPACTO', 'V1', 'story'),
  tpl('TPL003', 'OBRA_IMPACTO', 'V1', 'reels'),
  tpl('TPL004', 'CIDADE_BENEFICIADA', 'V1', 'feed'),
  tpl('TPL005', 'CIDADE_BENEFICIADA', 'V1', 'story'),
  tpl('TPL006', 'CIDADE_BENEFICIADA', 'V1', 'reels'),
  tpl('TPL007', 'AGENDA_CHEGADA', 'V1', 'feed'),
  tpl('TPL008', 'AGENDA_CHEGADA', 'V1', 'story'),
  tpl('TPL009', 'PRESTACAO_CONTAS', 'V1', 'feed'),
  tpl('TPL010', 'PRESTACAO_CONTAS', 'V1', 'story'),
  tpl('TPL011', 'FRASE_LOCAL', 'V1', 'story'),
  tpl('TPL012', 'FRASE_LOCAL', 'V1', 'feed'),
]

function tpl(
  codigo: string,
  categoria: ComunicacaoCategoriaCodigo,
  versao: string,
  formato: ComunicacaoFormato
): ComunicacaoTemplate {
  const formatoLabel =
    formato === 'feed'
      ? 'Feed'
      : formato === 'story'
        ? 'Story'
        : formato === 'reels'
          ? 'Reels'
          : formato === 'whatsapp'
            ? 'WhatsApp'
            : 'Banner'
  return {
    codigo,
    categoria,
    versao,
    formato,
    nomeCanva: `Cockpit | ${categoria} | ${versao} | ${formatoLabel}`,
    canvaDesignUrl: null,
    canvaBrandTemplateId: null,
    ativo: true,
    padrao: true,
    slots: [...COMUNICACAO_SLOTS],
  }
}

/** Legado conteudos_planejados.template → categoria oficial. */
export function categoriaFromLegacyTemplate(
  legacy: string | null | undefined
): ComunicacaoCategoriaCodigo | null {
  const t = (legacy ?? '').trim().toLowerCase()
  if (t === 'obra_impacto') return 'OBRA_IMPACTO'
  if (t === 'cidade_beneficiada') return 'CIDADE_BENEFICIADA'
  if (t === 'prestacao_contas') return 'PRESTACAO_CONTAS'
  if (t === 'agenda_chegada') return 'AGENDA_CHEGADA'
  if (t === 'frase_local') return 'FRASE_LOCAL'
  const upper = (legacy ?? '').trim().toUpperCase()
  if (COMUNICACAO_CATEGORIAS.some((c) => c.codigo === upper)) {
    return upper as ComunicacaoCategoriaCodigo
  }
  return null
}

/** Legado formato card/reels_capa → formato oficial. */
export function formatoFromLegacy(
  legacy: string | null | undefined
): ComunicacaoFormato {
  const f = (legacy ?? '').trim().toLowerCase()
  if (f === 'story') return 'story'
  if (f === 'reels' || f === 'reels_capa') return 'reels'
  if (f === 'whatsapp') return 'whatsapp'
  if (f === 'banner') return 'banner'
  return 'feed' // card, feed, geral
}

export function buildNomeCanva(
  categoria: string,
  versao: string,
  formato: ComunicacaoFormato
): string {
  const label =
    formato === 'feed'
      ? 'Feed'
      : formato === 'story'
        ? 'Story'
        : formato === 'reels'
          ? 'Reels'
          : formato === 'whatsapp'
            ? 'WhatsApp'
            : 'Banner'
  return `Cockpit | ${categoria} | ${versao} | ${label}`
}

export const CANVA_REGRA_BIBLIOTECA = `
NÃO crie design do zero. NÃO invente layout genérico.
1) No Canva, abra a pasta do objetivo (ex.: Obras) e DUPLIQUE o template indicado por codigo TPL / nomeCanva.
2) Preencha APENAS os slots do brief (cidade, textos, fotos, etc.). Slots vazios ficam como estão no mestre.
3) Mantenha identidade visual intacta (cores, tipografia, grades, logos fixos).
4) Exporte e registre no Cockpit com registrar_arte_gerada (informe o codigo TPL usado).
`.trim()
