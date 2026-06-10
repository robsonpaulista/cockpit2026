import { isGreetingQuery, isHelpQuery } from '@/lib/agent/greeting-reply'

export interface JarvisResultStat {
  label: string
  value: string
  highlight?: boolean
}

export interface JarvisResultSection {
  heading?: string
  lines: string[]
}

export interface JarvisAgendaItem {
  time: string
  title: string
  detail?: string
  description?: string
}

export interface JarvisResultView {
  title: string
  subtitle?: string
  stats: JarvisResultStat[]
  sections: JarvisResultSection[]
  bullets: string[]
  agendaItems: JarvisAgendaItem[]
  footer?: string
}

function stripMarkdown(text: string): string {
  return text.replace(/\*\*/g, '').replace(/\*/g, '').trim()
}

function extractBold(text: string): string | null {
  const match = text.match(/\*\*([^*]+)\*\*/)
  return match?.[1]?.trim() ?? null
}

function inferTitleFromQuery(query: string): string | null {
  const q = query.toLowerCase()
  if (/\bexpectativa\b|\bvotos?\b/.test(q)) return 'Expectativa de votos'
  if (/\bvisitas?\b|\bviagens?\b|\bcampo\b/.test(q)) return 'Visitas de campo'
  if (/\bagenda\b|\bcompromissos?\b/.test(q)) return 'Agenda'
  if (/\bpesquisas?\b|\binten[cç][aã]o\b/.test(q)) return 'Pesquisas eleitorais'
  if (/\blideran[cç]as?\b/.test(q)) return 'Lideranças'
  if (/\bdemandas?\b/.test(q)) return 'Demandas'
  if (/\bnot[ií]cias?\b/.test(q)) return 'Notícias em destaque'
  if (/\balertas?\b/.test(q)) return 'Alertas'
  if (/\bwhatsapp\b/.test(q)) return 'Envio WhatsApp'
  if (/\bresumo\s+operacional\b/.test(q)) return 'Resumo operacional'
  if (/\binstagram\b/.test(q)) return 'Instagram'
  if (/\bchapa\b/.test(q)) return 'Projeção de chapa'
  return null
}

const STAT_LINE =
  /^(.{2,48}?):\s*\*\*([^*]+)\*\*\s*$|^(expectativa\s+2026|lideran[cç]as?|total|presen[cç]a\s+territorial|capilaridade|registros?|viagens?|visitas?|conte[uú]do|destinat[aá]rio\(s\)?|status):\s*\*\*([^*]+)\*\*/i

