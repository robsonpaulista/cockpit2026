export type ObraMapaVisao = 'operacional' | 'comunicacao'

export type ObraMapaTema =
  | 'asfalto'
  | 'paralelepipedo'
  | 'quadras-esportivas'
  | 'maquinario-agricola'
  | 'passagens-cisternas'
  | 'outros'
export type ObraMapaTemaFiltro = ObraMapaTema | 'todos'

export interface ObraMapaTemaConfig {
  id: ObraMapaTemaFiltro
  label: string
  titulo: string
  descricao: string
  kpiEscopo: string
  kpiTipo: string
}

export const OBRA_MAPA_TEMAS: ObraMapaTemaConfig[] = [
  {
    id: 'todos',
    label: 'Todos os temas',
    titulo: 'Mapa de Obras · Visão geral',
    descricao:
      'Municípios com obras cadastradas por tema. Cidades com mais de um tipo exibem um marcador para cada categoria.',
    kpiEscopo: 'municípios com obras',
    kpiTipo: 'Todos os temas mapeados',
  },
  {
    id: 'asfalto',
    label: 'Asfalto',
    titulo: 'Mapa de Obras · Asfalto',
    descricao:
      'Municípios com obras de pavimentação asfáltica (CBUQ, TSD e similares) cadastradas, classificadas por fase com base no status da obra.',
    kpiEscopo: 'municípios com asfalto',
    kpiTipo: 'Pavimentação asfáltica',
  },
  {
    id: 'paralelepipedo',
    label: 'Paralelepípedo',
    titulo: 'Mapa de Obras · Paralelepípedo',
    descricao:
      'Municípios com obras de pavimentação em paralelepípedo cadastradas, classificadas por fase com base no status da obra.',
    kpiEscopo: 'municípios com paralelepípedo',
    kpiTipo: 'Pavimentação em paralelepípedo',
  },
  {
    id: 'quadras-esportivas',
    label: 'Quadras e areninhas',
    titulo: 'Mapa de Obras · Quadras e areninhas',
    descricao:
      'Municípios com obras de quadras esportivas, areninhas, campos society e reformas de estádio, classificadas por fase com base no status da obra.',
    kpiEscopo: 'municípios com quadras/areninhas',
    kpiTipo: 'Quadras, society e estádios',
  },
  {
    id: 'maquinario-agricola',
    label: 'Maquinário agrícola',
    titulo: 'Mapa de Obras · Maquinário agrícola',
    descricao:
      'Municípios com entrega ou aquisição de trator, escavadeira, arado e demais maquinários agrícolas, classificados por fase.',
    kpiEscopo: 'municípios com maquinário agrícola',
    kpiTipo: 'Trator, escavadeira, arado e afins',
  },
  {
    id: 'passagens-cisternas',
    label: 'Passagens e cisternas',
    titulo: 'Mapa de Obras · Passagens e cisternas',
    descricao:
      'Municípios com passagens molhadas, cisternas e infraestrutura de captação/armazenamento de água.',
    kpiEscopo: 'municípios com obras de água',
    kpiTipo: 'Passagens molhadas e cisternas',
  },
  {
    id: 'outros',
    label: 'Outros',
    titulo: 'Mapa de Obras · Outros',
    descricao:
      'Demais obras da planilha Jadyel (praças, estradas vicinais, cofinanciamentos e outras entregas por município).',
    kpiEscopo: 'municípios com outras obras',
    kpiTipo: 'Obras diversas do mandato',
  },
]

export const OBRA_MAPA_TEMAS_OBRA: ObraMapaTema[] = [
  'asfalto',
  'paralelepipedo',
  'quadras-esportivas',
  'maquinario-agricola',
  'passagens-cisternas',
  'outros',
]

export function obraMapaTemaConfig(tema: ObraMapaTemaFiltro): ObraMapaTemaConfig {
  return OBRA_MAPA_TEMAS.find((t) => t.id === tema) ?? OBRA_MAPA_TEMAS[1]
}

export type ObraFaseMapa = 'em_andamento' | 'finalizada' | 'a_iniciar' | 'outro'

export type ObraFaseFiltro = 'todas' | ObraFaseMapa

export interface ObraMapaRow {
  id: string
  municipio: string
  obra?: string | null
  status?: string | null
  tipo?: string | null
  orgao?: string | null
  valor_total?: number | null
  /** Cota parlamentar / parcela atribuída na planilha (preferida no mapa). */
  cota?: number | null
  imagem_url?: string | null
}

/**
 * Valor monetário exibido no Mapa de Obras: usa Cota quando existir;
 * senão cai para Valor (total da obra).
 */
