'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import dynamic from 'next/dynamic'
import {
  Maximize2,
  Minimize2,
  MapPin,
  Users,
  Eye,
  Target,
  Navigation,
  Filter,
  TrendingUp,
  Crosshair,
  FileSpreadsheet,
  FileText,
  ListOrdered,
  Search,
} from 'lucide-react'
import * as XLSX from 'xlsx'
import jsPDF from 'jspdf'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { getRegiaoByLat } from '@/lib/piaui-regiao'
import { getAllEleitores } from '@/lib/eleitores'
import { cn } from '@/lib/utils'
import { useTheme } from '@/contexts/theme-context'
import type { MapStats } from './mapa-wrapper-leaflet'

// Dynamic import (client-only)
const MapWrapperLeaflet = dynamic(
  () => import('./mapa-wrapper-leaflet').then(mod => mod.MapWrapperLeaflet),
  { ssr: false }
)

interface TerritorioInfo {
  cidade: string
  motivo: string
  expectativaVotos?: number
  visitas?: number
}

export interface PrioridadeCampoMapaRow {
  cidade: string
  expectativaVotos: number
  visitas: number
  agendas: number
  motivo: string
  ultimaVisita: string | null
}

interface MapaPresencaProps {
  cidadesComPresenca: string[]
  cidadesVisitadas?: string[]
  expectativaPorCidadeLista?: Array<{ cidade: string; expectativaVotos: number }>
  prioridadeCampoLista?: PrioridadeCampoMapaRow[]
  totalCidades: number
  onFullscreen?: () => void
  fullscreen?: boolean
  showStatsOverlay?: boolean
  territoriosQuentes?: TerritorioInfo[]
  territoriosMornos?: TerritorioInfo[]
  territoriosFrios?: TerritorioInfo[]
}

const FILTROS = [
  { id: 'todas', label: 'Todas', icon: Eye, description: 'Todas as cidades' },
  { id: 'com-lideranca', label: 'Com liderança', icon: MapPin, description: 'Cidades com liderança ativa' },
  { id: 'sem-lideranca', label: 'Sem liderança', icon: Navigation, description: 'Cidades sem cobertura' },
  { id: 'visitadas', label: 'Visitadas', icon: Crosshair, description: 'Cidades já visitadas' },
  { id: 'oportunidades', label: 'Oportunidades', icon: Target, description: 'Alto potencial sem liderança' },
]

const REGIOES = [
  { id: 'todas', label: 'Todas as Regiões' },
  { id: 'Norte', label: 'Norte' },
  { id: 'Centro-Norte', label: 'Centro-Norte' },
  { id: 'Centro-Sul', label: 'Centro-Sul' },
  { id: 'Sul', label: 'Sul' },
]
const OPPORTUNITY_THRESHOLD = 15000

function normalizeName(name: string): string {
  return name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim()
}

function formatUltimaVisitaCampo(iso: string | null): string | null {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  return d.toLocaleDateString('pt-BR')
}

