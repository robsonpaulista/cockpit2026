export type MovimentoPublico = {
  codigo: number | null
  nome: string
  dataHora: string | null
  orgaoJulgador: string | null
  possivelPrazo: boolean
}

export type AndamentoPublicoResponse = {
  ok: boolean
  fonte: 'datajud' | 'planilha'
  processo: string
  consultaPublicaUrl: string | null
  classe: string | null
  dataAjuizamento: string | null
  dataHoraUltimaAtualizacao: string | null
  ultimaMovimentacaoPlanilha: string | null
  movimentos: MovimentoPublico[]
  movimentosPrazo: MovimentoPublico[]
  aviso: string | null
}

const PRAZO_REGEX =
  /prazo|intima|intimação|citac|citação|manifest|recurso|conclus|decis|despach|audiên|senten|embarg|penhor|bloqueio|alvará/i

export function movimentoIndicaPrazo(nome: string): boolean {
  return PRAZO_REGEX.test(nome)
}

export function formatDatajudTimestamp(val: string | null | undefined): string | null {
  if (!val) return null
  const s = String(val).trim()
  if (/^\d{8}\d{6}$/.test(s)) {
    const y = s.slice(0, 4)
    const mo = s.slice(4, 6)
    const d = s.slice(6, 8)
    const h = s.slice(8, 10)
    const mi = s.slice(10, 12)
    return `${d}/${mo}/${y} ${h}:${mi}`
  }
  try {
    const dt = new Date(s)
    if (Number.isNaN(dt.getTime())) return s
    return dt.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
  } catch {
    return s
  }
}

type DatajudMovimentoRaw = {
  codigo?: number
  nome?: string
  dataHora?: string
  orgaoJulgador?: { nome?: string }
}

type DatajudSourceRaw = {
  numeroProcesso?: string
  classe?: { nome?: string }
  dataAjuizamento?: string
  dataHoraUltimaAtualizacao?: string
  movimentos?: DatajudMovimentoRaw[]
}

export function normalizeDatajudHit(source: DatajudSourceRaw): {
  classe: string | null
  dataAjuizamento: string | null
  dataHoraUltimaAtualizacao: string | null
  movimentos: MovimentoPublico[]
} {
  const movimentos = (source.movimentos ?? [])
    .map((m) => {
      const nome = String(m.nome ?? '').trim() || 'Movimentação'
      return {
        codigo: typeof m.codigo === 'number' ? m.codigo : null,
        nome,
        dataHora: m.dataHora ?? null,
        orgaoJulgador: m.orgaoJulgador?.nome ?? null,
        possivelPrazo: movimentoIndicaPrazo(nome),
      }
    })
    .sort((a, b) => {
      const ta = a.dataHora ? new Date(a.dataHora).getTime() : 0
      const tb = b.dataHora ? new Date(b.dataHora).getTime() : 0
      return tb - ta
    })

  return {
    classe: source.classe?.nome ?? null,
    dataAjuizamento: formatDatajudTimestamp(source.dataAjuizamento),
    dataHoraUltimaAtualizacao: formatDatajudTimestamp(source.dataHoraUltimaAtualizacao),
    movimentos,
  }
}
