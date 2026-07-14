'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { getEleitoradoByCity } from '@/lib/eleitores'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import { valorExibidoMapaObra } from '@/lib/obras-mapa'
import {
  calcularIptMunicipios,
  calcularIptResumo,
  IPT_VISITAS_JANELA_DIAS,
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
import {
  buildIptPresencaDigitalPorMunicipio,
  mergePresencaDigitalNosMunicipiosIpt,
  mergePesquisaEvolucaoNosMunicipiosIpt,
  mergeVisitasEvolucaoNosMunicipiosIpt,
  type IptPresencaDigitalCobertura,
} from '@/lib/ipt-instagram-presenca-digital'
import { loadInstagramConfigAsync } from '@/lib/instagramApi'

type PrioridadeRow = {
  cidade: string
  expectativaVotos: number
  eleitorado?: number
  visitas: number
}

type ObrasAgg = { count: number; valorTotal: number }

/** Obras do mandato Jadyel (planilhas → data/obras-jadyel.json), mesma fonte do Mapa de Obras. */
const IPT_OBRAS_API = '/api/obras/mapa?escopo=lista&periodo=todos'

function agregarObrasPorMunicipio(obras: ObraMapaRow[]): Map<string, ObrasAgg> {
  const map = new Map<string, ObrasAgg>()
  for (const obra of obras) {
    const municipio = obra.municipio?.trim()
    if (!municipio) continue
    const key = normalizeIptMunicipio(municipio)
    const cur = map.get(key) ?? { count: 0, valorTotal: 0 }
    cur.count += 1
    cur.valorTotal += valorExibidoMapaObra(obra) ?? 0
    map.set(key, cur)
  }
  return map
}

/** Conta posts classificados com vínculo obra → município (fonte Redes). */
function agregarDivulgacaoObrasPorMunicipio(
  obras: ObraMapaRow[],
  classifications: Record<string, { obraMapaId?: string | null }>
): Map<string, number> {
  const obraToMunicipio = new Map<string, string>()
  for (const obra of obras) {
    if (!obra.id) continue
    const municipio = obra.municipio?.trim()
    if (!municipio) continue
    obraToMunicipio.set(obra.id, normalizeIptMunicipio(municipio))
  }
  const map = new Map<string, number>()
  for (const row of Object.values(classifications)) {
    const obraId = row.obraMapaId?.trim()
    if (!obraId) continue
    const key = obraToMunicipio.get(obraId)
    if (!key) continue
    map.set(key, (map.get(key) ?? 0) + 1)
  }
  return map
}

function mapVisitasNoPeriodo(
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
  const [conexaoInstavel, setConexaoInstavel] = useState(false)
  const [municipios, setMunicipios] = useState<IptMunicipio[]>([])
  const [presencaDigitalCobertura, setPresencaDigitalCobertura] =
    useState<IptPresencaDigitalCobertura | null>(null)
  const [resumo, setResumo] = useState<IptResumo>({
    municipiosMonitorados: 0,
    criticos: 0,
    atencao: 0,
    estaveis: 0,
    fortes: 0,
    semExpectativa: 0,
  })

  const carregar = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = opts?.silent === true
    if (!silent) {
      setLoading(true)
      setError('')
    }
    let instavel = false
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

      const [territorioRes, pesquisaRes, obrasRes, visitasPeriodoRes, visitasAnteriorRes, insightsRes, classifRes, igCfg] =
        await Promise.all([
          fetch('/api/dashboard/territorios-frios', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ territorioConfig: territorioConfig ?? {} }),
            cache: 'no-store',
          }),
          fetch('/api/pesquisa?limit=5000', { cache: 'no-store' }),
          fetch(IPT_OBRAS_API, { cache: 'no-store' }),
          fetch(`/api/campo/visitas-resumo-td?days=${IPT_VISITAS_JANELA_DIAS}`, { cache: 'no-store' }),
          fetch(
            `/api/campo/visitas-resumo-td?days=${IPT_VISITAS_JANELA_DIAS}&offsetDays=${IPT_VISITAS_JANELA_DIAS}`,
            { cache: 'no-store' }
          ),
          fetch('/api/ipt/insights?mode=overrides', { cache: 'no-store' }),
          fetch('/api/instagram/classifications', { cache: 'no-store' }),
          loadInstagramConfigAsync().catch(() => ({ token: '', businessAccountId: '' })),
        ])

      const territorioJson = (await territorioRes.json()) as { retryable?: boolean }
      if (!territorioRes.ok) {
        if (territorioJson.retryable || territorioRes.status === 503) {
          instavel = true
        } else {
          throw new Error('Não foi possível carregar dados territoriais.')
        }
      }

      const territorioData = territorioRes.ok
        ? ((territorioJson as { prioridadeCampoLista?: PrioridadeRow[] }) ?? {})
        : { prioridadeCampoLista: [] as PrioridadeRow[] }

      const obrasJson = obrasRes.ok
        ? ((await obrasRes.json()) as { obras?: ObraMapaRow[] })
        : (await obrasRes.json()) as { retryable?: boolean }
      if (!obrasRes.ok && (obrasRes.status === 503 || (obrasJson as { retryable?: boolean }).retryable)) {
        instavel = true
      }
      const obrasLista = obrasRes.ok
        ? ((obrasJson as { obras?: ObraMapaRow[] }).obras ?? [])
        : []
      const obrasPorMunicipio = obrasRes.ok
        ? agregarObrasPorMunicipio(obrasLista)
        : new Map<string, ObrasAgg>()

      const classifJson = classifRes.ok
        ? ((await classifRes.json()) as {
            classifications?: Record<string, { obraMapaId?: string | null }>
          })
        : { classifications: {} }
      const divulgacaoPorMunicipio = agregarDivulgacaoObrasPorMunicipio(
        obrasLista,
        classifJson.classifications ?? {}
      )

      const visitasJson = visitasPeriodoRes.ok
        ? ((await visitasPeriodoRes.json()) as { municipios?: Array<{ municipio: string; visitas: number }> })
        : (await visitasPeriodoRes.json()) as { retryable?: boolean }
      if (
        !visitasPeriodoRes.ok &&
        (visitasPeriodoRes.status === 503 || (visitasJson as { retryable?: boolean }).retryable)
      ) {
        instavel = true
      }
      const visitasPorMunicipio = visitasPeriodoRes.ok
        ? mapVisitasNoPeriodo(
            (visitasJson as { municipios?: Array<{ municipio: string; visitas: number }> }).municipios
          )
        : new Map<string, number>()

      const visitasAnteriorJson = visitasAnteriorRes.ok
        ? ((await visitasAnteriorRes.json()) as {
            municipios?: Array<{ municipio: string; visitas: number }>
          })
        : ((await visitasAnteriorRes.json()) as { retryable?: boolean })
      if (
        !visitasAnteriorRes.ok &&
        (visitasAnteriorRes.status === 503 ||
          (visitasAnteriorJson as { retryable?: boolean }).retryable)
      ) {
        instavel = true
      }
      const visitasAnteriorPorMunicipio = visitasAnteriorRes.ok
        ? mapVisitasNoPeriodo(
            (visitasAnteriorJson as { municipios?: Array<{ municipio: string; visitas: number }> })
              .municipios
          )
        : new Map<string, number>()

      const pesquisaJson = pesquisaRes.ok
        ? ((await pesquisaRes.json()) as PollIptRow[])
        : (await pesquisaRes.json()) as { retryable?: boolean }
      if (!pesquisaRes.ok && (pesquisaRes.status === 503 || (pesquisaJson as { retryable?: boolean }).retryable)) {
        instavel = true
      }

      const candidatoPesquisa = resolveCandidatoIpt()
      const polls: PollIptRow[] = pesquisaRes.ok ? (pesquisaJson as PollIptRow[]) : []
      const { intencaoPorMunicipio, top5PorMunicipio, basePorMunicipio, evolucaoPorMunicipio } =
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
          visitasNoPeriodo: visitasPorMunicipio.get(key) ?? 0,
          obrasCount: obras?.count ?? 0,
          obrasValorTotal: obras?.valorTotal ?? 0,
          obrasDivulgacaoPosts: divulgacaoPorMunicipio.get(key) ?? 0,
          intencaoPesquisa: intencaoPorMunicipio.get(key) ?? null,
          pesquisaPosicaoTop5: posicaoCandidatoNoTop5(top5, candidatoPesquisa),
          pesquisaTop5: top5,
          pesquisaBase: basePorMunicipio.get(key) ?? null,
        }
      })

      const calculados = calcularIptMunicipios(inputs)

      let overrideMap: IptInsightOverrideMap = new Map()
      const insightsJson = (await insightsRes.json()) as {
        overrides?: Record<string, Partial<Record<'visitas' | 'obras' | 'pesquisa', import('@/lib/ipt').IptSinal>>>
        retryable?: boolean
      }
      if (!insightsRes.ok && (insightsRes.status === 503 || insightsJson.retryable)) {
        instavel = true
      } else if (insightsRes.ok) {
        overrideMap = new Map(Object.entries(insightsJson.overrides ?? {}))
      }

      const comOverrides = aplicarOverridesIpt(calculados, overrideMap)
      const comPesquisaEvo = mergePesquisaEvolucaoNosMunicipiosIpt(
        comOverrides,
        evolucaoPorMunicipio
      )
      const comVisitasEvo = mergeVisitasEvolucaoNosMunicipiosIpt(
        comPesquisaEvo,
        visitasAnteriorPorMunicipio
      )

      let comDigital = comVisitasEvo
      let cobertura: IptPresencaDigitalCobertura | null = null

      if (igCfg.token && igCfg.businessAccountId) {
        try {
          const demoRes = await fetch('/api/instagram/demographics', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              token: igCfg.token,
              businessAccountId: igCfg.businessAccountId,
            }),
            cache: 'no-store',
          })
          if (demoRes.ok) {
            const demoJson = (await demoRes.json()) as {
              followersTotal?: number
              topLocations?: Record<string, number>
              engagedTopLocations?: Record<string, number>
              previousByMunicipio?: Record<
                string,
                { followers: number; engaged: number; date: string }
              >
            }
            const built = buildIptPresencaDigitalPorMunicipio({
              topLocations: demoJson.topLocations,
              engagedTopLocations: demoJson.engagedTopLocations,
              followersTotal: demoJson.followersTotal,
              previousByMunicipio: demoJson.previousByMunicipio,
            })
            cobertura = built.cobertura
            comDigital = mergePresencaDigitalNosMunicipiosIpt(comVisitasEvo, built.porMunicipio)
          }
        } catch {
          // Presença digital é complementar — não bloqueia o mapa IPT
        }
      }

      setPresencaDigitalCobertura(cobertura)
      setMunicipios(comDigital)
      setResumo(calcularIptResumo(comDigital))
      setConexaoInstavel(instavel)
      if (silent) setError('')
    } catch (e) {
      if (silent) {
        // Mantém os dados atuais na tela; só sinaliza instabilidade.
        setConexaoInstavel(true)
      } else {
        setError(e instanceof Error ? e.message : 'Erro ao calcular prioridades.')
        setMunicipios([])
        setPresencaDigitalCobertura(null)
        setResumo({
          municipiosMonitorados: 0,
          criticos: 0,
          atencao: 0,
          estaveis: 0,
          fortes: 0,
          semExpectativa: 0,
        })
      }
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  useEffect(() => {
    if (!conexaoInstavel) return
    const id = window.setTimeout(() => void carregar(), 5000)
    return () => window.clearTimeout(id)
  }, [conexaoInstavel, carregar])

  const porNome = useMemo(() => {
    const map = new Map<string, IptMunicipio>()
    for (const m of municipios) map.set(normalizeIptMunicipio(m.municipio), m)
    return map
  }, [municipios])

  return {
    loading,
    error,
    conexaoInstavel,
    municipios,
    resumo,
    porNome,
    presencaDigitalCobertura,
    recarregar: carregar,
  }
}
