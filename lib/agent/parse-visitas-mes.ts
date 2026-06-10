const MESES: Record<string, number> = {
  janeiro: 0,
  jan: 0,
  fevereiro: 1,
  fev: 1,
  marco: 2,
  mar: 2,
  março: 2,
  abril: 3,
  abr: 3,
  maio: 4,
  mai: 4,
  junho: 5,
  jun: 5,
  julho: 6,
  jul: 6,
  agosto: 7,
  ago: 7,
  setembro: 8,
  set: 8,
  outubro: 9,
  out: 9,
  novembro: 10,
  nov: 10,
  dezembro: 11,
  dez: 11,
}

export interface ParsedMesAno {
  month: number
  year: number
  label: string
}

function norm(text: string): string {
  return text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

const MES_NAMES = Object.keys(MESES).sort((a, b) => b.length - a.length)

/** Nome de mês — não confundir com município («mês de abril»). */
export function isMonthName(text: string): boolean {
  const q = norm(text)
  if (!q) return false
  return MES_NAMES.some((nome) => q === norm(nome))
}

export function parseMesAnoFromText(
  text: string,
  referenceDate = new Date()
): ParsedMesAno | null {
  const q = norm(text)

  const slash = q.match(/\b(\d{1,2})\/(\d{4})\b/)
  if (slash) {
    const month = Number(slash[1]) - 1
    const year = Number(slash[2])
    if (month >= 0 && month <= 11) {
      const d = new Date(year, month, 1)
      return {
        month,
        year,
        label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
      }
    }
  }

  for (const nome of MES_NAMES) {
    const re = new RegExp(`\\b${nome}\\b(?:\\s+de)?\\s*(\\d{4})?`, 'i')
    const match = q.match(re)
    if (!match) continue
    const month = MESES[nome]
    const year = match[1] ? Number(match[1]) : referenceDate.getFullYear()
    const d = new Date(year, month, 1)
    return {
      month,
      year,
      label: d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }),
    }
  }

  return null
}