export function valorExibidoMapaObra(obra: Pick<ObraMapaRow, 'cota' | 'valor_total'>): number | null {
  const cota = obra.cota
  if (typeof cota === 'number' && Number.isFinite(cota)) return cota
  const valor = obra.valor_total
  if (typeof valor === 'number' && Number.isFinite(valor)) return valor
  return null
}

/**
 * Linha de total/subtotal da planilha (ex.: obra === "Total").
 * Não é entrega — só agrega valores e infla KPIs/listas.
 */
export function isObraLinhaTotalPlanilha(
  obra: { obra?: string | null } | string | null | undefined
): boolean {
  const nome =
    typeof obra === 'string'
      ? obra
      : String((obra as { obra?: string | null } | null | undefined)?.obra ?? '')
  const norm = nome
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  if (!norm) return false
  if (norm === 'total' || norm === 'subtotal') return true
  if (/^total\b/.test(norm) && norm.length <= 24) return true
  return false
}

export interface MunicipioObrasResumo {
  municipio: string
  fase: ObraFaseMapa
  total: number
  emAndamento: number
  finalizadas: number
  aIniciar: number
  obras: ObraMapaRow[]
}

export interface MunicipioObrasMarcador extends MunicipioObrasResumo {
  tema: ObraMapaTema
  markerKey: string
}

export function obraMarcadorKey(municipio: string, tema: ObraMapaTema): string {
  return `${municipio}::${tema}`
}

export function parseObraMarcadorKey(key: string): { municipio: string; tema: ObraMapaTema } | null {
  const sep = key.lastIndexOf('::')
  if (sep <= 0) return null
  const municipio = key.slice(0, sep)
  const tema = key.slice(sep + 2) as ObraMapaTema
  if (!OBRA_MAPA_TEMAS_OBRA.includes(tema)) return null
  return { municipio, tema }
}

export const OBRA_FASE_LABEL: Record<ObraFaseMapa, string> = {
  em_andamento: 'Em andamento',
  finalizada: 'Finalizada',
  a_iniciar: 'A iniciar',
  outro: 'Outro',
}

export const OBRA_FASE_COLOR: Record<ObraFaseMapa, string> = {
  em_andamento: '#2563EB',
  finalizada: '#059669',
  a_iniciar: '#D97706',
  outro: '#6B7280',
}

const FASE_PRIORITY: Record<ObraFaseMapa, number> = {
  em_andamento: 3,
  a_iniciar: 2,
  finalizada: 1,
  outro: 0,
}

export function normalizeObraText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
}

const ASFALTO_RE =
  /asfalt|cbuq|tsd|pmf|paviment|calcamento|recuperacao de estrada|estrada vicinal|restauracao.*estrada/

export function isObraParalelepipedo(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>): boolean {
  const tipo = normalizeObraText(obra.tipo ?? '')
  if (tipo === 'paralelepipedo') return true
  if (tipo === 'pavimentacao') {
    return /paralelepipedo/.test(normalizeObraText(obra.obra ?? ''))
  }

  const nome = normalizeObraText(obra.obra ?? '')
  return /paralelepipedo/.test(nome)
}

export function isObraAsfalto(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>): boolean {
  if (isObraParalelepipedo(obra)) return false

  const tipo = normalizeObraText(obra.tipo ?? '')
  if (tipo === 'asfalto') return true
  if (tipo === 'pavimentacao') return true

  const nome = normalizeObraText(obra.obra ?? '')
  return ASFALTO_RE.test(nome)
}

export function isObraPavimentacao(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>): boolean {
  return isObraAsfalto(obra) || isObraParalelepipedo(obra)
}

export function isObraQuadrasEsportivas(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>): boolean {
  if (isObraPavimentacao(obra)) return false

  const tipo = normalizeObraText(obra.tipo ?? '')
  if (/quadra|areninha|esportiv|poliesportiv|campo sintet|ginasio/.test(tipo)) return true

  const nome = normalizeObraText(obra.obra ?? '')
  return /quadra|areninha|esportiv|poliesportiv|campo sintet|ginasio|futebol de areia|beach tennis|campo de areia|society|estadio|reforma de estadio/.test(
    nome
  )
}

const PASSAGENS_CISTERNAS_RE =
  /passagem molhada|passagens molhadas|cisterna|cisternas|sistema de abastecimento de agua|abastecimento de agua/

export function isObraPassagensCisternas(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>): boolean {
  if (isObraPavimentacao(obra) || isObraQuadrasEsportivas(obra) || isObraMaquinarioAgricola(obra)) {
    return false
  }

  const tipo = normalizeObraText(obra.tipo ?? '')
  if (tipo === 'passagens-cisternas') return true
  if (PASSAGENS_CISTERNAS_RE.test(tipo)) return true

  const nome = normalizeObraText(obra.obra ?? '')
  return PASSAGENS_CISTERNAS_RE.test(nome)
}

