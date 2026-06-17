import {
  labelCenarioExpectativaComparativo,
  summarizeComparativoExpectativa2022,
  type ComparativoExpectativa2022Resumo,
  type ComparativoExpectativa2022Row,
  type CenarioExpectativaComparativo,
} from '@/lib/comparativo-expectativa-2022'
import type {
  FiltroComparativoExpectativa2022,
  ModoComparativoExpectativa2022,
} from '@/lib/agent/detect-comparativo-expectativa-2022'

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

function formatDeltaPercentual(deltaPercentual: number | null): string {
  if (deltaPercentual == null) return ''
  const sinal = deltaPercentual >= 0 ? '+' : ''
  return ` (${sinal}${deltaPercentual.toFixed(1).replace('.', ',')}%)`
}

function formatResumoComparativo(options: {
  resumo: ComparativoExpectativa2022Resumo
  cenario: CenarioExpectativaComparativo
}): { content: string; speechSegments: string[] } {
  const cenarioLabel = labelCenarioExpectativaComparativo(options.cenario)
  const { resumo } = options
  const pct = formatDeltaPercentual(resumo.deltaPercentual)

  const veredicto =
    resumo.delta > 0
      ? '**Sim.** A expectativa agregada para 2026 é **maior** que o total obtido em 2022 (Federal Jadyel).'
      : resumo.delta < 0
        ? '**Não.** A expectativa agregada para 2026 é **menor** que o total de 2022 (Federal Jadyel).'
        : '**Empate.** A expectativa total e os votos de 2022 estão no mesmo patamar.'

  let out = `**Expectativa 2026 × Federal 2022 — Piauí**\n`
  out += `Cenário: ${cenarioLabel}\n\n`
  out += `${veredicto}\n\n`
  out += `**Totais gerais**\n`
  out += `- Expectativa 2026: **${resumo.totalExpectativa2026.toLocaleString('pt-BR')}** votos\n`
  out += `- Federal 2022: **${resumo.totalVotos2022.toLocaleString('pt-BR')}** votos\n`
  out += `- Diferença: **${resumo.delta >= 0 ? '+' : ''}${resumo.delta.toLocaleString('pt-BR')}**${pct}\n\n`
  out += `**Municípios** (${resumo.municipiosComDados} com dados): **${resumo.cresceu}** acima de 2022 · **${resumo.manteve}** estáveis · **${resumo.caiu}** abaixo de 2022\n\n`
  out += `_Para ver cidades específicas, pergunte «quais municípios…» ou abra o **Mapa 2026 × 2022**._`

  const speech = [
    resumo.delta > 0
      ? 'Sim. A expectativa total para 2026 é maior que o total de 2022.'
      : resumo.delta < 0
        ? 'Não. A expectativa total para 2026 é menor que o total de 2022.'
        : 'A expectativa total está no mesmo patamar de 2022.',
    `Expectativa 2026: ${resumo.totalExpectativa2026.toLocaleString('pt-BR')} votos.`,
    `Federal 2022: ${resumo.totalVotos2022.toLocaleString('pt-BR')} votos.`,
    `Diferença: ${resumo.delta >= 0 ? 'mais' : 'menos'} ${Math.abs(resumo.delta).toLocaleString('pt-BR')} votos.`,
  ]

  return { content: out.trim(), speechSegments: speech }
}

export function formatComparativoExpectativa2022JarvisReply(options: {
  rows: ComparativoExpectativa2022Row[]
  filtro: FiltroComparativoExpectativa2022
  cenario: CenarioExpectativaComparativo
  totalFiltrado: number
  limite?: number
  modo?: ModoComparativoExpectativa2022
  resumo?: ComparativoExpectativa2022Resumo
}): { content: string; speechSegments: string[] } {
  const modo = options.modo ?? 'lista'

  if (modo === 'resumo') {
    const resumo = options.resumo ?? summarizeComparativoExpectativa2022(options.rows)
    return formatResumoComparativo({ resumo, cenario: options.cenario })
  }

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
    const pct = formatDeltaPercentual(r.deltaPercentual)
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
