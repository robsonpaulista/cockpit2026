/**
 * Leitura de contexto das notícias do Radar 224 a partir dos títulos.
 * Classifica assunto (tema), papel (alerta/oportunidade/contexto) e resume o município.
 */

import type { RadarNoticiaItem } from '@/lib/radar-224/buscar-noticias'

export type RadarAssunto =
  | 'Segurança'
  | 'Saúde'
  | 'Educação'
  | 'Saúde/Educação'
  | 'Política'
  | 'Economia'
  | 'Infraestrutura'
  | 'Comunidade'
  | 'Meio ambiente'
  | 'Geral'

export type RadarPapelNoticia = 'alerta' | 'oportunidade' | 'contexto'

export type RadarNoticiaEnriquecida = RadarNoticiaItem & {
  assunto: RadarAssunto
  papel: RadarPapelNoticia
  papelLabel: string
  dataCurta: string
  eventoKey: string
}

export type RadarLeituraContexto = {
  movimentacao: 'baixa' | 'moderada' | 'alta'
  movimentacaoLabel: string
  assuntoDominante: RadarAssunto | null
  oportunidade: string | null
  acontecimentos: number
  materias: number
}

function normalize(value: string): string {
  return String(value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

const ASSUNTO_REGRAS: Array<{ assunto: RadarAssunto; termos: string[] }> = [
  {
    assunto: 'Segurança',
    termos: [
      'policia',
      'pm ',
      'prf',
      'prisao',
      'preso',
      'prende',
      'operacao',
      'homicidio',
      'assassinato',
      'roubo',
      'furto',
      'trafico',
      'drogas',
      'violencia',
      'tiroteio',
      'sequestro',
      'crime',
      'delegacia',
      'investig',
    ],
  },
  {
    assunto: 'Saúde',
    termos: [
      'saude',
      'hospital',
      'ubs',
      'medico',
      'medica',
      'oftalm',
      'vacina',
      'paciente',
      'samu',
      'uti',
      'dengue',
      'epidemia',
      'posto de saude',
      'atendimento',
    ],
  },
  {
    assunto: 'Educação',
    termos: [
      'educacao',
      'escola',
      'aluno',
      'professora',
      'professor',
      'creche',
      'universidade',
      'enem',
      'merenda',
      'sala de aula',
    ],
  },
  {
    assunto: 'Política',
    termos: [
      'prefeito',
      'prefeita',
      'vereador',
      'camara',
      'eleicao',
      'campanha',
      'partido',
      'deputado',
      'governo',
      'secretaria',
      'mandato',
      'eleitoral',
    ],
  },
  {
    assunto: 'Economia',
    termos: [
      'emprego',
      'economia',
      'comercio',
      'empresa',
      'investimento',
      'feira',
      'industria',
      'renda',
      'salario',
    ],
  },
  {
    assunto: 'Infraestrutura',
    termos: [
      'obra',
      'estrada',
      'asfalto',
      'paviment',
      'ponte',
      'saneamento',
      'agua',
      'energia',
      'iluminacao',
      'construcao',
    ],
  },
  {
    assunto: 'Meio ambiente',
    termos: ['incendio', 'queimada', 'rio ', 'desmat', 'chuva', 'enchente', 'ambiental'],
  },
  {
    assunto: 'Comunidade',
    termos: [
      'festa',
      'religioso',
      'igreja',
      'cultura',
      'esporte',
      'campeonato',
      'show',
      'procissao',
      'padroeiro',
      'comunidade',
    ],
  },
]

const ALERTA_TERMOS = [
  'prende',
  'preso',
  'prisao',
  'homicidio',
  'assassinato',
  'morte',
  'morre',
  'morreu',
  'tiroteio',
  'violencia',
  'roubo',
  'furto',
  'trafico',
  'investig',
  'denuncia',
  'fraude',
  'desvio',
  'incendio',
  'acidente',
  'alerta',
  'crise',
  'protesto',
  'greve',
  'falta de',
  'sem agua',
  'sem luz',
]

const OPORTUNIDADE_TERMOS = [
  'amplia',
  'ampliar',
  'inaugura',
  'inauguracao',
  'entrega',
  'projeto',
  'investimento',
  'convenio',
  'beneficio',
  'mutirao',
  'programa',
  'nova unidade',
  'reforma',
  'melhoria',
  'conquista',
  'aprovado',
  'recursos para',
  'atendimento',
  'vagas',
]

function classificarAssunto(blob: string): RadarAssunto {
  const hits: Partial<Record<RadarAssunto, number>> = {}
  for (const regra of ASSUNTO_REGRAS) {
    for (const termo of regra.termos) {
      if (blob.includes(termo)) {
        hits[regra.assunto] = (hits[regra.assunto] ?? 0) + 1
      }
    }
  }
  const saude = hits.Saúde ?? 0
  const educacao = hits.Educação ?? 0
  if (saude > 0 && educacao > 0) return 'Saúde/Educação'

  let best: RadarAssunto = 'Geral'
  let bestScore = 0
  for (const [assunto, score] of Object.entries(hits) as Array<[RadarAssunto, number]>) {
    if (score > bestScore) {
      best = assunto
      bestScore = score
    }
  }
  return best
}

function classificarPapel(blob: string, assunto: RadarAssunto): RadarPapelNoticia {
  const alerta = ALERTA_TERMOS.some((t) => blob.includes(t))
  const oportunidade = OPORTUNIDADE_TERMOS.some((t) => blob.includes(t))

  if (alerta && !oportunidade) return 'alerta'
  if (oportunidade && !alerta) return 'oportunidade'
  if (alerta && oportunidade) {
    // conflito: prioriza alerta em segurança/crime, senão oportunidade
    if (assunto === 'Segurança') return 'alerta'
    return 'oportunidade'
  }
  if (assunto === 'Segurança') return 'alerta'
  if (
    assunto === 'Saúde' ||
    assunto === 'Educação' ||
    assunto === 'Saúde/Educação' ||
    assunto === 'Infraestrutura'
  ) {
    return 'oportunidade'
  }
  return 'contexto'
}

function papelLabel(papel: RadarPapelNoticia): string {
  if (papel === 'alerta') return 'Alerta'
  if (papel === 'oportunidade') return 'Oportunidade'
  return 'Contexto'
}

function dataCurta(iso: string | null): string {
  if (!iso) return '—'
  const t = Date.parse(iso)
  if (!Number.isFinite(t)) return '—'
  return new Date(t).toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
  })
}

