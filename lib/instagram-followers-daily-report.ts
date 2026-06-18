import type { InstagramSnapshot } from '@/lib/instagramApi'
import { formatFollowersDelta } from '@/lib/instagram-followers-history-chart'

export type FollowersDailyRow = {
  dateKey: string
  dateLabel: string
  delta: number
  total: number
  previousTotal: number
}

export type FollowersDailyReportInput = {
  history: InstagramSnapshot[]
  periodDays: number
  username?: string
  currentFollowers?: number
  periodGrowth?: number
  growthPercentage?: number
}

function sortHistory(history: InstagramSnapshot[]): InstagramSnapshot[] {
  return [...history].sort(
    (a, b) => new Date(a.snapshot_date).getTime() - new Date(b.snapshot_date).getTime()
  )
}

export function buildFollowersDailyRows(history: InstagramSnapshot[]): FollowersDailyRow[] {
  const sorted = sortHistory(history)
  const rows: FollowersDailyRow[] = []

  for (let i = 1; i < sorted.length; i++) {
    const previous = sorted[i - 1]
    const current = sorted[i]
    const dateKey = current.snapshot_date.split('T')[0]

    rows.push({
      dateKey,
      dateLabel: new Date(current.snapshot_date).toLocaleDateString('pt-BR', {
        weekday: 'short',
        day: '2-digit',
        month: '2-digit',
      }),
      delta: current.followers_count - previous.followers_count,
      total: current.followers_count,
      previousTotal: previous.followers_count,
    })
  }

  return rows
}

export function formatInstagramFollowersDailyReport(input: FollowersDailyReportInput): string {
  const rows = buildFollowersDailyRows(input.history)

  if (rows.length === 0) {
    return (
      'Ainda não há histórico diário suficiente para calcular a variação dia a dia.\n\n' +
      'Acesse **Redes & Instagram** para registrar snapshots automáticos. ' +
      'São necessários pelo menos **2 dias** de coleta.'
    )
  }

  const username = input.username?.trim()
  const header = username
    ? `**Variação de seguidores por dia — @${username}**`
    : '**Variação de seguidores por dia — Instagram**'

  const periodGrowth =
    input.periodGrowth ??
    rows.reduce((sum, row) => sum + row.delta, 0)
  const currentFollowers =
    input.currentFollowers ?? rows[rows.length - 1]?.total ?? 0

  let resposta = `${header}\n\n`
  resposta += `**Período analisado:** últimos ${input.periodDays} dias (${rows.length} dia${rows.length === 1 ? '' : 's'} com variação)\n`
  resposta += `**Seguidores atuais:** ${currentFollowers.toLocaleString('pt-BR')}\n`
  resposta += `**Saldo no período:** ${formatFollowersDelta(periodGrowth)}\n\n`
  resposta += `**Dia a dia** (variação vs. dia anterior):\n`

  for (const row of [...rows].reverse()) {
    const saldo = formatFollowersDelta(row.delta)
    const tendencia =
      row.delta > 0 ? '📈' : row.delta < 0 ? '📉' : '➖'
    resposta += `› **${row.dateLabel}:** ${saldo} seguidores ${tendencia} (total: ${row.total.toLocaleString('pt-BR')})\n`
  }

  const best = rows.reduce((max, row) => (row.delta > max.delta ? row : max), rows[0])
  const worst = rows.reduce((min, row) => (row.delta < min.delta ? row : min), rows[0])

  if (rows.length > 1) {
    resposta += `\n**Melhor dia:** ${best.dateLabel} (${formatFollowersDelta(best.delta)})\n`
    if (worst.delta < 0) {
      resposta += `**Pior dia:** ${worst.dateLabel} (${formatFollowersDelta(worst.delta)})\n`
    }
  }

  if (input.growthPercentage != null && input.growthPercentage !== 0) {
    resposta += `**Variação percentual no período:** ${input.growthPercentage > 0 ? '+' : ''}${input.growthPercentage}%\n`
  }

  resposta +=
    '\n_Dados dos snapshots diários salvos ao acessar Redes & Instagram. ' +
    'Para ver o gráfico completo, abra **Posts & Insights** → Histórico de Seguidores._'

  return resposta
}
