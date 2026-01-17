'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { X, Users, FileText, TrendingUp, CheckCircle, Clock, AlertCircle, Loader2, Download } from 'lucide-react'
import { getEleitoradoByCity } from '@/lib/eleitores'
import jsPDF from 'jspdf'

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

  // Função para exportar PDF
  const handleExportPDF = async () => {
    if (!contentRef.current) return

    setExporting(true)
    try {
      const { default: html2canvas } = await import('html2canvas')
      
      // Aguardar um pouco para garantir que o conteúdo está renderizado
      await new Promise(resolve => setTimeout(resolve, 100))
      
      // Configurações para captura completa do conteúdo
      const canvas = await html2canvas(contentRef.current, {
        scale: 1,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: contentRef.current.scrollWidth,
        height: contentRef.current.scrollHeight,
        windowWidth: contentRef.current.scrollWidth,
        windowHeight: contentRef.current.scrollHeight,
      })

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
      <div className="bg-surface rounded-xl border border-border w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-text-strong">Briefing Executivo</h2>
            <p className="text-sm text-text-muted mt-1">{cidade}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              disabled={exporting || loading}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              title="Exportar para PDF"
            >
              <Download className="w-4 h-4" />
              {exporting ? 'Exportando...' : 'Exportar PDF'}
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-background transition-colors"
            >
              <X className="w-5 h-5 text-text-muted" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3" ref={contentRef} style={{ backgroundColor: '#ffffff' }}>
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 text-primary animate-spin" />
              <span className="ml-2 text-sm text-text-muted">Carregando dados...</span>
            </div>
          ) : error ? (
            <div className="p-4 rounded-xl border border-status-error/30 bg-status-error/10">
              <p className="text-sm text-status-error">{error}</p>
            </div>
          ) : (
            <>
              {/* Lideranças */}
              <section>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Users className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-sm font-semibold text-text-strong">Lideranças e Expectativa de Votos</h3>
                </div>
                {liderancasOrdenadas.length === 0 ? (
                  <p className="text-xs text-text-muted">Nenhuma liderança encontrada</p>
                ) : (
                  <div className="space-y-0.5">
                    {expectativaVotosCol && (
                      <div className="p-1.5 rounded bg-primary-soft border border-primary/20 mb-1.5">
                        <p className="text-xs text-text-muted">Total de Expectativa de Votos</p>
                        <p className="text-lg font-bold text-primary">
                          {Math.round(totalExpectativa).toLocaleString('pt-BR')}
                        </p>
                      </div>
                    )}
                    <div className="space-y-0.5">
                      {liderancasOrdenadas.map((lider, idx) => {
                        const expectativa = expectativaVotosCol ? normalizeNumber(lider[expectativaVotosCol]) : 0
                        const nome = nomeCol ? (lider[nomeCol] || 'Sem nome') : 'Sem nome'
                        
                        return (
                          <div key={idx} className="p-1.5 rounded border border-border hover:bg-background/50 transition-colors">
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-text-strong truncate">{nome}</p>
                                {lider.funcao && (
                                  <p className="text-xs text-text-muted truncate">{lider.funcao}</p>
                                )}
                              </div>
                              {expectativa > 0 && (
                                <div className="text-right flex-shrink-0">
                                  <p className="text-xs font-semibold text-primary whitespace-nowrap">
                                    {Math.round(expectativa).toLocaleString('pt-BR')} votos
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}
              </section>

              {/* Demandas */}
              <section>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-primary" />
                  <h3 className="text-sm font-semibold text-text-strong">Demandas por Status</h3>
                </div>
                {demandsOrdenadas.length === 0 ? (
                  <p className="text-xs text-text-muted">Nenhuma demanda encontrada</p>
                ) : (
                  <div className="space-y-1">
                    {demandsOrdenadas.map((demand, idx) => {
                      const status = demand.status || 'Sem status'
                      const statusLower = status.toLowerCase().trim()
                      const isFinalizada = statusLower.includes('resolvido') || statusLower.includes('concluído') || statusLower.includes('concluido') || statusLower.includes('finalizado') || statusLower.includes('finalizada')
                      const isAndamento = statusLower.includes('andamento') || statusLower.includes('progresso') || statusLower.includes('em andamento')
                      
                      return (
                        <div key={idx} className="p-1.5 rounded border border-border hover:bg-background/50 transition-colors">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1 mb-0.5">
                                {isFinalizada ? (
                                  <CheckCircle className="w-3 h-3 text-status-success flex-shrink-0" />
                                ) : isAndamento ? (
                                  <Clock className="w-3 h-3 text-status-warning flex-shrink-0" />
                                ) : (
                                  <AlertCircle className="w-3 h-3 text-text-muted flex-shrink-0" />
                                )}
                                <p className="text-xs font-medium text-text-strong truncate">{demand.title}</p>
                              </div>
                              {demand.description && (
                                <p className="text-xs text-text-muted line-clamp-1">{demand.description}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                <span className={`text-xs px-1 py-0.5 rounded ${
                                  isFinalizada ? 'bg-status-success/10 text-status-success' :
                                  isAndamento ? 'bg-status-warning/10 text-status-warning' :
                                  'bg-text-muted/10 text-text-muted'
                                }`}>
                                  {status}
                                </span>
                                {demand.lideranca && (
                                  <span className="text-xs text-text-muted truncate">{demand.lideranca}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </section>

              {/* Pesquisas de Intenção de Voto */}
              {polls.length > 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-primary" />
                    <h3 className="text-sm font-semibold text-text-strong">Pesquisas de Intenção de Voto</h3>
                  </div>
                  <div className="space-y-1.5">
                    {polls.map((poll) => {
                      const pollEleitorado = getEleitoradoByCity(cidade)
                      const pollVotosProporcionais = pollEleitorado ? Math.round((poll.intencao / 100) * pollEleitorado) : null
                      
                      return (
                        <div key={poll.id} className="p-1.5 rounded border border-border bg-background/50">
                          <div className="flex items-start justify-between mb-1.5">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-text-strong">{poll.instituto}</p>
                              <p className="text-xs text-text-muted">
                                {new Date(poll.data).toLocaleDateString('pt-BR')} • {poll.candidato_nome}
                              </p>
                            </div>
                            <div className="text-right flex-shrink-0 ml-2">
                              <p className="text-sm font-bold text-primary">{poll.intencao.toFixed(1)}%</p>
                              <p className="text-xs text-text-muted">Intenção</p>
                            </div>
                          </div>
                          
                          {/* Dados detalhados (como no popup) */}
                          {pollEleitorado && pollEleitorado > 0 && (
                            <div className="mt-1.5 pt-1.5 border-t border-border space-y-0.5 text-xs">
                              <div className="flex justify-between">
                                <span className="text-text-muted">Eleitorado:</span>
                                <span className="font-medium text-text-strong">{pollEleitorado.toLocaleString('pt-BR')} eleitores</span>
                              </div>
                              {pollVotosProporcionais !== null && (
                                <div className="flex justify-between">
                                  <span className="text-text-muted">Votos Proporcionais:</span>
                                  <span className="font-medium text-text-strong">
                                    {pollVotosProporcionais.toLocaleString('pt-BR')} votos ({poll.intencao.toFixed(1)}% × {pollEleitorado.toLocaleString('pt-BR')})
                                  </span>
                                </div>
                              )}
                              <div className="flex justify-between">
                                <span className="text-text-muted">Rejeição:</span>
                                <span className="font-medium text-status-error">{poll.rejeicao.toFixed(1)}%</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Tipo:</span>
                                <span className="font-medium text-text-strong">
                                  {poll.tipo === 'estimulada' ? 'Estimulada' : 'Espontânea'}
                                </span>
                              </div>
                              <div className="flex justify-between">
                                <span className="text-text-muted">Cargo:</span>
                                <span className="font-medium text-text-strong">
                                  {poll.cargo === 'dep_federal' ? 'Deputado Federal' :
                                   poll.cargo === 'dep_estadual' ? 'Deputado Estadual' :
                                   poll.cargo === 'governador' ? 'Governador' :
                                   poll.cargo === 'senador' ? 'Senador' :
                                   poll.cargo === 'presidente' ? 'Presidente' : poll.cargo}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )}

              {polls.length === 0 && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <TrendingUp className="w-3.5 h-3.5 text-text-muted" />
                    <h3 className="text-sm font-semibold text-text-muted">Pesquisas de Intenção de Voto</h3>
                  </div>
                  <p className="text-xs text-text-muted">Nenhuma pesquisa encontrada para esta cidade</p>
                </section>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-background">
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
