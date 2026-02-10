'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { X, Users, FileText, TrendingUp, CheckCircle, Clock, AlertCircle, Loader2, Download, Copy, Check } from 'lucide-react'
import { getEleitoradoByCity } from '@/lib/eleitores'
import jsPDF from 'jspdf'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, LabelList } from 'recharts'

interface Lideranca {
  [key: string]: any
}

interface Demand {
  id?: string
  title: string
  description?: string
  status?: string
  theme?: string
  priority?: string
  lideranca?: string
  data_demanda?: string
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

export function ExecutiveBriefingModal({
  isOpen,
  onClose,
  cidade,
  liderancas,
  expectativaVotosCol,
  nomeCol,
}: ExecutiveBriefingModalProps) {
  const [demands, setDemands] = useState<Demand[]>([])
  const [polls, setPolls] = useState<Poll[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)

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

  // Buscar demandas da cidade
  const fetchDemands = useCallback(async () => {
    if (!cidade) return []
    
    try {
      const response = await fetch(`/api/campo/demands?cidade=${encodeURIComponent(cidade)}`)
      
      if (!response.ok) {
        throw new Error('Erro ao buscar demandas')
      }

      const data = await response.json()
      return data || []
    } catch (err) {
      console.error('Erro ao buscar demandas:', err)
      return []
    }
  }, [cidade])

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
      
      // Filtrar por cidade - normalizar nome da cidade para comparação
      const normalizedCidade = cidade.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      
      const cidadePolls = allPolls.filter((poll) => {
        const pollCidade = poll.cities?.name || ''
        const normalizedPollCidade = pollCidade.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
        
        return normalizedPollCidade === normalizedCidade || 
               normalizedPollCidade.includes(normalizedCidade) || 
               normalizedCidade.includes(normalizedPollCidade)
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
      setPolls([])
      setError(null)
    }
  }, [isOpen, cidade, fetchDemands, fetchPolls])

  if (!isOpen) return null

  // Ordenar lideranças por expectativa de votos
  const liderancasOrdenadas = [...liderancas].sort((a, b) => {
    const expectativaA = expectativaVotosCol ? normalizeNumber(a[expectativaVotosCol]) : 0
    const expectativaB = expectativaVotosCol ? normalizeNumber(b[expectativaVotosCol]) : 0
    return expectativaB - expectativaA
  })

