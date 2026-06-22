import { getEleitoradoByCity } from '@/lib/eleitores'

type DemandRow = {
  title?: string
  status?: string
  lideranca?: string
  description?: string
}

type PollRow = {
  data?: string
  instituto?: string
  candidato_nome?: string
  intencao?: number
  cities?: { name?: string } | null
}

function formatDatePt(iso: string): string {
  if (!iso) return '—'
  if (iso.includes('/')) return iso
  const d = iso.includes('T')
    ? new Date(iso)
    : (() => {
        const [y, m, day] = iso.split('-').map(Number)
        return new Date(y, (m || 1) - 1, day || 1)
      })()
  if (Number.isNaN(d.getTime())) return iso
  return d.toLocaleDateString('pt-BR')
}

function normCity(value: string): string {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

function pollsForCity(polls: PollRow[], cidade: string): PollRow[] {
  const cityNorm = normCity(cidade)
  return polls.filter((p) => {
    const name = p.cities?.name ? normCity(p.cities.name) : ''
    return name === cityNorm || name.includes(cityNorm) || cityNorm.includes(name)
  })
}

/** Briefing simplificado para envio via Jarvis (demandas + pesquisas). */
export function buildBriefingTerritorioWhatsAppText(
  cidade: string,
  demands: DemandRow[],
  polls: PollRow[],
): string {
  const hoje = new Date().toLocaleDateString('pt-BR')
  const lines: string[] = []
  const eleitorado = getEleitoradoByCity(cidade)
  const pollsCidade = pollsForCity(polls, cidade)

  lines.push(`*BRIEFING — ${cidade.toUpperCase()}*`)
  lines.push(hoje)
  lines.push('')

  if (eleitorado) {
    lines.push(`Eleitorado: ${eleitorado.toLocaleString('pt-BR')} eleitores`)
    lines.push('')
  }

  lines.push('*DEMANDAS*')
  if (demands.length === 0) {
    lines.push('Nenhuma demanda registrada.')
  } else {
    demands.slice(0, 12).forEach((d, i) => {
      const lider = d.lideranca ? ` — ${d.lideranca}` : ''
      lines.push(`${i + 1}. ${d.title || 'Sem título'}${lider}`)
      if (d.status) lines.push(`   Status: ${d.status}`)
    })
    if (demands.length > 12) lines.push(`+ ${demands.length - 12} outras demandas`)
  }
  lines.push('')

  if (pollsCidade.length > 0) {
    lines.push('*PESQUISAS (intenção)*')
    const sorted = [...pollsCidade].sort((a, b) => (b.intencao ?? 0) - (a.intencao ?? 0))
    const byKey = new Map<string, PollRow[]>()
    for (const p of sorted) {
      const key = `${formatDatePt(p.data ?? '')} — ${p.instituto ?? '—'}`
      if (!byKey.has(key)) byKey.set(key, [])
      byKey.get(key)!.push(p)
    }
    for (const [key, grupo] of byKey) {
      lines.push(key)
      grupo.slice(0, 8).forEach((p) => {
        lines.push(`  • ${p.candidato_nome}: ${(p.intencao ?? 0).toFixed(1)}%`)
      })
      lines.push('')
    }
  }

  lines.push('—')
  lines.push('Gerado pelo Cockpit 2026 / IA Cockpit')
  return lines.join('\n').trim()
}
