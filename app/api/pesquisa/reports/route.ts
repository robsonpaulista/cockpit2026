import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import pdfParseLib from 'pdf-parse/lib/pdf-parse.js'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const REPORTS_BUCKET = 'polls-pdfs'
const MAX_FILE_SIZE_BYTES = 20 * 1024 * 1024
const MIN_TEXT_FOR_ANALYSIS = 250
const PDF_PARSE_TIMEOUT_MS = 15000
const ENABLE_OPENAI_ANALYSIS = process.env.POLL_REPORT_AI_PROVIDER === 'openai'

type PollResumoBase = {
  id: string
  instituto: string
  candidato_nome: string
  intencao: number
  rejeicao: number
  data: string
  cities?: { name?: string | null } | null
}

type AnalysisSections = {
  methodology?: string | null
  electoralScenario?: string | null
  candidatePerformance?: string | null
  managementEvaluation?: string | null
  voterProfile?: string | null
  cityProblems?: string[] | null
  segmentation?: string[] | null
}

type ReportAnalysis = {
  summary: string
  highlights: string[]
  opportunities: string[]
  risks: string[]
  actionPlan: string[]
  analysisSections: AnalysisSections
}

type PdfExtractionResult = {
  text: string
  error: string | null
}

type OpenAIChatResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

function isMissingAnalysisSectionsColumnError(message: string): boolean {
  const normalized = message.toLowerCase()
  return normalized.includes('analysis_sections') && normalized.includes('column')
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | null = null

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error('timeout'))
    }, ms)
  })

  try {
    return await Promise.race([promise, timeoutPromise])
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId)
    }
  }
}

