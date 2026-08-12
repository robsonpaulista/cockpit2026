'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  ChevronDown,
  ChevronRight,
  Download,
  ExternalLink,
  Link2,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import {
  listarMunicipiosComObras,
  valorExibidoMapaObra,
  isObraMaquinarioAgricola,
  type ObraMapaRow,
} from '@/lib/obras-mapa'
import {
  planoDriveTemArquivo,
  planoDriveTemNota,
  type ObraPlanoDriveLink,
} from '@/lib/obras-mapa-plano-drive'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { chromeButtonClass } from '@/lib/button-chrome'
import { cn } from '@/lib/utils'
import {
  compareTerritorioNumber,
  compareTerritorioText,
  TerritorioSortableHeaderButton,
  toggleTerritorioSort,
} from '@/components/territorio-campo/territorio-sortable-header'
import { MapaObrasPlanoDriveModal } from '@/components/territorio-campo/mapa-obras-plano-drive-modal'
import { MapaObrasListaExportModal } from '@/components/territorio-campo/mapa-obras-lista-export-modal'
import { rankStatusMapaObraLista } from '@/lib/mapa-obras-lista-export'

type SortObraCol = 'municipio' | 'cota'

const STATUS_SEM = '__sem_status__'
const TIPO_SEM = '__sem_tipo__'
const TIPO_INFRA = 'infraestrutura'
const TIPO_MAQUINARIO = 'maquinario-agricola'
const TIPO_SAUDE = 'saude'

const TIPO_LABEL: Record<string, string> = {
  asfalto: 'Asfalto',
  paralelepipedo: 'Paralelepípedo',
  'quadras-esportivas': 'Quadras e areninhas',
  [TIPO_MAQUINARIO]: 'Maquinário agrícola',
  'passagens-cisternas': 'Passagens e cisternas',
  [TIPO_INFRA]: 'Infraestrutura',
  [TIPO_SAUDE]: 'Saúde',
  outros: 'Outros',
}

function normalizeTipoSlug(raw: string): string {
  return raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
}

function textoTemConstrucaoOuReforma(raw: string): boolean {
  const n = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return /\bconstruc(ao|oes)\b|\breforma(s)?\b|\brevitalizac(ao|oes)\b/.test(n)
}

function textoTemVicinal(raw: string): boolean {
  const n = raw
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
  return /\bvicinal(is|ais)?\b/.test(n)
}

/** Classifica bloco/tipo na lista: construção/reforma/revitalização/vicinal → Infraestrutura;
 * carreta/máquinas agrícolas → Maquinário agrícola; UBS → Saúde. */
function tipoKeyOf(obra: Pick<ObraMapaRow, 'tipo' | 'obra'>): string {
  const nome = obra.obra ?? ''
  const nomeNorm = nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  if (/\bubs\b|\bunidade basica de saude\b/.test(nomeNorm)) {
    return TIPO_SAUDE
  }
  if (textoTemConstrucaoOuReforma(nome) || textoTemVicinal(nome)) {
    return TIPO_INFRA
  }
  if (isObraMaquinarioAgricola(obra)) {
    return TIPO_MAQUINARIO
  }
  const t = (obra.tipo ?? '').trim()
  if (!t) return TIPO_SEM
  const slug = normalizeTipoSlug(t)
  if (slug === 'ubs' || slug === 'saude' || slug === TIPO_SAUDE) {
    return TIPO_SAUDE
  }
  if (
    slug === 'construcao' ||
    slug === 'reforma' ||
    slug === 'revitalizacao' ||
    slug === 'vicinal' ||
    slug === 'vicinais' ||
    slug === 'estrada-vicinal' ||
    slug === 'estradas-vicinais' ||
    slug === TIPO_INFRA
  ) {
    return TIPO_INFRA
  }
  if (slug === 'carreta' || slug === 'carreta-agricola' || slug === TIPO_MAQUINARIO) {
    return TIPO_MAQUINARIO
  }
  if (textoTemVicinal(t)) return TIPO_INFRA
  return t
}

function tipoLabelOf(key: string): string {
  if (key === TIPO_SEM) return 'Sem tipo'
  return TIPO_LABEL[key] ?? key
}