export function parseJarvisResultContent(content: string, userQuery?: string): JarvisResultView {
  const lines = content.split('\n').map((l) => l.trimEnd())
  const stats: JarvisResultStat[] = []
  const bullets: string[] = []
  const sections: JarvisResultSection[] = []
  const agendaItems: JarvisAgendaItem[] = []
  let footer: string | undefined
  let title = ''
  let subtitle: string | undefined
  let currentSection: JarvisResultSection | null = null

  const pushLine = (line: string) => {
    if (!currentSection) {
      currentSection = { lines: [] }
      sections.push(currentSection)
    }
    currentSection.lines.push(line)
  }

  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue

    const agendaLine = /^(\d+)\.\s+\*\*([^*]+)\*\*\s+[—–-]\s+\*\*([^*]+)\*\*\s*$/.exec(line)
    if (agendaLine) {
      agendaItems.push({
        time: agendaLine[2].trim(),
        title: agendaLine[3].trim(),
      })
      continue
    }

    const agendaMeta = /^_(.+)_$/.exec(line)
    if (agendaMeta && agendaItems.length > 0) {
      agendaItems[agendaItems.length - 1]!.detail = agendaMeta[1].trim()
      continue
    }

    const agendaDesc = /^>\s+(.+)$/.exec(line)
    if (agendaDesc && agendaItems.length > 0) {
      agendaItems[agendaItems.length - 1]!.description = agendaDesc[1].trim()
      continue
    }

    if (line.startsWith('›') || line.startsWith('>')) {
      bullets.push(stripMarkdown(line.replace(/^[›>]\s*/, '')))
      continue
    }

    const statMatch = line.match(STAT_LINE)
    if (statMatch) {
      const label = stripMarkdown(statMatch[1] ?? statMatch[3] ?? 'Dado')
      const value = stripMarkdown(statMatch[2] ?? statMatch[4] ?? '')
      if (label && value) {
        stats.push({
          label,
          value,
          highlight: /expectativa|votos|total/i.test(label),
        })
      }
      continue
    }

    const boldLabelValue = /^\*\*([^*]+):\*\*\s*(.+)$/.exec(line)
    if (boldLabelValue) {
      const label = boldLabelValue[1].trim()
      const value = stripMarkdown(boldLabelValue[2].trim())
      if (/última (?:cidade visitada|visita)/i.test(label)) {
        title = 'Última visita de campo'
        if (value) stats.push({ label: 'Cidade', value, highlight: true })
      } else if (!title) {
        title = value || label
      } else {
        pushLine(`${label}: ${value}`)
      }
      continue
    }

    const boldOnly = /^\*\*([^*]+)\*\*:?\s*$/.exec(line)
    if (boldOnly) {
      const heading = boldOnly[1].trim()
      if (!title) {
        title = heading
        continue
      }
      currentSection = { heading, lines: [] }
      sections.push(currentSection)
      continue
    }

    if (/^\*\*[^*]+:\*\*/.test(line)) {
      const heading = stripMarkdown(line.replace(/:\*\*$/, '').replace(/^\*\*/, ''))
      currentSection = { heading, lines: [] }
      sections.push(currentSection)
      continue
    }

    if (/^\+ \d+ outro/i.test(line)) {
      footer = stripMarkdown(line)
      continue
    }

    if (/^(quer que eu|deseja|posso|use o botão|certo\.|não encontrei)/i.test(line)) {
      footer = stripMarkdown(line)
      continue
    }

    if (/^tipo:\s*/i.test(line)) {
      pushLine(stripMarkdown(line))
      continue
    }

    if (/^última cidade visitada:/i.test(line)) {
      const cidade = stripMarkdown(line.replace(/^última cidade visitada:\s*/i, ''))
      stats.push({ label: 'Última cidade', value: cidade, highlight: true })
      continue
    }

    if (/^descrição:/i.test(line)) {
      pushLine(stripMarkdown(line.replace(/^descrição:\s*/i, 'Descrição: ')))
      continue
    }

    if (/^\d{2}\/\d{2}\/\d{4}$/.test(line)) {
      stats.push({ label: 'Data', value: line, highlight: true })
      continue
    }

    if (!title) {
      const bold = extractBold(line)
      title = bold ?? stripMarkdown(line).slice(0, 80)
      if (!bold && line.length > title.length) subtitle = stripMarkdown(line)
      continue
    }

    pushLine(stripMarkdown(line))
  }

  if (!title || /^tipo:\s*visita/i.test(title)) {
    title = inferTitleFromQuery(userQuery ?? '') ?? (title && !/^tipo:/i.test(title) ? title : 'Resultado')
  }

  const cleanedSections = sections
    .map((s) => ({ ...s, lines: s.lines.filter(Boolean) }))
    .filter((s) => s.heading || s.lines.length > 0)

  // Meta/descrição da agenda já vão nos cards — não repetir abaixo.
  const hasAgendaCards = agendaItems.length > 0

  return {
    title,
    subtitle,
    stats,
    sections: hasAgendaCards ? [] : cleanedSections,
    bullets: hasAgendaCards ? [] : bullets,
    agendaItems,
    footer,
  }
}

export function shouldShowJarvisResultPopup(content: string): boolean {
  const trimmed = content.trim()
  if (trimmed.length < 36) return false

  if (
    /^(responda|para listar|certo\.|não entendi|não há modal|aguarde terminar)/i.test(trimmed) ||
    trimmed.startsWith('**O que posso fazer') ||
    isHelpQuery(trimmed)
  ) {
    return false
  }

  if (isGreetingQuery(trimmed)) return false

  const hasStructure =
    trimmed.includes('**') ||
    trimmed.includes('›') ||
    /^\d+\.\s+\*\*/m.test(trimmed) ||
    /\d{1,3}(\.\d{3})+/.test(trimmed) ||
    trimmed.split('\n').length >= 3

  return hasStructure
}