function normalizeText(value: string): string {
  return value
    .replace(/\r/g, '\n')
    .replace(/\t/g, ' ')
    .replace(/[ \u00A0]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function splitSentences(text: string): string[] {
  return normalizeText(text)
    .replace(/\n+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 20)
}

function normalizeForSearch(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function splitLines(text: string): string[] {
  return normalizeText(text)
    .split('\n')
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .filter((line) => line.length >= 18)
}

function extractFirstJsonObject(raw: string): string | null {
  const start = raw.indexOf('{')
  const end = raw.lastIndexOf('}')
  if (start < 0 || end < 0 || end <= start) return null
  return raw.slice(start, end + 1)
}

function sanitizeLine(line: string): string {
  return line.replace(/\s+/g, ' ').trim()
}

function sanitizeTextBlock(value: string | null | undefined): string | null {
  if (!value) return null
  return value.replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim() || null
}

function pickTopUnique(lines: string[], limit: number): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  lines.forEach((line) => {
    const key = line.toLowerCase()
    if (!seen.has(key) && out.length < limit) {
      seen.add(key)
      out.push(line)
    }
  })
  return out
}

function normalizeAnalysisSections(sections: Partial<AnalysisSections>): AnalysisSections {
  return {
    methodology: sanitizeTextBlock(sections.methodology),
    electoralScenario: sanitizeTextBlock(sections.electoralScenario),
    candidatePerformance: sanitizeTextBlock(sections.candidatePerformance),
    managementEvaluation: sanitizeTextBlock(sections.managementEvaluation),
    voterProfile: sanitizeTextBlock(sections.voterProfile),
    cityProblems: pickTopUnique((sections.cityProblems || []).map(sanitizeLine).filter(Boolean), 12),
    segmentation: pickTopUnique((sections.segmentation || []).map(sanitizeLine).filter(Boolean), 12),
  }
}

function normalizeAnalysisOutput(
  analysis: Partial<ReportAnalysis> & { analysisSections?: Partial<AnalysisSections> }
): ReportAnalysis {
  const summary = sanitizeTextBlock(analysis.summary) || ''
  const highlights = pickTopUnique((analysis.highlights || []).map(sanitizeLine).filter(Boolean), 10)
  const opportunities = pickTopUnique((analysis.opportunities || []).map(sanitizeLine).filter(Boolean), 6)
  const risks = pickTopUnique((analysis.risks || []).map(sanitizeLine).filter(Boolean), 6)
  const actionPlan = pickTopUnique((analysis.actionPlan || []).map(sanitizeLine).filter(Boolean), 8)
  const analysisSections = normalizeAnalysisSections(analysis.analysisSections || {})

  return { summary, highlights, opportunities, risks, actionPlan, analysisSections }
}

function extractKeywordLines(text: string, keywords: string[], limit: number): string[] {
  const normalizedKeywords = keywords.map(normalizeForSearch)
  const sentences = splitSentences(text)
  return pickTopUnique(
    sentences.filter((sentence) => {
      const sentenceLower = normalizeForSearch(sentence)
      return normalizedKeywords.some((keyword) => sentenceLower.includes(keyword))
    }),
    limit
  )
}

function extractKeywordLinesFromLines(lines: string[], keywords: string[], limit: number): string[] {
  const normalizedKeywords = keywords.map(normalizeForSearch)
  return pickTopUnique(
    lines.filter((line) => {
      const normalizedLine = normalizeForSearch(line)
      return normalizedKeywords.some((keyword) => normalizedLine.includes(keyword))
    }),
    limit
  )
}

function extractPercentages(text: string): string[] {
  const matches = text.match(/\b\d{1,3}(?:[.,]\d+)?\s*%/g) || []
  return pickTopUnique(matches, 6)
}

type PollOption = {
  label: string
  percent: number
}

type QuestionBlock = {
  code: string
  title: string
  block: string
}

function parsePercentValue(raw: string): number {
  const normalized = raw.replace(/\./g, '').replace(',', '.')
  const value = Number(normalized)
  return Number.isFinite(value) ? value : 0
}

function formatPercent(value: number): string {
  return `${value.toFixed(2).replace('.', ',')}%`
}

function extractQuestionBlock(text: string, questionCode: string): string | null {
  const escapedCode = questionCode.replace('.', '\\.')
  const regex = new RegExp(`${escapedCode}[\\s\\S]*?(?=\\nP\\d+\\.|\\nPágina\\s+\\d+\\s+de\\s+\\d+|$)`, 'i')
  const match = text.match(regex)
  return match ? match[0] : null
}

function extractAllQuestionBlocks(text: string): QuestionBlock[] {
  const blocks: QuestionBlock[] = []
  const regex = /(?:^|\n)(P\d+\.)\s*([^\n]+)[\s\S]*?(?=\nP\d+\.|\nP[aá]gina\s+\d+\s+de\s+\d+|\n--\s*\d+\s+of\s+\d+\s*--|$)/gi
  let match = regex.exec(text)
  while (match) {
    const code = sanitizeLine(match[1] || '')
    const title = sanitizeLine(match[2] || '')
    const block = sanitizeLine((match[0] || '').replace(/^\n/, ''))
    if (code && title && block) {
      blocks.push({ code, title, block })
    }
    match = regex.exec(text)
  }
  return blocks
}

function includesAllKeywords(source: string, keywords: string[]): boolean {
  const normalizedSource = normalizeForSearch(source)
  return keywords.every((keyword) => normalizedSource.includes(normalizeForSearch(keyword)))
}

function findQuestionOptionsByKeywords(blocks: QuestionBlock[], keywords: string[], limit = 12): PollOption[] {
  const target = blocks.find((item) => includesAllKeywords(`${item.code} ${item.title}`, keywords))
  if (!target) return []
  return extractOptionsFromQuestionBlock(target.block, limit)
}

function pickFirstNonEmptyOptions(...groups: PollOption[][]): PollOption[] {
  for (const group of groups) {
    if (group.length > 0) return group
  }
  return []
}

function extractOptionsFromQuestionBlock(block: string | null, limit = 12): PollOption[] {
  if (!block) return []
  const options: PollOption[] = []
  const regex = /\b\d{4}\.\s*([^\n;]+?)(?:;|\.)?\s+\d+\s+(\d{1,3},\d{2})%/g
  let match: RegExpExecArray | null = regex.exec(block)
  while (match) {
    const label = sanitizeLine(match[1] || '')
    const percent = parsePercentValue(match[2] || '0,00')
    if (label && percent >= 0) {
      options.push({ label, percent })
    }
    if (options.length >= limit) break
    match = regex.exec(block)
  }
  return options
}

function extractTopOptions(options: PollOption[], limit: number, removeNoOpinion = true): PollOption[] {
  const filtered = removeNoOpinion
    ? options.filter((option) => {
        const label = normalizeForSearch(option.label)
        return !label.includes('nao sabe') && !label.includes('nao opin') && !label.includes('branco') && !label.includes('nulo')
      })
    : options

  return filtered.sort((a, b) => b.percent - a.percent).slice(0, limit)
}

function stringifyOptions(options: PollOption[], limit: number): string {
  return options
    .slice(0, limit)
    .map((option) => `${option.label}: ${formatPercent(option.percent)}`)
    .join(' | ')
}

function extractSingleValue(text: string, regex: RegExp): string | null {
  const match = text.match(regex)
  if (!match || !match[1]) return null
  return sanitizeLine(match[1])
}

function buildFallbackSummary(poll: PollResumoBase): ReportAnalysis {
  const cidade = poll.cities?.name || 'Estado'
  const summary = `Pesquisa de ${poll.instituto} em ${cidade}, com ${poll.candidato_nome} em ${poll.intencao.toFixed(
    1
  )}% de intenção e ${poll.rejeicao.toFixed(1)}% de rejeição.`

  return {
    summary,
    highlights: [
      `Intenção de voto registrada: ${poll.intencao.toFixed(1)}%.`,
      `Rejeição registrada: ${poll.rejeicao.toFixed(1)}%.`,
      `Instituto responsável: ${poll.instituto}.`,
    ],
    opportunities: [
      'Reforçar agenda de rua e presença territorial para converter indecisos.',
      'Direcionar comunicação para segmentos de menor recall no município.',
    ],
    risks: ['Monitorar rejeição e consolidar narrativa de contraste com adversários.'],
    actionPlan: [
      'Executar plano tático de 7 dias focado nos bairros com menor presença.',
      'Alinhar discurso com lideranças locais e comunicação digital da cidade.',
      'Validar evolução com nova rodada de tracking em até 15 dias.',
    ],
    analysisSections: {},
  }
}

function buildAnalysisFromText(text: string, poll: PollResumoBase): ReportAnalysis {
  const cleanText = normalizeText(text)
  if (!cleanText) return buildFallbackSummary(poll)

  const textBase = cleanText.slice(0, 220000)
  const questionBlocks = extractAllQuestionBlocks(textBase)

  const p2Sexo = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['sexo'], 8),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P2.'), 8)
  )
  const p3Escolaridade = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['grau', 'instru'], 10),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P3.'), 10)
  )
  const p4Renda = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['renda'], 10),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P4.'), 10)
  )
  const p5Idade = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['idade'], 10),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P5.'), 10)
  )
  const p6Religiao = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['relig'], 10),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P6.'), 10)
  )

  const pInteresseEleicoes = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['interesse', 'elei'], 8),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P9.'), 8)
  )
  const pPrioridadesCidade = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['precisa mais de'], 12),
    findQuestionOptionsByKeywords(questionBlocks, ['prioridade'], 12),
    findQuestionOptionsByKeywords(questionBlocks, ['principais problemas'], 12),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P8.'), 15)
  )

  const pAprovPrefeito = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['aprova', 'desaprova', 'prefeito'], 8),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P10.'), 8)
  )
  const pAvalPrefeito = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['avalia', 'administração', 'prefeito'], 10),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P11.'), 10)
  )

  const pPresidente = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['presidente'], 12),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P12.'), 12)
  )
  const pAprovGovernador = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['aprova', 'desaprova', 'governador'], 8),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P14.'), 8)
  )
  const pAvalGovernador = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['avalia', 'administração', 'governador'], 10),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P15.'), 10)
  )
  const pVotoGovernador = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['votaria', 'governador'], 12),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P16.'), 12)
  )
  const pVotoSenado = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['votaria', 'senador'], 12),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P18.'), 12)
  )
  const pVotoDepFederal = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['votaria', 'deputado federal'], 12),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P20.'), 12)
  )
  const pVotoDepEstadual = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['votaria', 'deputado estadual'], 12),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P22.'), 12)
  )

  const pLiderancas = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['maior liderança'], 12),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P24.'), 12)
  )
  const pVereadoresAtuantes = pickFirstNonEmptyOptions(
    findQuestionOptionsByKeywords(questionBlocks, ['vereadores', 'mais atuante'], 14),
    extractOptionsFromQuestionBlock(extractQuestionBlock(textBase, 'P25.'), 14)
  )

  const totalEntrevistas = extractSingleValue(textBase, /(?:n[uú]mero de entrevistas|entrevistas coletadas)\s*[:\t ]+([0-9]{2,5})/i)
  const margemErro = extractSingleValue(textBase, /margem de erro[^.\n]*?([0-9]{1,2},[0-9]{1,2}\s*%)/i)
  const confianca = extractSingleValue(textBase, /intervalo de confian[çc]a[^.\n]*?([0-9]{1,3}\s*%)/i)
  const periodoCampo = extractSingleValue(textBase, /2\.4\.\s*per[ií]odo campo\s*([^\n]+)/i)

  const topPrioridades = extractTopOptions(pPrioridadesCidade, 4)
  const topPresidencia = extractTopOptions(pPresidente, 3)
  const topGovernador = extractTopOptions(pVotoGovernador, 3)
  const topSenado = extractTopOptions(pVotoSenado, 3)
  const topDepFed = extractTopOptions(pVotoDepFederal, 3)
  const topDepEst = extractTopOptions(pVotoDepEstadual, 3)
  const topLiderancas = extractTopOptions(pLiderancas, 3)
  const topVereadores = extractTopOptions(pVereadoresAtuantes, 3)

  const aprovaPref = pAprovPrefeito.find((o) => normalizeForSearch(o.label).includes('aprova'))
  const desaprovaPref = pAprovPrefeito.find((o) => normalizeForSearch(o.label).includes('desaprova'))
  const muitoInteresse = pInteresseEleicoes.find((o) => normalizeForSearch(o.label).includes('muito interesse'))
  const nenhumInteresse = pInteresseEleicoes.find((o) => normalizeForSearch(o.label).includes('nenhum interesse'))

  const lines = splitLines(cleanText)
  const percentageMentions = extractPercentages(cleanText)
  const keywordHighlights = extractKeywordLines(cleanText, ['intenção', 'rejeição', 'espontânea', 'estimulada', 'cenário', 'avaliação'], 4)
  const problemasCidade = extractKeywordLinesFromLines(
    lines,
    [
      'principais problemas',
      'problema da cidade',
      'saúde',
      'segurança',
      'desemprego',
      'infraestrutura',
      'saneamento',
      'educação',
      'transporte',
      'asfalto',
      'pavimentação',
      'água',
    ],
    4
  )
  const avaliacaoGestao = extractKeywordLinesFromLines(
    lines,
    ['avaliação da gestão', 'administração', 'prefeito', 'governador', 'aprovação', 'desaprovação'],
    3
  )
  const recortesEleitorado = extractKeywordLinesFromLines(
    lines,
    ['faixa etária', 'sexo', 'renda', 'escolaridade', 'bairro', 'zona urbana', 'zona rural', 'segmento'],
    3
  )
  const opportunityLines = extractKeywordLines(
    cleanText,
    ['oportunidade', 'crescer', 'potencial', 'indecis', 'favorável', 'aceitação', 'boa avaliação'],
    4
  )
  const riskLines = extractKeywordLines(
    cleanText,
    ['risco', 'ameaça', 'desfavor', 'rejeição', 'desaprovação', 'alerta', 'queda'],
    4
  )

  const cidade = poll.cities?.name || 'Estado'
  const resumoPartes = [
    `Leitura estratégica da pesquisa de ${poll.instituto} em ${cidade}, com base em ${totalEntrevistas || 'amostra não identificada'} entrevistas.`,
    `No cenário local, ${poll.candidato_nome} registra ${poll.intencao.toFixed(1)}% de intenção e ${poll.rejeicao.toFixed(1)}% de rejeição no cadastro interno.`,
    topPrioridades.length > 0
      ? `As prioridades do eleitorado estão concentradas em ${stringifyOptions(topPrioridades, 3)}.`
      : keywordHighlights[0] || 'A pesquisa indica temas de cidade e avaliação de gestão como eixos centrais da disputa.',
  ]
  if (aprovaPref && desaprovaPref) {
    resumoPartes.push(
      `A avaliação do prefeito está competitiva, com aprovação de ${formatPercent(aprovaPref.percent)} e desaprovação de ${formatPercent(
        desaprovaPref.percent
      )}.`
    )
  }
  if (muitoInteresse && nenhumInteresse) {
    resumoPartes.push(
      `O nível de mobilização é baixo: apenas ${formatPercent(muitoInteresse.percent)} declaram muito interesse eleitoral, contra ${formatPercent(
        nenhumInteresse.percent
      )} sem interesse.`
    )
  }
  if (problemasCidade.length > 0) {
    resumoPartes.push(`Problemas citados pelos entrevistados: ${problemasCidade.slice(0, 2).join(' | ')}.`)
  }
  if (avaliacaoGestao.length > 0) {
    resumoPartes.push(`Avaliação de gestão/narrativa: ${avaliacaoGestao[0]}.`)
  }
  if (recortesEleitorado.length > 0) {
    resumoPartes.push(`Recortes de eleitorado identificados: ${recortesEleitorado[0]}.`)
  }

  const resumoBase = resumoPartes.join('\n')

  const highlights = pickTopUnique(
    [
      totalEntrevistas ? `Amostra efetiva da pesquisa: ${totalEntrevistas} entrevistas.` : '',
      margemErro ? `Margem de erro declarada: ${margemErro}.` : '',
      confianca ? `Nível de confiança declarado: ${confianca}.` : '',
      periodoCampo ? `Período de campo: ${periodoCampo}.` : '',
      topPrioridades.length > 0 ? `Prioridades da cidade: ${stringifyOptions(topPrioridades, 3)}.` : '',
      topPresidencia.length > 0 ? `Cenário presidencial local: ${stringifyOptions(topPresidencia, 3)}.` : '',
      topGovernador.length > 0 ? `Cenário para governador: ${stringifyOptions(topGovernador, 3)}.` : '',
      topLiderancas.length > 0 ? `Maiores lideranças locais: ${stringifyOptions(topLiderancas, 3)}.` : '',
      ...keywordHighlights,
      ...problemasCidade,
      ...avaliacaoGestao,
      ...recortesEleitorado,
      ...(percentageMentions.length > 0
        ? [`Percentuais citados no relatório: ${percentageMentions.join(', ')}.`]
        : []),
      `Candidato referência cadastrado no sistema: ${poll.candidato_nome}.`,
    ],
    5
  )

  const opportunities =
    pickTopUnique(
      [
        topPrioridades.length > 0
          ? `Ancorar a narrativa em ${topPrioridades[0]?.label || 'prioridade local'} para capturar o eleitor de baixa mobilização.`
          : '',
        topLiderancas.length > 0
          ? `Construir ponte com redes vinculadas a ${topLiderancas[0]?.label}, maior referência de liderança na cidade.`
          : '',
        topVereadores.length > 0
          ? `Articular com vereadores mais reconhecidos (${stringifyOptions(topVereadores, 2)}) para capilarizar mensagem territorial.`
          : '',
        topDepFed.length > 0
          ? `Conectar agenda municipal com as lideranças de maior tração em deputado federal (${stringifyOptions(topDepFed, 2)}).`
          : '',
        ...opportunityLines,
      ].filter(Boolean) as string[],
      6
    ).slice(0, 6)

  const risks =
    pickTopUnique(
      [
        nenhumInteresse
          ? `Risco de abstenção/desmobilização: ${formatPercent(nenhumInteresse.percent)} declararam nenhum interesse nas eleições.`
          : '',
        desaprovaPref
          ? `Risco de contaminação da rejeição à gestão municipal: desaprovação em ${formatPercent(desaprovaPref.percent)}.`
          : '',
        topPrioridades.length > 0
          ? `Risco de perda de agenda se a campanha não liderar os temas de ${topPrioridades
              .slice(0, 2)
              .map((item) => item.label)
              .join(' e ')}.`
          : '',
        ...riskLines,
      ].filter(Boolean) as string[],
      6
    ).slice(0, 6)

  const actionPlan = [
    `Executar plano de 14 dias com eixo temático em ${topPrioridades[0]?.label || 'prioridades urbanas'}, com agenda diária em bairros de maior densidade eleitoral.`,
    `Ativar rede de influência com lideranças locais (${stringifyOptions(topLiderancas, 2) || 'principais lideranças'}) e coordenação com vereadores mais lembrados.`,
    `Criar trilha de comunicação para converter eleitores de médio interesse (${formatPercent(
      pInteresseEleicoes.find((o) => normalizeForSearch(o.label).includes('medio interesse'))?.percent || 0
    )}) em apoio ativo.`,
    `Blindar narrativa contra desgaste da gestão: respostas objetivas para os vetores de crítica e pacote de propostas para ${topPrioridades
      .slice(0, 2)
      .map((item) => item.label)
      .join(' + ')}.`,
    'Monitorar semanalmente aprovação, rejeição e interesse eleitoral com tracking curto por território.',
    'Definir metas por segmento (sexo, idade e renda) com responsáveis de campo e de comunicação para execução integrada.',
  ]

  const cityProblems =
    topPrioridades.length > 0
      ? topPrioridades.map((item) => `${item.label}: ${formatPercent(item.percent)}`)
      : problemasCidade.length > 0
      ? problemasCidade
      : undefined

  const segmentation = pickTopUnique(
    [
      p2Sexo.length > 0 ? `Sexo: ${stringifyOptions(extractTopOptions(p2Sexo, 2, false), 2)}.` : '',
      p5Idade.length > 0 ? `Faixa etária: ${stringifyOptions(extractTopOptions(p5Idade, 3, false), 3)}.` : '',
      p4Renda.length > 0 ? `Renda: ${stringifyOptions(extractTopOptions(p4Renda, 3, false), 3)}.` : '',
      recortesEleitorado[0] || '',
    ].filter(Boolean) as string[],
    6
  )

  const methodology = [
    totalEntrevistas ? `Amostra: ${totalEntrevistas} entrevistas.` : '',
    margemErro ? `Margem de erro: ${margemErro}.` : '',
    confianca ? `Nível de confiança: ${confianca}.` : '',
    periodoCampo ? `Período de campo: ${periodoCampo}.` : '',
    'Método declarado: entrevistas presenciais com questionário estruturado e controle de qualidade por filtragem/fiscalização.',
  ]
    .filter(Boolean)
    .join(' ')

  const electoralScenario = [
    topPresidencia.length > 0 ? `Presidência: ${stringifyOptions(topPresidencia, 3)}.` : '',
    topGovernador.length > 0 ? `Governo estadual: ${stringifyOptions(topGovernador, 3)}.` : '',
    topSenado.length > 0 ? `Senado (1º/2º voto): ${stringifyOptions(topSenado, 3)}.` : '',
    topDepFed.length > 0 ? `Deputado federal: ${stringifyOptions(topDepFed, 3)}.` : '',
    topDepEst.length > 0 ? `Deputado estadual: ${stringifyOptions(topDepEst, 3)}.` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const managementEvaluation = [
    pAprovPrefeito.length > 0 ? `Prefeito - aprovação/desaprovação: ${stringifyOptions(pAprovPrefeito, 3)}.` : '',
    pAvalPrefeito.length > 0 ? `Prefeito - avaliação detalhada: ${stringifyOptions(pAvalPrefeito, 5)}.` : '',
    pAprovGovernador.length > 0 ? `Governador - aprovação/desaprovação: ${stringifyOptions(pAprovGovernador, 3)}.` : '',
    pAvalGovernador.length > 0 ? `Governador - avaliação detalhada: ${stringifyOptions(pAvalGovernador, 5)}.` : '',
  ]
    .filter(Boolean)
    .join('\n')

  const voterProfile = [
    p2Sexo.length > 0 ? `Sexo: ${stringifyOptions(p2Sexo, 2)}.` : '',
    p3Escolaridade.length > 0 ? `Escolaridade: ${stringifyOptions(extractTopOptions(p3Escolaridade, 4, false), 4)}.` : '',
    p4Renda.length > 0 ? `Renda: ${stringifyOptions(extractTopOptions(p4Renda, 4, false), 4)}.` : '',
    p5Idade.length > 0 ? `Faixa etária: ${stringifyOptions(extractTopOptions(p5Idade, 5, false), 5)}.` : '',
    p6Religiao.length > 0 ? `Religião: ${stringifyOptions(extractTopOptions(p6Religiao, 3, false), 3)}.` : '',
  ]
    .filter(Boolean)
    .join('\n')

  return {
    summary: resumoBase,
    highlights,
    opportunities,
    risks,
    actionPlan,
    analysisSections: {
      methodology: methodology || null,
      electoralScenario: electoralScenario || null,
      candidatePerformance: `Registro interno do candidato foco ${poll.candidato_nome}: intenção ${poll.intencao.toFixed(
        1
      )}% e rejeição ${poll.rejeicao.toFixed(
        1
      )}%. A estratégia deve considerar o ambiente de baixa mobilização eleitoral e a força das lideranças locais mapeadas na pesquisa.`,
      managementEvaluation: managementEvaluation || (avaliacaoGestao.length > 0 ? avaliacaoGestao.join(' ') : null),
      voterProfile: voterProfile || null,
      cityProblems: cityProblems || null,
      segmentation: segmentation.length > 0 ? segmentation : null,
    },
  }
}

