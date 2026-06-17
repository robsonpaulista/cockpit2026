export interface LiderancaPorCargoRow {
  cargo: string
  total: number
}

export function resolveTerritorioCargoColumn(headers: string[]): string | null {
  const col = headers.find((h) => /função|funcao|cargo|papel|atuação|atuacao/i.test(h))
  return col ?? null
}

export function aggregateLiderancasPorCargo(
  records: ReadonlyArray<Record<string, unknown>>,
  cargoCol: string
): LiderancaPorCargoRow[] {
  const totais = new Map<string, number>()

  for (const record of records) {
    const cargo = String(record[cargoCol] ?? '').trim()
    if (!cargo) continue
    totais.set(cargo, (totais.get(cargo) ?? 0) + 1)
  }

  return [...totais.entries()]
    .map(([cargo, total]) => ({ cargo, total }))
    .sort((a, b) => b.total - a.total || a.cargo.localeCompare(b.cargo, 'pt-BR'))
}

export function formatLiderancasPorCargoJarvisReply(options: {
  rows: LiderancaPorCargoRow[]
  totalLiderancas: number
  semCargo: number
}): { content: string; speechSegments: string[] } {
  const { rows, totalLiderancas, semCargo } = options

  if (totalLiderancas === 0) {
    return {
      content:
        'Não há lideranças na planilha de **Território & Base**. Confira a configuração da planilha.',
      speechSegments: ['Não há lideranças na planilha de território.'],
    }
  }

  if (rows.length === 0) {
    return {
      content: `Há **${totalLiderancas.toLocaleString('pt-BR')}** liderança(s), mas nenhuma com **cargo** preenchido na planilha.`,
      speechSegments: [
        `${totalLiderancas} lideranças sem cargo preenchido na planilha.`,
      ],
    }
  }

  const linhas = rows.map(
    (row, index) =>
      `${index + 1}. **${row.cargo}** — **${row.total.toLocaleString('pt-BR')}** liderança(s)`
  )

  let out = `**Lideranças por cargo — Piauí**\n`
  out += `Total na base: **${totalLiderancas.toLocaleString('pt-BR')}** liderança(s)\n`
  if (semCargo > 0) {
    out += `Sem cargo informado: **${semCargo.toLocaleString('pt-BR')}**\n`
  }
  out += `\n${linhas.join('\n')}`
  out += `\n\n_Ver detalhes e filtros em **Território & Base**._`

  const top = rows[0]
  const speech = [
    `${totalLiderancas} lideranças na base.`,
    top
      ? `Cargo com mais lideranças: ${top.cargo}, ${top.total}.`
      : 'Nenhum cargo preenchido.',
  ]

  return { content: out.trim(), speechSegments: speech }
}
