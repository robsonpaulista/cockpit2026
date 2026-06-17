import {
  labelCenarioExpectativaComparativo,
  type ComparativoExpectativa2022Row,
  type CenarioExpectativaComparativo,
} from '@/lib/comparativo-expectativa-2022'
import type { FiltroComparativoExpectativa2022 } from '@/lib/agent/detect-comparativo-expectativa-2022'

function tituloFiltro(filtro: FiltroComparativoExpectativa2022): string {
  switch (filtro) {
    case 'cresceu':
      return 'Expectativa 2026 **acima** de Federal 2022 (Jadyel)'
    case 'manteve':
      return 'Expectativa 2026 **estável** vs. Federal 2022 (Jadyel)'
    case 'todos':
      return 'Comparativo Expectativa 2026 × Federal 2022 (Jadyel)'
    default:
      return 'Expectativa 2026 **menor** que Federal 2022 (Jadyel)'
  }
}

export function formatComparativoExpectativa2022JarvisReply(options: {
  rows: ComparativoExpectativa2022Row[]
  filtro: FiltroComparativoExpectativa2022
  cenario: CenarioExpectativaComparativo
  totalFiltrado: number
  limite?: number
}): { content: string; speechSegments: string[] } {
  const limite = options.limite ?? 20
  const cenarioLabel = labelCenarioExpectativaComparativo(options.cenario)
  const slice = options.rows.slice(0, limite)

  if (slice.length === 0) {
    const empty = `**${tituloFiltro(options.filtro)}**\n\nCenário: ${cenarioLabel}\n\nNenhum município neste recorte. Confira a planilha em **Território & Base** ou abra o **Mapa 2026 × 2022**.`
    return {
      content: empty,
      speechSegments: ['Nenhum município neste recorte do comparativo.'],
    }
  }

  const linhas = slice.map((r, i) => {
    const pct =
      r.deltaPercentual != null
        ? ` (${r.deltaPercentual >= 0 ? '+' : ''}${r.deltaPercentual.toFixed(1).replace('.', ',')}%)`
        : ''
    return `${i + 1}. **${r.cidade}** — 2026: **${r.expectativa2026.toLocaleString('pt-BR')}** | 2022: **${r.votos2022.toLocaleString('pt-BR')}** | Δ ${r.delta.toLocaleString('pt-BR')}${pct}`
  })

  let out = `**${tituloFiltro(options.filtro)}**\n`
  out += `Cenário: ${cenarioLabel}\n`
  out += `**${options.totalFiltrado}** município(s) no recorte`
  if (options.filtro === 'caiu') {
    out += ' — ordenados pela maior queda absoluta'
  }
  out += '\n\n'
  out += linhas.join('\n')

  if (options.totalFiltrado > limite) {
    out += `\n\n+ ${options.totalFiltrado - limite} outro(s). Veja o mapa em **Território & Base** → **Mapa 2026 × 2022**.`
  }

  const speech = [
    `${options.totalFiltrado} municípios no comparativo.`,
    `Destaque: ${slice[0]?.cidade}, queda de ${Math.abs(slice[0]?.delta ?? 0).toLocaleString('pt-BR')} votos.`,
  ]

  return { content: out.trim(), speechSegments: speech }
}
