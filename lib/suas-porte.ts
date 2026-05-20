import type { SuasFaixaPorte } from '@/lib/limites-tetos-types'
import { SUAS_FAIXAS_PADRAO } from '@/lib/limites-tetos-types'

/** Classificação de porte e teto SUAS por população. */

export interface ClassificacaoSuas {
  porte: string
  valorFormatado: string
  valorNumerico: number | null
}

function formatBrl(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function classificaPorteSuasFromFaixas(
  populacao: number | null,
  faixas: SuasFaixaPorte[] = SUAS_FAIXAS_PADRAO,
): ClassificacaoSuas {
  if (populacao === null || !Number.isFinite(populacao)) {
    return { porte: '-', valorFormatado: '-', valorNumerico: null }
  }
  const ordenadas = [...faixas].sort((a, b) => a.ordem - b.ordem)
  for (const faixa of ordenadas) {
    if (faixa.populacao_max == null) {
      return {
        porte: faixa.porte,
        valorFormatado: formatBrl(faixa.valor),
        valorNumerico: faixa.valor,
      }
    }
    if (populacao <= faixa.populacao_max) {
      return {
        porte: faixa.porte,
        valorFormatado: formatBrl(faixa.valor),
        valorNumerico: faixa.valor,
      }
    }
  }
  const ultima = ordenadas[ordenadas.length - 1]
  if (ultima) {
    return {
      porte: ultima.porte,
      valorFormatado: formatBrl(ultima.valor),
      valorNumerico: ultima.valor,
    }
  }
  return { porte: '-', valorFormatado: '-', valorNumerico: null }
}

export function classificaPorteSuas(populacao: number | null): ClassificacaoSuas {
  return classificaPorteSuasFromFaixas(populacao, SUAS_FAIXAS_PADRAO)
}

export function parseValorSuasFormatado(valorFormatado: string): number {
  if (valorFormatado === '-') return 0
  const valor = valorFormatado.replace('R$ ', '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(valor)
  return Number.isFinite(n) ? n : 0
}