async function buildAnalysisWithAI(text: string, poll: PollResumoBase): Promise<ReportAnalysis | null> {
  if (!ENABLE_OPENAI_ANALYSIS) return null
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) return null

  const cidade = poll.cities?.name || 'Estado'
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini'
  const textForModel = text.slice(0, 120000)

  const systemPrompt = [
    'Você é um consultor político-eleitoral sênior especializado em análise estratégica de pesquisas eleitorais municipais no Brasil.',
    'Sua missão é produzir um relatório estratégico profissional e completo a partir do conteúdo integral de uma pesquisa eleitoral.',
    'LEIA TODO O CONTEÚDO DO PDF com atenção máxima. Extraia TODOS os dados numéricos, percentuais, cenários e indicadores presentes.',
    'Seja técnico, preciso e estratégico. Use linguagem política profissional.',
    'Não invente dados nem suponha informações: use EXCLUSIVAMENTE o conteúdo fornecido.',
    'Para campos sem dados no PDF, retorne null ou array vazio — nunca use placeholders.',
    'Não repita informações entre seções.',
    'Retorne APENAS JSON válido, sem markdown, sem comentários, sem texto extra.',
  ].join(' ')

  const userPrompt = `
Metadados da pesquisa:
- Município: ${cidade}
- Instituto: ${poll.instituto}
- Candidato foco: ${poll.candidato_nome}
- Intenção registrada: ${poll.intencao.toFixed(1)}%
- Rejeição registrada: ${poll.rejeicao.toFixed(1)}%

Conteúdo integral do PDF da pesquisa:
"""
${textForModel}
"""

Produza um relatório estratégico profissional completo. Retorne JSON com este formato exato:
{
  "summary": "Sumário executivo com 3 a 5 parágrafos estratégicos: panorama político da cidade, posicionamento do candidato foco, principais achados da pesquisa e recomendação estratégica central.",

  "analysisSections": {
    "methodology": "Metodologia da pesquisa: universo eleitoral, tamanho da amostra, margem de erro, nível de confiança, período de coleta e método de entrevista (presencial/telefônico/online). Extraia diretamente do PDF.",
    "electoralScenario": "Análise completa do cenário eleitoral: todos os candidatos com percentuais de intenção estimulada e espontânea, índices de brancos/nulos/indecisos, projeções de 1º e 2º turno quando disponíveis, dinâmicas de transferência de voto.",
    "candidatePerformance": "Análise detalhada do candidato foco: intenção de voto estimulada e espontânea, rejeição, avaliação pessoal, índice de aprovação, comparativo com adversários, evolução temporal se houver série histórica no PDF.",
    "managementEvaluation": "Avaliação da gestão atual: aprovação/desaprovação do prefeito ou governador, notas atribuídas, pontos positivos e negativos apontados pelos entrevistados, base eleitoral de aprovação e potencial de transferência de votos.",
    "voterProfile": "Perfil socioeconômico e demográfico do eleitorado: distribuição por sexo, faixa etária, renda familiar, escolaridade, zona urbana/rural. Inclua todos os percentuais disponíveis no PDF.",
    "cityProblems": ["Liste os principais problemas da cidade apontados pelos entrevistados. Inclua percentual quando disponível. Ex: 'Saúde pública: 42%'"],
    "segmentation": ["Desempenho do candidato foco segmentado por: sexo, faixa etária, renda, escolaridade, bairro ou zona geográfica. Inclua percentuais. Ex: 'Mulheres: 38% de intenção vs. 29% dos homens'"]
  },

  "highlights": ["8 a 10 achados estratégicos objetivos com dados numéricos extraídos do PDF. Priorize dados concretos sobre intenção, rejeição, avaliação e comparativos."],
  "opportunities": ["5 a 6 oportunidades eleitorais concretas e acionáveis identificadas nos dados desta pesquisa para este município específico"],
  "risks": ["5 a 6 riscos políticos ou eleitorais objetivos identificados nos dados, não generalizações"],
  "actionPlan": ["6 a 8 ações imediatas e práticas priorizadas por impacto estratégico: especifique território, segmento-alvo, mensagem e prazo quando possível"]
}

Regras obrigatórias:
- Extraia TODOS os percentuais e dados numéricos presentes no PDF
- Se um campo não tiver dados disponíveis no PDF, retorne null (texto) ou [] (arrays)
- O actionPlan deve conter ações específicas para ESTE município, nunca genéricas
- Não use placeholders como "[dado não disponível]" ou "[inserir aqui]"
- Não repita frases idênticas entre seções diferentes
`.trim()

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.15,
        max_tokens: 4096,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
      }),
    })

    if (!response.ok) return null

    const data = (await response.json()) as OpenAIChatResponse
    const rawContent = data.choices?.[0]?.message?.content || ''
    if (!rawContent) return null

    const jsonString = extractFirstJsonObject(rawContent) || rawContent
    const parsed = JSON.parse(jsonString) as Partial<ReportAnalysis> & { analysisSections?: Partial<AnalysisSections> }
    const normalized = normalizeAnalysisOutput(parsed)

    if (
      !normalized.summary ||
      normalized.highlights.length === 0 ||
      normalized.opportunities.length === 0 ||
      normalized.risks.length === 0 ||
      normalized.actionPlan.length === 0
    ) {
      return null
    }

    return normalized
  } catch {
    return null
  }
}