function statusKeyOf(obra: Pick<ObraMapaRow, 'status'>): string {
  const s = (obra.status ?? '').trim()
  return s || STATUS_SEM
}

function compareTipoKeys(a: string, b: string): number {
  const ordem = Object.keys(TIPO_LABEL)
  const ia = ordem.indexOf(a)
  const ib = ordem.indexOf(b)
  if (ia >= 0 && ib >= 0) return ia - ib
  if (ia >= 0) return -1
  if (ib >= 0) return 1
  if (a === TIPO_SEM) return 1
  if (b === TIPO_SEM) return -1
  return tipoLabelOf(a).localeCompare(tipoLabelOf(b), 'pt-BR')
}

function compareStatusKeys(a: string, b: string): number {
  const ra = rankStatusMapaObraLista(a === STATUS_SEM ? '' : a)
  const rb = rankStatusMapaObraLista(b === STATUS_SEM ? '' : b)
  if (ra !== rb) return ra - rb
  if (a === STATUS_SEM) return 1
  if (b === STATUS_SEM) return -1
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' })
}

function compareObrasPorStatusDepoisSort(
  a: ObraMapaRow,
  b: ObraMapaRow,
  sortCol: SortObraCol,
  sortAsc: boolean,
): number {
  const byStatus = compareStatusKeys(statusKeyOf(a), statusKeyOf(b))
  if (byStatus !== 0) return byStatus
  if (sortCol === 'municipio') {
    const byMun = compareTerritorioText(a.municipio || '', b.municipio || '', sortAsc)
    if (byMun !== 0) return byMun
    return compareTerritorioNumber(
      valorExibidoMapaObra(a) ?? 0,
      valorExibidoMapaObra(b) ?? 0,
      false,
    )
  }
  const byCota = compareTerritorioNumber(
    valorExibidoMapaObra(a) ?? 0,
    valorExibidoMapaObra(b) ?? 0,
    sortAsc,
  )
  if (byCota !== 0) return byCota
  return compareTerritorioText(a.municipio || '', b.municipio || '', true)
}

function sumValorObras(rows: ObraMapaRow[]): number | null {
  let valor = 0
  let comValor = 0
  for (const obra of rows) {
    const v = valorExibidoMapaObra(obra)
    if (v != null && Number.isFinite(v)) {
      valor += v
      comValor += 1
    }
  }
  return comValor > 0 ? valor : null
}

function formatCurrency(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 20,
  }).format(value)
}

function formatDataDemanda(raw?: string | null): string {
  if (!raw?.trim()) return '—'
  const t = raw.trim()
  // dd/mm/aaaa ou dd-mm-aaaa
  const br = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/)
  if (br) {
    const d = br[1]!.padStart(2, '0')
    const m = br[2]!.padStart(2, '0')
    let y = br[3]!
    if (y.length === 2) y = `20${y}`
    return `${d}/${m}/${y}`
  }
  // ISO / Date parseable
  const parsed = new Date(t)
  if (!Number.isNaN(parsed.getTime())) {
    return parsed.toLocaleDateString('pt-BR')
  }
  // Excel serial as string number
  const serial = Number(t)
  if (Number.isFinite(serial) && serial > 20000 && serial < 80000) {
    const excelEpoch = Date.UTC(1899, 11, 30)
    const ms = excelEpoch + Math.round(serial) * 86400000
    return new Date(ms).toLocaleDateString('pt-BR', { timeZone: 'UTC' })
  }
  return t
}

interface MapaObrasListaStatusProps {
  /** Obras já filtradas (mesma fonte do mapa: planilha Demandas). */
  obras: ObraMapaRow[]
  /** Recarrega obras da planilha (Sheets). */
  onAtualizar?: () => void | Promise<void>
  atualizando?: boolean
  onStatusSalvo?: () => void
  /** Chrome Copiloto (filtros/tabela iguais a Cidades). */
  embedded?: boolean
}

