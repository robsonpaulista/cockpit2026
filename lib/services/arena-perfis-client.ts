import type { ArenaIntervalo, ArenaPerfil, ArenaPerfilPapel } from '@/lib/arena/types'

export type ArenaPerfisResposta = {
  perfis: ArenaPerfil[]
  intervalo: ArenaIntervalo
  /** Posts publicados no período (base da fidelidade). */
  postsNoPeriodo: number
}

/** Perfis da Arena com a pontuação calculada no intervalo, opcionalmente filtrados por papel. */
export async function listarArenaPerfis(
  intervalo: ArenaIntervalo,
  papel?: ArenaPerfilPapel,
): Promise<ArenaPerfisResposta> {
  const params = new URLSearchParams({ inicio: intervalo.inicio, fim: intervalo.fim })
  if (papel) params.set('papel', papel)
  const res = await fetch(`/api/arena/perfis?${params.toString()}`, { cache: 'no-store' })
  if (!res.ok) {
    const json = (await res.json().catch(() => null)) as { error?: string } | null
    throw new Error(json?.error ?? 'Não foi possível carregar os perfis da arena')
  }
  return (await res.json()) as ArenaPerfisResposta
}