async function ensureReportsBucket() {
  const admin = createAdminClient()
  const { data: bucketData } = await admin.storage.getBucket(REPORTS_BUCKET)
  if (bucketData) return
  await admin.storage.createBucket(REPORTS_BUCKET, {
    public: false,
    fileSizeLimit: `${MAX_FILE_SIZE_BYTES}`,
    allowedMimeTypes: ['application/pdf'],
  })
}

async function fetchPollBase(supabase: ReturnType<typeof createClient>, userId: string, pollId: string) {
  const { data: poll, error: pollError } = await supabase
    .from('polls')
    .select(
      `
      id,
      instituto,
      candidato_nome,
      intencao,
      rejeicao,
      data,
      cities (
        name
      )
    `
    )
    .eq('id', pollId)
    .eq('user_id', userId)
    .maybeSingle()

  return { poll: poll as PollResumoBase | null, pollError }
}

async function parsePdfText(fileBuffer: Buffer): Promise<PdfExtractionResult> {
  let parsedText = ''
  let parseError: string | null = null
  try {
    const pdfParse = pdfParseLib as unknown as (dataBuffer: Buffer) => Promise<{ text?: string }>
    const parsed = await withTimeout(
      pdfParse(fileBuffer),
      PDF_PARSE_TIMEOUT_MS
    )
    parsedText = typeof parsed.text === 'string' ? normalizeText(parsed.text) : ''
  } catch (error) {
    parsedText = ''
    parseError = error instanceof Error ? error.message : 'Falha desconhecida ao extrair texto do PDF'
    console.error('[poll-reports] parsePdfText erro:', parseError)
  }

  return {
    text: parsedText,
    error: parseError,
  }
}

