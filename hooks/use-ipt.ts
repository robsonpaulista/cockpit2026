'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { getEleitoradoByCity } from '@/lib/eleitores'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import {
  calcularIptMunicipios,
  calcularIptResumo,
  normalizeIptMunicipio,
  type IptMunicipio,
  type IptMunicipioInput,
  type IptResumo,
} from '@/lib/ipt'
import {
  buildPesquisaIptPorMunicipio,
  posicaoCandidatoNoTop5,
  resolveCandidatoIpt,
  type PollIptRow,
} from '@/lib/ipt-pesquisa'
import {
  aplicarOverridesIpt,
  type IptInsightOverrideMap,
} from '@/lib/ipt-insights'

type PrioridadeRow = {
  cidade: string
  expectativaVotos: number
  eleitorado?: number
  visitas: number
}

type ObrasAgg = { count: number; valorTotal: number }

function agregarObrasPorMunicipio(obras: ObraMapaRow[]): Map<string, ObrasAgg> {
  const map = new Map<string, ObrasAgg>()
  for (const obra of obras) {
    const municipio = obra.municipio?.trim()
    if (!municipio) continue
    const key = normalizeIptMunicipio(municipio)
    const cur = map.get(key) ?? { count: 0, valorTotal: 0 }
    cur.count += 1
    cur.valorTotal += typeof obra.valor_total === 'number' && Number.isFinite(obra.valor_total) ? obra.valor_total : 0
    map.set(key, cur)
  }
  return map
}

function mapVisitas15Dias(
  rows: Array<{ municipio: string; visitas: number }> | undefined
): Map<string, number> {
  const map = new Map<string, number>()
  for (const row of rows ?? []) {
    map.set(normalizeIptMunicipio(row.municipio), row.visitas)
  }
  return map
}

export function useIpt() {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [municipios, setMunicipios] = useState<IptMunicipio[]>([])
  const [resumo, setResumo] = useState<IptResumo>({
    municipiosMonitorados: 0,
    criticos: 0,
    atencao: 0,
    estaveis: 0,
    fortes: 0,
    semExpectativa: 0,
  })

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      let territorioConfig: Record<string, unknown> | null = null
      const configRes = await fetch('/api/territorio/config', { cache: 'no-store' })
      const configJson = (await configRes.json()) as { configured?: boolean }
      if (configJson.configured) {
        territorioConfig = {}
      } else if (typeof window !== 'undefined') {
        const saved = localStorage.getItem('territorio_sheets_config')
        if (saved) territorioConfig = JSON.parse(saved) as Record<string, unknown>
      }

      const [territorioRes, pesquisaRes, obrasRes, visitas15Res, insightsRes] = await Promise.all([
        fetch('/api/dashboard/territorios-frios', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ territorioConfig: territorioConfig ?? {} }),
          cache: 'no-store',
        }),
        fetch('/api/pesquisa?limit=5000', { cache: 'no-store' }),
        fetch('/api/obras', { cache: 'no-store' }),
        fetch('/api/campo/visitas-resumo-td?days=15', { cache: 'no-store' }),
        fetch('/api/ipt/insights?mode=overrides', { cache: 'no-store' }),
      ])

      if (!territorioRes.ok) {
        throw new Error('Não foi possível carregar dados territoriais.')
      }

      const territorioData = (await territorioRes.json()) as {
        prioridadeCampoLista?: PrioridadeRow[]
      }

      const obrasPorMunicipio = obrasRes.ok
        ? agregarObrasPorMunicipio(((await obrasRes.json()) as { obras?: ObraMapaRow[] }).obras ?? [])
        : new Map<string, ObrasAgg>()

      const visitas15PorMunicipio = visitas15Res.ok
        ? mapVisitas15Dias(
            ((await visitas15Res.json()) as { municipios?: Array<{ municipio: string; visitas: number }> })
              .municipios
          )
        : new Map<string, number>()

      const candidatoPesquisa = resolveCandidatoIpt()
      const polls: PollIptRow[] = pesquisaRes.ok
        ? ((await pesquisaRes.json()) as PollIptRow[])
        : []
      const { intencaoPorMunicipio, top5PorMunicipio, basePorMunicipio } =
        buildPesquisaIptPorMunicipio(polls, candidatoPesquisa)

      const prioridadeMap = new Map<string, PrioridadeRow>()
      for (const row of territorioData.prioridadeCampoLista ?? []) {
        prioridadeMap.set(normalizeIptMunicipio(row.cidade), row)
      }

      const inputs: IptMunicipioInput[] = (municipiosPiaui as Array<{ nome: string }>).map((m) => {
        const key = normalizeIptMunicipio(m.nome)
        const row = prioridadeMap.get(key)
        const obras = obrasPorMunicipio.get(key)

        const top5 = top5PorMunicipio.get(key) ?? []

        return {
          municipio: m.nome,
          expectativaVotos: row?.expectativaVotos ?? 0,
          eleitorado: row?.eleitorado ?? getEleitoradoByCity(m.nome) ?? 0,
          liderancas: 0,
          visitas: row?.visitas ?? 0,
          visitasUltimos15Dias: visitas15PorMunicipio.get(key) ?? 0,
          obrasCount: obras?.count ?? 0,
          obrasValorTotal: obras?.valorTotal ?? 0,
          intencaoPesquisa: intencaoPorMunicipio.get(key) ?? null,
          pesquisaPosicaoTop5: posicaoCandidatoNoTop5(top5, candidatoPesquisa),
          pesquisaTop5: top5,
          pesquisaBase: basePorMunicipio.get(key) ?? null,
        }
      })

      const calculados = calcularIptMunicipios(inputs)

      let overrideMap: IptInsightOverrideMap = new Map()
      if (insightsRes.ok) {
        const insightsJson = (await insightsRes.json()) as {
          overrides?: Record<string, Partial<Record<'visitas' | 'obras' | 'pesquisa', import('@/lib/ipt').IptSinal>>>
        }
        overrideMap = new Map(Object.entries(insightsJson.overrides ?? {}))
      }

      const comOverrides = aplicarOverridesIpt(calculados, overrideMap)
      setMunicipios(comOverrides)
      setResumo(calcularIptResumo(comOverrides))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao calcular prioridades.')
      setMunicipios([])
      setResumo({ municipiosMonitorados: 0, criticos: 0, atencao: 0, estaveis: 0, fortes: 0, semExpectativa: 0 })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const porNome = useMemo(() => {
    const map = new Map<string, IptMunicipio>()
    for (const m of municipios) map.set(normalizeIptMunicipio(m.municipio), m)
    return map
  }, [municipios])

  return { loading, error, municipios, resumo, porNome, recarregar: carregar }
}
