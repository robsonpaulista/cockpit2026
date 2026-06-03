import type { JuridicoMovimentacao } from '@/lib/juridico-movimentacoes'
import { formatUltimaMovimentacaoExibicao } from '@/lib/juridico-movimentacoes'
import type { ProcessoDimensao } from '@/lib/juridico-processos-dimensao'
import { DIMENSAO_PARTY_LABEL } from '@/lib/juridico-processos-dimensao'
import { formatDateShort } from '@/lib/utils'

export type JuridicoWhatsAppMovimentacaoInput = {
  processo: Pick<
    ProcessoDimensao,
    | 'processo'
    | 'acao'
    | 'area'
    | 'status'
    | 'orgaoJulgador'
    | 'varaOrigem'
    | 'poloDimensao'
    | 'prioridade'
    | 'autor'
    | 'requerido'
  >
  movimentacao: Pick<
    JuridicoMovimentacao,
    'descricao' | 'dataMovimentacao' | 'statusProcesso' | 'observacoes' | 'fonte' | 'createdAt'
  >
  /** Destaque de que a movimentação acabou de ser registrada no Cockpit */
  novaAtualizacao?: boolean
}

function poloLabel(polo: ProcessoDimensao['poloDimensao']): string {
  if (polo === 'autor') return 'Autor'
  if (polo === 'requerido') return 'Requerido'
  return 'Autor e requerido'
}

/**
 * Texto para WhatsApp (sem emojis), alinhado ao resumo operacional / briefing.
 */
export function buildJuridicoMovimentacaoWhatsAppText(
  input: JuridicoWhatsAppMovimentacaoInput
): string {
  const { processo: p, movimentacao: m, novaAtualizacao } = input
  const lines: string[] = []

  lines.push('*JURÍDICO — Atualização de processo*')
  if (novaAtualizacao) {
    lines.push('_Nova movimentação registrada no Cockpit_')
  }
  lines.push('')

  lines.push(`*Processo:* ${p.processo}`)
  if (p.acao) lines.push(`*Ação:* ${p.acao}`)
  if (p.area) lines.push(`*Área:* ${p.area}`)
  if (p.orgaoJulgador) lines.push(`*Órgão:* ${p.orgaoJulgador}`)
  if (p.varaOrigem) lines.push(`*Vara:* ${p.varaOrigem}`)
  lines.push(`*Polo ${DIMENSAO_PARTY_LABEL}:* ${poloLabel(p.poloDimensao)}`)
  if (p.prioridade) lines.push(`*Prioridade:* ${p.prioridade}`)
  lines.push('')

  lines.push('*Última movimentação*')
  lines.push(
    formatUltimaMovimentacaoExibicao(m.descricao, m.dataMovimentacao ?? m.createdAt.slice(0, 10))
  )
  if (m.statusProcesso) lines.push(`*Status:* ${m.statusProcesso}`)
  if (m.observacoes?.trim()) lines.push(`*Obs.:* ${m.observacoes.trim()}`)
  lines.push('')

  if (p.autor || p.requerido) {
    lines.push('*Partes*')
    if (p.autor) lines.push(`• Autor: ${p.autor}`)
    if (p.requerido) lines.push(`• Requerido: ${p.requerido}`)
    lines.push('')
  }

  lines.push('—'.repeat(32))
  lines.push(`Cockpit 2026 — ${formatDateShort(new Date().toISOString().slice(0, 10))}`)

  return lines.join('\n').trim()
}
