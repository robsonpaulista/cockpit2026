'use client'

import { useEffect, useState, useCallback, useRef, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { X, Users, FileText, TrendingUp, CheckCircle, Clock, AlertCircle, Loader2, Download, Copy, Check } from 'lucide-react'
import { useTheme } from '@/contexts/theme-context'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { getEleitoradoByCity } from '@/lib/eleitores'
import jsPDF from 'jspdf'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts'

interface Lideranca {
  [key: string]: any
}

interface Demand {
  id?: string
  selection_key: string
  title: string
  description?: string
  status?: string
  theme?: string
  priority?: string
  lideranca?: string
  data_demanda?: string
  sheets_data?: Record<string, unknown>
}

interface Poll {
  id: string
  data: string
  instituto: string
  candidato_nome: string
  tipo: string
  cargo: string
  cidade_id?: string | null
  cities?: {
    id: string
    name: string
  } | null
  intencao: number
  rejeicao: number
}

interface ExecutiveBriefingModalProps {
  isOpen: boolean
  onClose: () => void
  cidade: string
  liderancas: Lideranca[]
  expectativaVotosCol?: string
  nomeCol?: string
}

/** Comparação estrita de município (evita COCAL ⊂ COCAL DOS ALVES). */
function normalizarNomeMunicipioBriefing(value: string): string {
  return String(value || '')
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
}

export function ExecutiveBriefingModal({
  isOpen,
  onClose,
  cidade,
  liderancas,
  expectativaVotosCol,
  nomeCol,
}: ExecutiveBriefingModalProps) {
  const { appearance, theme } = useTheme()
  const isDark = appearance === 'dark'
  const isCockpit = false
  const modalShellClass = isCockpit
    ? 'border-white/12 bg-[linear-gradient(165deg,rgba(22,34,44,0.92)_0%,rgba(18,30,38,0.95)_100%)] shadow-[0_24px_64px_rgba(3,12,20,0.42)]'
    : 'border-card bg-surface'
  const panelClass = isCockpit
    ? 'border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.04)_0%,rgba(255,255,255,0.02)_100%)]'
    : 'border-card bg-surface'
  const contentClass = isCockpit
    ? 'bg-[linear-gradient(180deg,rgba(255,255,255,0.025)_0%,rgba(255,255,255,0.012)_100%)] text-text-primary'
    : 'bg-background text-text-primary'
  const headingClass = 'text-sm font-semibold text-text-primary'
  const bodyTextClass = 'text-sm text-text-primary'
  const metaTextClass = 'text-xs text-text-secondary'

  const chartPalette = useMemo(
    () =>
      isDark
        ? {
            grid: 'rgba(148, 163, 184, 0.22)',
            axis: '#64748b',
            tick: '#94a3b8',
            label: '#94a3b8',
          }
        : {
            grid: '#E8E8E8',
            axis: '#888888',
            tick: '#666666',
            label: '#666666',
          },
    [isDark]
  )

  const [demands, setDemands] = useState<Demand[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [filtroLideranca, setFiltroLideranca] = useState<string>('')
  const [selectedDemandKeys, setSelectedDemandKeys] = useState<string[]>([])
  const [exportSelectionMode, setExportSelectionMode] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

  const normalizeText = useCallback((value: unknown): string => {
    if (value === null || value === undefined) return ''
    return String(value)
      .toLowerCase()
      .trim()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
  }, [])

  const getSheetsField = useCallback((demand: Demand, patterns: RegExp[]): string | null => {
    const raw = demand.sheets_data
    if (!raw || typeof raw !== 'object') return null

    const entries = Object.entries(raw)
    const match = entries.find(([key]) => patterns.some((pattern) => pattern.test(key)))
    if (!match) return null

    const value = match[1]
    if (value === null || value === undefined) return null
    const text = String(value).trim()
    return text || null
  }, [])

  const getDemandValor = useCallback((demand: Demand): string | null => {
    const rawValue = getSheetsField(demand, [
      /^valor$/i,
      /valor\s*\(?.*r\$.*\)?/i,
      /custo|or[çc]amento/i,
    ])
    if (!rawValue) return null
    const semMoeda = rawValue.replace(/r\$\s*/gi, '').trim()
    return semMoeda || null
  }, [getSheetsField])

  const getDemandPrevisao = useCallback((demand: Demand): string | null => {
    const fromSheet = getSheetsField(demand, [
      /^previs[aã]o$/i,
      /data.*previs[aã]o/i,
      /previs[aã]o.*data/i,
      /prazo/i,
    ])
    if (fromSheet) return fromSheet
    return demand.data_demanda ? new Date(demand.data_demanda).toLocaleDateString('pt-BR') : null
  }, [getSheetsField])

  // Função para normalizar números
  const normalizeNumber = (value: any): number => {
    if (typeof value === 'number') return value
    
    const str = String(value).trim()
    if (!str) return 0
    
    let cleaned = str.replace(/[^\d.,]/g, '')
    
    if (cleaned.includes(',') && cleaned.includes('.')) {
      if (cleaned.lastIndexOf(',') > cleaned.lastIndexOf('.')) {
        cleaned = cleaned.replace(/\./g, '').replace(',', '.')
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    } else if (cleaned.includes(',')) {
      const parts = cleaned.split(',')
      if (parts.length === 2) {
        if (parts[1].length === 3) {
          cleaned = cleaned.replace(/,/g, '')
        } else if (parts[1].length <= 2) {
          cleaned = cleaned.replace(',', '.')
        } else {
          cleaned = cleaned.replace(/,/g, '')
        }
      } else {
        cleaned = cleaned.replace(/,/g, '')
      }
    }
    
    const numValue = parseFloat(cleaned)
    return isNaN(numValue) ? 0 : numValue
  }

  const formatValorSemMoeda = (value: number): string => {
    if (!Number.isFinite(value) || value <= 0) return '-'
    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const getDemandValorNumero = (demand: Demand): number => {
    const valor = getDemandValor(demand)
    if (!valor) return 0
    return normalizeNumber(valor)
  }

  const buildDemandSelectionKey = useCallback((demand: Omit<Demand, 'selection_key'>, idx: number): string => {
    if (demand.id) return `id:${demand.id}`
    const title = String(demand.title || '').trim()
    const lideranca = String(demand.lideranca || '').trim()
    const dataDemanda = String(demand.data_demanda || '').trim()
    return `row:${idx}:${title}:${lideranca}:${dataDemanda}`
  }, [])

  // Buscar demandas da cidade
  const fetchDemands = useCallback(async () => {
    if (!cidade) return []
    
    try {
      const response = await fetch(`/api/campo/demands?cidade=${encodeURIComponent(cidade)}`)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar demandas')
      }

      const data = await response.json()
      const normalizedDemands = (Array.isArray(data) ? data : []).map((rawDemand, idx) => {
        const baseDemand = rawDemand as Omit<Demand, 'selection_key'>
        return {
          ...baseDemand,
          selection_key: buildDemandSelectionKey(baseDemand, idx),
        } as Demand
      })
      return normalizedDemands
    } catch (err) {
      console.error('Erro ao buscar demandas:', err)
      return []
    }
  }, [cidade, buildDemandSelectionKey])

  // Buscar pesquisas da cidade
  const fetchPolls = useCallback(async () => {
    if (!cidade) return []
    
    try {
      // Buscar todas as pesquisas primeiro
      const response = await fetch('/api/pesquisa')
      
      if (!response.ok) {
        throw new Error('Erro ao buscar pesquisas')
      }

      const allPolls: Poll[] = await response.json()
      
      const alvo = normalizarNomeMunicipioBriefing(cidade)
      const cidadePolls = allPolls.filter((poll) => {
        const pollCidade = poll.cities?.name || ''
        if (!pollCidade.trim()) return false
        return normalizarNomeMunicipioBriefing(pollCidade) === alvo
      })
      
      return cidadePolls
    } catch (err) {
      console.error('Erro ao buscar pesquisas:', err)
      return []
    }
  }, [cidade])

  useEffect(() => {
    if (isOpen && cidade) {
      setLoading(true)
      setError(null)
      
      Promise.all([fetchDemands(), fetchPolls()])
        .then(([demandsData, pollsData]) => {
          setDemands(demandsData)
          setSelectedDemandKeys(demandsData.map((d) => d.selection_key))
          setPolls(pollsData)
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Erro ao carregar dados')
        })
        .finally(() => {
          setLoading(false)
        })
    } else {
      setDemands([])
      setSelectedDemandKeys([])
      setPolls([])
      setError(null)
    }
  }, [isOpen, cidade, fetchDemands, fetchPolls])

  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      setFiltroLideranca('')
    }
  }, [isOpen, cidade])

  if (!isOpen || typeof document === 'undefined') return null

  const liderancasDisponiveis = useMemo(() => {
    const nomesLiderancas = new Set<string>()

    liderancas.forEach((lider) => {
      const nome = nomeCol ? String(lider[nomeCol] || '').trim() : ''
      if (nome) nomesLiderancas.add(nome)
    })

    demands.forEach((demand) => {
      const nome = String(demand.lideranca || '').trim()
      if (nome) nomesLiderancas.add(nome)
    })

    return Array.from(nomesLiderancas).sort((a, b) => a.localeCompare(b, 'pt-BR'))
  }, [demands, liderancas, nomeCol])

  // Ordenar lideranças por expectativa de votos
  const liderancasOrdenadas = [...liderancas].sort((a, b) => {
    const expectativaA = expectativaVotosCol ? normalizeNumber(a[expectativaVotosCol]) : 0
    const expectativaB = expectativaVotosCol ? normalizeNumber(b[expectativaVotosCol]) : 0
    return expectativaB - expectativaA
  })

  const liderancasOrdenadasFiltradas = !filtroLideranca
    ? liderancasOrdenadas
    : liderancasOrdenadas.filter((lider) => {
        const nome = nomeCol ? String(lider[nomeCol] || '').trim() : ''
        return normalizeText(nome) === normalizeText(filtroLideranca)
      })

  const demandsFiltradas = !filtroLideranca
    ? demands
    : demands.filter((demand) => normalizeText(demand.lideranca) === normalizeText(filtroLideranca))

  // Ordenar demandas: finalizadas primeiro, depois em andamento, depois demais
  const demandsOrdenadas = [...demandsFiltradas].sort((a, b) => {
    const statusA = (a.status || '').toLowerCase().trim()
    const statusB = (b.status || '').toLowerCase().trim()
    
    const isFinalizadaA = statusA.includes('resolvido') || statusA.includes('concluído') || statusA.includes('concluido') || statusA.includes('finalizado') || statusA.includes('finalizada')
    const isFinalizadaB = statusB.includes('resolvido') || statusB.includes('concluído') || statusB.includes('concluido') || statusB.includes('finalizado') || statusB.includes('finalizada')
    
    const isAndamentoA = statusA.includes('andamento') || statusA.includes('progresso') || statusA.includes('em andamento')
    const isAndamentoB = statusB.includes('andamento') || statusB.includes('progresso') || statusB.includes('em andamento')
    
    if (isFinalizadaA && !isFinalizadaB) return -1
    if (!isFinalizadaA && isFinalizadaB) return 1
    if (isAndamentoA && !isAndamentoB) return -1
    if (!isAndamentoA && isAndamentoB) return 1
    
    return 0
  })
  const demandsSelecionadasOrdenadas = demandsOrdenadas.filter((demand) =>
    selectedDemandKeys.includes(demand.selection_key)
  )
  const demandsParaExibicao = exportSelectionMode ? demandsSelecionadasOrdenadas : demandsOrdenadas
  const totalValorDemandasSelecionadas = demandsSelecionadasOrdenadas.reduce(
    (sum, demand) => sum + getDemandValorNumero(demand),
    0
  )

  // Calcular totais
  const totalExpectativa = liderancasOrdenadasFiltradas.reduce((sum, lider) => {
    return sum + (expectativaVotosCol ? normalizeNumber(lider[expectativaVotosCol]) : 0)
  }, 0)

  // Obter eleitorado e calcular votos proporcionais se houver pesquisa
  const eleitorado = getEleitoradoByCity(cidade)
  const ultimaPesquisa = polls.length > 0 ? polls.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime())[0] : null
  const votosProporcionais = eleitorado && ultimaPesquisa ? Math.round((ultimaPesquisa.intencao / 100) * eleitorado) : null

  // Função para gerar texto formatado para WhatsApp e copiar
  const handleCopyWhatsApp = async () => {
    const hoje = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const lines: string[] = []

    lines.push(`📋 *BRIEFING EXECUTIVO*`)
    lines.push(`📍 *${cidade.toUpperCase()}*`)
    lines.push(`📅 ${hoje}`)
    lines.push(``)

    // Eleitorado
    if (eleitorado) {
      lines.push(`🗳️ *Eleitorado:* ${eleitorado.toLocaleString('pt-BR')} eleitores`)
      lines.push(``)
    }

    // Lideranças
    lines.push(`━━━━━━━━━━━━━━━━━━`)
    lines.push(`👥 *LIDERANÇAS*`)
    if (expectativaVotosCol) {
      lines.push(`📊 Total esperado: *${Math.round(totalExpectativa).toLocaleString('pt-BR')} votos*`)
    }
    lines.push(``)

    if (liderancasOrdenadasFiltradas.length === 0) {
      lines.push(`_Nenhuma liderança cadastrada_`)
    } else {
      liderancasOrdenadasFiltradas.forEach((lider, idx) => {
        const nome = nomeCol ? (lider[nomeCol] || 'Sem nome') : 'Sem nome'
        const funcao = lider.funcao ? ` — ${lider.funcao}` : ''
        const expectativa = expectativaVotosCol ? normalizeNumber(lider[expectativaVotosCol]) : 0

        let line = `${idx + 1}. *${nome}*${funcao}`
        if (expectativa > 0) {
          line += `\n    🎯 ${Math.round(expectativa).toLocaleString('pt-BR')} votos`
        }
        lines.push(line)
      })
    }
    lines.push(``)

    // Demandas
    lines.push(`━━━━━━━━━━━━━━━━━━`)
    lines.push(`📝 *DEMANDAS* (${demandsSelecionadasOrdenadas.length})`)
    lines.push(``)

    if (demandsSelecionadasOrdenadas.length === 0) {
      lines.push(`_Nenhuma demanda selecionada para exportação_`)
    } else {
      const appendDemandExtras = (d: Demand) => {
        const valorNumero = getDemandValorNumero(d)
        const previsao = getDemandPrevisao(d)
        if (valorNumero > 0) {
          lines.push(`    💰 Valor: ${formatValorSemMoeda(valorNumero)}`)
        }
        if (previsao) {
          lines.push(`    📅 Previsão: ${previsao}`)
        }
      }

      const finalizadas = demandsSelecionadasOrdenadas.filter(d => {
        const s = (d.status || '').toLowerCase()
        return s.includes('resolvido') || s.includes('concluído') || s.includes('concluido') || s.includes('finalizado') || s.includes('finalizada')
      })
      const emAndamento = demandsSelecionadasOrdenadas.filter(d => {
        const s = (d.status || '').toLowerCase()
        return s.includes('andamento') || s.includes('progresso')
      })
      const pendentes = demandsSelecionadasOrdenadas.filter(d => {
        const s = (d.status || '').toLowerCase()
        return !s.includes('resolvido') && !s.includes('concluído') && !s.includes('concluido') && !s.includes('finalizado') && !s.includes('finalizada') && !s.includes('andamento') && !s.includes('progresso')
      })

      if (finalizadas.length > 0) {
        lines.push(`✅ *Concluídas (${finalizadas.length}):*`)
        finalizadas.forEach(d => {
          const lider = d.lideranca ? ` — ${d.lideranca}` : ''
          lines.push(`  • ${d.title}${lider}`)
          appendDemandExtras(d)
        })
        lines.push(``)
      }

      if (emAndamento.length > 0) {
        lines.push(`⏳ *Em andamento (${emAndamento.length}):*`)
        emAndamento.forEach(d => {
          const lider = d.lideranca ? ` — ${d.lideranca}` : ''
          lines.push(`  • ${d.title}${lider}`)
          appendDemandExtras(d)
          if (d.description) {
            lines.push(`    _${d.description}_`)
          }
        })
        lines.push(``)
      }

      if (pendentes.length > 0) {
        lines.push(`⚪ *Pendentes (${pendentes.length}):*`)
        pendentes.forEach(d => {
          const lider = d.lideranca ? ` — ${d.lideranca}` : ''
          lines.push(`  • ${d.title}${lider}`)
          appendDemandExtras(d)
        })
        lines.push(``)
      }
    }

    // Pesquisas
    if (polls.length > 0) {
      lines.push(`━━━━━━━━━━━━━━━━━━`)
      lines.push(`📊 *PESQUISAS DE INTENÇÃO DE VOTO*`)
      lines.push(``)

      // Agrupar por data/instituto
      const pollsPorData = new Map<string, Poll[]>()
      polls.forEach(poll => {
        const dateStr = poll.data
        let formattedDate: string
        if (dateStr.includes('T')) {
          formattedDate = new Date(dateStr).toLocaleDateString('pt-BR')
        } else {
          const [year, month, day] = dateStr.split('-').map(Number)
          formattedDate = new Date(year, month - 1, day).toLocaleDateString('pt-BR')
        }
        const key = `${formattedDate} — ${poll.instituto}`
        if (!pollsPorData.has(key)) pollsPorData.set(key, [])
        pollsPorData.get(key)!.push(poll)
      })

      // Ordenar por data (mais recente primeiro)
      const pollsEntries = Array.from(pollsPorData.entries()).sort((a, b) => {
        const dateA = a[1][0]?.data || ''
        const dateB = b[1][0]?.data || ''
        return dateB.localeCompare(dateA)
      })

      pollsEntries.forEach(([key, pollsGrupo]) => {
        lines.push(`🗓️ *${key}*`)
        // Ordenar candidatos por intenção (maior primeiro)
        const sorted = [...pollsGrupo].sort((a, b) => b.intencao - a.intencao)
        sorted.forEach((poll, idx) => {
          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : '  •'
          lines.push(`${medal} ${poll.candidato_nome}: *${poll.intencao.toFixed(1)}%*`)
        })
        lines.push(``)
      })

      // Votos proporcionais baseado na última pesquisa
      if (votosProporcionais && ultimaPesquisa) {
        lines.push(`📈 Projeção de votos (última pesquisa): *${votosProporcionais.toLocaleString('pt-BR')}*`)
        lines.push(``)
      }
    }

    lines.push(`━━━━━━━━━━━━━━━━━━`)
    lines.push(`_Gerado pelo Cockpit 2026_`)

    const text = lines.join('\n')

    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    } catch {
      // Fallback para browsers que não suportam clipboard API
      const textarea = document.createElement('textarea')
      textarea.value = text
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      setCopied(true)
      setTimeout(() => setCopied(false), 3000)
    }
  }

  // Função para exportar PDF
  const handleExportPDF = async () => {
    if (!contentRef.current) return

    setExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      setExportSelectionMode(true)
      await new Promise(resolve => setTimeout(resolve, 120))
      
      // Aguardar um pouco para garantir que o conteúdo está renderizado
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Garantir que o container está no topo e visível
      if (!contentRef.current) {
        throw new Error('Elemento de conteúdo não encontrado')
      }
      
      contentRef.current.scrollTop = 0
      // Garantir que não há overflow escondido
      const originalOverflow = contentRef.current.style.overflow
      contentRef.current.style.overflow = 'visible'
      
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Configurações para captura completa do conteúdo
      const canvas = await html2canvas(contentRef.current, {
        scale: 1.5,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: contentRef.current.scrollWidth,
        height: contentRef.current.scrollHeight,
        windowWidth: contentRef.current.scrollWidth,
        windowHeight: contentRef.current.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const exportRoot = clonedDoc.querySelector('[data-briefing-export-root="true"]') as HTMLElement | null
          if (exportRoot) {
            // Forçar tokens claros para o PDF, independente do tema ativo no app
            exportRoot.style.setProperty('--bg-app', '255 255 255')
            exportRoot.style.setProperty('--bg-surface', '255 255 255')
            exportRoot.style.setProperty('--bg-sidebar', '248 250 252')
            exportRoot.style.setProperty('--text-primary', '17 24 39')
            exportRoot.style.setProperty('--text-secondary', '75 85 99')
            exportRoot.style.setProperty('--text-muted', '107 114 128')
            exportRoot.style.setProperty('--border-card', '209 213 219')
            exportRoot.style.backgroundColor = '#ffffff'
            exportRoot.style.color = '#111827'
          }

          // Garantir que todas as seções e tabelas estão visíveis no clone
          const clonedContent = clonedDoc.body
          if (clonedContent) {
            // Garantir que todas as seções estão visíveis
            const clonedSections = clonedContent.querySelectorAll('section')
            clonedSections.forEach((el) => {
              const htmlEl = el as HTMLElement
              htmlEl.style.display = 'block'
              htmlEl.style.visibility = 'visible'
              htmlEl.style.opacity = '1'
              htmlEl.style.height = 'auto'
              htmlEl.style.maxHeight = 'none'
              htmlEl.style.overflow = 'visible'
            })
            
            // Garantir que todas as tabelas estão visíveis
            const clonedTables = clonedContent.querySelectorAll('table')
            clonedTables.forEach((el) => {
              const htmlEl = el as HTMLElement
              htmlEl.style.display = 'table'
              htmlEl.style.visibility = 'visible'
              htmlEl.style.opacity = '1'
            })
            
            // Garantir que divs com overflow estão visíveis
            const clonedDivs = clonedContent.querySelectorAll('div[style*="overflow"]')
            clonedDivs.forEach((el) => {
              const htmlEl = el as HTMLElement
              htmlEl.style.overflow = 'visible'
              htmlEl.style.maxHeight = 'none'
            })
          }
        },
      })
      
      // Restaurar overflow original
      contentRef.current.style.overflow = originalOverflow

      if (!canvas || canvas.width === 0 || canvas.height === 0) {
        throw new Error('Canvas inválido')
      }

      const pdf = new jsPDF('p', 'mm', 'a4')
      const pdfWidth = pdf.internal.pageSize.getWidth()
      const pdfHeight = pdf.internal.pageSize.getHeight()
      
      // Margens
      const margin = 8
      const contentWidth = pdfWidth - (margin * 2)
      
      // Calcular dimensões da imagem
      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const ratio = contentWidth / imgWidth
      const imgScaledWidth = contentWidth
      const imgScaledHeight = imgHeight * ratio

      // Adicionar título na primeira página
      const titleHeight = 18
      pdf.setFontSize(14)
      pdf.text('Briefing Executivo', pdfWidth / 2, 10, { align: 'center' })
      pdf.setFontSize(9)
      pdf.text(cidade, pdfWidth / 2, 16, { align: 'center' })
      
      // Adicionar imagem em múltiplas páginas se necessário
      let currentY = 0
      let pageNumber = 0
      let yPosition = titleHeight + 2

      while (currentY < imgScaledHeight) {
        // Adicionar página se não for a primeira
        if (pageNumber > 0) {
          pdf.addPage()
          yPosition = margin
        }

        // Calcular altura disponível nesta página
        const availableHeight = pageNumber === 0 
          ? pdfHeight - titleHeight - margin - 2 
          : pdfHeight - (margin * 2)
        
        // Calcular altura da parte da imagem que cabe nesta página
        const heightToAdd = Math.min(imgScaledHeight - currentY, availableHeight)
        
        // Calcular posição Y na imagem original (em pixels do canvas)
        const sourceY = Math.floor((currentY / imgScaledHeight) * imgHeight)
        const sourceHeight = Math.ceil((heightToAdd / imgScaledHeight) * imgHeight)

        // Limitar sourceHeight para não ultrapassar o tamanho do canvas
        const actualSourceHeight = Math.min(sourceHeight, imgHeight - sourceY)

        if (actualSourceHeight <= 0) break

        // Criar canvas temporário para esta página
        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = imgWidth
        tempCanvas.height = actualSourceHeight
        const tempCtx = tempCanvas.getContext('2d')
        
        if (!tempCtx) {
          throw new Error('Não foi possível criar contexto do canvas')
        }

        // Copiar parte da imagem original para o canvas temporário
        try {
          tempCtx.drawImage(canvas, 0, sourceY, imgWidth, actualSourceHeight, 0, 0, imgWidth, actualSourceHeight)
          const pageImgData = tempCanvas.toDataURL('image/png', 0.95)
          
          if (!pageImgData || pageImgData === 'data:,') {
            throw new Error('Erro ao gerar imagem da página')
          }

          // Ajustar altura escalada baseada na altura real da fonte
          const actualScaledHeight = (actualSourceHeight / imgHeight) * imgScaledHeight
          pdf.addImage(pageImgData, 'PNG', margin, yPosition, imgScaledWidth, actualScaledHeight)
        } catch (drawError) {
          console.error('Erro ao desenhar no canvas:', drawError)
          throw drawError
        }

        currentY += heightToAdd
        pageNumber++
        
        // Proteção contra loop infinito
        if (pageNumber > 100) {
          throw new Error('Muitas páginas geradas. Interrompendo.')
        }
      }

      pdf.save(`Briefing-Executivo-${cidade.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`)
    } catch (err) {
      console.error('Erro ao exportar PDF:', err)
      const errorMessage = err instanceof Error ? err.message : 'Erro desconhecido'
      alert(`Erro ao exportar PDF: ${errorMessage}. Tente novamente.`)
    } finally {
      setExportSelectionMode(false)
      setExporting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-center justify-center bg-black/55 p-4">
      <div className={cn('flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border font-sans', modalShellClass)}>
        {/* Header */}
        <div className={cn('flex items-center justify-between border-b p-6', isCockpit ? 'border-white/10' : 'border-card')}>
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Briefing Executivo</h2>
            <p className="mt-1 text-sm text-text-secondary">{cidade}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopyWhatsApp}
              disabled={loading}
              className={cn(
                sidebarPrimaryCTAButtonClass(isCockpit),
                copied && 'ring-2 ring-status-success/40 ring-offset-2 ring-offset-background'
              )}
              title="Copiar briefing formatado para WhatsApp"
            >
              {copied ? (
                <Check className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')} aria-hidden />
              ) : (
                <Copy className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')} aria-hidden />
              )}
              {copied ? 'Copiado!' : 'WhatsApp'}
            </button>
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={exporting || loading}
              className={sidebarPrimaryCTAButtonClass(isCockpit)}
              title="Exportar para PDF"
            >
              <Download
                className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')}
                aria-hidden
              />
              {exporting ? 'Exportando...' : 'PDF'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className={cn('rounded-lg p-1.5 transition-colors', isCockpit ? 'hover:bg-white/10' : 'hover:bg-background')}
            >
              <X className="w-5 h-5 text-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div
          className={cn('flex-1 space-y-3 overflow-y-auto p-4', contentClass)}
          ref={contentRef}
          data-briefing-export-root="true"
        >
          {liderancasDisponiveis.length > 0 && (
            <div className={cn('rounded-lg border p-3', panelClass)}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wide text-text-secondary">
                    Filtrar por liderança
                  </span>
                  <select
                    value={filtroLideranca}
                    onChange={(e) => setFiltroLideranca(e.target.value)}
                    className={cn(
                      'w-full max-w-xs rounded-md border px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft',
                      isCockpit ? 'border-white/10 bg-white/[0.03] text-text-primary' : 'border-card bg-surface text-text-primary'
                    )}
                  >
                    <option value="">Todas</option>
                    {liderancasDisponiveis.map((nome) => (
                      <option key={nome} value={nome}>
                        {nome}
                      </option>
                    ))}
                  </select>
                </label>
                <span className="text-xs text-text-secondary">
                  Demandas selecionadas: {demandsSelecionadasOrdenadas.length}/{demandsOrdenadas.length}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedDemandKeys(demandsOrdenadas.map((d) => d.selection_key))}
                  className="rounded-md border border-card px-2 py-1 text-[11px] font-medium text-text-primary transition-colors hover:bg-background"
                >
                  Marcar todas
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDemandKeys([])}
                  className="rounded-md border border-card px-2 py-1 text-[11px] font-medium text-text-primary transition-colors hover:bg-background"
                >
                  Limpar todas
                </button>
              </div>
            </div>
          )}
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
              <span className={cn('ml-2', bodyTextClass)}>Carregando dados...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl border border-status-error/30 bg-status-error/10">
              <p className="text-sm text-status-error">{error}</p>
            </div>
          ) : (
            <>
              {/* Lideranças */}
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <Users className="w-3.5 h-3.5 text-accent-gold" />
                  <h3 className={headingClass}>Lideranças e Expectativa de Votos</h3>
                  {expectativaVotosCol && (
                    <span className="ml-auto text-xs font-semibold text-accent-gold">
                      Total: {Math.round(totalExpectativa).toLocaleString('pt-BR')} votos
                    </span>
                  )}
                </div>
                {liderancasOrdenadasFiltradas.length === 0 ? (
                  <p className={metaTextClass}>Nenhuma liderança encontrada</p>
                ) : (
                  <div className={cn('overflow-x-auto rounded-lg border', panelClass)}>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className={cn('border-b', isCockpit ? 'border-white/10 bg-white/[0.04]' : 'border-card bg-surface')}>
                          <th className="p-1.5 text-left font-semibold text-text-primary">Nome</th>
                          {liderancasOrdenadasFiltradas.some(l => l.funcao) && (
                            <th className="p-1.5 text-left font-semibold text-text-primary">Função</th>
                          )}
                          {expectativaVotosCol && (
                            <th className="p-1.5 text-right font-semibold text-text-primary">Expectativa de Votos</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className={cn(isCockpit ? 'bg-white/[0.02]' : 'bg-surface')}>
                        {liderancasOrdenadasFiltradas.map((lider, idx) => {
                          const expectativa = expectativaVotosCol ? normalizeNumber(lider[expectativaVotosCol]) : 0
                          const nome = nomeCol ? (lider[nomeCol] || 'Sem nome') : 'Sem nome'
                          
                          return (
                            <tr
                              key={idx}
                              className={cn(
                                'border-b transition-colors',
                                isCockpit
                                  ? 'border-white/10 odd:bg-white/[0.02] even:bg-white/[0.01] hover:bg-white/[0.05]'
                                  : 'border-card odd:bg-background/25 even:bg-surface hover:bg-accent-gold-soft/15'
                              )}
                            >
                              <td className="p-1.5 text-text-primary">{nome}</td>
                              {liderancasOrdenadasFiltradas.some(l => l.funcao) && (
                                <td className="p-1.5 text-text-secondary">{lider.funcao || '-'}</td>
                              )}
                              {expectativaVotosCol && (
                                <td className="p-1.5 text-right font-semibold text-accent-gold">
                                  {expectativa > 0 ? `${Math.round(expectativa).toLocaleString('pt-BR')} votos` : '-'}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {/* Demandas */}
              <section>
                <div className="flex items-center gap-1.5 mb-2">
                  <FileText className="w-3.5 h-3.5 text-accent-gold" />
                  <h3 className={headingClass}>Demandas por Status</h3>
                </div>
                {demandsParaExibicao.length === 0 ? (
                  <p className={metaTextClass}>Nenhuma demanda encontrada</p>
                ) : (
                  <>
                  <div className={cn('overflow-x-auto rounded-lg border', panelClass)}>
                    <table className="w-full border-collapse text-xs">
                      <thead>
                        <tr className={cn('border-b', isCockpit ? 'border-white/10 bg-white/[0.04]' : 'border-card bg-surface')}>
                          {!exportSelectionMode && (
                            <th className="w-10 p-1.5 text-center font-semibold text-text-primary">
                              <input
                                type="checkbox"
                                checked={
                                  demandsOrdenadas.length > 0 &&
                                  demandsOrdenadas.every((d) => selectedDemandKeys.includes(d.selection_key))
                                }
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    const todasVisiveis = demandsOrdenadas.map((d) => d.selection_key)
                                    setSelectedDemandKeys((prev) =>
                                      Array.from(new Set([...prev, ...todasVisiveis]))
                                    )
                                  } else {
                                    const visiveis = new Set(demandsOrdenadas.map((d) => d.selection_key))
                                    setSelectedDemandKeys((prev) => prev.filter((key) => !visiveis.has(key)))
                                  }
                                }}
                                aria-label="Selecionar todas as demandas visíveis"
                              />
                            </th>
                          )}
                          <th className="p-1.5 text-left font-semibold text-text-primary">Título</th>
                          <th className="p-1.5 text-left font-semibold text-text-primary">Status</th>
                          {demandsParaExibicao.some(d => d.lideranca) && (
                            <th className="p-1.5 text-left font-semibold text-text-primary">Liderança</th>
                          )}
                          {demandsParaExibicao.some((d) => getDemandValor(d)) && (
                            <th className="p-1.5 text-right font-semibold text-text-primary">Valor</th>
                          )}
                          {demandsParaExibicao.some((d) => getDemandPrevisao(d)) && (
                            <th className="p-1.5 text-left font-semibold text-text-primary">Previsão</th>
                          )}
                        </tr>
                      </thead>
                      <tbody className={cn(isCockpit ? 'bg-white/[0.02]' : 'bg-surface')}>
                        {demandsParaExibicao.map((demand, idx) => {
                          const status = demand.status || 'Sem status'
                          const statusLower = status.toLowerCase().trim()
                          const isFinalizada = statusLower.includes('resolvido') || statusLower.includes('concluído') || statusLower.includes('concluido') || statusLower.includes('finalizado') || statusLower.includes('finalizada')
                          const isAndamento = statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('em andamento')
                          const isSelected = selectedDemandKeys.includes(demand.selection_key)
                          
                          return (
                            <tr
                              key={idx}
                              className={cn(
                                'border-b transition-colors',
                                isCockpit
                                  ? 'border-white/10 odd:bg-white/[0.02] even:bg-white/[0.01] hover:bg-white/[0.05]'
                                  : 'border-card odd:bg-background/25 even:bg-surface hover:bg-accent-gold-soft/15'
                              )}
                            >
                              {!exportSelectionMode && (
                                <td className="p-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => {
                                      setSelectedDemandKeys((prev) =>
                                        prev.includes(demand.selection_key)
                                          ? prev.filter((key) => key !== demand.selection_key)
                                          : [...prev, demand.selection_key]
                                      )
                                    }}
                                    aria-label={`Selecionar demanda ${demand.title}`}
                                  />
                                </td>
                              )}
                              <td className="p-1.5 text-text-primary">
                                <div className="flex items-center gap-1">
                                  {isFinalizada ? (
                                    <CheckCircle className="w-3 h-3 text-status-success flex-shrink-0" />
                                  ) : isAndamento ? (
                                    <Clock className="w-3 h-3 text-status-warning flex-shrink-0" />
                                  ) : (
                                    <AlertCircle className="w-3 h-3 text-secondary flex-shrink-0" />
                                  )}
                                  <span>{demand.title}</span>
                                </div>
                                {demand.description && (
                                  <p className="mt-0.5 text-xs text-text-secondary">{demand.description}</p>
                                )}
                              </td>
                              <td className="p-1.5">
                                <span className={`text-xs px-1.5 py-0.5 rounded ${
                                  isFinalizada ? 'bg-status-success/10 text-status-success' :
                                  isAndamento ? 'bg-status-warning/10 text-status-warning' :
                                  'bg-text-muted/10 text-secondary'
                                }`}>
                                  {status}
                                </span>
                              </td>
                              {demandsParaExibicao.some(d => d.lideranca) && (
                                <td className="p-1.5 text-text-secondary">{demand.lideranca || '-'}</td>
                              )}
                              {demandsParaExibicao.some((d) => getDemandValor(d)) && (
                                <td className="p-1.5 text-right font-medium text-text-primary">
                                  {formatValorSemMoeda(getDemandValorNumero(demand))}
                                </td>
                              )}
                              {demandsParaExibicao.some((d) => getDemandPrevisao(d)) && (
                                <td className="p-1.5 text-text-secondary">
                                  {getDemandPrevisao(demand) || '-'}
                                </td>
                              )}
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                  {demandsSelecionadasOrdenadas.some((d) => getDemandValor(d)) && (
                    <div className="mt-2 flex justify-end">
                      <span className="text-xs font-bold text-accent-gold">
                        Total Valor (selecionadas): {formatValorSemMoeda(totalValorDemandasSelecionadas)}
                      </span>
                    </div>
                  )}
                  </>
                )}
              </section>

              {/* Pesquisas de Intenção de Voto */}
              {polls.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-3.5 h-3.5 text-accent-gold" />
                    <h3 className={headingClass}>Pesquisas de Intenção de Voto</h3>
                  </div>
                  <div className={cn('h-96 rounded-lg border p-4', isCockpit ? 'border-white/10 bg-white/[0.03]' : 'border-card bg-background')}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={(() => {
                          // Preparar dados para o gráfico
                          const datasUnicas = new Map<string, any>()
                          
                          polls.forEach((poll) => {
                            const dateStr = poll.data
                            let formattedDate: string
                            if (dateStr.includes('T')) {
                              formattedDate = new Date(dateStr).toLocaleDateString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit',
                                year: 'numeric'
                              })
                            } else {
                              const [year, month, day] = dateStr.split('-').map(Number)
                              formattedDate = new Date(year, month - 1, day).toLocaleDateString('pt-BR', { 
                                day: '2-digit', 
                                month: '2-digit',
                                year: 'numeric'
                              })
                            }
                            
                            if (!datasUnicas.has(formattedDate)) {
                              datasUnicas.set(formattedDate, {
                                data: formattedDate,
                                dataOriginal: formattedDate,
                              })
                            }
                            
                            const dataObj = datasUnicas.get(formattedDate)
                            const key = `intencao_${poll.candidato_nome.replace(/\s+/g, '_')}`
                            dataObj[key] = poll.intencao
                            dataObj[`instituto_${poll.candidato_nome.replace(/\s+/g, '_')}`] = poll.instituto
                          })
                          
                          return Array.from(datasUnicas.values()).sort((a, b) => {
                            const dateA = new Date(a.dataOriginal.split('/').reverse().join('-'))
                            const dateB = new Date(b.dataOriginal.split('/').reverse().join('-'))
                            return dateA.getTime() - dateB.getTime()
                          })
                        })()} 
                        margin={{ top: 25, right: 100, left: 50, bottom: 50 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          stroke={chartPalette.grid}
                          strokeWidth={1}
                          horizontal={true}
                          vertical={false}
                        />
                        <XAxis
                          dataKey="data"
                          stroke={chartPalette.axis}
                          fontSize={11}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fill: chartPalette.tick, fontWeight: 500 }}
                        />
                        <YAxis
                          domain={[0, 100]}
                          stroke={chartPalette.axis}
                          fontSize={11}
                          tick={{ fill: chartPalette.tick, fontWeight: 500 }}
                          ticks={[0, 20, 40, 60, 80, 100]}
                          label={{
                            value: 'Intenção (%)',
                            angle: -90,
                            position: 'insideLeft',
                            style: {
                              textAnchor: 'middle',
                              fill: chartPalette.label,
                              fontSize: 12,
                              fontWeight: 600,
                            },
                          }}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const items = payload.map((item: any) => {
                                const dataKey = item.dataKey?.toString() || ''
                                const candidatoNome = dataKey.replace('intencao_', '').replace(/_/g, ' ') || ''
                                const institutoKey = `instituto_${dataKey.replace('intencao_', '') || ''}`
                                const instituto = item.payload?.[institutoKey] || ''
                                const valor = item.value
                                
                                return {
                                  candidatoNome,
                                  instituto,
                                  valor,
                                  data: item.payload?.data,
                                  color: item.color || item.stroke || '#666'
                                }
                              }).filter(Boolean).sort((a: any, b: any) => (b.valor || 0) - (a.valor || 0))
                              
                              if (items.length === 0) return null
                              
                              const firstItem = items[0]
                              if (!firstItem) return null
                              return (
                                <div className={cn('rounded-md border p-3 text-xs shadow-lg', isCockpit ? 'border-white/10 bg-[#14222c]' : 'border-card bg-surface')}>
                                  <p className="mb-1 text-xs font-semibold text-text-primary">{firstItem.data}</p>
                                  {firstItem.instituto && (
                                    <p className="mb-2 border-b border-card pb-2 text-xs text-secondary">
                                      {firstItem.instituto}
                                    </p>
                                  )}
                                  <div className="space-y-1.5">
                                    {items.map((item: any, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                          <span className="text-xs font-medium text-text-primary">{item.candidatoNome}</span>
                                        </div>
                                        {item.valor !== undefined && (
                                          <span className="text-xs font-bold text-text-primary">
                                            {item.valor.toFixed(1)}%
                                          </span>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )
                            }
                            return null
                          }}
                        />
                        {(() => {
                          // Obter candidatos únicos
                          const candidatosUnicos = Array.from(new Set(polls.map(p => p.candidato_nome).filter(Boolean)))
                          // Cores sóbrias e profissionais
                          const cores = [
                            '#2C3E50', // Azul escuro
                            '#34495E', // Cinza azulado
                            '#7F8C8D', // Cinza
                            '#16A085', // Verde teal
                            '#8E44AD', // Roxo
                            '#C0392B', // Vermelho escuro
                            '#D68910', // Laranja escuro
                            '#1F618D', // Azul marinho
                            '#117A65', // Verde escuro
                            '#6C3483'  // Roxo escuro
                          ]
                          
                          return candidatosUnicos.map((candidato, index) => {
                            const key = `intencao_${candidato.replace(/\s+/g, '_')}`
                            const cor = cores[index % cores.length]
                            
                            return (
                              <Line
                                key={`line_${candidato}`}
                                type="monotone"
                                dataKey={key}
                                stroke={cor}
                                strokeWidth={2.5}
                                dot={{
                                  r: 3.5,
                                  fill: cor,
                                  strokeWidth: 1.5,
                                  stroke: isDark ? 'rgb(15 23 42)' : '#fff',
                                }}
                                activeDot={{ r: 5.5, stroke: cor, strokeWidth: 2 }}
                                animationDuration={500}
                              >
                                <LabelList
                                  dataKey={key}
                                  position="top"
                                  offset={8}
                                  formatter={(value: number) => value !== undefined && value !== null ? `${value.toFixed(0)}%` : ''}
                                  style={{ 
                                    fill: cor, 
                                    fontSize: '11px', 
                                    fontWeight: 700
                                  }}
                                />
                              </Line>
                            )
                          })
                        })()}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {polls.length === 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-secondary" />
                    <h3 className="text-sm font-semibold text-text-secondary">Pesquisas de Intenção de Voto</h3>
                  </div>
                  <p className={metaTextClass}>Nenhuma pesquisa encontrada para esta cidade</p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className={cn('border-t p-4', isCockpit ? 'border-white/10 bg-white/[0.02]' : 'border-card bg-background')}>
          <button type="button" onClick={onClose} className={sidebarPrimaryCTAButtonClass(isCockpit, 'w-full')}>
            Fechar
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
