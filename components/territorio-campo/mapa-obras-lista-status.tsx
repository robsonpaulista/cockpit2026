'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Download, ExternalLink, Link2, Loader2, RefreshCw } from 'lucide-react'
import {
  listarMunicipiosComObras,
  valorExibidoMapaObra,
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

type SortObraCol = 'municipio' | 'cota'

const TIPO_LABEL: Record<string, string> = {
  asfalto: 'Asfalto',
  paralelepipedo: 'Paralelepípedo',
  'quadras-esportivas': 'Quadras e areninhas',
  'maquinario-agricola': 'Maquinário agrícola',
  'passagens-cisternas': 'Passagens e cisternas',
  outros: 'Outros',
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

interface MapaObrasListaStatusProps {
  /** Obras já filtradas (mesma fonte do mapa: planilha Demandas). */
  obras: ObraMapaRow[]
  /** Recarrega obras da planilha (Sheets). */
  onAtualizar?: () => void | Promise<void>
  atualizando?: boolean
  onStatusSalvo?: () => void
}

/** Lista das obras no mapa — mesma planilha Sheets da guia Demandas. */
export function MapaObrasListaStatus({
  obras,
  onAtualizar,
  atualizando = false,
  onStatusSalvo,
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
      const tipo = (obra.tipo ?? '').trim()
      if (tipo) presentes.add(tipo)
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
        const tipo = (obra.tipo ?? '').trim()
        if (tipo !== filtroTipo) return false
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
          ? `Tipo: ${TIPO_LABEL[filtroTipo] ?? filtroTipo}`
          : null,
        filtroStatus ? `Status: ${filtroStatus}` : null,
        `Ordenação: ${sortCol === 'cota' ? 'valor' : 'município'} (${sortAsc ? 'A→Z' : 'Z→A'})`,
      ].filter((v): v is string => Boolean(v)),
    [busca, filtroMunicipio, filtroStatus, filtroTipo, sortAsc, sortCol],
  )

  const alternarSort = (column: SortObraCol) => {
    const next = toggleTerritorioSort(sortCol, sortAsc, column, ['municipio'] as const)
    setSortCol(next.column)
    setSortAsc(next.asc)
  }

  const vinculados = Object.keys(linksByObra).length

  return (
    <div className="flex flex-col gap-4">
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

      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar município, obra, status, plano…"
          className="min-w-[12rem] flex-1 rounded-lg border border-card bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:max-w-xs"
        />
        <select
          value={filtroMunicipio}
          onChange={(e) => setFiltroMunicipio(e.target.value)}
          title="Filtrar por município"
          className="max-w-[14rem] truncate rounded-lg border border-card bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
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
          className="rounded-lg border border-card bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
        >
          <option value="">Todos os tipos</option>
          {opcoesTipo.map((tipo) => (
            <option key={tipo} value={tipo}>
              {TIPO_LABEL[tipo] ?? tipo}
            </option>
          ))}
        </select>
        <select
          value={filtroStatus}
          onChange={(e) => setFiltroStatus(e.target.value)}
          title="Filtrar por status"
          className="max-w-[14rem] truncate rounded-lg border border-card bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
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
            className={cn(chromeButtonClass, 'h-8 px-2 text-[11px]')}
          >
            Limpar filtros
          </button>
        )}
        <button
          type="button"
          onClick={() => void atualizar()}
          disabled={atualizando || atualizandoLocal || linksLoading}
          title="Recarregar obras da planilha e vínculos do Drive"
          className={cn(chromeButtonClass, 'h-8 px-2 text-[11px] disabled:opacity-50')}
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
          className={cn(chromeButtonClass, 'h-8 px-2 text-[11px] disabled:opacity-50')}
        >
          <Download className="h-3.5 w-3.5" aria-hidden />
          Exportar
        </button>
        <span className="text-xs text-text-secondary">
          {filtradas.length.toLocaleString('pt-BR')} obra
          {filtradas.length === 1 ? '' : 's'}
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-card bg-bg-surface">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-card bg-bg-app/60 text-xs uppercase tracking-wide text-text-secondary">
              <tr>
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
              {filtradas.map((obra) => {
                const link = linksByObra[obra.id]
                return (
                  <tr key={obra.id} className="align-top hover:bg-bg-app/30">
                    <td className="px-3 py-3 font-medium text-text-primary">
                      {obra.municipio}
                    </td>
                    <td className="max-w-md px-3 py-3 text-text-primary">{obra.obra}</td>
                    <td className="px-3 py-3 text-text-secondary">
                      {TIPO_LABEL[obra.tipo ?? ''] ?? obra.tipo ?? '—'}
                    </td>
                    <td className="px-3 py-3 tabular-nums text-text-secondary">
                      {formatCurrency(valorExibidoMapaObra(obra))}
                    </td>
                    <td className="px-3 py-3 text-text-secondary">{obra.status ?? '—'}</td>
                    <td className="px-3 py-3">
                      <div className="flex min-w-[9rem] flex-col gap-1.5">
                        {link && (planoDriveTemArquivo(link) || planoDriveTemNota(link)) ? (
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
                                  className={cn(chromeButtonClass, 'h-7 px-2 text-[10px]')}
                                >
                                  <ExternalLink className="h-3 w-3" aria-hidden />
                                  Abrir
                                </a>
                              ) : null}
                              <button
                                type="button"
                                onClick={() => setObraParaVincular(obra)}
                                className={cn(chromeButtonClass, 'h-7 px-2 text-[10px]')}
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
                              chromeButtonClass,
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
              })}
            </tbody>
            {filtradas.length > 0 ? (
              <tfoot className="border-t-2 border-card bg-bg-app/80 text-sm font-semibold text-text-primary">
                <tr>
                  <td className="px-3 py-3" colSpan={3}>
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
