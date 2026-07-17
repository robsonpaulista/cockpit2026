export const RESUMO_ELEICOES_HUB_PERSIST_KEY = 'resumo_eleicoes_hub_persist_v1'

export type ResumoEleicoesHubPersist = {
  cidade?: string
  buscaIniciada?: boolean
}

function canUseStorage(): boolean {
  return typeof window !== 'undefined'
}

export function readResumoEleicoesHubPersist(): ResumoEleicoesHubPersist {
  if (!canUseStorage()) return {}
  try {
    const raw = sessionStorage.getItem(RESUMO_ELEICOES_HUB_PERSIST_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as ResumoEleicoesHubPersist
    if (!parsed || typeof parsed !== 'object') return {}
    return {
      cidade: typeof parsed.cidade === 'string' ? parsed.cidade : undefined,
      buscaIniciada: Boolean(parsed.buscaIniciada),
    }
  } catch {
    return {}
  }
}

export function writeResumoEleicoesHubPersist(
  patch: Partial<ResumoEleicoesHubPersist> & { clearCidade?: boolean },
): void {
  if (!canUseStorage()) return
  try {
    const current = readResumoEleicoesHubPersist()
    const next: ResumoEleicoesHubPersist = { ...current, ...patch }
    delete (next as { clearCidade?: boolean }).clearCidade
    if (patch.clearCidade || patch.cidade === '') {
      delete next.cidade
    }
    sessionStorage.setItem(RESUMO_ELEICOES_HUB_PERSIST_KEY, JSON.stringify(next))
  } catch {
    // storage indisponível / cheio
  }
}

export function persistResumoEleicoesCidade(
  cidade: string | null | undefined,
  opts?: { buscaIniciada?: boolean },
): void {
  const limpa = String(cidade || '').trim()
  if (!limpa) {
    writeResumoEleicoesHubPersist({
      clearCidade: true,
      ...(opts?.buscaIniciada !== undefined ? { buscaIniciada: opts.buscaIniciada } : {}),
    })
    return
  }
  writeResumoEleicoesHubPersist({
    cidade: limpa,
    ...(opts?.buscaIniciada !== undefined ? { buscaIniciada: opts.buscaIniciada } : {}),
  })
}