export function MapaPresenca({
  cidadesComPresenca,
  cidadesVisitadas = [],
  expectativaPorCidadeLista = [],
  totalCidades,
  onFullscreen,
  fullscreen = false,
  showStatsOverlay = true,
  territoriosQuentes = [],
  territoriosMornos = [],
  territoriosFrios = [],
  prioridadeCampoLista = [],
}: MapaPresencaProps) {
  const { appearance } = useTheme()
  const isDarkAppearance = appearance === 'dark'
  const [clientReady, setClientReady] = useState<boolean>(false)
  const [isNativeFullscreen, setIsNativeFullscreen] = useState<boolean>(false)
  const [filtroAtivo, setFiltroAtivo] = useState<string>('todas')
  const [filtroRegiao, setFiltroRegiao] = useState<string>('todas')
  const [mapStats, setMapStats] = useState<MapStats | null>(null)
  const [prioridadeBuscaMunicipio, setPrioridadeBuscaMunicipio] = useState<string>('')

  useEffect(() => {
    setClientReady(true)
  }, [])

  // Fullscreen listener
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsNativeFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  useEffect(() => {
    if (!isNativeFullscreen) setPrioridadeBuscaMunicipio('')
  }, [isNativeFullscreen])

  const handleExitFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen()
    }
  }, [])

  // Voter data map
  const eleitoresPorCidade = useMemo(() => {
    const mapa: Record<string, number> = {}
    const eleitores = getAllEleitores()
    eleitores.forEach(e => {
      mapa[e.municipio] = e.eleitorado
    })
    return mapa
  }, [])

  // Filtrar dados por região
  const dadosRegiao = useMemo(() => {
    if (filtroRegiao === 'todas') {
      return {
        municipios: municipiosPiaui,
        presenca: cidadesComPresenca,
        visitadas: cidadesVisitadas,
        quentes: territoriosQuentes,
        mornos: territoriosMornos,
        frios: territoriosFrios,
      }
    }

    const munisFiltrados = municipiosPiaui.filter((m) => getRegiaoByLat(m.lat) === filtroRegiao)
    const nomesSet = new Set(munisFiltrados.map(m => normalizeName(m.nome)))
    const match = (nome: string) => nomesSet.has(normalizeName(nome))

    return {
      municipios: munisFiltrados,
      presenca: cidadesComPresenca.filter(c => match(c)),
      visitadas: cidadesVisitadas.filter(c => match(c)),
      quentes: territoriosQuentes.filter(t => match(t.cidade)),
      mornos: territoriosMornos.filter(t => match(t.cidade)),
      frios: territoriosFrios.filter(t => match(t.cidade)),
    }
  }, [filtroRegiao, cidadesComPresenca, cidadesVisitadas, territoriosQuentes, territoriosMornos, territoriosFrios])

  const handleStatsCalculated = useCallback((stats: MapStats) => {
    setMapStats(stats)
  }, [])

  const prioridadeCampoFiltrada = useMemo(() => {
    if (prioridadeCampoLista.length === 0) return []
    if (filtroRegiao === 'todas') return prioridadeCampoLista
    const munisFiltrados = municipiosPiaui.filter((m) => getRegiaoByLat(m.lat) === filtroRegiao)
    const nomesSet = new Set(munisFiltrados.map((m) => normalizeName(m.nome)))
    return prioridadeCampoLista.filter((row) => nomesSet.has(normalizeName(row.cidade)))
  }, [prioridadeCampoLista, filtroRegiao])

  const prioridadeCampoExibicao = useMemo(() => {
    const comRank = prioridadeCampoFiltrada.map((row, i) => ({
      row,
      rankGlobal: i + 1,
    }))
    const q = normalizeName(prioridadeBuscaMunicipio.trim())
    if (!q) return comRank
    return comRank.filter(({ row }) => normalizeName(row.cidade).includes(q))
  }, [prioridadeCampoFiltrada, prioridadeBuscaMunicipio])

  const resumoGlobalRegiao = useMemo(() => {
    const municipiosSet = new Set(dadosRegiao.municipios.map((m) => normalizeName(m.nome)))
    const cidadesComLiderancaSet = new Set(dadosRegiao.presenca.map((c) => normalizeName(c)))
    const cidadesVisitadasSet = new Set(dadosRegiao.visitadas.map((c) => normalizeName(c)))

    const eleitoresNormalizado = new Map<string, number>()
    Object.entries(eleitoresPorCidade).forEach(([cidade, eleitorado]) => {
      eleitoresNormalizado.set(normalizeName(cidade), eleitorado)
    })

    let totalEleitores = 0
    dadosRegiao.municipios.forEach((municipio) => {
      totalEleitores += eleitoresNormalizado.get(normalizeName(municipio.nome)) || 0
    })

    const expectativaPorCidade = new Map<string, number>()
    expectativaPorCidadeLista.forEach((territorio) => {
      const cidadeKey = normalizeName(territorio.cidade)
      if (!municipiosSet.has(cidadeKey)) return
      const expectativa = Number(territorio.expectativaVotos) || 0
      if (expectativa <= 0) return
      const atual = expectativaPorCidade.get(cidadeKey) || 0
      expectativaPorCidade.set(cidadeKey, Math.max(atual, expectativa))
    })

    const totalMunicipios = dadosRegiao.municipios.length
    const comLiderancas = cidadesComLiderancaSet.size
    const semLiderancas = Math.max(totalMunicipios - comLiderancas, 0)
    const totalVotosPrevistos = Array.from(expectativaPorCidade.values()).reduce((sum, value) => sum + value, 0)
    const totalVisitadas = cidadesVisitadasSet.size

    return {
      totalMunicipios,
      comLiderancas,
      semLiderancas,
      totalEleitores,
      totalVotosPrevistos,
      totalVisitadas,
    }
  }, [dadosRegiao, eleitoresPorCidade, expectativaPorCidadeLista])

  const cidadesSemLiderancaExport = useMemo(() => {
    const cidadesComLiderancaSet = new Set(dadosRegiao.presenca.map((c) => normalizeName(c)))

    const eleitoresNormalizado = new Map<string, number>()
    Object.entries(eleitoresPorCidade).forEach(([cidade, eleitorado]) => {
      eleitoresNormalizado.set(normalizeName(cidade), eleitorado)
    })

    const linhas = dadosRegiao.municipios
      .filter((municipio) => !cidadesComLiderancaSet.has(normalizeName(municipio.nome)))
      .map((municipio) => {
        const eleitores = eleitoresNormalizado.get(normalizeName(municipio.nome)) || 0
        const ehOportunidade = eleitores >= OPPORTUNITY_THRESHOLD

        return {
          cidade: municipio.nome,
          eleitores,
          tipo: ehOportunidade ? 'Oportunidade' : 'Sem liderança',
        }
      })
      .filter((item) => {
        if (filtroAtivo === 'oportunidades') return item.tipo === 'Oportunidade'
        if (filtroAtivo === 'sem-lideranca') return true
        return false
      })
      .sort((a, b) => {
        if (b.eleitores !== a.eleitores) return b.eleitores - a.eleitores
        return a.cidade.localeCompare(b.cidade, 'pt-BR')
      })

    return linhas
  }, [dadosRegiao, eleitoresPorCidade, filtroAtivo])

  const nomeArquivoBase = useMemo(() => {
    const data = new Date().toISOString().slice(0, 10)
    const regiao = filtroRegiao === 'todas' ? 'todas-regioes' : filtroRegiao.toLowerCase().replace(/\s+/g, '-')
    return `territorios-sem-lideranca-${regiao}-${data}`
  }, [filtroRegiao])

  const handleExportarSemLiderancaXls = useCallback(() => {
    if (cidadesSemLiderancaExport.length === 0) return

    const rows = cidadesSemLiderancaExport.map((item) => ({
      Cidade: item.cidade,
      Eleitores: item.eleitores,
      Tipo: item.tipo,
    }))

    const ws = XLSX.utils.json_to_sheet(rows)
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Sem Liderança')
    XLSX.writeFile(wb, `${nomeArquivoBase}.xls`, { bookType: 'biff8' })
  }, [cidadesSemLiderancaExport, nomeArquivoBase])

  const handleExportarSemLiderancaPdf = useCallback(() => {
    if (cidadesSemLiderancaExport.length === 0) return

    const doc = new jsPDF('p', 'mm', 'a4')
    const pageWidth = doc.internal.pageSize.getWidth()
    const pageHeight = doc.internal.pageSize.getHeight()
    const margemX = 12
    const colunaCidadeX = margemX
    const colunaEleitoresX = pageWidth - margemX

    doc.setFontSize(13)
    doc.text('Análise de Territórios — Cidades sem liderança', margemX, 14)

    doc.setFontSize(10)
    doc.text(
      `Região: ${filtroRegiao === 'todas' ? 'Todas as regiões' : filtroRegiao} | Registros: ${cidadesSemLiderancaExport.length}`,
      margemX,
      21
    )

    let y = 28
    doc.setFontSize(10)
    doc.setFont('helvetica', 'bold')
    doc.text('Cidade', colunaCidadeX, y)
    doc.text('Eleitores', colunaEleitoresX, y, { align: 'right' })
    y += 2
    doc.setLineWidth(0.2)
    doc.line(margemX, y, pageWidth - margemX, y)
    y += 5

    doc.setFont('helvetica', 'normal')
    cidadesSemLiderancaExport.forEach((item, idx) => {
      const cidadeTexto = `${idx + 1}. ${item.cidade}`
      const cidadeLinhas = doc.splitTextToSize(cidadeTexto, 145) as string[]
      const alturaLinha = Math.max(cidadeLinhas.length * 5, 5)

      if (y + alturaLinha > pageHeight - 12) {
        doc.addPage()
        y = 16
        doc.setFont('helvetica', 'bold')
        doc.text('Cidade', colunaCidadeX, y)
        doc.text('Eleitores', colunaEleitoresX, y, { align: 'right' })
        y += 2
        doc.line(margemX, y, pageWidth - margemX, y)
        y += 5
        doc.setFont('helvetica', 'normal')
      }

      doc.text(cidadeLinhas, colunaCidadeX, y)
      doc.text(item.eleitores.toLocaleString('pt-BR'), colunaEleitoresX, y, { align: 'right' })
      y += alturaLinha + 1
    })

    doc.save(`${nomeArquivoBase}.pdf`)
  }, [cidadesSemLiderancaExport, filtroRegiao, nomeArquivoBase])

  if (!clientReady) {
    return (
      <div className="w-full h-96 bg-surface rounded-2xl border border-card flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-2 border-accent-gold border-t-transparent rounded-full animate-spin" />
          <p className="text-secondary text-sm">Carregando mapa estratégico...</p>
        </div>
      </div>
    )
  }

  const mapaComOverlays = (
    <>
      {/* Map Component */}
      <MapWrapperLeaflet
        appearance={appearance}
        cidadesComPresenca={dadosRegiao.presenca}
        cidadesVisitadas={dadosRegiao.visitadas}
        municipiosPiaui={dadosRegiao.municipios}
        eleitoresPorCidade={eleitoresPorCidade}
        territoriosQuentes={dadosRegiao.quentes}
        territoriosMornos={dadosRegiao.mornos}
        territoriosFrios={dadosRegiao.frios}
        filtroAtivo={filtroAtivo}
        onStatsCalculated={handleStatsCalculated}
      />

      {(fullscreen || isNativeFullscreen) && (
        <div
          className={cn(
            'pointer-events-none absolute left-3 top-3 z-[1000] min-w-[260px] rounded-xl border p-3 shadow-lg backdrop-blur-md',
            isDarkAppearance ? 'border-white/10 bg-[rgba(22,34,44,0.92)]' : 'border-gray-200/70 bg-white/95',
          )}
        >
          <p className="mb-2 text-[11px] font-semibold text-text-primary">Resumo Global da Região</p>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <p className="text-[11px] text-text-muted">Municípios</p>
            <p className="text-right text-[11px] font-semibold text-text-primary">{resumoGlobalRegiao.totalMunicipios}</p>

            <p className="text-[11px] text-text-muted">Com lideranças</p>
            <p className={cn('text-right text-[11px] font-semibold', isDarkAppearance ? 'text-emerald-300' : 'text-emerald-700')}>
              {resumoGlobalRegiao.comLiderancas}
            </p>

            <p className="text-[11px] text-text-muted">Sem lideranças</p>
            <p className={cn('text-right text-[11px] font-semibold', isDarkAppearance ? 'text-red-300' : 'text-red-700')}>
              {resumoGlobalRegiao.semLiderancas}
            </p>

            <p className="text-[11px] text-text-muted">Eleitores</p>
            <p className="text-right text-[11px] font-semibold text-text-primary">
              {resumoGlobalRegiao.totalEleitores.toLocaleString('pt-BR')}
            </p>

            <p className="text-[11px] text-text-muted">Previsão de votos</p>
            <p className={cn('text-right text-[11px] font-semibold', isDarkAppearance ? 'text-amber-200' : 'text-[#B46800]')}>
              {resumoGlobalRegiao.totalVotosPrevistos.toLocaleString('pt-BR')}
            </p>

            <p className="text-[11px] text-text-muted">Visitadas</p>
            <p className={cn('text-right text-[11px] font-semibold', isDarkAppearance ? 'text-cyan-300' : 'text-blue-700')}>
              {resumoGlobalRegiao.totalVisitadas}
            </p>
          </div>
        </div>
      )}

      {/* Live Counter Overlay */}
      {showStatsOverlay && mapStats && (
        <div
          className={cn(
            'pointer-events-none absolute right-3 top-3 z-[1000] min-w-[170px] space-y-1.5 rounded-xl border p-3 shadow-lg backdrop-blur-md',
            isDarkAppearance ? 'border-white/10 bg-[rgba(22,34,44,0.92)]' : 'border-gray-200/50 bg-white/90',
          )}
        >
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
            <span className="text-[11px] font-bold text-text-primary">{mapStats.cidadesComPresenca}</span>
            <span className="text-[11px] text-text-muted">com presença</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-amber-500" />
            <span className="text-[11px] font-bold text-text-primary">{mapStats.oportunidades}</span>
            <span className="text-[11px] text-text-muted">oportunidades</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-2.5 w-2.5 shrink-0 rounded-full bg-red-500 opacity-70" />
            <span className="text-[11px] font-bold text-text-primary">{mapStats.cidadesSemPresenca}</span>
            <span className="text-[11px] text-text-muted">sem liderança</span>
          </div>
          <div className={cn('my-1 h-px', isDarkAppearance ? 'bg-white/10' : 'bg-gray-200')} />
          <div className="flex items-center gap-2">
            <Users className={cn('h-3.5 w-3.5 shrink-0', isDarkAppearance ? 'text-cyan-300' : 'text-blue-600')} />
            <span className={cn('text-[11px] font-bold', isDarkAppearance ? 'text-cyan-300' : 'text-blue-700')}>{mapStats.percentualCobertura}%</span>
            <span className="text-[11px] text-text-muted">eleitorado</span>
          </div>
        </div>
      )}
    </>
  )

  return (
    <div
      className={`w-full min-h-0 ${isNativeFullscreen ? 'flex h-full max-h-full min-h-0 w-full flex-col overflow-hidden bg-background' : 'space-y-3'}`}
    >
      {/* Header com Título Dinâmico */}
      <div
        className={`flex items-center justify-between ${isNativeFullscreen ? 'shrink-0 bg-surface border-b border-card px-4 py-3' : ''}`}
      >
        <div className="flex flex-col gap-1">
          <div className="flex items-center gap-2">
            <h3 className={`font-semibold text-text-primary ${isNativeFullscreen ? 'text-lg' : 'text-sm'}`}>
              Mapa de Estratégia Territorial
            </h3>
          </div>
          {/* Dynamic Insight Title */}
          {mapStats?.insightPrincipal && (
            <p className="text-xs text-accent-gold font-medium flex items-center gap-1.5">
              <TrendingUp className="w-3 h-3" />
              {mapStats.insightPrincipal}
            </p>
          )}
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleExportarSemLiderancaXls}
            disabled={cidadesSemLiderancaExport.length === 0}
            className="px-2.5 py-1.5 rounded-lg border border-card bg-background text-secondary hover:text-text-primary hover:bg-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs"
            title="Exportar cidades sem liderança em XLS"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            XLS
          </button>
          <button
            onClick={handleExportarSemLiderancaPdf}
            disabled={cidadesSemLiderancaExport.length === 0}
            className="px-2.5 py-1.5 rounded-lg border border-card bg-background text-secondary hover:text-text-primary hover:bg-card transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5 text-xs"
            title="Exportar cidades sem liderança em PDF"
          >
            <FileText className="w-3.5 h-3.5" />
            PDF
          </button>
          {onFullscreen && !isNativeFullscreen && (
            <button
              onClick={onFullscreen}
              className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
              title="Expandir mapa em tela cheia"
            >
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          {isNativeFullscreen && (
            <button
              onClick={handleExitFullscreen}
              className="p-2 rounded-lg hover:bg-background transition-colors text-secondary hover:text-text-primary"
              title="Sair da tela cheia"
            >
              <Minimize2 className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Filtros Rápidos + Região */}
      <div className={`flex flex-wrap items-center gap-1.5 ${isNativeFullscreen ? 'shrink-0 border-b border-card bg-surface px-4 py-2' : ''}`}>
        <Filter className="w-3.5 h-3.5 text-secondary mr-0.5" />
        {FILTROS.map(filtro => {
          const Icon = filtro.icon
          const isActive = filtroAtivo === filtro.id
          return (
            <button
              key={filtro.id}
              onClick={() => setFiltroAtivo(filtro.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                isActive
                  ? 'bg-accent-gold text-white shadow-sm'
                  : 'bg-background text-secondary hover:bg-card hover:text-text-primary border border-card'
              }`}
              title={filtro.description}
            >
              <Icon className="w-3 h-3" />
              {filtro.label}
              {filtro.id === 'oportunidades' && mapStats && mapStats.oportunidades > 0 && (
                <span
                  className={cn(
                    'ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
                    isActive ? 'bg-white/25' : isDarkAppearance ? 'bg-amber-500/20 text-amber-200' : 'bg-amber-100 text-amber-700',
                  )}
                >
                  {mapStats.oportunidades}
                </span>
              )}
            </button>
          )
        })}

        {/* Separador */}
        <div className="w-px h-5 bg-card mx-1" />

        {/* Dropdown de Região */}
        <select
          value={filtroRegiao}
          onChange={(e) => setFiltroRegiao(e.target.value)}
          className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-accent-gold-soft pr-6 ${
            filtroRegiao !== 'todas'
              ? 'bg-accent-gold text-white shadow-sm'
              : 'bg-background text-secondary hover:bg-card hover:text-text-primary border border-card'
          }`}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='${filtroRegiao !== 'todas' ? 'white' : isDarkAppearance ? '%2394a3b8' : '%236b7280'}' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 8px center',
          }}
        >
          {REGIOES.map(r => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      </div>

      {/* Mapa com Overlay de Contadores — em tela cheia, apenas acrescenta coluna ao lado */}
      {isNativeFullscreen ? (
        <div className="flex min-h-0 flex-1 flex-row overflow-hidden">
          <div
            className={`relative w-full min-h-0 overflow-hidden bg-surface ${
              isNativeFullscreen ? 'min-h-0 flex-1' : ''
            }`}
          >
            {mapaComOverlays}
          </div>
          <aside
            className={cn(
              'flex w-[min(340px,32vw)] shrink-0 flex-col overflow-hidden border-l border-card bg-surface',
              isDarkAppearance ? 'border-white/10' : undefined,
            )}
          >
            <div className={cn('shrink-0 border-b px-3 py-2.5', isDarkAppearance ? 'border-white/10 bg-black/20' : 'border-card bg-background/40')}>
              <div className="flex items-center gap-2">
                <ListOrdered className={cn('h-4 w-4 shrink-0', isDarkAppearance ? 'text-amber-200' : 'text-amber-700')} aria-hidden />
                <p className="text-sm font-semibold text-text-primary">Prioridade no campo</p>
              </div>
              <p className="mt-1 text-xs leading-snug text-text-muted">
                Cruza os municípios do Piauí (como no Território) com a previsão de votos 2026 da planilha e os check-ins de campo/agenda. Ordem: mais votos com menos visitas primeiro.
                Respeita o filtro de região acima.
              </p>
              <label
                className={cn(
                  'mt-2 flex items-center gap-2 rounded-lg border px-2.5 py-2',
                  isDarkAppearance ? 'border-white/10 bg-black/15' : 'border-card bg-background/50',
                )}
              >
                <Search className="h-4 w-4 shrink-0 text-text-muted" aria-hidden />
                <input
                  type="search"
                  value={prioridadeBuscaMunicipio}
                  onChange={(e) => setPrioridadeBuscaMunicipio(e.target.value)}
                  placeholder="Buscar município…"
                  className={cn(
                    'min-w-0 flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-muted focus:outline-none',
                  )}
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-1">
              {prioridadeCampoFiltrada.length === 0 ? (
                <div className="px-1 py-3 text-sm leading-relaxed text-text-secondary">
                  {prioridadeCampoLista.length === 0 ? (
                    <>
                      <p className="font-medium text-text-primary">Nenhum município no ranking por enquanto.</p>
                      <p className="mt-1.5 text-xs text-text-muted">
                        É preciso ao menos previsão na planilha do Território ou agendas/check-ins de campo com cidade para montar o cruzamento.
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="font-medium text-text-primary">Nenhum município desta região na lista.</p>
                      <p className="mt-1.5 text-xs text-text-muted">
                        Escolha outra região no filtro acima ou a opção Todas as regiões para ver a fila completa.
                      </p>
                    </>
                  )}
                </div>
              ) : prioridadeCampoExibicao.length === 0 ? (
                <div className="px-1 py-3 text-sm leading-relaxed text-text-secondary">
                  <p className="font-medium text-text-primary">Nenhum município encontrado.</p>
                  <p className="mt-1.5 text-xs text-text-muted">
                    Ajuste o termo de busca ou limpe o campo para ver a lista completa da região.
                  </p>
                </div>
              ) : (
                <ol className="list-none space-y-2">
                  {prioridadeCampoExibicao.map(({ row, rankGlobal }) => {
                    const ultima = formatUltimaVisitaCampo(row.ultimaVisita)
                    const votosLabel =
                      row.expectativaVotos > 0
                        ? `${row.expectativaVotos.toLocaleString('pt-BR')} votos previstos (2026)`
                        : 'Sem previsão na planilha'
                    const visitasLabel =
                      row.visitas === 0
                        ? 'nenhuma visita com check-in'
                        : `${row.visitas} visita${row.visitas !== 1 ? 's' : ''} com check-in`
                    return (
                      <li
                        key={`${rankGlobal}-${normalizeName(row.cidade)}`}
                        className={cn(
                          'flex gap-2 rounded-lg border px-2.5 py-2',
                          isDarkAppearance ? 'border-white/10 bg-white/[0.03]' : 'border-card bg-background/60',
                        )}
                      >
                        <span
                          className={cn(
                            'flex h-6 min-w-[1.5rem] shrink-0 items-center justify-center rounded text-xs font-bold tabular-nums',
                            isDarkAppearance ? 'bg-white/10 text-text-secondary' : 'bg-border-card/80 text-text-muted',
                          )}
                          title="Posição na fila estratégica (global na região)"
                        >
                          {rankGlobal}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-semibold leading-tight text-text-primary">{row.cidade}</p>
                          <p className="mt-1 text-xs leading-snug text-text-secondary">
                            {votosLabel}
                            <span className="text-text-muted"> · </span>
                            {visitasLabel}
                            {ultima ? (
                              <>
                                <span className="text-text-muted"> · </span>
                                última: {ultima}
                              </>
                            ) : null}
                          </p>
                        </div>
                      </li>
                    )
                  })}
                </ol>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div
          className={`relative w-full min-h-0 overflow-hidden bg-surface ${
            fullscreen ? 'h-[calc(100vh-300px)] rounded-2xl border border-card' : 'h-96 rounded-2xl border border-card'
          }`}
        >
          {mapaComOverlays}
        </div>
      )}

      {/* Legenda Aprimorada */}
      <div
        className={`flex flex-wrap items-center justify-center gap-4 text-xs text-secondary ${isNativeFullscreen ? 'shrink-0 bg-surface border-t border-card px-4 py-3' : ''}`}
      >
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-4 rounded-full bg-blue-600 border-2 border-blue-700 flex items-center justify-center">
            <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          </div>
          <span>Visitada</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-blue-600"></div>
          <span>Com liderança</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-amber-500 border border-amber-600 animate-pulse"></div>
          <span className="text-amber-700 font-medium">Oportunidade</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-red-500 border border-red-600 opacity-70"></div>
          <span>Sem liderança</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-4 h-2 rounded bg-blue-400/20 border border-blue-300/30"></div>
          <span>Zona de presença</span>
        </div>
      </div>
    </div>
  )
}
