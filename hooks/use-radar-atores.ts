'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchRadarAtores } from '@/lib/services/radar-eleitoral-client'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'

const ORDEM_TIPO: Record<PoliticalActorWithTerms['actor_type'], number> = {
  own_candidate: 0,
  competitor: 1,
  ally: 2,
  other: 3,
}

/** Candidatos monitorados pelo radar (compartilhados por todas as abas e pelo filtro global). */
export function useRadarAtores() {
  const [atores, setAtores] = useState<PoliticalActorWithTerms[]>([])
  const [carregando, setCarregando] = useState<boolean>(true)
  const [setupRequired, setSetupRequired] = useState<boolean>(false)
  const [youtubeConfigurado, setYoutubeConfigurado] = useState<boolean | null>(null)
  const [instavel, setInstavel] = useState<boolean>(false)

  const recarregar = useCallback(async () => {
    try {
      const r = await fetchRadarAtores()
      if (!r.instavel) setAtores(r.dados)
      setSetupRequired(r.setupRequired)
      if (r.youtubeConfigurado !== null) setYoutubeConfigurado(r.youtubeConfigurado)
      setInstavel(r.instavel)
    } catch {
      setInstavel(true)
    } finally {
      setCarregando(false)
    }
  }, [])

  useEffect(() => {
    void recarregar()
  }, [recarregar])

  useEffect(() => {
    if (!instavel) return
    const id = window.setTimeout(() => void recarregar(), 5000)
    return () => window.clearTimeout(id)
  }, [instavel, recarregar])

  const ativos = useMemo(
    () =>
      atores
        .filter((a) => a.active)
        .sort((a, b) => ORDEM_TIPO[a.actor_type] - ORDEM_TIPO[b.actor_type] || a.name.localeCompare(b.name, 'pt-BR')),
    [atores],
  )

  return { atores, ativos, carregando, setupRequired, youtubeConfigurado, instavel, recarregar }
}

export type RadarAtores = ReturnType<typeof useRadarAtores>
