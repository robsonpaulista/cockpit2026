export type JuridicoMovimentacaoFonte = 'manual' | 'planilha' | 'datajud'

export type JuridicoMovimentacao = {
  id: string
  processoId: string
  descricao: string
  dataMovimentacao: string | null
  statusProcesso: string | null
  observacoes: string | null
  fonte: JuridicoMovimentacaoFonte
  createdAt: string
  createdByName: string | null
}

export type JuridicoMovimentacoesResponse = {
  processoId: string
  ultimaMovimentacao: string | null
  dataUltimaMovimentacao: string | null
  statusAtual: string | null
  movimentacoes: JuridicoMovimentacao[]
}

export type RegistrarMovimentacaoInput = {
  descricao: string
  dataMovimentacao?: string | null
  statusProcesso?: string | null
  observacoes?: string | null
}

/** Última movimentação registrada manualmente pela equipe no Cockpit. */
export function isMovimentacaoAtualizacaoEquipe(fonte: JuridicoMovimentacaoFonte | null | undefined): boolean {
  return fonte === 'manual'
}

export function formatUltimaMovimentacaoExibicao(
  descricao: string | null | undefined,
  data: string | null | undefined
): string {
  const d = descricao?.trim()
  if (!d) return '—'
  if (data?.trim()) {
    const [y, m, day] = data.split('-')
    if (y && m && day) return `${day}/${m}/${y} — ${d}`
  }
  return d
}
