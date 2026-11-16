'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react'
import {
  MUNICIPIOS_PI_ORDENADOS,
  useTerritorioMunicipio,
} from '@/components/territorio-campo/territorio-municipio-context'
import {
  TseBusca,
  TseCarregando,
  TseDado,
  TseDados,
  TseErro,
  TsePill,
  TseSegmentado,
  TseVazio,
  tseTabela,
} from '@/components/tse/tse-ui'
import { fetchJadyelFederal2026VotosPorMunicipioPI } from '@/lib/jadyel-federal-2022-pi-votos'
import { normalizeMunicipioNome } from '@/lib/piaui-regiao'
import {
  VISITAS_COBERTURA_2026_DESDE,
  buildVisitasCobertura2026Model,
  filtrarVisitasCobertura2026Rows,
  type VisitasCobertura2026Filtro,
  type VisitasCobertura2026Row,
  type VisitasCobertura2026VisitaInfo,
} from '@/lib/territorio-campo/visitas-cobertura-2026'
import { cn } from '@/lib/utils'

const fmt = (n: number): string => n.toLocaleString('pt-BR')
const fmtPct = (n: number): string =>
  `${n.toLocaleString('pt-BR', { maximumFractionDigits: 1, minimumFractionDigits: 0 })}%`

function formatDateLabel(iso: string | null): string {
  if (!iso) return '—'
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso)
  if (m) return `${m[3]}/${m[2]}/${m[1]}`
  try {
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return iso
    return d.toLocaleDateString('pt-BR')
  } catch {
    return iso
  }
}

type VisitasResumoTdResponse = {
  municipios?: Array<{
    municipio?: string
    visitas?: number
    ultimaVisita?: string | null
  }>
  error?: string
}

type SortCol = 'municipio' | 'votos2026' | 'status' | 'visitas' | 'ultimaVisita'
type SortDir = 'asc' | 'desc'

const FILTROS: readonly { id: VisitasCobertura2026Filtro; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'sem_visita', label: 'Sem visita' },
  { id: 'visitadas', label: 'Visitadas' },
]

const COLUNAS: readonly { id: SortCol; label: string; align?: 'right' }[] = [
  { id: 'municipio', label: 'Município' },
  { id: 'votos2026', label: 'Votos 2026', align: 'right' },
  { id: 'status', label: 'Status' },
  { id: 'visitas', label: 'Visitas', align: 'right' },
  { id: 'ultimaVisita', label: 'Última visita' },
]

function compareTextPt(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base', numeric: true })
}

function ordenarRows(
  lista: VisitasCobertura2026Row[],
  col: SortCol,
  dir: SortDir,
): VisitasCobertura2026Row[] {
  const mult = dir === 'asc' ? 1 : -1
  return [...lista].sort((a, b) => {
    if (col === 'votos2026' || col === 'visitas') {
      const va = col === 'votos2026' ? a.votos2026 : a.visitas
      const vb = col === 'votos2026' ? b.votos2026 : b.visitas
      if (va !== vb) return (va - vb) * mult
      return compareTextPt(a.municipio, b.municipio)
    }

    if (col === 'ultimaVisita') {
      const va = a.ultimaVisita
      const vb = b.ultimaVisita
      if (!va && !vb) return compareTextPt(a.municipio, b.municipio)
      if (!va) return 1
      if (!vb) return -1
      if (va !== vb) return va.localeCompare(vb) * mult
      return compareTextPt(a.municipio, b.municipio)
    }

    if (col === 'status') {
      const va = a.visitada ? 1 : 0
      const vb = b.visitada ? 1 : 0
      if (va !== vb) return (va - vb) * mult
      return compareTextPt(a.municipio, b.municipio)
    }

    return compareTextPt(a.municipio, b.municipio) * mult
  })
}

