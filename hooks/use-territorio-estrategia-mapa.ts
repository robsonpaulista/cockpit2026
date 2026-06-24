'use client'

import { useEffect, useState } from 'react'
import type { PrioridadeCampoMapaRow } from '@/components/mapa-presenca'

export type TerritorioEstrategiaMapaItem = {
  cidade: string
  motivo: string
  expectativaVotos?: number
  visitas?: number
}

function mapTerritorioItems(list: Record<string, unknown>[] | undefined): TerritorioEstrategiaMapaItem[] {
  return (list ?? []).map((t) => ({
    cidade: String(t.cidade ?? ''),
    motivo: String(t.motivo ?? ''),
    expectativaVotos: typeof t.expectativaVotos === 'number' ? t.expectativaVotos : undefined,
    visitas: typeof t.visitas === 'number' ? t.visitas : undefined,
  }))
}

export function useTerritorioEstrategiaMapa() {
  const [loading, setLoading] = useState(true)
  const [territoriosFrios, setTerritoriosFrios] = useState<TerritorioEstrategiaMapaItem[]>([])
  const [territoriosQuentes, setTerritoriosQuentes] = useState<TerritorioEstrategiaMapaItem[]>([])
  const [territoriosMornos, setTerritoriosMornos] = useState<TerritorioEstrategiaMapaItem[]>([])
  const [cidadesComLiderancas, setCidadesComLiderancas] = useState<string[]>([])
  const [cidadesVisitadasLista, setCidadesVisitadasLista] = useState<string[]>([])
  const [expectativaPorCidadeLista, setExpectativaPorCidadeLista] = useState<
    Array<{ cidade: string; expectativaVotos: number }>
  >([])
  const [prioridadeCampoLista, setPrioridadeCampoLista] = useState<PrioridadeCampoMapaRow[]>([])

  useEffect(() => {
    const abortController = new AbortController()
    const signal = abortController.signal

    const fetchTerritoriosMapa = async () => {
      setLoading(true)
      try {
        let config: Record<string, unknown> | { spreadsheetId?: string } | null = null
        try {
          const serverConfigRes = await fetch('/api/territorio/config', { signal })
          const serverConfig = (await serverConfigRes.json()) as { configured?: boolean }
          if (serverConfig.configured) {
            config = {}
          }
        } catch {
          if (signal.aborted) return
        }

        if (!config && typeof window !== 'undefined') {
          const savedConfig = localStorage.getItem('territorio_sheets_config')
          if (savedConfig) {
            try {
              config = JSON.parse(savedConfig) as Record<string, unknown>
            } catch {
              config = null
            }
          }
        }

        if (config && !signal.aborted) {
          const response = await fetch('/api/dashboard/territorios-frios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              territorioConfig:
                config && typeof config === 'object' && 'spreadsheetId' in config && config.spreadsheetId
                  ? config
                  : {},
            }),
            signal,
          })

          if (response.ok) {
            const data = (await response.json()) as {
              territoriosFrios?: Record<string, unknown>[]
              territoriosQuentes?: Record<string, unknown>[]
              territoriosMornos?: Record<string, unknown>[]
              cidadesComLiderancas?: string[]
              cidadesVisitadasLista?: string[]
              expectativaPorCidadeLista?: Record<string, unknown>[]
              prioridadeCampoLista?: Record<string, unknown>[]
            }
            if (signal.aborted) return

            setTerritoriosFrios(mapTerritorioItems(data.territoriosFrios))
            setTerritoriosQuentes(mapTerritorioItems(data.territoriosQuentes))
            setTerritoriosMornos(mapTerritorioItems(data.territoriosMornos))
            if (data.cidadesComLiderancas) setCidadesComLiderancas(data.cidadesComLiderancas)
            if (data.cidadesVisitadasLista) setCidadesVisitadasLista(data.cidadesVisitadasLista)
            if (Array.isArray(data.expectativaPorCidadeLista)) {
              setExpectativaPorCidadeLista(
                data.expectativaPorCidadeLista
                  .map((item) => ({
                    cidade: String(item.cidade ?? ''),
                    expectativaVotos: Number(item.expectativaVotos) || 0,
                  }))
                  .filter((item) => item.cidade && item.expectativaVotos > 0)
              )
            }
            if (Array.isArray(data.prioridadeCampoLista)) {
              setPrioridadeCampoLista(
                data.prioridadeCampoLista.map((item) => ({
                  cidade: String(item.cidade ?? ''),
                  expectativaVotos: Number(item.expectativaVotos) || 0,
                  eleitorado: Number(item.eleitorado) || 0,
                  semExpectativa: Boolean(item.semExpectativa),
                  visitas: Number(item.visitas) || 0,
                  agendas: Number(item.agendas) || 0,
                  motivo: String(item.motivo ?? ''),
                  ultimaVisita: item.ultimaVisita != null ? String(item.ultimaVisita) : null,
                }))
              )
            }
          }
        }
      } catch {
        if (signal.aborted) return
      } finally {
        if (!signal.aborted) setLoading(false)
      }
    }

    void fetchTerritoriosMapa()
    return () => abortController.abort()
  }, [])

  return {
    loading,
    territoriosFrios,
    territoriosQuentes,
    territoriosMornos,
    cidadesComLiderancas,
    cidadesVisitadasLista,
    expectativaPorCidadeLista,
    prioridadeCampoLista,
    hasMapData: cidadesComLiderancas.length > 0,
  }
}

export type TerritorioEstrategiaMapaData = ReturnType<typeof useTerritorioEstrategiaMapa>