async function buildStrategicAnalysis(text: string, poll: PollResumoBase): Promise<ReportAnalysis> {
  const aiAnalysis = await buildAnalysisWithAI(text, poll)
  if (aiAnalysis) return aiAnalysis
  return buildAnalysisFromText(text, poll)
}

async function upsertReportWithCompatibility(
  supabase: ReturnType<typeof createClient>,
  payload: {
    poll_id: string
    user_id: string
    file_path: string
    file_name: string
    file_size: number
    mime_type: string
    extracted_text: string | null
    summary: string
    highlights: string[]
    opportunities: string[]
    risks: string[]
    action_plan: string[]
    analysis_sections: AnalysisSections
    analysis_status: 'completed'
    analysis_error: string | null
  }
) {
  const firstAttempt = await supabase.from('poll_reports').upsert(payload, { onConflict: 'poll_id' }).select('*').single()
  if (!firstAttempt.error) return firstAttempt
  if (!isMissingAnalysisSectionsColumnError(firstAttempt.error.message)) return firstAttempt

  const { analysis_sections: _ignored, ...legacyPayload } = payload
  return supabase.from('poll_reports').upsert(legacyPayload, { onConflict: 'poll_id' }).select('*').single()
}

async function updateReportWithCompatibility(
  supabase: ReturnType<typeof createClient>,
  reportId: string,
  userId: string,
  payload: {
    extracted_text: string | null
    summary: string
    highlights: string[]
    opportunities: string[]
    risks: string[]
    action_plan: string[]
    analysis_sections: AnalysisSections
    analysis_status: 'completed'
    analysis_error: string | null
  }
) {
  const firstAttempt = await supabase
    .from('poll_reports')
    .update(payload)
    .eq('id', reportId)
    .eq('user_id', userId)
    .select('*')
    .single()

  if (!firstAttempt.error) return firstAttempt
  if (!isMissingAnalysisSectionsColumnError(firstAttempt.error.message)) return firstAttempt

  const { analysis_sections: _ignored, ...legacyPayload } = payload
  return supabase
    .from('poll_reports')
    .update(legacyPayload)
    .eq('id', reportId)
    .eq('user_id', userId)
    .select('*')
    .single()
}