const MAQUINARIO_AGRICOLA_RE =
  /trator|escavadeira|retroescavadeira|arado|grade aradora|colheitadeira|plantadeira|pulverizador|subsolador|implemento agricola|maquinario agricola|maquina agricola|maquinario|entrega de trator|aquisicao de trator|trator agricola/

export function isObraMaquinarioAgricola(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>): boolean {
  if (isObraPavimentacao(obra) || isObraQuadrasEsportivas(obra)) return false

  const tipo = normalizeObraText(obra.tipo ?? '')
  if (MAQUINARIO_AGRICOLA_RE.test(tipo)) return true

  const nome = normalizeObraText(obra.obra ?? '')
  return MAQUINARIO_AGRICOLA_RE.test(nome)
}

export function obraCorrespondeTema(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>, tema: ObraMapaTema): boolean {
  const tipoSlug = normalizeObraText(obra.tipo ?? '')
  if (tipoSlug === tema) return true
  if (tema === 'outros') {
    return (
      tipoSlug === 'outros' ||
      (!isObraAsfalto(obra) &&
        !isObraParalelepipedo(obra) &&
        !isObraQuadrasEsportivas(obra) &&
        !isObraMaquinarioAgricola(obra) &&
        !isObraPassagensCisternas(obra))
    )
  }
  if (tema === 'asfalto') return isObraAsfalto(obra)
  if (tema === 'paralelepipedo') return isObraParalelepipedo(obra)
  if (tema === 'quadras-esportivas') return isObraQuadrasEsportivas(obra)
  if (tema === 'maquinario-agricola') return isObraMaquinarioAgricola(obra)
  if (tema === 'passagens-cisternas') return isObraPassagensCisternas(obra)
  return false
}

export function filtrarObrasPorTema(obras: ObraMapaRow[], tema: ObraMapaTema): ObraMapaRow[] {
  return obras.filter((obra) => obraCorrespondeTema(obra, tema))
}

export function filtrarObrasPavimentacao(obras: ObraMapaRow[]): ObraMapaRow[] {
  return obras.filter((obra) => isObraPavimentacao(obra))
}

export function filtrarObrasAsfalto(obras: ObraMapaRow[]): ObraMapaRow[] {
  return filtrarObrasPorTema(obras, 'asfalto')
}

export function filtrarObrasParalelepipedo(obras: ObraMapaRow[]): ObraMapaRow[] {
  return filtrarObrasPorTema(obras, 'paralelepipedo')
}

export function classificarObraFase(status: string | null | undefined): ObraFaseMapa {
  const s = normalizeObraText(status ?? '')
  if (!s) return 'a_iniciar'

  if (/conclu|finaliz|executad|encerrad|concluida/.test(s)) return 'finalizada'
  if (/andamento|execu|em curso|o\.?s\.?\s*public|publicada|medicao|medicao|em exec/.test(s)) {
    return 'em_andamento'
  }
  if (/aguard|a iniciar|planej|licit|orcament|paralis|nao inici|não inici|em projeto/.test(s)) {
    return 'a_iniciar'
  }

  return 'outro'
}

function faseDominante(contagem: Record<ObraFaseMapa, number>): ObraFaseMapa {
  const ordem: ObraFaseMapa[] = ['em_andamento', 'a_iniciar', 'finalizada', 'outro']
  return ordem.reduce((best, fase) =>
    contagem[fase] > contagem[best] ? fase : contagem[fase] === contagem[best] && FASE_PRIORITY[fase] > FASE_PRIORITY[best] ? fase : best
  )
}

export function agregarObrasPorMunicipio(obras: ObraMapaRow[]): MunicipioObrasResumo[] {
  const porMunicipio = new Map<string, MunicipioObrasResumo>()

  for (const obra of obras) {
    const municipio = obra.municipio?.trim()
    if (!municipio) continue

    const fase = classificarObraFase(obra.status)
    const atual = porMunicipio.get(municipio) ?? {
      municipio,
      fase: 'outro' as ObraFaseMapa,
      total: 0,
      emAndamento: 0,
      finalizadas: 0,
      aIniciar: 0,
      obras: [],
    }

    atual.total += 1
    atual.obras.push(obra)
    if (fase === 'em_andamento') atual.emAndamento += 1
    else if (fase === 'finalizada') atual.finalizadas += 1
    else if (fase === 'a_iniciar') atual.aIniciar += 1

    porMunicipio.set(municipio, atual)
  }

  return [...porMunicipio.values()]
    .map((row) => {
      const contagem: Record<ObraFaseMapa, number> = {
        em_andamento: row.emAndamento,
        finalizada: row.finalizadas,
        a_iniciar: row.aIniciar,
        outro: row.total - row.emAndamento - row.finalizadas - row.aIniciar,
      }
      return { ...row, fase: faseDominante(contagem) }
    })
    .sort((a, b) => a.municipio.localeCompare(b.municipio, 'pt-BR'))
}