/** Chave grosseira para agrupar matérias do mesmo acontecimento. */
function eventoKey(title: string, assunto: RadarAssunto): string {
  const tokens = normalize(title)
    .split(' ')
    .filter((w) => w.length > 3)
    .slice(0, 6)
  return `${assunto}|${tokens.join(' ')}`
}

export function enriquecerNoticiasRadar(
  itens: RadarNoticiaItem[],
): RadarNoticiaEnriquecida[] {
  return itens.map((item) => {
    const blob = normalize(`${item.title} ${item.summary ?? ''}`)
    const assunto = classificarAssunto(blob)
    const papel = classificarPapel(blob, assunto)
    return {
      ...item,
      assunto,
      papel,
      papelLabel: papelLabel(papel),
      dataCurta: dataCurta(item.publishedAt),
      eventoKey: eventoKey(item.title, assunto),
    }
  })
}

function movimentacaoDe(qtdEventos: number): RadarLeituraContexto['movimentacao'] {
  if (qtdEventos >= 8) return 'alta'
  if (qtdEventos >= 3) return 'moderada'
  return 'baixa'
}

export function construirLeituraContexto(
  enriquecidas: RadarNoticiaEnriquecida[],
): RadarLeituraContexto {
  const eventos = new Set(enriquecidas.map((n) => n.eventoKey))
  const acontecimentos = eventos.size
  const materias = enriquecidas.length
  const movimentacao = movimentacaoDe(acontecimentos)

  const porAssunto = new Map<RadarAssunto, number>()
  const porPapel = { alerta: 0, oportunidade: 0, contexto: 0 }
  for (const n of enriquecidas) {
    porAssunto.set(n.assunto, (porAssunto.get(n.assunto) ?? 0) + 1)
    porPapel[n.papel] += 1
  }

  let assuntoDominante: RadarAssunto | null = null
  let max = 0
  for (const [assunto, qtd] of porAssunto) {
    if (assunto === 'Geral') continue
    if (qtd > max) {
      max = qtd
      assuntoDominante = assunto
    }
  }

  const oportunidades = [...porAssunto.entries()]
    .filter(([a]) => a === 'Saúde' || a === 'Educação' || a === 'Saúde/Educação' || a === 'Infraestrutura')
    .sort((a, b) => b[1] - a[1])

  let oportunidade: string | null = null
  if (oportunidades.length >= 2) {
    const nomes = oportunidades.slice(0, 2).map(([a]) => a.replace('Saúde/Educação', 'Saúde'))
    // normaliza Saúde+Educação
    const set = new Set(nomes.flatMap((n) => (n === 'Saúde/Educação' ? ['Saúde', 'Educação'] : [n])))
    if (set.has('Saúde') && set.has('Educação')) oportunidade = 'Saúde e educação'
    else oportunidade = [...set].join(' e ')
  } else if (oportunidades.length === 1) {
    const a = oportunidades[0][0]
    oportunidade = a === 'Saúde/Educação' ? 'Saúde e educação' : a
  } else if (porPapel.oportunidade > 0) {
    oportunidade = 'Entregas e melhorias locais'
  }

  return {
    movimentacao,
    movimentacaoLabel:
      movimentacao === 'alta'
        ? 'Movimentação alta'
        : movimentacao === 'moderada'
          ? 'Movimentação moderada'
          : 'Movimentação baixa',
    assuntoDominante,
    oportunidade,
    acontecimentos,
    materias,
  }
}