/** Lista das obras no mapa — mesma planilha Sheets da guia Demandas. */
export function MapaObrasListaStatus({
  obras,
  onAtualizar,
  atualizando = false,
  onStatusSalvo,
  embedded = false,
}: MapaObrasListaStatusProps) {
  const [busca, setBusca] = useState('')
  const [filtroMunicipio, setFiltroMunicipio] = useState('')
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [sortCol, setSortCol] = useState<SortObraCol>('municipio')
  const [sortAsc, setSortAsc] = useState(true)
  const [linksByObra, setLinksByObra] = useState<Record<string, ObraPlanoDriveLink>>({})
  const [linksLoading, setLinksLoading] = useState(false)
  const [linksError, setLinksError] = useState<string | null>(null)
  const [obraParaVincular, setObraParaVincular] = useState<ObraMapaRow | null>(null)
  const [atualizandoLocal, setAtualizandoLocal] = useState(false)
  const [exportModalOpen, setExportModalOpen] = useState(false)
  /** Blocos por tipo — começam recolhidos. Linhas ordenadas por status. */
  const [tiposExpandidos, setTiposExpandidos] = useState<Set<string>>(() => new Set())

  const carregarLinks = useCallback(async () => {
    setLinksLoading(true)
    setLinksError(null)
    try {
      const res = await fetch('/api/campo/obras-mapa/plano-drive')
      const data = (await res.json().catch(() => ({}))) as {
        links?: ObraPlanoDriveLink[]
        error?: string
        setupRequired?: boolean
      }
      if (!res.ok) {
        setLinksError(
          data.error ||
            (data.setupRequired
              ? 'Execute database/create-obras-mapa-plano-drive.sql no Supabase.'
              : 'Falha ao carregar vínculos Drive'),
        )
        setLinksByObra({})
        return
      }
      const next: Record<string, ObraPlanoDriveLink> = {}
      for (const link of data.links ?? []) {
        next[link.obra_id] = link
      }
      setLinksByObra(next)
    } catch (e) {
      setLinksError(e instanceof Error ? e.message : 'Falha de rede')
      setLinksByObra({})
    } finally {
      setLinksLoading(false)
    }
  }, [])

  const atualizar = useCallback(async () => {
    setAtualizandoLocal(true)
    try {
      await Promise.all([
        Promise.resolve(onAtualizar?.() ?? onStatusSalvo?.()),
        carregarLinks(),
      ])
    } finally {
      setAtualizandoLocal(false)
    }
  }, [carregarLinks, onAtualizar, onStatusSalvo])

  useEffect(() => {
    void carregarLinks()
  }, [carregarLinks])

  const opcoesMunicipio = useMemo(
    () => listarMunicipiosComObras(obras, 'todos'),
    [obras],
  )

  const opcoesTipo = useMemo(() => {
    const presentes = new Set<string>()
    for (const obra of obras) {
      const key = tipoKeyOf(obra)
      if (key !== TIPO_SEM) presentes.add(key)
    }
    const ordemConhecida = Object.keys(TIPO_LABEL)
    const conhecidos = ordemConhecida.filter((id) => presentes.has(id))
    const extras = [...presentes]
      .filter((id) => !TIPO_LABEL[id])
      .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    return [...conhecidos, ...extras]
  }, [obras])

  const opcoesStatus = useMemo(() => {
    const set = new Set<string>()
    for (const obra of obras) {
      const status = (obra.status ?? '').trim()
      if (status) set.add(status)
    }
    return [...set].sort((a, b) => a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }))
  }, [obras])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const base = obras.filter((obra) => {
      if (filtroMunicipio) {
        const municipio = (obra.municipio ?? '').trim()
        if (municipio !== filtroMunicipio) return false
      }
      if (filtroTipo) {
        if (tipoKeyOf(obra) !== filtroTipo) return false
      }
      if (filtroStatus) {
        const status = (obra.status ?? '').trim()
        if (status !== filtroStatus) return false
      }
      if (!q) return true
      const link = linksByObra[obra.id]
      const blob = [
        obra.municipio,
        obra.obra,
        obra.orgao,
        obra.status,
        obra.tipo,
        obra.data_demanda,
        link?.drive_file_name,
        link?.nota_texto,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })

    return [...base].sort((a, b) => {
      if (sortCol === 'municipio') {
        const byMun = compareTerritorioText(a.municipio || '', b.municipio || '', sortAsc)
        if (byMun !== 0) return byMun
        return compareTerritorioNumber(
          valorExibidoMapaObra(a) ?? 0,
          valorExibidoMapaObra(b) ?? 0,
          false,
        )
      }
      const byCota = compareTerritorioNumber(
        valorExibidoMapaObra(a) ?? 0,
        valorExibidoMapaObra(b) ?? 0,
        sortAsc,
      )
      if (byCota !== 0) return byCota
      return compareTerritorioText(a.municipio || '', b.municipio || '', true)
    })
  }, [busca, filtroMunicipio, filtroStatus, filtroTipo, linksByObra, obras, sortAsc, sortCol])

  const blocosPorTipo = useMemo(() => {
    const byTipo = new Map<string, ObraMapaRow[]>()
    for (const obra of filtradas) {
      const key = tipoKeyOf(obra)
      const list = byTipo.get(key)
      if (list) list.push(obra)
      else byTipo.set(key, [obra])
    }

    const tipoKeys = [...byTipo.keys()].sort(compareTipoKeys)

    return tipoKeys.map((tipoKey) => {
      const obrasDoTipo = [...(byTipo.get(tipoKey) ?? [])].sort((a, b) =>
        compareObrasPorStatusDepoisSort(a, b, sortCol, sortAsc),
      )
      return {
        key: tipoKey,
        label: tipoLabelOf(tipoKey),
        obras: obrasDoTipo,
        valor: sumValorObras(obrasDoTipo),
      }
    })
  }, [filtradas, sortAsc, sortCol])

  useEffect(() => {
    if (!filtroTipo && !filtroStatus) return
    if (filtroTipo) {
      setTiposExpandidos(new Set([filtroTipo]))
      return
    }
    const tipoKeys = blocosPorTipo.map((b) => b.key)
    if (tipoKeys.length > 0) setTiposExpandidos(new Set(tipoKeys))
  }, [blocosPorTipo, filtroStatus, filtroTipo])

  const totais = useMemo(() => {
    let valor = 0
    let comValor = 0
    let comPlano = 0
    const municipios = new Set<string>()
    for (const obra of filtradas) {
      const mun = (obra.municipio || '').trim()
      if (mun) municipios.add(mun)
      const v = valorExibidoMapaObra(obra)
      if (v != null && Number.isFinite(v)) {
        valor += v
        comValor += 1
      }
      const link = linksByObra[obra.id]
      if (link && (planoDriveTemArquivo(link) || planoDriveTemNota(link))) {
        comPlano += 1
      }
    }
    return {
      obras: filtradas.length,
      municipios: municipios.size,
      valor,
      comValor,
      comPlano,
    }
  }, [filtradas, linksByObra])

  const filtrosExportResumo = useMemo(
    () =>
      [
        busca.trim() ? `Busca: ${busca.trim()}` : null,
        filtroMunicipio ? `Município: ${filtroMunicipio}` : null,
        filtroTipo
          ? `Tipo: ${tipoLabelOf(filtroTipo)}`
          : null,
        filtroStatus ? `Status: ${filtroStatus}` : null,
        `Ordenação: status, depois ${sortCol === 'cota' ? 'valor' : 'município'} (${sortAsc ? 'A→Z' : 'Z→A'})`,
      ].filter((v): v is string => Boolean(v)),
    [busca, filtroMunicipio, filtroStatus, filtroTipo, sortAsc, sortCol],
  )

  const alternarSort = (column: SortObraCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, ['municipio'] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  const toggleTipo = useCallback((key: string) => {
    setTiposExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }, [])

  const expandirTodosTipos = useCallback(() => {
    setTiposExpandidos(new Set(blocosPorTipo.map((b) => b.key)))
  }, [blocosPorTipo])

  const recolherTodosTipos = useCallback(() => {
    setTiposExpandidos(new Set())
  }, [])

  const vinculados = Object.keys(linksByObra).length
  const todosExpandidos =
    blocosPorTipo.length > 0 && blocosPorTipo.every((b) => tiposExpandidos.has(b.key))

  const actionBtnClass = embedded ? 'wr-copiloto-redes__ghost-btn' : chromeButtonClass
  const exportBtnClass = embedded
    ? 'wr-copiloto-export-btn wr-copiloto-redes__ghost-btn'
    : chromeButtonClass
  const selectClass = embedded
    ? 'wr-copiloto-filter-select max-w-[14rem] truncate'
    : 'max-w-[14rem] truncate rounded-lg border border-card bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft'
  const searchClass = embedded
    ? 'wr-copiloto-filter-select min-w-[12rem] flex-1 sm:max-w-xs'
    : 'min-w-[12rem] flex-1 rounded-lg border border-card bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:max-w-xs'

  return (
    <div className="flex flex-col gap-4">
      {!embedded ? (
        <div className="rounded-xl border border-card bg-bg-surface p-4">
          <h2 className="text-base font-semibold text-text-primary">
            Obras da planilha de Demandas
          </h2>
          <p className={cn('mt-1 max-w-3xl', typographyBodyMutedClass)}>
            Mesma fonte e filtros da guia Demandas. Vincule cada obra ao plano de
            trabalho na pasta do Drive (compartilhada com a service account).
          </p>
          <p className="mt-2 text-xs text-text-secondary">
            {linksLoading
              ? 'Carregando vínculos Drive…'
              : `${vinculados.toLocaleString('pt-BR')} plano${vinculados === 1 ? '' : 's'} vinculado${vinculados === 1 ? '' : 's'}`}
          </p>
          {linksError ? (
            <p className="mt-2 text-xs text-status-danger">{linksError}</p>
          ) : null}
        </div>
      ) : null}

      <div className={cn(embedded ? 'wr-copiloto-filtros' : 'flex flex-wrap items-center gap-2')}>
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar município, obra, status, plano…"
          className={searchClass}
        />
        <select
          value={filtroMunicipio}
          onChange={(e) => setFiltroMunicipio(e.target.value)}
          title="Filtrar por município"
          className={selectClass}
        >
          <option value="">Todos os municípios</option>
          {opcoesMunicipio.map((municipio) => (
            <option key={municipio} value={municipio}>
              {municipio}
            </option>
          ))}
        </select>
        <select
          value={filtroTipo}
          onChange={(e) => setFiltroTipo(e.target.value)}
          title="Filtrar por tipo"
          className={selectClass}
        >
          <option value="">Todos os tipos</option>
          {opcoesTipo.map((tipo) => (
            <option key={tipo} value={tipo}>
              {tipoLabelOf(tipo)}
            </option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          title="Filtrar por status"
          className={selectClass}
        >
          <option value="">Todos os status</option>
          {opcoesStatus.map((status) => (
            <option key={status} value={status}>
              {status}
            </option>
          ))}
        </select>
        {(filtroMunicipio || filtroTipo || filtroStatus) && (
          <button
            type="button"
            onClick={() => {
              setFiltroMunicipio('')
              setFiltroTipo('')
              setFiltroStatus('')
            }}
            className={cn(actionBtnClass, !embedded && 'h-8 px-2 text-[11px]')}
          >
            Limpar filtros
          </button>
        )}
        <button
          type="button"
          onClick={() => void atualizar()}
          disabled={atualizando || atualizandoLocal || linksLoading}
          title="Recarregar obras da planilha e vínculos do Drive"
          className={cn(actionBtnClass, !embedded && 'h-8 px-2 text-[11px] disabled:opacity-50')}
        >
          {atualizando || atualizandoLocal ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" aria-hidden />
          )}
          Atualizar
        </button>
        <button
          type="button"
          onClick={() => setExportModalOpen(true)}
          disabled={filtradas.length === 0}
          title="Exportar seleção filtrada (CSV, Excel ou PDF)"
          className={cn(exportBtnClass, !embedded && 'h-8 px-2 text-[11px] disabled:opacity-50')}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Exportar
        </button>
        {blocosPorTipo.length > 0 ? (
          <button
            type="button"
            onClick={todosExpandidos ? recolherTodosTipos : expandirTodosTipos}
            title={todosExpandidos ? 'Recolher todos os tipos' : 'Expandir todos os tipos'}
            className={cn(actionBtnClass, !embedded && 'h-8 px-2 text-[11px]')}
          >
            {todosExpandidos ? 'Recolher tipos' : 'Expandir tipos'}
          </button>
        ) : null}
        <span className="text-xs text-text-secondary">
          {filtradas.length.toLocaleString('pt-BR')} obra
          {filtradas.length === 1 ? '' : 's'}
          {blocosPorTipo.length > 0
            ? ` · ${blocosPorTipo.length} tipo${blocosPorTipo.length === 1 ? '' : 's'}`
            : ''}
        </span>
      </div>

      <div
        className={cn(
          embedded
            ? 'wr-copiloto-table-wrap'
            : 'overflow-hidden rounded-xl border border-card bg-bg-surface',
        )}
      >
        <div className="overflow-x-auto">
          <table
            className={cn(
              'min-w-full text-left text-sm',
              embedded && 'wr-copiloto-table',
            )}
          >
            <thead className="border-b border-card bg-bg-app/60 text-xs uppercase tracking-wide text-text-secondary">
              <tr>
                <th className="px-3 py-2.5 whitespace-nowrap">Data demanda</th>
                <th className="px-3 py-2.5">
                  <TerritorioSortableHeaderButton
                    label="Município"
                    active={sortCol === 'municipio'}
                    asc={sortAsc}
                    onClick={() => alternarSort('municipio')}
                    compact
                  />
                </th>
                <th className="px-3 py-2.5">Obra</th>
                <th className="px-3 py-2.5">Tipo</th>
                <th className="px-3 py-2.5">
                  <TerritorioSortableHeaderButton
                    label="Valor"
                    active={sortCol === 'cota'}
                    asc={sortAsc}
                    onClick={() => alternarSort('cota')}
                    align="left"
                    compact
                  />
                </th>
                <th className="px-3 py-2.5">Status</th>
                <th className="px-3 py-2.5">Plano Drive</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card">
              {blocosPorTipo.map((tipoBloco) => {
                const tipoAberto = tiposExpandidos.has(tipoBloco.key)
                return (
                  <GroupBlockRows key={tipoBloco.key}>
                    <tr className="bg-bg-app/70">
                      <td colSpan={7} className="p-0">
                        <button
                          type="button"
                          onClick={() => toggleTipo(tipoBloco.key)}
                          aria-expanded={tipoAberto}
                          className="flex w-full items-center gap-2 px-3 py-2.5 text-left transition-colors hover:bg-bg-app/90"
                        >
                          {tipoAberto ? (
                            <ChevronDown
                              className="h-4 w-4 shrink-0 text-text-secondary"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          ) : (
                            <ChevronRight
                              className="h-4 w-4 shrink-0 text-text-secondary"
                              strokeWidth={1.75}
                              aria-hidden
                            />
                          )}
                          <span className="min-w-0 flex-1 text-sm font-semibold text-text-primary">
                            {tipoBloco.label}
                          </span>
                          <span className="shrink-0 text-xs tabular-nums text-text-secondary">
                            {tipoBloco.obras.length.toLocaleString('pt-BR')} obra
                            {tipoBloco.obras.length === 1 ? '' : 's'}
                            {tipoBloco.valor != null
                              ? ` · ${formatCurrency(tipoBloco.valor)}`
                              : ''}
                          </span>
                        </button>
                      </td>
                    </tr>
                    {tipoAberto
                      ? tipoBloco.obras.map((obra) => {
                          const link = linksByObra[obra.id]
                          return (
                            <tr key={obra.id} className="align-top hover:bg-bg-app/30">
                              <td className="whitespace-nowrap px-3 py-3 tabular-nums text-text-secondary">
                                {formatDataDemanda(obra.data_demanda)}
                              </td>
                              <td className="px-3 py-3 font-medium text-text-primary">
                                {obra.municipio}
                              </td>
                              <td className="max-w-md px-3 py-3 text-text-primary">
                                {obra.obra}
                              </td>
                              <td className="px-3 py-3 text-text-secondary">
                                {tipoLabelOf(tipoKeyOf(obra))}
                              </td>
                              <td className="px-3 py-3 tabular-nums text-text-secondary">
                                {formatCurrency(valorExibidoMapaObra(obra))}
                              </td>
                              <td className="px-3 py-3 text-text-secondary">
                                {obra.status ?? '—'}
                              </td>
                              <td className="px-3 py-3">
                                <div className="flex min-w-[9rem] flex-col gap-1.5">
                                  {link &&
                                  (planoDriveTemArquivo(link) || planoDriveTemNota(link)) ? (
                                    <>
                                      <span
                                        className="line-clamp-2 text-xs text-text-primary"
                                        title={
                                          planoDriveTemArquivo(link)
                                            ? link.drive_file_name ?? undefined
                                            : link.nota_texto ?? undefined
                                        }
                                      >
                                        {planoDriveTemArquivo(link)
                                          ? link.drive_file_name || 'Arquivo vinculado'
                                          : link.nota_texto}
                                      </span>
                                      <div className="flex flex-wrap gap-1.5">
                                        {link.drive_web_view_link ? (
                                          <a
                                            href={link.drive_web_view_link}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className={cn(
                                              actionBtnClass,
                                              !embedded && 'h-7 px-2 text-[10px]',
                                            )}
                                          >
                                            <ExternalLink className="h-3 w-3" aria-hidden />
                                            Abrir
                                          </a>
                                        ) : null}
                                        <button
                                          type="button"
                                          onClick={() => setObraParaVincular(obra)}
                                          className={cn(
                                            actionBtnClass,
                                            !embedded && 'h-7 px-2 text-[10px]',
                                          )}
                                        >
                                          <Link2 className="h-3 w-3" aria-hidden />
                                          {planoDriveTemArquivo(link) ? 'Trocar' : 'Editar'}
                                        </button>
                                      </div>
                                    </>
                                  ) : (
                                    <button
                                      type="button"
                                      onClick={() => setObraParaVincular(obra)}
                                      disabled={linksLoading}
                                      className={cn(
                                        actionBtnClass,
                                        !embedded &&
                                          'h-8 px-2 text-[11px] disabled:opacity-50',
                                      )}
                                    >
                                      {linksLoading ? (
                                        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                                      ) : (
                                        <Link2 className="h-3 w-3" aria-hidden />
                                      )}
                                      Vincular
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          )
                        })
                      : null}
                  </GroupBlockRows>
                )
              })}
            </tbody>
            {filtradas.length > 0 ? (
              <tfoot className="border-t-2 border-card bg-bg-app/80 text-sm font-semibold text-text-primary">
                <tr>
                  <td className="px-3 py-3" colSpan={4}>
                    Total
                    <span className="ml-2 font-normal text-text-secondary">
                      {totais.obras.toLocaleString('pt-BR')} obra
                      {totais.obras === 1 ? '' : 's'} ·{' '}
                      {totais.municipios.toLocaleString('pt-BR')} município
                      {totais.municipios === 1 ? '' : 's'}
                    </span>
                  </td>
                  <td className="px-3 py-3 tabular-nums">
                    {formatCurrency(totais.comValor > 0 ? totais.valor : null)}
                  </td>
                  <td className="px-3 py-3" />
                  <td className="px-3 py-3 text-xs font-normal text-text-secondary">
                    {totais.comPlano.toLocaleString('pt-BR')} plano
                    {totais.comPlano === 1 ? '' : 's'}
                  </td>
                </tr>
              </tfoot>
            ) : null}
          </table>
        </div>
        {filtradas.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-text-muted">
            Nenhuma obra encontrada.
          </p>
        ) : null}
      </div>

      <MapaObrasPlanoDriveModal
        isOpen={Boolean(obraParaVincular)}
        onClose={() => setObraParaVincular(null)}
        obra={obraParaVincular}
        linkAtual={obraParaVincular ? linksByObra[obraParaVincular.id] ?? null : null}
        onLinked={(link) => {
          if (!obraParaVincular) return
          const obraId = obraParaVincular.id
          setLinksByObra((prev) => {
            const next = { ...prev }
            if (link) next[obraId] = link
            else delete next[obraId]
            return next
          })
        }}
      />

      <MapaObrasListaExportModal
        isOpen={exportModalOpen}
        onClose={() => setExportModalOpen(false)}
        obras={filtradas}
        linksByObra={linksByObra}
        filtrosResumo={filtrosExportResumo}
      />
    </div>
  )
}

/** Agrupa vários `<tr>` sem wrapper inválido dentro de `<tbody>`. */
function GroupBlockRows({ children }: { children: ReactNode }) {
  return <>{children}</>
}