function getAnalysisStatus(extractedText: string, extractionError: string | null) {
  if (extractionError) {
    return {
      status: 'completed' as const,
      error: `Falha na leitura do PDF: ${extractionError}.`,
    }
  }

  const textLen = normalizeText(extractedText).length
  if (textLen < MIN_TEXT_FOR_ANALYSIS) {
    return {
      status: 'completed' as const,
      error:
        'Análise parcial: texto extraído do PDF é insuficiente (provável arquivo escaneado). Cole um texto complementar da pesquisa para obter leitura estratégica completa.',
    }
  }

  return {
    status: 'completed' as const,
    error: null,
  }
}

export async function GET(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pollId = searchParams.get('poll_id')
    if (!pollId) {
      return NextResponse.json({ error: 'poll_id é obrigatório' }, { status: 400 })
    }

    const { data: report, error } = await supabase
      .from('poll_reports')
      .select('*')
      .eq('poll_id', pollId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    if (!report) {
      return NextResponse.json({ report: null }, { status: 200 })
    }

    const admin = createAdminClient()
    const { data: signed } = await admin.storage.from(REPORTS_BUCKET).createSignedUrl(report.file_path, 60 * 60)

    return NextResponse.json({
      report: {
        ...report,
        file_url: signed?.signedUrl || null,
      },
    })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const formData = await request.formData()
    const pollIdRaw = formData.get('poll_id')
    const fileRaw = formData.get('file')
    const manualContextRaw = formData.get('manual_context')

    const pollId = typeof pollIdRaw === 'string' ? pollIdRaw : ''
    const file = fileRaw instanceof File ? fileRaw : null
    const manualContext = typeof manualContextRaw === 'string' ? normalizeText(manualContextRaw) : ''

    if (!pollId || !file) {
      return NextResponse.json({ error: 'poll_id e file são obrigatórios' }, { status: 400 })
    }
    if (file.type !== 'application/pdf') {
      return NextResponse.json({ error: 'Apenas arquivos PDF são permitidos' }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      return NextResponse.json({ error: 'Arquivo excede o limite de 20MB' }, { status: 400 })
    }

    const { poll, pollError } = await fetchPollBase(supabase, user.id, pollId)

    if (pollError) {
      return NextResponse.json({ error: pollError.message }, { status: 500 })
    }
    if (!poll) {
      return NextResponse.json({ error: 'Pesquisa não encontrada' }, { status: 404 })
    }

    await ensureReportsBucket()
    const admin = createAdminClient()

    const { data: existingReport } = await supabase
      .from('poll_reports')
      .select('id, file_path')
      .eq('poll_id', pollId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (existingReport?.file_path) {
      await admin.storage.from(REPORTS_BUCKET).remove([existingReport.file_path])
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer())
    const safeName = file.name.replace(/[^\w.\-]/g, '_')
    const filePath = `${user.id}/${pollId}/${Date.now()}-${safeName}`

    const { error: uploadError } = await admin.storage
      .from(REPORTS_BUCKET)
      .upload(filePath, fileBuffer, { contentType: 'application/pdf', upsert: false })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const extraction = await parsePdfText(fileBuffer)
    const extractedText = normalizeText([extraction.text, manualContext].filter(Boolean).join('\n\n'))

    const analysis = await buildStrategicAnalysis(extractedText, poll as PollResumoBase)
    const analysisStatus = getAnalysisStatus(extractedText, extraction.error)

    const payload = {
      poll_id: pollId,
      user_id: user.id,
      file_path: filePath,
      file_name: file.name,
      file_size: file.size,
      mime_type: file.type,
      extracted_text: extractedText || null,
      summary: analysis.summary,
      highlights: analysis.highlights,
      opportunities: analysis.opportunities,
      risks: analysis.risks,
      action_plan: analysis.actionPlan,
      analysis_sections: analysis.analysisSections,
      analysis_status: analysisStatus.status,
      analysis_error: analysisStatus.error,
    }

    const { data: report, error: reportError } = await upsertReportWithCompatibility(supabase, payload)

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 })
    }

    const { data: signed } = await admin.storage.from(REPORTS_BUCKET).createSignedUrl(filePath, 60 * 60)

    return NextResponse.json({
      report: {
        ...report,
        file_url: signed?.signedUrl || null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pollId = searchParams.get('poll_id')
    if (!pollId) {
      return NextResponse.json({ error: 'poll_id é obrigatório' }, { status: 400 })
    }

    let manualContext = ''
    try {
      const body = await request.json()
      if (body && typeof body.manual_context === 'string') {
        manualContext = normalizeText(body.manual_context)
      }
    } catch {
      manualContext = ''
    }

    const { data: report, error: reportError } = await supabase
      .from('poll_reports')
      .select('*')
      .eq('poll_id', pollId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (reportError) {
      return NextResponse.json({ error: reportError.message }, { status: 500 })
    }
    if (!report) {
      return NextResponse.json({ error: 'Relatório não encontrado' }, { status: 404 })
    }

    const { poll, pollError } = await fetchPollBase(supabase, user.id, pollId)
    if (pollError) {
      return NextResponse.json({ error: pollError.message }, { status: 500 })
    }
    if (!poll) {
      return NextResponse.json({ error: 'Pesquisa não encontrada' }, { status: 404 })
    }

    const admin = createAdminClient()
    const { data: fileData, error: downloadError } = await admin.storage.from(REPORTS_BUCKET).download(report.file_path)
    if (downloadError || !fileData) {
      return NextResponse.json({ error: downloadError?.message || 'Arquivo do relatório não encontrado' }, { status: 500 })
    }

    const fileBuffer = Buffer.from(await fileData.arrayBuffer())
    const extraction = await parsePdfText(fileBuffer)
    const extractedText = normalizeText([extraction.text, manualContext].filter(Boolean).join('\n\n'))
    const analysis = await buildStrategicAnalysis(extractedText, poll)
    const analysisStatus = getAnalysisStatus(extractedText, extraction.error)

    const { data: updatedReport, error: updateError } = await updateReportWithCompatibility(supabase, report.id, user.id, {
      extracted_text: extractedText || null,
      summary: analysis.summary,
      highlights: analysis.highlights,
      opportunities: analysis.opportunities,
      risks: analysis.risks,
      action_plan: analysis.actionPlan,
      analysis_sections: analysis.analysisSections,
      analysis_status: analysisStatus.status,
      analysis_error: analysisStatus.error,
    })

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 })
    }

    const { data: signed } = await admin.storage.from(REPORTS_BUCKET).createSignedUrl(updatedReport.file_path, 60 * 60)

    return NextResponse.json({
      report: {
        ...updatedReport,
        file_url: signed?.signedUrl || null,
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro interno do servidor'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const pollId = searchParams.get('poll_id')
    if (!pollId) {
      return NextResponse.json({ error: 'poll_id é obrigatório' }, { status: 400 })
    }

    const { data: report } = await supabase
      .from('poll_reports')
      .select('id, file_path')
      .eq('poll_id', pollId)
      .eq('user_id', user.id)
      .maybeSingle()

    if (!report) {
      return NextResponse.json({ success: true })
    }

    const admin = createAdminClient()
    await admin.storage.from(REPORTS_BUCKET).remove([report.file_path])

    const { error: deleteError } = await supabase
      .from('poll_reports')
      .delete()
      .eq('id', report.id)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: deleteError.message }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Erro interno do servidor' }, { status: 500 })
  }
}