/** Ordena: oportunidades → alertas → contexto; depois data. */
export function ordenarNoticiasEnriquecidas(
  itens: RadarNoticiaEnriquecida[],
): RadarNoticiaEnriquecida[] {
  const peso = { oportunidade: 0, alerta: 1, contexto: 2 }
  return [...itens].sort((a, b) => {
    const pa = peso[a.papel] - peso[b.papel]
    if (pa !== 0) return pa
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return db - da
  })
}

export type RadarAcontecimento = {
  key: string
  titulo: string
  url: string | null
  assunto: RadarAssunto
  papel: RadarPapelNoticia
  papelLabel: string
  dataCurta: string
  publishedAt: string | null
  fontes: string[]
  fontesLabel: string
  materias: RadarNoticiaEnriquecida[]
}

/** Agrupa matérias parecidas (mesmo tema + tokens do título). */
export function agruparAcontecimentos(
  itens: RadarNoticiaEnriquecida[],
): RadarAcontecimento[] {
  const map = new Map<string, RadarNoticiaEnriquecida[]>()
  for (const item of ordenarNoticiasEnriquecidas(itens)) {
    const list = map.get(item.eventoKey) ?? []
    list.push(item)
    map.set(item.eventoKey, list)
  }

  // Severidade do grupo (badge): alerta > oportunidade > contexto
  const severidade = { alerta: 0, oportunidade: 1, contexto: 2 }
  // Ordem de exibição: oportunidade primeiro
  const ordemLista = { oportunidade: 0, alerta: 1, contexto: 2 }
  const grupos: RadarAcontecimento[] = []

  for (const [key, materias] of map) {
    const fontes = [
      ...new Set(materias.map((m) => m.fonteNome || m.sourceName || 'Fonte').filter(Boolean)),
    ]
    const papel = materias.reduce(
      (best, m) => (severidade[m.papel] < severidade[best] ? m.papel : best),
      materias[0].papel,
    )
    const principal =
      materias.find((m) => m.papel === papel) ??
      materias.slice().sort((a, b) => b.title.length - a.title.length)[0]

    grupos.push({
      key,
      titulo: principal.title,
      url: principal.url,
      assunto: principal.assunto,
      papel,
      papelLabel: papelLabel(papel),
      dataCurta: principal.dataCurta,
      publishedAt: principal.publishedAt,
      fontes,
      fontesLabel:
        fontes.length === 1
          ? `1 fonte`
          : `${fontes.length} fontes`,
      materias,
    })
  }

  return grupos.sort((a, b) => {
    const pa = ordemLista[a.papel] - ordemLista[b.papel]
    if (pa !== 0) return pa
    const da = a.publishedAt ? Date.parse(a.publishedAt) : 0
    const db = b.publishedAt ? Date.parse(b.publishedAt) : 0
    return db - da
  })
}