export function VisitasCobertura2026Panel() {
  const { municipio, noMunicipio } = useTerritorioMunicipio()
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)
  const [votosMap, setVotosMap] = useState<Map<string, number>>(new Map())
  const [totalVotosApi, setTotalVotosApi] = useState<number | null>(null)
  const [visitas, setVisitas] = useState<VisitasCobertura2026VisitaInfo[]>([])
  const [filtro, setFiltro] = useState<VisitasCobertura2026Filtro>('todas')
  const [busca, setBusca] = useState<string>('')
  const [sortCol, setSortCol] = useState<SortCol>('votos2026')
  const [sortDir, setSortDir] = useState<SortDir>('desc')

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const visitasUrl = `/api/campo/visitas-resumo-td?since=${encodeURIComponent(VISITAS_COBERTURA_2026_DESDE)}`
      const [votosResult, visitasRes] = await Promise.all([
        fetchJadyelFederal2026VotosPorMunicipioPI(),
        fetch(visitasUrl, { cache: 'no-store' }),
      ])

      if (!votosResult) {
        throw new Error('Não foi possível carregar os votos do Jadyel em 2026.')
      }

      const visitasJson = (await visitasRes.json().catch(() => null)) as VisitasResumoTdResponse | null
      if (!visitasRes.ok) {
        throw new Error(visitasJson?.error || `Erro ao carregar visitas (${visitasRes.status})`)
      }

      const listaVisitas: VisitasCobertura2026VisitaInfo[] = Array.isArray(visitasJson?.municipios)
        ? visitasJson.municipios.map((m) => ({
            municipio: String(m.municipio ?? ''),
            visitas: Number(m.visitas) || 0,
            ultimaVisita: m.ultimaVisita ?? null,
          }))
        : []

      setVotosMap(votosResult.mapaNormalizado)
      setTotalVotosApi(votosResult.totalVotos)
      setVisitas(listaVisitas)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar cobertura 2026')
      setVotosMap(new Map())
      setTotalVotosApi(null)
      setVisitas([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const model = useMemo(
    () =>
      buildVisitasCobertura2026Model({
        municipios: MUNICIPIOS_PI_ORDENADOS,
        votosPorMunicipio: votosMap,
        visitas,
        totalVotosApi,
      }),
    [votosMap, visitas, totalVotosApi],
  )

  const municipioKey = useMemo(
    () => (municipio ? normalizeMunicipioNome(municipio) : null),
    [municipio],
  )

  const toggleSort = useCallback(
    (col: SortCol) => {
      if (sortCol === col) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
        return
      }
      setSortCol(col)
      setSortDir(col === 'municipio' || col === 'status' ? 'asc' : 'desc')
    },
    [sortCol],
  )

  const rowsFiltradas = useMemo(() => {
    const base = filtrarVisitasCobertura2026Rows(model.rows, {
      filtro: municipioKey ? 'todas' : filtro,
      busca: municipioKey ? undefined : busca,
      municipioKey,
    })
    // Com município selecionado, ainda aplica noMunicipio por segurança de chave.
    const filtradas = municipio ? base.filter((r) => noMunicipio(r.municipio)) : base
    return ordenarRows(filtradas, sortCol, sortDir)
  }, [model.rows, filtro, busca, municipioKey, municipio, noMunicipio, sortCol, sortDir])

  if (loading) {
    return <TseCarregando texto="Cruzando votos 2026 e visitas de campo…" className="min-h-[30vh]" />
  }

  if (error) {
    return <TseErro>{error}</TseErro>
  }

  return (
    <div className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <TseDados className="mt-0">
            <TseDado rotulo="Votos Jadyel 2026" valor={fmt(model.totalVotos2026)} />
          </TseDados>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <TseDados className="mt-0">
            <TseDado rotulo="% votos cobertos" valor={fmtPct(model.pctVotosCobertos)} />
          </TseDados>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <TseDados className="mt-0">
            <TseDado
              rotulo="Municípios visitados"
              valor={`${fmt(model.municipiosVisitados)} / ${fmt(model.municipiosComVotos)}`}
              sufixo={fmtPct(model.pctMunicipiosVisitados)}
            />
          </TseDados>
        </div>
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <TseDados className="mt-0">
            <TseDado rotulo="Sem visita (com votos)" valor={fmt(model.municipiosSemVisita)} />
          </TseDados>
        </div>
      </div>

      <p className="text-[13px] text-[var(--tse-muted)]">
        Cobertura = município com check-in de campo a partir de{' '}
        {formatDateLabel(VISITAS_COBERTURA_2026_DESDE)}. Peso = votos nominais do Jadyel (Dep.
        Federal 2026). Prioridade: maiores votos ainda sem visita.
      </p>

      {!municipio ? (
        <div className="flex flex-wrap items-center gap-3">
          <TseSegmentado opcoes={FILTROS} valor={filtro} onChange={setFiltro} />
          <TseBusca
            value={busca}
            onChange={setBusca}
            placeholder="Buscar município…"
            className="w-full min-w-[14rem] sm:w-64"
          />
        </div>
      ) : null}

      {rowsFiltradas.length === 0 ? (
        <TseVazio>
          {municipio
            ? 'Nenhum dado de cobertura para este município.'
            : 'Nenhum município neste filtro.'}
        </TseVazio>
      ) : (
        <div className={tseTabela.container} data-tse-tabela="">
          <table className={tseTabela.table}>
            <thead className={tseTabela.thead}>
              <tr>
                {COLUNAS.map((col) => {
                  const active = sortCol === col.id
                  const SortIcon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown
                  return (
                    <th
                      key={col.id}
                      className={cn(tseTabela.th, col.align === 'right' && 'text-right')}
                    >
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className={cn(
                          'inline-flex max-w-full items-center gap-1 font-bold uppercase tracking-wide transition-colors',
                          col.align === 'right' && 'ml-auto flex-row-reverse',
                          active
                            ? 'text-[var(--tse-text)]'
                            : 'text-[var(--tse-muted)] hover:text-[var(--tse-text)]',
                        )}
                        title={
                          active
                            ? sortDir === 'asc'
                              ? 'Crescente — clique para decrescente'
                              : 'Decrescente — clique para crescente'
                            : 'Ordenar'
                        }
                        aria-label={`Ordenar por ${col.label}`}
                      >
                        <span className="truncate">{col.label}</span>
                        <SortIcon
                          className={cn('h-3 w-3 shrink-0', active ? 'opacity-100' : 'opacity-45')}
                          aria-hidden
                        />
                      </button>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {rowsFiltradas.map((row) => (
                <tr key={row.municipioKey} className={tseTabela.tr}>
                  <td className={cn(tseTabela.td, 'font-semibold')}>{row.municipio}</td>
                  <td className={cn(tseTabela.td, 'text-right tabular-nums')}>
                    {row.votos2026 > 0 ? fmt(row.votos2026) : '—'}
                  </td>
                  <td className={tseTabela.td}>
                    <TsePill tom={row.visitada ? 'verde' : 'amarelo'}>
                      {row.visitada ? 'Visitada' : 'Sem visita'}
                    </TsePill>
                  </td>
                  <td className={cn(tseTabela.td, 'text-right tabular-nums')}>
                    {row.visitas > 0 ? fmt(row.visitas) : '—'}
                  </td>
                  <td className={cn(tseTabela.td, 'tabular-nums text-[var(--tse-muted)]')}>
                    {formatDateLabel(row.ultimaVisita)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