  // Ordenar demandas: finalizadas primeiro, depois em andamento, depois demais
  const demandsOrdenadas = [...demands].sort((a, b) => {
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

  // Calcular totais
  const totalExpectativa = liderancas.reduce((sum, lider) => {
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

    if (liderancasOrdenadas.length === 0) {
      lines.push(`_Nenhuma liderança cadastrada_`)
    } else {
      liderancasOrdenadas.forEach((lider, idx) => {
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
    lines.push(`📝 *DEMANDAS* (${demandsOrdenadas.length})`)
    lines.push(``)

    if (demandsOrdenadas.length === 0) {
      lines.push(`_Nenhuma demanda registrada_`)
    } else {
      const finalizadas = demandsOrdenadas.filter(d => {
        const s = (d.status || '').toLowerCase()
        return s.includes('resolvido') || s.includes('concluído') || s.includes('concluido') || s.includes('finalizado') || s.includes('finalizada')
      })
      const emAndamento = demandsOrdenadas.filter(d => {
        const s = (d.status || '').toLowerCase()
        return s.includes('andamento') || s.includes('progresso')
      })
      const pendentes = demandsOrdenadas.filter(d => {
        const s = (d.status || '').toLowerCase()
        return !s.includes('resolvido') && !s.includes('concluído') && !s.includes('concluido') && !s.includes('finalizado') && !s.includes('finalizada') && !s.includes('andamento') && !s.includes('progresso')
      })

      if (finalizadas.length > 0) {
        lines.push(`✅ *Concluídas (${finalizadas.length}):*`)
        finalizadas.forEach(d => {
          const lider = d.lideranca ? ` — ${d.lideranca}` : ''
          lines.push(`  • ${d.title}${lider}`)
        })
        lines.push(``)
      }

      if (emAndamento.length > 0) {
        lines.push(`⏳ *Em andamento (${emAndamento.length}):*`)
        emAndamento.forEach(d => {
          const lider = d.lideranca ? ` — ${d.lideranca}` : ''
          lines.push(`  • ${d.title}${lider}`)
        })
        lines.push(``)
      }

      if (pendentes.length > 0) {
        lines.push(`⚪ *Pendentes (${pendentes.length}):*`)
        pendentes.forEach(d => {
          const lider = d.lideranca ? ` — ${d.lideranca}` : ''
          lines.push(`  • ${d.title}${lider}`)
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
      setExporting(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-card w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-card">
          <div>
            <h2 className="text-xl font-semibold text-text-primary">Briefing Executivo</h2>
            <p className="text-sm text-secondary mt-1">{cidade}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyWhatsApp}
              disabled={loading}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                copied
                  ? 'bg-green-600 text-white'
                  : 'bg-green-600 text-white hover:bg-green-700'
              }`}
              title="Copiar briefing formatado para WhatsApp"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'Copiado!' : 'WhatsApp'}
            </button>
            <button
              onClick={handleExportPDF}
              disabled={exporting || loading}
              className="flex items-center gap-2 px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar para PDF"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exportando...' : 'PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-background transition-colors"
            >
              <X className="w-5 h-5 text-secondary" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={contentRef} style={{ backgroundColor: '#ffffff' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-accent-gold animate-spin" />
              <span className="ml-2 text-sm text-secondary">Carregando dados...</span>
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
                  <h3 className="text-sm font-semibold text-text-primary">Lideranças e Expectativa de Votos</h3>
                  {expectativaVotosCol && (
                    <span className="ml-auto text-xs font-bold text-accent-gold">
                      Total: {Math.round(totalExpectativa).toLocaleString('pt-BR')} votos
                    </span>
                  )}
                </div>
                {liderancasOrdenadas.length === 0 ? (
                  <p className="text-xs text-secondary">Nenhuma liderança encontrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-background border-b border-card">
                          <th className="text-left p-1.5 font-semibold text-text-primary">Nome</th>
                          {liderancasOrdenadas.some(l => l.funcao) && (
                            <th className="text-left p-1.5 font-semibold text-text-primary">Função</th>
                          )}
                          {expectativaVotosCol && (
                            <th className="text-right p-1.5 font-semibold text-text-primary">Expectativa de Votos</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {liderancasOrdenadas.map((lider, idx) => {
                          const expectativa = expectativaVotosCol ? normalizeNumber(lider[expectativaVotosCol]) : 0
                          const nome = nomeCol ? (lider[nomeCol] || 'Sem nome') : 'Sem nome'
                          
                          return (
                            <tr key={idx} className="border-b border-card hover:bg-background/50 transition-colors">
                              <td className="p-1.5 text-text-primary">{nome}</td>
                              {liderancasOrdenadas.some(l => l.funcao) && (
                                <td className="p-1.5 text-secondary">{lider.funcao || '-'}</td>
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
                  <h3 className="text-sm font-semibold text-text-primary">Demandas por Status</h3>
                </div>
                {demandsOrdenadas.length === 0 ? (
                  <p className="text-xs text-secondary">Nenhuma demanda encontrada</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="bg-background border-b border-card">
                          <th className="text-left p-1.5 font-semibold text-text-primary">Título</th>
                          <th className="text-left p-1.5 font-semibold text-text-primary">Status</th>
                          {demandsOrdenadas.some(d => d.lideranca) && (
                            <th className="text-left p-1.5 font-semibold text-text-primary">Liderança</th>
                          )}
                          {demandsOrdenadas.some(d => d.data_demanda) && (
                            <th className="text-left p-1.5 font-semibold text-text-primary">Data</th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {demandsOrdenadas.map((demand, idx) => {
                          const status = demand.status || 'Sem status'
                          const statusLower = status.toLowerCase().trim()
                          const isFinalizada = statusLower.includes('resolvido') || statusLower.includes('concluído') || statusLower.includes('concluido') || statusLower.includes('finalizado') || statusLower.includes('finalizada')
                          const isAndamento = statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('em andamento')
                          
                          return (
                            <tr key={idx} className="border-b border-card hover:bg-background/50 transition-colors">
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
                                  <p className="text-secondary mt-0.5 text-xs">{demand.description}</p>
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
                              {demandsOrdenadas.some(d => d.lideranca) && (
                                <td className="p-1.5 text-secondary">{demand.lideranca || '-'}</td>
                              )}
                              {demandsOrdenadas.some(d => d.data_demanda) && (
                                <td className="p-1.5 text-secondary">
                                  {demand.data_demanda ? new Date(demand.data_demanda).toLocaleDateString('pt-BR') : '-'}
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

              {/* Pesquisas de Intenção de Voto */}
              {polls.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-3">
                    <TrendingUp className="w-3.5 h-3.5 text-accent-gold" />
                    <h3 className="text-sm font-semibold text-text-primary">Pesquisas de Intenção de Voto</h3>
                  </div>
                  <div className="h-96 bg-white rounded-lg border border-card p-4">
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
                        <CartesianGrid strokeDasharray="3 3" stroke="#E8E8E8" strokeWidth={1} horizontal={true} vertical={false} />
                        <XAxis 
                          dataKey="data" 
                          stroke="#888888" 
                          fontSize={11}
                          angle={-45}
                          textAnchor="end"
                          height={60}
                          tick={{ fill: '#666666', fontWeight: 500 }}
                        />
                        <YAxis 
                          domain={[0, 100]}
                          stroke="#888888"
                          fontSize={11}
                          tick={{ fill: '#666666', fontWeight: 500 }}
                          ticks={[0, 20, 40, 60, 80, 100]}
                          label={{ 
                            value: 'Intenção (%)', 
                            angle: -90, 
                            position: 'insideLeft',
                            style: { textAnchor: 'middle', fill: '#666666', fontSize: 12, fontWeight: 600 }
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
                                <div className="bg-white border border-gray-200 rounded-md p-3 shadow-lg text-xs">
                                  <p className="text-xs font-semibold text-gray-900 mb-1">{firstItem.data}</p>
                                  {firstItem.instituto && (
                                    <p className="text-xs text-gray-600 mb-2 pb-2 border-b border-gray-200">{firstItem.instituto}</p>
                                  )}
                                  <div className="space-y-1.5">
                                    {items.map((item: any, idx: number) => (
                                      <div key={idx} className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
                                          <span className="text-xs font-medium text-gray-700">{item.candidatoNome}</span>
                                        </div>
                                        {item.valor !== undefined && (
                                          <span className="text-xs font-bold text-gray-900">{item.valor.toFixed(1)}%</span>
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
                                dot={{ r: 3.5, fill: cor, strokeWidth: 1.5, stroke: '#fff' }}
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
                    <h3 className="text-sm font-semibold text-secondary">Pesquisas de Intenção de Voto</h3>
                  </div>
                  <p className="text-xs text-secondary">Nenhuma pesquisa encontrada para esta cidade</p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-card bg-background">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