export function temasComObrasNoMunicipio(obras: ObraMapaRow[], municipio: string): ObraMapaTema[] {
  return OBRA_MAPA_TEMAS_OBRA.filter((tema) =>
    obras.some((obra) => obra.municipio?.trim() === municipio && obraCorrespondeTema(obra, tema))
  )
}

export function agregarMarcadoresPorMunicipioETema(
  obras: ObraMapaRow[],
  temaFiltro: ObraMapaTemaFiltro
): MunicipioObrasMarcador[] {
  const temas =
    temaFiltro === 'todos' ? OBRA_MAPA_TEMAS_OBRA : [temaFiltro]

  const marcadores: MunicipioObrasMarcador[] = []

  for (const tema of temas) {
    const obrasTema = filtrarObrasPorTema(obras, tema)
    const agregados = agregarObrasPorMunicipio(obrasTema)
    for (const row of agregados) {
      marcadores.push({
        ...row,
        tema,
        markerKey: obraMarcadorKey(row.municipio, tema),
      })
    }
  }

  return marcadores.sort((a, b) => {
    const byMunicipio = a.municipio.localeCompare(b.municipio, 'pt-BR')
    if (byMunicipio !== 0) return byMunicipio
    return a.tema.localeCompare(b.tema)
  })
}

/** Desloca marcadores quando o município tem mais de um tema, evitando sobreposição. */
export function coordsMarcadorPorTema(
  base: { lat: number; lng: number },
  tema: ObraMapaTema,
  temasNoMunicipio: ObraMapaTema[]
): { lat: number; lng: number } {
  if (temasNoMunicipio.length <= 1) return base

  const idx = temasNoMunicipio.indexOf(tema)
  if (idx < 0) return base

  const angle = (2 * Math.PI * idx) / temasNoMunicipio.length - Math.PI / 2
  const radius = 0.042
  return {
    lat: base.lat + radius * Math.cos(angle),
    lng: base.lng + radius * Math.sin(angle),
  }
}

export function listarMunicipiosComObras(
  obras: ObraMapaRow[],
  temaFiltro: ObraMapaTemaFiltro
): string[] {
  const fonte = temaFiltro === 'todos' ? obras : filtrarObrasPorTema(obras, temaFiltro)
  const municipios = new Set<string>()
  for (const obra of fonte) {
    const municipio = obra.municipio?.trim()
    if (!municipio) continue
    const norm = municipio
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
    // Exclui agregados da planilha que não são município do PI.
    if (/diversos\s+municipios/.test(norm) || /municipio nao informado/.test(norm)) continue
    municipios.add(municipio)
  }
  return [...municipios].sort((a, b) => a.localeCompare(b, 'pt-BR'))
}

export function filtrarMarcadoresPorMunicipio(
  marcadores: MunicipioObrasMarcador[],
  municipio: string | null | undefined
): MunicipioObrasMarcador[] {
  const alvo = municipio?.trim()
  if (!alvo) return marcadores
  return marcadores.filter((m) => m.municipio.trim() === alvo)
}

export function filtrarMarcadoresPorFase(
  marcadores: MunicipioObrasMarcador[],
  filtro: ObraFaseFiltro
): MunicipioObrasMarcador[] {
  if (filtro === 'todas') return marcadores
  return marcadores.filter((m) => {
    if (filtro === 'em_andamento') return m.emAndamento > 0
    if (filtro === 'finalizada') return m.finalizadas > 0
    if (filtro === 'a_iniciar') return m.aIniciar > 0
    return m.total - m.emAndamento - m.finalizadas - m.aIniciar > 0
  })
}

export function filtrarMunicipiosPorFase(
  municipios: MunicipioObrasResumo[],
  filtro: ObraFaseFiltro
): MunicipioObrasResumo[] {
  if (filtro === 'todas') return municipios
  return municipios.filter((m) => {
    if (filtro === 'em_andamento') return m.emAndamento > 0
    if (filtro === 'finalizada') return m.finalizadas > 0
    if (filtro === 'a_iniciar') return m.aIniciar > 0
    return m.total - m.emAndamento - m.finalizadas - m.aIniciar > 0
  })
}

export function faseMarkerParaMunicipio(
  municipio: MunicipioObrasResumo,
  filtro: ObraFaseFiltro
): ObraFaseMapa {
  if (filtro === 'em_andamento') return 'em_andamento'
  if (filtro === 'finalizada') return 'finalizada'
  if (filtro === 'a_iniciar') return 'a_iniciar'
  if (filtro === 'outro') return 'outro'
  return municipio.fase
}
