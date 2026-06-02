import type { ResumoOperacionalResponse, ResumoSecao } from '@/lib/resumo-operacional'
import { formatDateShort } from '@/lib/utils'

const SEPARADOR = '—'.repeat(32)

function formatPeriodoWhatsApp(inicio: string, fim: string): string {
  return `${formatDateShort(inicio)} a ${formatDateShort(fim)}`
}

function appendSecaoNoticias(lines: string[], secao: ResumoSecao): void {
  lines.push('*NOTÍCIAS*')
  const intro = secao.itens[0]
  if (intro) lines.push(intro)
  lines.push('')

  const links = secao.noticiasLinks ?? []
  if (links.length === 0) {
    const fallback = secao.itens.slice(1)
    for (const item of fallback) lines.push(`• ${item}`)
    lines.push('')
    return
  }

  for (const n of links) {
    const meta = n.meta ? ` (${n.meta})` : ''
    const cabecalho = [n.dataFmt, n.source].filter(Boolean).join(' · ')
    lines.push(`• ${cabecalho}${meta}`)
    lines.push(`  ${n.title}`)
    if (n.url) lines.push(`  ${n.url}`)
    lines.push('')
  }
}

function appendSecaoGenerica(lines: string[], secao: ResumoSecao): void {
  lines.push(`*${secao.titulo.toUpperCase()}*`)
  for (const item of secao.itens) {
    lines.push(`• ${item}`)
  }
  lines.push('')
}

/**
 * Versão WhatsApp do resumo operacional (texto sóbrio, sem emojis).
 */
export function buildResumoOperacionalWhatsAppText(resumo: ResumoOperacionalResponse): string {
  const lines: string[] = []

  lines.push(`*${resumo.cabecalho}*`)
  lines.push(
    `Período: ${formatPeriodoWhatsApp(resumo.periodo.inicio, resumo.periodo.fim)} (${resumo.periodo.dias} dias)`
  )
  lines.push(
    `Comparativo: ${formatPeriodoWhatsApp(resumo.periodo.inicioAnterior, resumo.periodo.fimAnterior)}`
  )
  lines.push('')

  if (resumo.alertas.length > 0) {
    lines.push('*ALERTAS*')
    for (const alerta of resumo.alertas) {
      lines.push(`• ${alerta}`)
    }
    lines.push('')
  }

  lines.push(SEPARADOR)

  for (const secao of resumo.secoes) {
    if (secao.titulo === 'Notícias') {
      appendSecaoNoticias(lines, secao)
    } else {
      appendSecaoGenerica(lines, secao)
    }
  }

  lines.push(SEPARADOR)
  lines.push(`Gerado pelo Cockpit 2026 — ${formatDateShort(resumo.geradoEm)}`)

  return lines.join('\n').trim()
}
