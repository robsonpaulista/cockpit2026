'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  MiniMap,
  useNodesState,
  useEdgesState,
  ConnectionMode,
  Panel,
  MarkerType,
} from 'reactflow'
import 'reactflow/dist/style.css'
import { X, Maximize2, Minimize2, ChevronRight, ChevronDown, Expand, Shrink } from 'lucide-react'

interface Lideranca {
  [key: string]: any
}

interface MindMapModalProps {
  isOpen: boolean
  onClose: () => void
  liderancas: Lideranca[]
  candidatoPadrao: string
  cidadeCol: string
  nomeCol: string
  expectativaVotosCol: string | null
}

// Configuração de layout
const LAYOUT = {
  nodeWidth: 160,
  nodeHeight: 50,
  horizontalSpacing: 250,
  verticalSpacing: 70,
  liderancaVerticalSpacing: 50,
  maxLiderancasPerCidade: 6,
}

export function MindMapModal({
  isOpen,
  onClose,
  liderancas,
  candidatoPadrao,
  cidadeCol,
  nomeCol,
  expectativaVotosCol,
}: MindMapModalProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  
  // Estado para controlar expansão
  // 'candidato' expandido mostra cidades
  // 'cidade-X' expandido mostra lideranças daquela cidade
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set())

  // Agrupar lideranças por cidade e ordenar por votos
  const liderancasPorCidade = useMemo(() => {
    const grouped: Record<string, { liderancas: Lideranca[]; totalVotos: number }> = {}
    
    liderancas.forEach((l) => {
      const cidade = l[cidadeCol] || 'Sem Cidade'
      if (!grouped[cidade]) {
        grouped[cidade] = { liderancas: [], totalVotos: 0 }
      }
      grouped[cidade].liderancas.push(l)
      
      if (expectativaVotosCol) {
        const votos = parseFloat(String(l[expectativaVotosCol] || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0
        grouped[cidade].totalVotos += votos
      }
    })
    
    // Ordenar lideranças dentro de cada cidade por votos (decrescente)
    Object.values(grouped).forEach(cityData => {
      cityData.liderancas.sort((a, b) => {
        if (!expectativaVotosCol) return 0
        const votosA = parseFloat(String(a[expectativaVotosCol] || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0
        const votosB = parseFloat(String(b[expectativaVotosCol] || '0').replace(/[^\d.,]/g, '').replace(',', '.')) || 0
        return votosB - votosA
      })
    })
    
    return grouped
  }, [liderancas, cidadeCol, expectativaVotosCol])

  // Ordenar cidades por total de votos (decrescente)
  const cidadesOrdenadas = useMemo(() => {
    return Object.keys(liderancasPorCidade).sort((a, b) => {
      return liderancasPorCidade[b].totalVotos - liderancasPorCidade[a].totalVotos
    })
  }, [liderancasPorCidade])

  // Toggle expansão de um nó
  const toggleNode = useCallback((nodeId: string) => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (next.has(nodeId)) {
        next.delete(nodeId)
        // Se recolher candidato, recolher tudo
        if (nodeId === 'candidato') {
          return new Set()
        }
      } else {
        next.add(nodeId)
      }
      return next
    })
  }, [])

  // Expandir/recolher nível inteiro
  const expandLevel = useCallback((level: 'cidades' | 'liderancas') => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (level === 'cidades') {
        next.add('candidato')
      } else if (level === 'liderancas') {
        next.add('candidato')
        cidadesOrdenadas.forEach((_, index) => {
          next.add(`cidade-${index}`)
        })
      }
      return next
    })
  }, [cidadesOrdenadas])

  const collapseLevel = useCallback((level: 'cidades' | 'liderancas') => {
    setExpandedNodes(prev => {
      const next = new Set(prev)
      if (level === 'liderancas') {
        // Recolher apenas lideranças (manter cidades)
        cidadesOrdenadas.forEach((_, index) => {
          next.delete(`cidade-${index}`)
        })
      } else if (level === 'cidades') {
        // Recolher tudo
        return new Set()
      }
      return next
    })
  }, [cidadesOrdenadas])

  // Verificar estados de expansão
  const isCandidatoExpanded = expandedNodes.has('candidato')
  const allCidadesExpanded = cidadesOrdenadas.every((_, index) => expandedNodes.has(`cidade-${index}`))
  const someCidadesExpanded = cidadesOrdenadas.some((_, index) => expandedNodes.has(`cidade-${index}`))

  // Gerar nós e arestas baseado no estado de expansão
  const { generatedNodes, generatedEdges } = useMemo(() => {
    const nodes: Node[] = []
    const edges: Edge[] = []
    
    const isCandidatoExp = expandedNodes.has('candidato')
    
    // Nó raiz - Candidato (sempre visível)
    nodes.push({
      id: 'candidato',
      type: 'default',
      position: { x: 0, y: 0 },
      data: { 
        label: (
          <div 
            className="flex items-center justify-center gap-2 cursor-pointer select-none"
            onClick={() => toggleNode('candidato')}
          >
            <span>{candidatoPadrao || 'Candidato'}</span>
            <span className="ml-1 opacity-80">
              {isCandidatoExp ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
            </span>
          </div>
        )
      },
      style: {
        background: 'linear-gradient(135deg, #7C2D12 0%, #9A3412 100%)',
        color: 'white',
        border: '3px solid #7C2D12',
        borderRadius: '50%',
        padding: '16px',
        fontSize: '13px',
        fontWeight: 'bold',
        width: 130,
        height: 130,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center' as const,
        boxShadow: '0 8px 32px rgba(124, 45, 18, 0.4)',
        cursor: 'pointer',
      },
    })
    
    // Se candidato não está expandido, retornar apenas ele
    if (!isCandidatoExp) {
      return { generatedNodes: nodes, generatedEdges: edges }
    }
    
    // Calcular posições das cidades
    const numCidades = cidadesOrdenadas.length
    const totalCidadeHeight = numCidades * LAYOUT.verticalSpacing
    const startY = -totalCidadeHeight / 2 + LAYOUT.verticalSpacing / 2
    
    cidadesOrdenadas.forEach((cidade, cidadeIndex) => {
      const cityData = liderancasPorCidade[cidade]
      const cidadeId = `cidade-${cidadeIndex}`
      const isCidadeExpanded = expandedNodes.has(cidadeId)
      
      const cidadeY = startY + (cidadeIndex * LAYOUT.verticalSpacing)
      
      const totalVotosFormatado = cityData.totalVotos > 0 
        ? cityData.totalVotos.toLocaleString('pt-BR') 
        : ''
      
      // Nó da cidade
      nodes.push({
        id: cidadeId,
        type: 'default',
        position: { x: LAYOUT.horizontalSpacing, y: cidadeY },
        data: { 
          label: (
            <div 
              className="text-center cursor-pointer select-none"
              onClick={() => toggleNode(cidadeId)}
            >
              <div className="flex items-center justify-center gap-1">
                <span className="font-bold text-xs leading-tight">{cidade}</span>
                <span className="opacity-80">
                  {isCidadeExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                </span>
              </div>
              <div className="text-[10px] opacity-80 mt-0.5">
                {cityData.liderancas.length} liderança{cityData.liderancas.length > 1 ? 's' : ''}
              </div>
              {totalVotosFormatado && (
                <div className="text-[10px] mt-0.5 font-semibold">
                  🗳️ {totalVotosFormatado}
                </div>
              )}
            </div>
          )
        },
        style: {
          background: 'linear-gradient(135deg, #0F4C75 0%, #1B6CA8 100%)',
          color: 'white',
          border: '2px solid #0F4C75',
          borderRadius: '10px',
          padding: '10px 14px',
          fontSize: '11px',
          minWidth: LAYOUT.nodeWidth,
          boxShadow: '0 4px 16px rgba(15, 76, 117, 0.3)',
          cursor: 'pointer',
        },
      })
      
      // Aresta do candidato para a cidade
      edges.push({
        id: `e-candidato-${cidadeId}`,
        source: 'candidato',
        target: cidadeId,
        type: 'smoothstep',
        style: { 
          stroke: '#0F4C75', 
          strokeWidth: 2,
        },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          color: '#0F4C75',
          width: 15,
          height: 15,
        },
      })
      
      // Se cidade está expandida, mostrar lideranças
      if (isCidadeExpanded) {
        const liderancasExibir = cityData.liderancas.slice(0, LAYOUT.maxLiderancasPerCidade)
        const numLids = liderancasExibir.length
        const hasMore = cityData.liderancas.length > LAYOUT.maxLiderancasPerCidade
        const totalLidItems = numLids + (hasMore ? 1 : 0)
        
        const lidStartY = cidadeY - ((totalLidItems - 1) * LAYOUT.liderancaVerticalSpacing) / 2
        
        liderancasExibir.forEach((lideranca, lidIndex) => {
          const lidId = `lid-${cidadeIndex}-${lidIndex}`
          const nome = lideranca[nomeCol] || 'Sem Nome'
          const votos = expectativaVotosCol && lideranca[expectativaVotosCol]
            ? parseFloat(String(lideranca[expectativaVotosCol]).replace(/[^\d.,]/g, '').replace(',', '.')) || 0
            : 0
          
          const lidY = lidStartY + (lidIndex * LAYOUT.liderancaVerticalSpacing)
          
          nodes.push({
            id: lidId,
            type: 'default',
            position: { x: LAYOUT.horizontalSpacing * 2, y: lidY },
            data: { 
              label: (
                <div className="text-center">
                  <div className="font-medium text-[10px] leading-tight truncate max-w-[130px]">{nome}</div>
                  {votos > 0 && (
                    <div className="text-[9px] text-emerald-600 font-medium mt-0.5">
                      {votos.toLocaleString('pt-BR')} votos
                    </div>
                  )}
                </div>
              )
            },
            style: {
              background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)',
              color: '#0C4A6E',
              border: '1.5px solid #7DD3FC',
              borderRadius: '8px',
              padding: '8px 12px',
              fontSize: '10px',
              minWidth: 110,
              maxWidth: 160,
              boxShadow: '0 2px 8px rgba(14, 165, 233, 0.15)',
            },
          })
          
          edges.push({
            id: `e-${cidadeId}-${lidId}`,
            source: cidadeId,
            target: lidId,
            type: 'smoothstep',
            style: { 
              stroke: '#7DD3FC', 
              strokeWidth: 1.5,
            },
            markerEnd: {
              type: MarkerType.ArrowClosed,
              color: '#7DD3FC',
              width: 12,
              height: 12,
            },
          })
        })
        
        // Indicador de "mais lideranças"
        if (hasMore) {
          const maisId = `mais-${cidadeIndex}`
          const maisY = lidStartY + (numLids * LAYOUT.liderancaVerticalSpacing)
          
          nodes.push({
            id: maisId,
            type: 'default',
            position: { x: LAYOUT.horizontalSpacing * 2, y: maisY },
            data: { 
              label: `+${cityData.liderancas.length - LAYOUT.maxLiderancasPerCidade} mais`
            },
            style: {
              background: '#F1F5F9',
              color: 'rgb(var(--text-muted))',
              border: '1.5px dashed #94A3B8',
              borderRadius: '8px',
              padding: '6px 10px',
              fontSize: '10px',
              minWidth: 80,
            },
          })
          
          edges.push({
            id: `e-${cidadeId}-${maisId}`,
            source: cidadeId,
            target: maisId,
            type: 'smoothstep',
            style: { 
              stroke: '#CBD5E1', 
              strokeWidth: 1,
              strokeDasharray: '5,5',
            },
          })
        }
      }
    })
    
    return { generatedNodes: nodes, generatedEdges: edges }
  }, [expandedNodes, cidadesOrdenadas, liderancasPorCidade, candidatoPadrao, nomeCol, expectativaVotosCol, toggleNode])

  const [nodes, setNodes, onNodesChange] = useNodesState(generatedNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(generatedEdges)

  // Atualizar quando os dados mudarem
  useEffect(() => {
    setNodes(generatedNodes)
    setEdges(generatedEdges)
  }, [generatedNodes, generatedEdges, setNodes, setEdges])

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen((prev) => !prev)
  }, [])

  // Reset ao abrir
  useEffect(() => {
    if (isOpen) {
      setExpandedNodes(new Set())
    }
  }, [isOpen])

  if (!isOpen) return null

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center ${
        isFullscreen ? '' : 'p-4 md:p-8'
      }`}
    >
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className={`relative bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col ${
          isFullscreen 
            ? 'w-full h-full rounded-none' 
            : 'w-full max-w-7xl h-[85vh]'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-slate-800 to-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white">Mapa de Lideranças</h2>
            <p className="text-sm text-white/80">
              {cidadesOrdenadas.length} cidades • {liderancas.length} lideranças
            </p>
          </div>
          
          {/* Controles de Expansão */}
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => expandLevel('cidades')}
                disabled={isCandidatoExpanded && !someCidadesExpanded}
                className="px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Expandir cidades"
              >
                <Expand className="w-3.5 h-3.5" />
                Cidades
              </button>
              <button
                onClick={() => collapseLevel('cidades')}
                disabled={!isCandidatoExpanded}
                className="px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Recolher cidades"
              >
                <Shrink className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="flex items-center gap-1 bg-white/10 rounded-lg p-1">
              <button
                onClick={() => expandLevel('liderancas')}
                disabled={allCidadesExpanded}
                className="px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Expandir lideranças"
              >
                <Expand className="w-3.5 h-3.5" />
                Lideranças
              </button>
              <button
                onClick={() => collapseLevel('liderancas')}
                disabled={!someCidadesExpanded}
                className="px-3 py-1.5 text-xs font-medium text-white hover:bg-white/20 rounded-md transition-colors flex items-center gap-1.5 disabled:opacity-50"
                title="Recolher lideranças"
              >
                <Shrink className="w-3.5 h-3.5" />
              </button>
            </div>
            
            <div className="w-px h-6 bg-white/20" />
            
            <button
              onClick={toggleFullscreen}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
              title={isFullscreen ? 'Sair da tela cheia' : 'Tela cheia'}
            >
              {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/20 hover:bg-white/30 text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        {/* Mapa */}
        <div className="flex-1 bg-gradient-to-br from-slate-50 to-slate-100">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            connectionMode={ConnectionMode.Loose}
            fitView
            fitViewOptions={{ padding: 0.3, minZoom: 0.3, maxZoom: 1.5 }}
            minZoom={0.1}
            maxZoom={2}
            proOptions={{ hideAttribution: true }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
          >
            <Background color="#CBD5E1" gap={24} size={1} />
            <Controls 
              showZoom={true}
              showFitView={true}
              showInteractive={false}
              position="bottom-right"
              style={{ 
                display: 'flex', 
                flexDirection: 'column', 
                gap: '4px',
                background: 'white',
                borderRadius: '8px',
                padding: '4px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            />
            <MiniMap 
              nodeColor={(node) => {
                if (node.id === 'candidato') return '#9A3412'
                if (node.id.startsWith('cidade')) return '#0F4C75'
                if (node.id.startsWith('mais')) return '#94A3B8'
                return '#7DD3FC'
              }}
              maskColor="rgba(0, 0, 0, 0.08)"
              position="bottom-left"
              style={{
                background: 'white',
                borderRadius: '8px',
                boxShadow: '0 2px 8px rgba(0,0,0,0.15)'
              }}
            />
            <Panel position="top-right" className="bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-lg border border-slate-200">
              <div className="text-xs text-slate-600 space-y-2">
                <div className="font-semibold text-slate-800 mb-2">Legenda</div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 rounded-full" style={{ background: 'linear-gradient(135deg, #7C2D12 0%, #9A3412 100%)' }} />
                  <span>Candidato Principal</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded" style={{ background: 'linear-gradient(135deg, #0F4C75 0%, #1B6CA8 100%)' }} />
                  <span>Cidades</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-4 h-3 rounded" style={{ background: 'linear-gradient(135deg, #E0F2FE 0%, #BAE6FD 100%)', border: '1px solid #7DD3FC' }} />
                  <span>Lideranças</span>
                </div>
                <div className="border-t border-slate-200 pt-2 mt-2 text-[10px] text-slate-500">
                  💡 Clique nos nós para expandir/recolher
                </div>
              </div>
            </Panel>
          </ReactFlow>
        </div>
      </div>
    </div>
  )
}
