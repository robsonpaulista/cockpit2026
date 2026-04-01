'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Trash2, Plus, RefreshCw, Check, Printer, Info, Eye, EyeOff, X, Maximize2, Minimize2, ArrowRightLeft, PenSquare, ChevronLeft, ChevronRight } from 'lucide-react'
import jsPDF from 'jspdf'
import { Cenario, CenarioCompleto, PartidoCenario } from '@/lib/chapasService'
import * as chapasFederalService from '@/lib/chapasService'
import * as chapasEstaduaisService from '@/lib/chapas-estaduais-service'
import CenariosTabs from '@/components/cenarios-tabs'
import {
  encontrarPartidoRepublicanos,
  nomePartidoEhRepublicanos,
} from '@/lib/chapas-republicanos-match'
import {
  buildSegundaVagaFeedbackLabel,
  calcularDistanciaProximaVagaPartido,
} from '@/lib/chapas-segunda-vaga-republicanos'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

const coresPartidosFederais = {
  'PT': { cor: 'bg-accent-gold', corTexto: 'text-white' },
  'PSD/MDB': { cor: 'bg-accent-gold-soft', corTexto: 'text-text-primary' },
  'PP': { cor: 'bg-text-secondary', corTexto: 'text-white' },
  'REPUBLICANOS': { cor: 'bg-blue-600', corTexto: 'text-white' },
  REPUB: { cor: 'bg-blue-600', corTexto: 'text-white' },
  'PODEMOS': { cor: 'bg-accent-gold', corTexto: 'text-white' }
}

const coresPartidosEstaduais = {
  'PT': { cor: 'bg-accent-gold', corTexto: 'text-white' },
  'MDB': { cor: 'bg-accent-gold-soft', corTexto: 'text-text-primary' },
  'PP': { cor: 'bg-text-secondary', corTexto: 'text-white' },
  'REPUBLICANOS': { cor: 'bg-blue-600', corTexto: 'text-white' },
  REPUB: { cor: 'bg-blue-600', corTexto: 'text-white' },
}

// Interface para partido local
interface PartidoLocal {
  nome: string
  cor: string
  corTexto: string
  candidatos: Array<{
    nome: string
    votos: number
    genero?: string
  }>
}

// Função para criar estrutura inicial de partidos
const criarPartidosIniciais = (coresPartidosAtivos: Record<string, { cor: string; corTexto: string }>): PartidoLocal[] => {
  return Object.keys(coresPartidosAtivos).map(nome => ({
    nome,
    ...coresPartidosAtivos[nome as keyof typeof coresPartidosAtivos],
    candidatos: []
  }))
}

const NOMES_FEMININOS_COMUNS = [
  'ANA',
  'ANYARA',
  'ALINE',
  'JANAINA',
  'ELIZANGELA',
  'EUZUILA',
  'TERESA',
  'SIMONE',
  'GRACINHA',
  'DRAGA ALANA',
  'RAIMUNDINHA',
  'PASTORA',
  'MELKA',
  'KARLA',
  'DIANA',
  'FIDELIS',
  'GABRIELA',
  'SAMANTA',
  'MARINA',
  'RAISSA',
]

const normalizarNomeGenero = (nome: string) =>
  nome
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()

const inferirGeneroCandidatoInicial = (nome: string, generoInformado?: string): 'homem' | 'mulher' | undefined => {
  if (generoInformado === 'mulher') return 'mulher'
  if (generoInformado === 'homem') return 'homem'

  const nomeNormalizado = normalizarNomeGenero(nome)
  if (nomeNormalizado.includes('MULHER')) return 'mulher'
  if (NOMES_FEMININOS_COMUNS.some((token) => nomeNormalizado.includes(token))) return 'mulher'
  return undefined
}

export default function ChapasPage() {
  const { user } = useAuth()
  const pathname = usePathname()
  const isChapasEstaduais = pathname === '/dashboard/chapas-estaduais'
  const service = isChapasEstaduais ? chapasEstaduaisService : chapasFederalService
  const coresPartidosAtivos = isChapasEstaduais ? coresPartidosEstaduais : coresPartidosFederais
  const ordemPartidosPadrao = isChapasEstaduais
    ? ['PT', 'MDB', 'PP', 'REPUBLICANOS']
    : ['PT', 'PSD/MDB', 'PP', 'REPUBLICANOS', 'PODEMOS']
  const initialQuociente = isChapasEstaduais ? 67000 : 190000
  const initialNumVagas = isChapasEstaduais ? 30 : 10
  const userIdRef = useRef<string | null>(null)
  const [loading, setLoading] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [modoImpressao, setModoImpressao] = useState(false)
  const [exportandoPdf, setExportandoPdf] = useState(false)

  const [partidos, setPartidos] = useState<PartidoLocal[]>(criarPartidosIniciais(coresPartidosAtivos))
  const [quociente, setQuociente] = useState(initialQuociente)
  const [quocienteCarregado, setQuocienteCarregado] = useState(false)
  const [cenarioAtivo, setCenarioAtivo] = useState<CenarioCompleto | null>(null)

  const [editVoto, setEditVoto] = useState<{ partidoIdx: number; candidatoIdx: number } | null>(null)
  const [hoveredRow, setHoveredRow] = useState<{ partidoIdx: number; candidatoIdx: number } | null>(null)
  const [editingName, setEditingName] = useState<{ partidoIdx: number; candidatoIdx: number; tempValue: string } | null>(null)
  const [votosLegenda, setVotosLegenda] = useState<{ [partido: string]: number }>({})

  // Estados para adicionar novo candidato
  const [dialogAberto, setDialogAberto] = useState<number | null>(null)
  const [novoCandidato, setNovoCandidato] = useState({ nome: '', votos: 0, genero: 'homem' as 'homem' | 'mulher' })
  const [salvandoCandidato, setSalvandoCandidato] = useState(false)
  
  // Estados para adicionar novo partido
  const [dialogNovoPartidoAberto, setDialogNovoPartidoAberto] = useState(false)
  const [novoPartido, setNovoPartido] = useState({ nome: '', cor: 'bg-gray-500', corTexto: 'text-white' })
  const [salvandoPartido, setSalvandoPartido] = useState(false)
  const [dialogEditarPartidoAberto, setDialogEditarPartidoAberto] = useState<string | null>(null)
  const [nomePartidoEdicao, setNomePartidoEdicao] = useState('')
  const [salvandoEdicaoPartido, setSalvandoEdicaoPartido] = useState(false)

  // Adicionar estado para edição temporária dos votos de legenda
  const [votosLegendaTemp, setVotosLegendaTemp] = useState<{ [partido: string]: string }>({})
  const [salvandoMudancas, setSalvandoMudancas] = useState(false)
  const [notificacaoAutoSave, setNotificacaoAutoSave] = useState<string | null>(null)
  const [carregandoCenario, setCarregandoCenario] = useState(false)
  const [dadosCarregados, setDadosCarregados] = useState(false)
  const [numVagas, setNumVagas] = useState(initialNumVagas)
  const [openAnaliseRepublicanos, setOpenAnaliseRepublicanos] = useState(false)
  const [mostrarDetalhesSobras, setMostrarDetalhesSobras] = useState(false)
  
  // Estado para gerenciar partidos ocultos
  const [partidosOcultos, setPartidosOcultos] = useState<{ [partidoNome: string]: boolean }>({})
  const [ordemPartidosManual, setOrdemPartidosManual] = useState<{ [partidoNome: string]: number }>({})
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)
  
  // Estado para cenários (compartilhado com CenariosTabs para evitar fetch duplicado)
  const [cenariosLista, setCenariosLista] = useState<Cenario[]>([])
  const [cenariosCarregados, setCenariosCarregados] = useState(false)
  
  // Controle simples de save
  const saveEmAndamentoRef = useRef(false)

  const mostrarNotificacaoAutoSave = (mensagem: string) => {
    setNotificacaoAutoSave(mensagem)
    setTimeout(() => setNotificacaoAutoSave(null), 3000)
  }

  const construirMapaOrdem = <T extends { nome: string }>(listaPartidos: T[]) => {
    const mapa: { [partidoNome: string]: number } = {}
    listaPartidos.forEach((partido, idx) => {
      mapa[partido.nome] = idx + 1
    })
    return mapa
  }

  // Função para alternar visibilidade de partido
  const togglePartidoVisibilidade = (partidoNome: string) => {
    setPartidosOcultos(prev => {
      if (prev[partidoNome]) {
        const proximo = { ...prev }
        delete proximo[partidoNome]
        return proximo
      }

      return {
        ...prev,
        [partidoNome]: true
      }
    })
  }

  // Função para toggle fullscreen
  const toggleFullscreen = async () => {
    try {
      if (!isFullscreen) {
        if (fullscreenRef.current?.requestFullscreen) {
          await fullscreenRef.current.requestFullscreen()
          setIsFullscreen(true)
        }
      } else {
        if (document.fullscreenElement) {
          await document.exitFullscreen()
          setIsFullscreen(false)
        }
      }
    } catch (err) {
      console.error('Erro ao alternar fullscreen:', err)
    }
  }

  // Listener para detectar saída de fullscreen
  useEffect(() => {
    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement)
    }
    document.addEventListener('fullscreenchange', handleFullscreenChange)
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange)
  }, [])

  // Função para carregar dados do cenário base
  const carregarDadosSupabase = async () => {
    try {
      // Tentar carregar do cenário base
      const cenarioBase = await service.carregarCenario('base')
      if (cenarioBase) {
        setCenarioAtivo(cenarioBase)
        const partidosOrdenados = ordenarPartidos(cenarioBase.partidos)
        setPartidos(partidosOrdenados)
        setOrdemPartidosManual(construirMapaOrdem(cenarioBase.partidos))
        if (!quocienteCarregado) {
          setQuociente(cenarioBase.quocienteEleitoral)
          setQuocienteCarregado(true)
        }
        const votosLegendaTemp: { [partido: string]: number } = {}
        cenarioBase.partidos.forEach(partido => {
          if (partido.votosLegenda) {
            votosLegendaTemp[partido.nome] = partido.votosLegenda
          }
        })
        setVotosLegenda(votosLegendaTemp)
        // Sincroniza a barra de cenários (evita "Nenhum cenário encontrado" após criar base)
        const listaAtualizada = await service.listarCenarios()
        setCenariosLista(listaAtualizada)
        setCenariosCarregados(true)
        mostrarNotificacaoAutoSave('Dados carregados com sucesso')
      } else {
        // Se não existe cenário base, criar um com dados iniciais
        const partidosIniciais = criarPartidosIniciais(coresPartidosAtivos)
        // Popular com dados iniciais
        service.dadosIniciais.forEach((item: { partido: string; nome: string; votos: number; genero?: string }) => {
          const partido = partidosIniciais.find(p => p.nome === item.partido)
          if (partido) {
            partido.candidatos.push({
              nome: item.nome,
              votos: item.votos,
              genero: inferirGeneroCandidatoInicial(item.nome, item.genero)
            })
          }
        })
        const partidosConvertidos: PartidoCenario[] = partidosIniciais.map(p => ({
          nome: p.nome,
          cor: p.cor,
          corTexto: p.corTexto,
          candidatos: p.candidatos,
          votosLegenda: 0
        }))
        await service.criarCenarioBase(partidosConvertidos, initialQuociente)
        await carregarDadosSupabase()
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido'
      console.error('Erro ao carregar dados:', error)
      alert(`Erro ao carregar dados: ${errorMessage}. Verifique se as tabelas foram criadas no banco de dados.`)
    }
  }

  // Estado para erro de carregamento (permite retry)
  const [erroCarregamento, setErroCarregamento] = useState<string | null>(null)
  const carregandoRef = useRef(false)

  // Função de carregamento com retry automático
  const carregarDadosIniciais = async (tentativa: number = 1) => {
    if (carregandoRef.current) return
    carregandoRef.current = true
    setErroCarregamento(null)
    
    // Garantir cache do userId em TODA tentativa (ref sobrevive a closures)
    if (userIdRef.current) {
      service.preWarmUserIdCache(userIdRef.current)
    }
    
    try {
      console.log(`[Chapas] Carregando dados... (tentativa ${tentativa})`)
      
      // Uma única chamada que busca cenários + cenário ativo com partidos
      const { cenarios: listaCenarios, cenarioAtivo: cenarioAtivoData } = await service.listarCenariosComAtivo()
      
      console.log(`[Chapas] Dados carregados: ${listaCenarios.length} cenários`)
      
      // Compartilhar cenários com CenariosTabs (evita fetch duplicado)
      setCenariosLista(listaCenarios)
      setCenariosCarregados(true)
      setDadosCarregados(true)
      
      if (cenarioAtivoData) {
        setCenarioAtivo(cenarioAtivoData)
        const partidosOrdenados = ordenarPartidos(cenarioAtivoData.partidos)
        setPartidos(partidosOrdenados)
        setOrdemPartidosManual(construirMapaOrdem(cenarioAtivoData.partidos))
        setQuociente(cenarioAtivoData.quocienteEleitoral)
        setQuocienteCarregado(true)
        
        const votosLegendaTemp: { [partido: string]: number } = {}
        cenarioAtivoData.partidos.forEach(partido => {
          if (partido.votosLegenda) {
            votosLegendaTemp[partido.nome] = partido.votosLegenda
          }
        })
        setVotosLegenda(votosLegendaTemp)
      } else {
        // Se não há cenário ativo, carregar o cenário base
        await carregarDadosSupabase()
      }
    } catch (error: unknown) {
      const err = error as Error
      const errorMessage = err?.message || 'Erro desconhecido'
      console.error(`[Chapas] Erro na tentativa ${tentativa}:`, errorMessage)
      
      // Retry automático (até 2 tentativas)
      if (tentativa < 2) {
        console.log(`[Chapas] Retry automático em 1s...`)
        carregandoRef.current = false
        await new Promise(resolve => setTimeout(resolve, 1000))
        return carregarDadosIniciais(tentativa + 1)
      }
      
      // Após 2 tentativas, mostrar erro com opção de retry manual
      setErroCarregamento(errorMessage)
    } finally {
      carregandoRef.current = false
    }
  }

  // Manter ref do userId sempre atualizado (sobrevive a closures e retries)
  useEffect(() => {
    if (user?.id) {
      userIdRef.current = user.id
      service.preWarmUserIdCache(user.id)
    }
  }, [user?.id])

  // Carregar dados do Supabase ao abrir a página (só quando user estiver disponível)
  useEffect(() => {
    if (dadosCarregados) return
    if (!user?.id) return
    carregarDadosIniciais()
  }, [dadosCarregados, user?.id])

  // Função para ordenar partidos na ordem fixa
  const ordenarPartidos = <T extends { nome: string }>(partidosParaOrdenar: T[]): T[] => {
    const indexMap = new Map<string, number>()
    partidosParaOrdenar.forEach((partido, index) => {
      indexMap.set(partido.nome, index)
    })

    const resolverOrdem = (nome: string) => {
      const manual = ordemPartidosManual[nome]
      if (typeof manual === 'number' && Number.isFinite(manual) && manual > 0) {
        return manual
      }

      const idxPadrao = ordemPartidosPadrao.indexOf(nome)
      if (idxPadrao >= 0) return idxPadrao + 1

      const idxAtual = indexMap.get(nome) ?? 0
      return ordemPartidosPadrao.length + idxAtual + 1
    }

    return [...partidosParaOrdenar].sort((a, b) => {
      const ordemA = resolverOrdem(a.nome)
      const ordemB = resolverOrdem(b.nome)
      if (ordemA !== ordemB) return ordemA - ordemB

      const idxA = indexMap.get(a.nome) ?? 0
      const idxB = indexMap.get(b.nome) ?? 0
      return idxA - idxB
    })
  }

  const handleMoverPartido = (partidoNome: string, direcao: 'esquerda' | 'direita') => {
    const nomesOrdenados = ordenarPartidos(partidos).map((partido) => partido.nome)
    const indiceAtual = nomesOrdenados.findIndex((nome) => nome === partidoNome)
    if (indiceAtual < 0) return

    const delta = direcao === 'esquerda' ? -1 : 1
    const indiceDestino = indiceAtual + delta
    if (indiceDestino < 0 || indiceDestino >= nomesOrdenados.length) return

    const [movido] = nomesOrdenados.splice(indiceAtual, 1)
    nomesOrdenados.splice(indiceDestino, 0, movido)

    const novaOrdem: { [partidoNome: string]: number } = {}
    nomesOrdenados.forEach((nome, idx) => {
      novaOrdem[nome] = idx + 1
    })

    setOrdemPartidosManual(novaOrdem)
  }

  const partidosOcultosLista = ordenarPartidos(partidos)
    .filter(partido => partidosOcultos[partido.nome])
    .map(partido => partido.nome)

  const mostrarTodosPartidos = () => {
    setPartidosOcultos({})
  }

  // Função para converter partidos para o formato do cenário
  const converterPartidosParaCenario = (): PartidoCenario[] => {
    const partidosOrdenados = ordenarPartidos(partidos)
    return partidosOrdenados.map(partido => ({
      nome: partido.nome,
      cor: partido.cor,
      corTexto: partido.corTexto,
      candidatos: partido.candidatos
        .filter(c => c.nome !== 'VOTOS LEGENDA')
        .map(c => ({
          nome: c.nome,
          votos: c.votos,
          genero: (c as any).genero
        })),
      votosLegenda: votosLegenda[partido.nome] || 0
    }))
  }

  // Função para salvar mudanças no cenário ativo (simples e direta)
  const salvarMudancasCenario = async () => {
    if (!cenarioAtivo) {
      alert('Nenhum cenário ativo encontrado. Tente selecionar um cenário primeiro.')
      return
    }
    
    // Evitar duplo-clique
    if (saveEmAndamentoRef.current) return
    saveEmAndamentoRef.current = true
    setSalvandoMudancas(true)
    
    // Garantir cache do userId antes de salvar
    if (userIdRef.current) service.preWarmUserIdCache(userIdRef.current)
    
    try {
      const partidosConvertidos = converterPartidosParaCenario()
      await service.atualizarCenario(cenarioAtivo.id, partidosConvertidos, quociente)
      
      setCenarioAtivo(prev => prev ? { ...prev, atualizadoEm: new Date().toISOString(), quocienteEleitoral: quociente } : null)
      mostrarNotificacaoAutoSave(`Mudanças salvas no cenário "${cenarioAtivo.nome}"`)
    } catch (error: unknown) {
      const err = error as Error
      if (err?.message?.includes('Timeout')) {
        alert('O salvamento demorou muito. Verifique sua conexão e tente novamente.')
      } else {
        alert('Erro ao salvar mudanças. Tente novamente.')
      }
    } finally {
      saveEmAndamentoRef.current = false
      setSalvandoMudancas(false)
    }
  }

  // Função para atualizar apenas o estado local
  const updateLocalState = (partidoIdx: number, candidatoIdx: number, field: 'nome' | 'votos', value: string) => {
    setPartidos(prev => prev.map((p, i) => {
      if (i !== partidoIdx) return p
      const candidatos = p.candidatos.map((c, idx) => {
        if (idx !== candidatoIdx) return c
        if (field === 'nome') {
          return { ...c, nome: value }
        }
        let votos = parseInt(value.replace(/\D/g, ''), 10) || 0
        if (votos < 0) votos = 0
        return { ...c, votos }
      })
      return { ...p, candidatos }
    }))
  }

  // Função para iniciar edição de nome
  const startEditingName = (partidoIdx: number, candidatoIdx: number) => {
    const candidato = partidos[partidoIdx]?.candidatos[candidatoIdx]
    if (candidato) {
      setEditingName({ partidoIdx, candidatoIdx, tempValue: candidato.nome })
      setHoveredRow({ partidoIdx, candidatoIdx })
    }
  }

  // Função para salvar nome (só atualiza estado local + agenda auto-save)
  const saveNameChange = (partidoIdx: number, candidatoIdx: number) => {
    if (!editingName || editingName.partidoIdx !== partidoIdx || editingName.candidatoIdx !== candidatoIdx) {
      setEditingName(null)
      setHoveredRow(null)
      return
    }

    const oldNome = partidos[partidoIdx]?.candidatos[candidatoIdx]?.nome ?? ''
    const newNome = editingName.tempValue.trim()
    
    if (newNome && newNome !== oldNome) {
      setPartidos(prev => prev.map((p, i) => {
        if (i !== partidoIdx) return p
        return {
          ...p,
          candidatos: p.candidatos.map((c, idx) => idx === candidatoIdx ? { ...c, nome: newNome } : c)
        }
      }))
    }
    
    setEditingName(null)
    setHoveredRow(null)
  }

  // Função para salvar votos (só atualiza estado local - salva via botão "Salvar Mudanças")
  const saveVotosChange = (partidoIdx: number, candidatoIdx: number, votos: number) => {
    setPartidos(prev => prev.map((p, i) => {
      if (i !== partidoIdx) return p
      return {
        ...p,
        candidatos: p.candidatos.map((c, idx) => idx === candidatoIdx ? { ...c, votos } : c)
      }
    }))
  }

  // Soma dos votos e cálculo da projeção
  const getVotosProjetados = (candidatos: { votos: number; nome: string }[], partidoNome: string) => {
    const votosLegendaPartido = votosLegenda[partidoNome] || 0
    return candidatos
      .filter(c => c.nome !== 'VOTOS LEGENDA')
      .reduce((acc, c) => acc + c.votos, 0) + votosLegendaPartido
  }

  // Calcular 80% do Quociente Eleitoral
  const getQuocienteMinimo = () => {
    return quociente * 0.8
  }

  // Verificar se partido atingiu o mínimo de 80% do quociente
  const partidoAtingiuMinimo = (partidoNome: string) => {
    const votosProjetados = getVotosProjetados(
      partidos.find(p => p.nome === partidoNome)?.candidatos || [], 
      partidoNome
    )
    const quocienteMinimo = getQuocienteMinimo()
    return votosProjetados >= quocienteMinimo
  }

  const getProjecaoEleitos = (votosTotal: number) => (votosTotal / quociente).toFixed(2)

  const feedbackSegundaVagaPorPartido = useMemo(() => {
    const rows = partidos.map((partido) => ({
      nome: partido.nome,
      votosTotal: getVotosProjetados(partido.candidatos, partido.nome),
      atingiuMinimo: partidoAtingiuMinimo(partido.nome),
    }))
    const escopo = isChapasEstaduais ? 'estadual' : 'federal'
    const mapa: Record<string, NonNullable<ReturnType<typeof buildSegundaVagaFeedbackLabel>>> = {}
    for (const p of partidos) {
      const raw = calcularDistanciaProximaVagaPartido(rows, quociente, numVagas, (nome) => nome === p.nome)
      const label = buildSegundaVagaFeedbackLabel(raw, {
        escopo,
        simulacao: {
          partidosRows: rows,
          quociente,
          numVagas,
          nomePartidoAlvo: p.nome,
        },
      })
      if (label) mapa[p.nome] = label
    }
    return mapa
  }, [partidos, votosLegenda, quociente, numVagas, isChapasEstaduais])

  // Calcular vagas diretas
  const calcularVagasDiretas = (votosTotal: number) => {
    return Math.floor(votosTotal / quociente)
  }

  // MÉTODO D'HONDT CORRETO
  const calcularDistribuicaoDHondt = () => {
    const VAGAS_TOTAIS = numVagas
    
    const partidosElegiveis = partidos.filter(partido => partidoAtingiuMinimo(partido.nome))
    
    const partidosComVagas = partidosElegiveis.map(partido => {
      const votosTotal = getVotosProjetados(partido.candidatos, partido.nome)
      const vagasDiretas = calcularVagasDiretas(votosTotal)
      
      return {
        partido: partido.nome,
        votosTotal,
        vagasObtidas: vagasDiretas,
        vagasDiretas: vagasDiretas
      }
    })
    
    const vagasDistribuidas = partidosComVagas.reduce((total, p) => total + p.vagasObtidas, 0)
    const vagasRestantes = VAGAS_TOTAIS - vagasDistribuidas
    
    const historicoSobras = []
    
    for (let i = 0; i < vagasRestantes; i++) {
      const quocientesPartidarios = partidosComVagas.map(p => ({
        partido: p.partido,
        quocientePartidario: p.votosTotal / (p.vagasObtidas + 1)
      }))
      
      quocientesPartidarios.sort((a, b) => b.quocientePartidario - a.quocientePartidario)
      
      const ganhador = quocientesPartidarios[0]
      
      if (ganhador && ganhador.partido) {
        historicoSobras.push({
          rodada: i + 1,
          partido: ganhador.partido,
          quocientePartidario: ganhador.quocientePartidario,
          vaga: vagasDistribuidas + i + 1
        })
        
        const partidoGanhador = partidosComVagas.find(p => p.partido === ganhador.partido)
        if (partidoGanhador) {
          partidoGanhador.vagasObtidas++
        }
      } else {
        break
      }
    }
    
    return {
      partidosComVagas,
      vagasDistribuidas,
      vagasRestantes,
      historicoSobras,
      totalVagas: VAGAS_TOTAIS
    }
  }

  // Calcular sobras
  const calcularSobras = () => {
    const partidosElegiveis = partidos.filter(partido => partidoAtingiuMinimo(partido.nome) && !partidosOcultos[partido.nome])
    
    const resultados = partidos
      .filter(partido => !partidosOcultos[partido.nome])
      .map(partido => {
        const votosTotal = getVotosProjetados(partido.candidatos, partido.nome)
        const vagasDiretas = calcularVagasDiretas(votosTotal)
        const divisao = votosTotal / quociente
        const atingiuMinimo = partidoAtingiuMinimo(partido.nome)
        
        const quocientePartidario = atingiuMinimo ? votosTotal / (vagasDiretas + 1) : 0
        
        return {
          partido: partido.nome,
          votosTotal,
          vagasDiretas,
          sobra: quocientePartidario,
          divisao,
          projecaoEleitos: divisao.toFixed(2),
          atingiuMinimo,
          quocientePartidario
        }
      })

    const ordenadosPorSobras = resultados
      .filter(r => r.atingiuMinimo && r.quocientePartidario !== undefined)
      .sort((a, b) => (b.quocientePartidario || 0) - (a.quocientePartidario || 0))
    
    return {
      resultados,
      ordenadosPorSobras,
      maiorSobra: ordenadosPorSobras[0]?.quocientePartidario || 0
    }
  }

  // Simular distribuição completa
  const simularDistribuicaoCompleta = () => {
    return calcularDistribuicaoDHondt()
  }

  // Função genérica para separar candidatos por gênero
  const separarCandidatosPorGenero = (candidatos: { nome: string; votos: number; genero?: string }[]) => {
    const candidatosFiltrados = candidatos.filter(c => c.nome !== 'VOTOS LEGENDA')
    
    const homens = candidatosFiltrados
      .filter(c => c.genero !== 'mulher')
      .sort((a, b) => b.votos - a.votos)
    
    const mulheres = candidatosFiltrados
      .filter(c => c.genero === 'mulher')
      .sort((a, b) => b.votos - a.votos)
    
    return { homens, mulheres }
  }

  // Funções específicas
  const separarCandidatosPT = (candidatos: { nome: string; votos: number; genero?: string }[]) => {
    return separarCandidatosPorGenero(candidatos)
  }

  const separarCandidatosPSDMDB = (candidatos: { nome: string; votos: number; genero?: string }[]) => {
    return separarCandidatosPorGenero(candidatos)
  }

  const separarCandidatosPP = (candidatos: { nome: string; votos: number; genero?: string }[]) => {
    return separarCandidatosPorGenero(candidatos)
  }

  const separarCandidatosRepublicanos = (candidatos: { nome: string; votos: number; genero?: string }[]) => {
    return separarCandidatosPorGenero(candidatos)
  }

  const separarCandidatosPodemos = (candidatos: { nome: string; votos: number; genero?: string }[]) => {
    return separarCandidatosPorGenero(candidatos)
  }

  // Função para excluir candidato
  const handleExcluirCandidato = async (partidoIdx: number, candidatoIdx: number) => {
    try {
      if (!cenarioAtivo) {
        throw new Error('Cenário base não encontrado')
      }
      
      setPartidos(prev => prev.map((p, i) => {
        if (i !== partidoIdx) return p
        return {
          ...p,
          candidatos: p.candidatos.filter((_, idx) => idx !== candidatoIdx)
        }
      }))

      const partidosConvertidos = converterPartidosParaCenario()
      await service.atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)
      mostrarNotificacaoAutoSave('Candidato excluído com sucesso')
    } catch (error) {
      await carregarDadosSupabase()
      alert('Candidato não encontrado. Dados foram recarregados automaticamente.')
    }
  }

  // Função para excluir partido completo
  const handleExcluirPartido = async (partidoNome: string) => {
    try {
      if (!cenarioAtivo) {
        throw new Error('Cenário base não encontrado')
      }
      
      setPartidos(prev => prev.filter(p => p.nome !== partidoNome))
      setOrdemPartidosManual(prev => {
        const proximo = { ...prev }
        delete proximo[partidoNome]
        return proximo
      })
      
      setVotosLegenda(prev => {
        const novo = { ...prev }
        delete novo[partidoNome]
        return novo
      })

      const partidosConvertidos = converterPartidosParaCenario().filter(p => p.nome !== partidoNome)
      await service.atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)
      mostrarNotificacaoAutoSave(`Partido ${partidoNome} excluído com sucesso`)
    } catch (error) {
      await carregarDadosSupabase()
      alert('Erro ao excluir partido. Dados foram recarregados automaticamente.')
    }
  }

  // Função para adicionar novo partido
  const handleAdicionarPartido = async () => {
    if (!novoPartido.nome.trim()) {
      alert('Por favor, digite o nome do partido')
      return
    }

    const partidoExistente = partidos.find(p => p.nome === novoPartido.nome)
    if (partidoExistente) {
      alert('Este partido já existe!')
      return
    }

    setSalvandoPartido(true)
    
    try {
      if (!cenarioAtivo) {
        throw new Error('Cenário base não encontrado')
      }
      
      const novoPartidoObj: PartidoLocal = {
        nome: novoPartido.nome,
        cor: novoPartido.cor,
        corTexto: novoPartido.corTexto,
        candidatos: []
      }
      
      const partidosAtualizados = [...partidos, novoPartidoObj]
      const partidosOrdenados = ordenarPartidos(partidosAtualizados)
      const partidosConvertidos = partidosOrdenados.map(partido => ({
        nome: partido.nome,
        cor: partido.cor,
        corTexto: partido.corTexto,
        candidatos: partido.candidatos.map(c => ({
          nome: c.nome,
          votos: c.votos,
          genero: (c as any).genero
        })),
        votosLegenda: votosLegenda[partido.nome] || 0
      }))
      
      setPartidos(partidosAtualizados)
      setOrdemPartidosManual(construirMapaOrdem(ordenarPartidos(partidosAtualizados)))
      
      await service.atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)
      
      setNovoPartido({ nome: '', cor: 'bg-gray-500', corTexto: 'text-white' })
      setDialogNovoPartidoAberto(false)
      
      mostrarNotificacaoAutoSave(`Partido ${novoPartido.nome} adicionado com sucesso`)
    } catch (error) {
      await carregarDadosSupabase()
      alert('Erro ao adicionar partido. Dados foram recarregados automaticamente.')
    } finally {
      setSalvandoPartido(false)
    }
  }

  const handleAbrirEditarPartido = (nomeAtual: string) => {
    setDialogEditarPartidoAberto(nomeAtual)
    setNomePartidoEdicao(nomeAtual)
  }

  const handleSalvarEdicaoPartido = () => {
    if (!dialogEditarPartidoAberto) return

    const nomeAtual = dialogEditarPartidoAberto
    const novoNome = nomePartidoEdicao.trim()

    if (!novoNome) {
      alert('Digite um nome válido para o partido.')
      return
    }

    if (novoNome === nomeAtual) {
      setDialogEditarPartidoAberto(null)
      setNomePartidoEdicao('')
      return
    }

    const duplicado = partidos.some(
      (p) => p.nome.toUpperCase() === novoNome.toUpperCase() && p.nome !== nomeAtual
    )
    if (duplicado) {
      alert('Já existe um partido com esse nome.')
      return
    }

    const partidosAtualizados = partidos.map((partido) =>
      partido.nome === nomeAtual ? { ...partido, nome: novoNome } : partido
    )

    const votosLegendaAtualizados = { ...votosLegenda }
    if (Object.prototype.hasOwnProperty.call(votosLegendaAtualizados, nomeAtual)) {
      votosLegendaAtualizados[novoNome] = votosLegendaAtualizados[nomeAtual]
      delete votosLegendaAtualizados[nomeAtual]
    }

    const votosLegendaTempAtualizados = { ...votosLegendaTemp }
    if (Object.prototype.hasOwnProperty.call(votosLegendaTempAtualizados, nomeAtual)) {
      votosLegendaTempAtualizados[novoNome] = votosLegendaTempAtualizados[nomeAtual]
      delete votosLegendaTempAtualizados[nomeAtual]
    }

    const partidosOcultosAtualizados = { ...partidosOcultos }
    if (Object.prototype.hasOwnProperty.call(partidosOcultosAtualizados, nomeAtual)) {
      partidosOcultosAtualizados[novoNome] = partidosOcultosAtualizados[nomeAtual]
      delete partidosOcultosAtualizados[nomeAtual]
    }

    setPartidos(partidosAtualizados)
    setOrdemPartidosManual(prev => {
      const proximo = { ...prev }
      const ordemAtual = proximo[nomeAtual]
      delete proximo[nomeAtual]
      if (typeof ordemAtual === 'number' && Number.isFinite(ordemAtual)) {
        proximo[novoNome] = ordemAtual
      }
      return proximo
    })
    setVotosLegenda(votosLegendaAtualizados)
    setVotosLegendaTemp(votosLegendaTempAtualizados)
    setPartidosOcultos(partidosOcultosAtualizados)

    setDialogEditarPartidoAberto(null)
    setNomePartidoEdicao('')
    mostrarNotificacaoAutoSave(`Nome alterado para ${novoNome}. Clique em "Salvar Mudanças" para persistir.`)
  }

  // Função para adicionar novo candidato
  const handleAdicionarCandidato = async (partidoIdx: number) => {
    if (!novoCandidato.nome.trim()) {
      alert('Por favor, digite o nome do candidato')
      return
    }

    setSalvandoCandidato(true)
    const partido = partidos[partidoIdx]
    
    try {
      const candidatoExistente = partido.candidatos.find(c => c.nome === novoCandidato.nome)
      if (candidatoExistente) {
        alert('Este candidato já existe no partido!')
        return
      }

      if (!cenarioAtivo) {
        throw new Error('Cenário base não encontrado')
      }
      
      setPartidos(prev => prev.map((p, i) => {
        if (i !== partidoIdx) return p
        
        const candidatosAtuais = [...p.candidatos]
        
        const candidatoComGenero = { 
          nome: novoCandidato.nome, 
          votos: novoCandidato.votos,
          genero: novoCandidato.genero 
        }
        
        if (novoCandidato.genero === 'mulher') {
          const ultimaMulherIndex = candidatosAtuais.findLastIndex(c => c.genero === 'mulher')
          
          if (ultimaMulherIndex === -1) {
            candidatosAtuais.push(candidatoComGenero)
          } else {
            candidatosAtuais.splice(ultimaMulherIndex + 1, 0, candidatoComGenero)
          }
        } else {
          const primeiraMulherIndex = candidatosAtuais.findIndex(c => c.genero === 'mulher')
          
          if (primeiraMulherIndex === -1) {
            candidatosAtuais.push(candidatoComGenero)
          } else {
            candidatosAtuais.splice(primeiraMulherIndex, 0, candidatoComGenero)
          }
        }
        
        return {
          ...p,
          candidatos: candidatosAtuais
        }
      }))

      const partidosConvertidos = converterPartidosParaCenario()
      await service.atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)

      setNovoCandidato({ nome: '', votos: 0, genero: 'homem' })
      setDialogAberto(null)
      
      mostrarNotificacaoAutoSave('Candidato adicionado com sucesso')
    } catch (error) {
      alert('Erro ao adicionar candidato. Tente novamente.')
    } finally {
      setSalvandoCandidato(false)
    }
  }

  // Função para verificar se o candidato atingiu 20% do quociente
  const candidatoAtingiuMinimo = (votos: number) => {
    return votos >= (quociente * 0.2)
  }

  // Função para calcular os candidatos eleitos
  const calcularCandidatosEleitos = () => {
    try {
      const simulacao = simularDistribuicaoCompleta()
      const candidatosEleitos: Array<{
        partido: string
        nome: string
        votos: number
        posicao: number
        tipoEleicao: 'direta' | 'sobra'
        atingiuMinimo: boolean
      }> = []

      if (!simulacao || !simulacao.partidosComVagas) {
        return []
      }

      simulacao.partidosComVagas.forEach(partidoInfo => {
        if (!partidoInfo || !partidoInfo.partido || typeof partidoInfo.vagasObtidas !== 'number') {
          return
        }

        const partido = partidos.find(p => p.nome === partidoInfo.partido)
        if (!partido || partidoInfo.vagasObtidas === 0) return

        const candidatosValidos = partido.candidatos.filter(c => c.nome !== 'VOTOS LEGENDA')
        
        const candidatosComMinimo = candidatosValidos.filter(c => candidatoAtingiuMinimo(c.votos))
        const candidatosSemMinimo = candidatosValidos.filter(c => !candidatoAtingiuMinimo(c.votos))
        
        const candidatosComMinimoOrdenados = [...candidatosComMinimo].sort((a, b) => b.votos - a.votos)
        const candidatosSemMinimoOrdenados = [...candidatosSemMinimo].sort((a, b) => b.votos - a.votos)
        
        let candidatosSelecionados: Array<{candidato: any, atingiuMinimo: boolean}> = []
        
        for (let i = 0; i < partidoInfo.vagasObtidas && i < candidatosComMinimoOrdenados.length; i++) {
          candidatosSelecionados.push({
            candidato: candidatosComMinimoOrdenados[i],
            atingiuMinimo: true
          })
        }
        
        const vagasRestantes = partidoInfo.vagasObtidas - candidatosSelecionados.length
        if (vagasRestantes > 0) {
          for (let i = 0; i < vagasRestantes && i < candidatosSemMinimoOrdenados.length; i++) {
            candidatosSelecionados.push({
              candidato: candidatosSemMinimoOrdenados[i],
              atingiuMinimo: false
            })
          }
        }
        
        candidatosSelecionados.forEach((selecao, index) => {
          const candidato = selecao.candidato
          if (candidato && candidato.nome) {
            candidatosEleitos.push({
              partido: partido.nome,
              nome: candidato.nome,
              votos: candidato.votos || 0,
              posicao: index + 1,
              tipoEleicao: index < calcularVagasDiretas(partidoInfo.votosTotal || 0) ? 'direta' : 'sobra',
              atingiuMinimo: selecao.atingiuMinimo
            })
          }
        })
      })

      return candidatosEleitos.sort((a, b) => {
        if (a.partido !== b.partido) return a.partido.localeCompare(b.partido)
        return b.votos - a.votos
      })
    } catch (error) {
      return []
    }
  }

  // Análise simples do Republicanos (REPUBLICANOS, REPUB, coligações)
  const analisarRepublicanos = () => {
    const partido = encontrarPartidoRepublicanos(partidos)
    const partidoNome = partido?.nome ?? 'REPUBLICANOS'
    const votos = partido ? getVotosProjetados(partido.candidatos, partido.nome) : 0
    const minimo80 = getQuocienteMinimo()
    const atingiuMinimo = votos >= minimo80
    const vagasDiretas = calcularVagasDiretas(votos)

    const simulacao = simularDistribuicaoCompleta()
    const infoPartidoSim = simulacao.partidosComVagas.find((p) =>
      nomePartidoEhRepublicanos(p.partido)
    )
    const vagasTotaisPrevistas = infoPartidoSim?.vagasObtidas || 0
    const vagasSobra = vagasTotaisPrevistas - vagasDiretas

    const cenarios = {
      atual: {
        votos,
        vagasDiretas,
        vagasSobra,
        vagasTotais: vagasTotaisPrevistas,
        elegivel: atingiuMinimo
      }
    }

    const riscos: Array<{
      partido: string
      votosAtuais: number
      deltaParaDireta: number
      deltaParaSobra: number
      deltaMinimo: number
      elegivel: boolean
    }> = []
    const adversarios = partidos.filter((p) => !nomePartidoEhRepublicanos(p.nome))

    adversarios.forEach(adversario => {
      const votosAdv = getVotosProjetados(adversario.candidatos, adversario.nome)
      const vagasDiretasAdv = calcularVagasDiretas(votosAdv)
      const minimo80Adv = getQuocienteMinimo()
      const atingiuMinimoAdv = votosAdv >= minimo80Adv

      const deltaParaDireta = Math.max(0, Math.ceil(quociente - votosAdv))

      let deltaParaSobra = Infinity
      if (atingiuMinimoAdv && vagasSobra > 0) {
        const qRepublicanos = votos / (vagasDiretas + 1)
        const qAdversario = votosAdv / (vagasDiretasAdv + 1)
        if (qAdversario < qRepublicanos) {
          deltaParaSobra = Math.max(0, Math.ceil(qRepublicanos * (vagasDiretasAdv + 1) - votosAdv))
        } else {
          deltaParaSobra = 0
        }
      }

      riscos.push({
        partido: adversario.nome,
        votosAtuais: votosAdv,
        deltaParaDireta,
        deltaParaSobra,
        deltaMinimo: Math.min(deltaParaDireta, deltaParaSobra),
        elegivel: atingiuMinimoAdv
      })
    })

    riscos.sort((a, b) => a.deltaMinimo - b.deltaMinimo)

    return {
      cenarios,
      riscos,
      conclusao:
        vagasTotaisPrevistas > 0
          ? `${partidoNome} elege ${vagasTotaisPrevistas} candidato(s) (${vagasDiretas} diretas + ${vagasSobra} sobras)`
          : `${partidoNome} não elege ninguém`,
    }
  }

  const handleGerarPdf = async () => {
    if (!contentRef.current || exportandoPdf) return

    setExportandoPdf(true)
    setModoImpressao(true)

    const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

    try {
      await wait(250)
      const { default: html2canvas } = await import('html2canvas')

      const target = contentRef.current
      if (!target) {
        throw new Error('Conteúdo da página não encontrado.')
      }

      const originalOverflow = target.style.overflow
      const originalHeight = target.style.height
      const originalMaxHeight = target.style.maxHeight

      target.style.overflow = 'visible'
      target.style.height = 'auto'
      target.style.maxHeight = 'none'

      await wait(120)

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff',
        width: target.scrollWidth,
        height: target.scrollHeight,
        windowWidth: target.scrollWidth,
        windowHeight: target.scrollHeight,
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
          const clonedTarget = clonedDoc.getElementById('chapas-pdf-content')
          if (!clonedTarget) return
          const htmlTarget = clonedTarget as HTMLElement
          htmlTarget.style.overflow = 'visible'
          htmlTarget.style.height = 'auto'
          htmlTarget.style.maxHeight = 'none'

          const overflowNodes = clonedTarget.querySelectorAll('div, section, article')
          overflowNodes.forEach((node) => {
            const el = node as HTMLElement
            const view = clonedDoc.defaultView
            const computed = view ? view.getComputedStyle(el) : null
            const overflowCurrent = `${el.style.overflow} ${el.style.overflowY} ${el.style.overflowX}`.toLowerCase()
            const overflowComputed = `${computed?.overflow || ''} ${computed?.overflowY || ''} ${computed?.overflowX || ''}`.toLowerCase()
            if (
              overflowCurrent.includes('auto') ||
              overflowCurrent.includes('hidden') ||
              overflowCurrent.includes('scroll') ||
              overflowComputed.includes('auto') ||
              overflowComputed.includes('hidden') ||
              overflowComputed.includes('scroll')
            ) {
              el.style.overflow = 'visible'
              el.style.overflowY = 'visible'
              el.style.overflowX = 'visible'
              el.style.maxHeight = 'none'
              el.style.height = 'auto'
            }
          })

          // Ajustes específicos para PDF de chapas estaduais
          if (isChapasEstaduais) {
            const grid = clonedTarget.querySelector('[data-chapas-partidos-grid]') as HTMLElement | null
            if (grid) {
              grid.style.display = 'grid'
              grid.style.gridTemplateColumns = 'repeat(4, minmax(0, 1fr))'
              grid.style.gap = '16px'
              grid.style.alignItems = 'start'
              grid.style.width = '100%'
            }

            const cards = clonedTarget.querySelectorAll('[data-chapas-partido-card]')
            cards.forEach((node) => {
              const el = node as HTMLElement
              el.style.height = 'auto'
              el.style.minHeight = '0'
              el.style.alignSelf = 'start'
              el.style.width = '100%'
              el.style.maxWidth = 'none'
            })

            const bodies = clonedTarget.querySelectorAll('[data-chapas-partido-body]')
            bodies.forEach((node) => {
              const el = node as HTMLElement
              el.style.overflow = 'visible'
              el.style.overflowY = 'visible'
              el.style.maxHeight = 'none'
              el.style.height = 'auto'
              el.style.flex = '0 0 auto'
            })
          }
        },
      })

      target.style.overflow = originalOverflow
      target.style.height = originalHeight
      target.style.maxHeight = originalMaxHeight

      if (!canvas.width || !canvas.height) {
        throw new Error('Não foi possível montar o conteúdo para exportação.')
      }

      const pdf = new jsPDF('l', 'mm', 'a4')
      const pageWidth = pdf.internal.pageSize.getWidth()
      const pageHeight = pdf.internal.pageSize.getHeight()
      const margin = 8
      const headerHeight = 14
      const footerHeight = 8
      const usableWidth = pageWidth - margin * 2
      const usableHeightFirstPage = pageHeight - margin - headerHeight - footerHeight
      const usableHeightNextPages = pageHeight - margin * 2 - footerHeight

      const imgWidth = canvas.width
      const imgHeight = canvas.height
      const scaleRatio = usableWidth / imgWidth
      const scaledTotalHeight = imgHeight * scaleRatio

      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(12)
      pdf.text('Simulador de Chapas - Relatorio Completo', margin, margin + 4)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(8)
      pdf.text(
        `Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`,
        margin,
        margin + 9
      )

      let currentY = 0
      let page = 1
      let drawY = margin + headerHeight

      while (currentY < scaledTotalHeight) {
        if (page > 1) {
          pdf.addPage()
          drawY = margin
        }

        const availableHeight = page === 1 ? usableHeightFirstPage : usableHeightNextPages
        const heightChunk = Math.min(scaledTotalHeight - currentY, availableHeight)

        const sourceY = Math.floor((currentY / scaledTotalHeight) * imgHeight)
        const sourceHeight = Math.ceil((heightChunk / scaledTotalHeight) * imgHeight)
        const realSourceHeight = Math.min(sourceHeight, imgHeight - sourceY)
        if (realSourceHeight <= 0) break

        const pageCanvas = document.createElement('canvas')
        pageCanvas.width = imgWidth
        pageCanvas.height = realSourceHeight
        const pageCtx = pageCanvas.getContext('2d')
        if (!pageCtx) throw new Error('Erro ao preparar página do PDF.')

        pageCtx.drawImage(canvas, 0, sourceY, imgWidth, realSourceHeight, 0, 0, imgWidth, realSourceHeight)
        const pageImg = pageCanvas.toDataURL('image/png', 0.95)
        const realScaledHeight = (realSourceHeight / imgHeight) * scaledTotalHeight
        pdf.addImage(pageImg, 'PNG', margin, drawY, usableWidth, realScaledHeight)

        pdf.setFontSize(8)
        pdf.setTextColor(90)
        pdf.text(`Pagina ${page}`, pageWidth - margin, pageHeight - 3, { align: 'right' })
        pdf.setTextColor(0)

        currentY += heightChunk
        page += 1
      }

      pdf.save(`Chapas-Completo-${new Date().toISOString().slice(0, 10)}.pdf`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Erro ao gerar PDF.'
      alert(`Falha ao gerar PDF: ${message}`)
    } finally {
      setModoImpressao(false)
      setExportandoPdf(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 w-full">
      <div className={`w-full py-4 ${isChapasEstaduais && modoImpressao ? 'px-1' : 'px-4 sm:px-6 lg:px-8'}`}>
        {/* Notificação de auto-save */}
        {notificacaoAutoSave && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span className="text-sm">{notificacaoAutoSave}</span>
          </div>
        )}

        {/* Indicador de carregamento / erro com retry */}
        {!dadosCarregados && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4 max-w-sm">
              {erroCarregamento ? (
                <>
                  <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                    <span className="text-red-500 text-xl font-bold">!</span>
                  </div>
                  <span className="text-gray-700 text-center text-sm">
                    Não foi possível carregar os dados.<br/>
                    <span className="text-gray-400 text-xs">{erroCarregamento}</span>
                  </span>
                  <button
                    onClick={() => {
                      setErroCarregamento(null)
                      carregarDadosIniciais()
                    }}
                    className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:opacity-90 transition-opacity text-sm font-medium"
                  >
                    Tentar novamente
                  </button>
                </>
              ) : (
                <>
                  <RefreshCw className="h-8 w-8 animate-spin text-accent-gold" />
                  <span className="text-gray-700">Carregando dados...</span>
                </>
              )}
            </div>
          </div>
        )}
        
        <div ref={fullscreenRef} className={`${isFullscreen ? 'bg-white p-4 max-h-screen overflow-y-auto' : 'bg-transparent'} transition-all duration-300`}>
          <div id="chapas-pdf-content" ref={contentRef} className="w-full space-y-4 py-2">
            {/* Controles (título na navbar) */}
            <div className="flex items-center justify-between mb-4">
              <div />
              <div className="flex items-center gap-2">
                <button
                  onClick={handleGerarPdf}
                  disabled={exportandoPdf || !dadosCarregados}
                  title="Gerar PDF completo"
                  className="px-4 py-2 border border-border-card bg-white rounded-lg hover:bg-bg-app disabled:opacity-50 flex items-center gap-2"
                >
                  {exportandoPdf ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Gerando PDF...
                    </>
                  ) : (
                    <>
                      <Printer className="h-4 w-4" />
                      Gerar PDF
                    </>
                  )}
                </button>
                <Link
                  href={isChapasEstaduais ? '/dashboard/chapas' : '/dashboard/chapas-estaduais'}
                  title={isChapasEstaduais ? 'Ir para Chapas Federais' : 'Ir para Chapas Estaduais'}
                  className="px-4 py-2 border border-border-card bg-white rounded-lg hover:bg-bg-app flex items-center gap-2"
                >
                  <ArrowRightLeft className="h-4 w-4" />
                  {isChapasEstaduais ? 'Federais' : 'Estaduais'}
                </Link>
                <button
                  onClick={toggleFullscreen}
                  title={isFullscreen ? 'Sair de tela cheia' : 'Tela cheia'}
                  className="p-2 rounded-lg hover:bg-bg-app text-text-secondary hover:text-accent-gold transition-colors"
                >
                  {isFullscreen ? (
                    <Minimize2 className="h-5 w-5" />
                  ) : (
                    <Maximize2 className="h-5 w-5" />
                  )}
                </button>
                <button
                  onClick={salvarMudancasCenario}
                  disabled={salvandoMudancas}
                  className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {salvandoMudancas ? (
                    <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Salvar Mudanças
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Gerenciador de Cenários com Abas */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
            <CenariosTabs
              service={service}
              partidosAtuais={converterPartidosParaCenario()}
              quocienteAtual={quociente}
              cenariosIniciais={cenariosCarregados ? cenariosLista : undefined}
              cenarioAtivoId={cenarioAtivo?.id}
              carregandoExterno={!cenariosCarregados}
              onCenarioChange={(cenario) => {
                setCenarioAtivo(cenario)
                const partidosOrdenados = ordenarPartidos(cenario.partidos)
                setPartidos(partidosOrdenados)
                setOrdemPartidosManual(construirMapaOrdem(cenario.partidos))
                setQuociente(cenario.quocienteEleitoral)
                const votosLegendaTemp: { [partido: string]: number } = {}
                cenario.partidos.forEach(partido => {
                  if (partido.votosLegenda) {
                    votosLegendaTemp[partido.nome] = partido.votosLegenda
                  }
                })
                setVotosLegenda(votosLegendaTemp)
              }}
              onCenarioBaseCreated={() => {
                carregarDadosSupabase()
              }}
              onCenarioDeleted={() => {
                carregarDadosSupabase()
              }}
              onCenarioClick={async (cenarioId) => {
                if (carregandoCenario) return
                setCarregandoCenario(true)
                try {
                  const novoCenario = await service.carregarCenario(cenarioId)
                  if (novoCenario) {
                    setCenarioAtivo(novoCenario)
                    const partidosOrdenados = ordenarPartidos(novoCenario.partidos)
                    setPartidos(partidosOrdenados)
                    setOrdemPartidosManual(construirMapaOrdem(novoCenario.partidos))
                    setQuociente(novoCenario.quocienteEleitoral)
                    const votosLegendaTemp: { [partido: string]: number } = {}
                    novoCenario.partidos.forEach(partido => {
                      if (partido.votosLegenda) {
                        votosLegendaTemp[partido.nome] = partido.votosLegenda
                      }
                    })
                    setVotosLegenda(votosLegendaTemp)
                    mostrarNotificacaoAutoSave(`Cenário "${novoCenario.nome}" carregado com sucesso`)
                  }
                } catch (error) {
                  alert('Erro ao carregar cenário. Tente novamente.')
                } finally {
                  setCarregandoCenario(false)
                }
              }}
              onSalvarMudancas={salvarMudancasCenario}
              salvandoMudancas={salvandoMudancas}
            />
          </div>

          {/* Resumo do Quociente */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-3">
            <div className="flex flex-wrap items-center gap-4 text-xs justify-between">
              <div className="flex flex-wrap items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Vagas:</span>
                  <input
                    type="number"
                    value={numVagas}
                    onChange={(e) => setNumVagas(Math.max(1, parseInt(e.target.value) || 10))}
                    className="text-sm font-bold text-gray-700 bg-transparent border-b border-gray-200 focus:border-accent-gold outline-none w-20 text-center px-1"
                    min="1"
                    max="20"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">QE 2026:</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9.]*"
                    value={quociente.toLocaleString('pt-BR')}
                    onChange={e => {
                      const raw = e.target.value.replace(/\./g, '')
                      const num = Number(raw)
                      if (!isNaN(num) && num >= 0) {
                        setQuociente(num)
                      }
                    }}
                    onBlur={() => {
                      // Quociente salvo via botão "Salvar Mudanças"
                    }}
                    className="text-sm font-bold text-gray-700 bg-transparent border-b border-gray-200 focus:border-accent-gold outline-none w-32 text-center px-1"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Mínimo:</span>
                  <span className="text-sm font-bold text-gray-700">{getQuocienteMinimo().toLocaleString('pt-BR')}</span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Elegíveis:</span>
                  <span className="text-sm font-bold text-gray-700">
                    {partidos.filter(p => partidoAtingiuMinimo(p.nome) && !partidosOcultos[p.nome]).length}/{partidos.filter(p => !partidosOcultos[p.nome]).length}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="font-semibold text-gray-700">Total de Votos:</span>
                  <span className="text-sm font-bold text-gray-700">
                    {partidos
                      .filter(p => !partidosOcultos[p.nome])
                      .reduce((total, partido) => total + getVotosProjetados(partido.candidatos, partido.nome), 0)
                      .toLocaleString('pt-BR')}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={mostrarTodosPartidos}
                  disabled={partidosOcultosLista.length === 0}
                  className="px-3 py-2 border border-amber-300 text-amber-900 rounded-lg hover:bg-amber-50 flex items-center gap-2 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  title={partidosOcultosLista.length > 0 ? 'Reexibir todos os partidos ocultos' : 'Não há partidos ocultos'}
                >
                  <Eye className="h-4 w-4" />
                  Mostrar todos {partidosOcultosLista.length > 0 ? `(${partidosOcultosLista.length})` : ''}
                </button>
                <button
                  onClick={() => setDialogNovoPartidoAberto(true)}
                  className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 flex items-center gap-2 whitespace-nowrap"
                >
                  <Plus className="h-4 w-4" />
                  Adicionar Partido
                </button>
              </div>
            </div>
          </div>

          {partidosOcultosLista.length > 0 && (
            <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs font-semibold text-amber-900">
                  Partidos ocultos ({partidosOcultosLista.length}):
                </span>
                {partidosOcultosLista.map((partidoNome) => (
                  <button
                    key={partidoNome}
                    type="button"
                    onClick={() => togglePartidoVisibilidade(partidoNome)}
                    className="inline-flex items-center gap-1 rounded-full border border-amber-300 bg-white px-2 py-1 text-xs text-amber-900 hover:bg-amber-100"
                    title={`Mostrar ${partidoNome}`}
                  >
                    <Eye className="h-3 w-3" />
                    {partidoNome}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={mostrarTodosPartidos}
                  className="inline-flex items-center gap-1 rounded-full border border-amber-400 bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-200"
                >
                  Mostrar todos
                </button>
              </div>
            </div>
          )}

          {/* Grid de partidos */}
          <div
            data-chapas-partidos-grid
            className={`w-full grid gap-4 ${
              isChapasEstaduais && modoImpressao
                ? 'grid-cols-4'
                : isChapasEstaduais
                  ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
                  : 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5'
            }`}
          >
            {ordenarPartidos(partidos)
              .filter(partido => !partidosOcultos[partido.nome])
              .map((partido) => {
                const partidoIdx = partidos.findIndex(p => p.nome === partido.nome)
                const posicaoAtualNaOrdem = ordenarPartidos(partidos).findIndex((p) => p.nome === partido.nome)
                
                const atingiuMinimo = partidoAtingiuMinimo(partido.nome)
                const quocienteMinimo = getQuocienteMinimo()
                const votosProjetados = getVotosProjetados(partido.candidatos, partido.nome)
                const feedbackVagasChip = feedbackSegundaVagaPorPartido[partido.nome]

                return (
                  <div
                    key={partido.nome}
                    data-chapas-partido-card
                    className={`w-full flex flex-col items-center bg-white rounded-lg shadow-sm border border-card p-4 ${isChapasEstaduais && modoImpressao ? 'h-auto' : 'h-full'} ${
                    atingiuMinimo 
                      ? 'border-border-card' 
                      : 'border-status-error/50 bg-status-error/5'
                    }`}
                  >
                    <div className={`w-full py-2 px-3 font-bold text-sm mb-3 rounded text-center ${
                      atingiuMinimo 
                        ? 'bg-bg-surface text-text-primary' 
                        : 'bg-status-error/10 text-status-error'
                    }`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleMoverPartido(partido.nome, 'esquerda')}
                            className="text-text-secondary hover:text-text-primary transition-colors p-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Mover partido para a esquerda"
                            disabled={posicaoAtualNaOrdem <= 0}
                          >
                            <ChevronLeft className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoverPartido(partido.nome, 'direita')}
                            className="text-text-secondary hover:text-text-primary transition-colors p-1 disabled:opacity-40 disabled:cursor-not-allowed"
                            title="Mover partido para a direita"
                            disabled={posicaoAtualNaOrdem >= partidos.length - 1}
                          >
                            <ChevronRight className="h-3.5 w-3.5" />
                          </button>
                        </div>
                        <span className="px-2 truncate">{partido.nome}</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              if (confirm(`Tem certeza que deseja excluir o partido ${partido.nome} e todos os seus candidatos?`)) {
                                handleExcluirPartido(partido.nome)
                              }
                            }}
                            className="text-status-error hover:text-status-error/80 transition-colors p-1"
                            title="Remover partido"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAbrirEditarPartido(partido.nome)}
                            className="text-text-secondary hover:text-text-primary transition-colors p-1"
                            title="Editar nome do partido"
                          >
                            <PenSquare className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => togglePartidoVisibilidade(partido.nome)}
                            className="text-text-secondary hover:text-text-primary transition-colors p-1"
                            title={partidosOcultos[partido.nome] ? 'Mostrar partido' : 'Ocultar partido'}
                          >
                            {partidosOcultos[partido.nome] ? (
                              <EyeOff className="h-3.5 w-3.5" />
                            ) : (
                              <Eye className="h-3.5 w-3.5" />
                            )}
                          </button>
                          {nomePartidoEhRepublicanos(partido.nome) && (
                            <button
                              type="button"
                              onClick={() => setOpenAnaliseRepublicanos(true)}
                              className="text-text-primary hover:text-accent-gold transition-colors p-1"
                            >
                              <Info className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {!atingiuMinimo && (
                      <div className="w-full mb-2 p-2 bg-status-error/10 border border-status-error/30 rounded text-xs text-status-error text-center">
                        <div className="font-semibold">⚠️ Não atingiu mínimo</div>
                        <div className="text-[10px] mt-1">{votosProjetados.toLocaleString('pt-BR')} / {quocienteMinimo.toLocaleString('pt-BR')}</div>
                      </div>
                    )}
                    
                    <div
                      data-chapas-partido-body
                      className={`w-full flex flex-col ${isChapasEstaduais && modoImpressao ? 'overflow-visible' : 'flex-1 overflow-y-auto'}`}
                    >
                      <div className="space-y-0.5">
                        <table className="w-full text-xs">
                          <tbody>
                            {(() => {
                              const homens = partido.candidatos
                                .map((candidato, originalIdx) => ({ candidato, originalIdx }))
                                .filter(({ candidato }) => candidato.nome !== 'VOTOS LEGENDA' && candidato.genero !== 'mulher')
                                .sort((a, b) => b.candidato.votos - a.candidato.votos)
                              return homens.map(({ candidato: c, originalIdx: candidatoIdx }, idx) => {
                                return (
                                <tr 
                                  key={`homem-${c.nome}-${idx}`}
                                  className="group relative hover:bg-bg-app transition-colors"
                                  onMouseEnter={() => setHoveredRow({ partidoIdx: partidoIdx, candidatoIdx })}
                                  onMouseLeave={() => {
                                    if (!(editingName?.partidoIdx === partidoIdx && editingName?.candidatoIdx === candidatoIdx)) {
                                      setHoveredRow(null)
                                    }
                                  }}
                                >
                                  <td className="pr-1 text-left font-normal align-top">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-text-secondary">{idx + 1}.</span>
                                      {modoImpressao ? (
                                        <span className="text-xs font-medium text-text-primary">{c.nome}</span>
                                      ) : (
                                        <input
                                          type="text"
                                          value={editingName?.partidoIdx === partidoIdx && editingName?.candidatoIdx === candidatoIdx 
                                            ? editingName.tempValue 
                                            : c.nome}
                                          onFocus={() => startEditingName(partidoIdx, candidatoIdx)}
                                          onChange={e => {
                                            if (editingName?.partidoIdx === partidoIdx && editingName?.candidatoIdx === candidatoIdx) {
                                              setEditingName({ ...editingName, tempValue: e.target.value })
                                            }
                                          }}
                                          onBlur={() => saveNameChange(partidoIdx, candidatoIdx)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              e.currentTarget.blur()
                                            } else if (e.key === 'Escape') {
                                              setEditingName(null)
                                              e.currentTarget.blur()
                                            }
                                          }}
                                          className="bg-transparent border-b border-border-card focus:border-accent-gold outline-none w-32 text-xs py-0.5 px-1 text-text-primary"
                                        />
                                      )}
                                    </div>
                                  </td>
                                  <td className="text-right whitespace-nowrap font-normal align-top">
                                    {modoImpressao ? (
                                      <span className="text-xs font-medium">
                                        {Number(c.votos).toLocaleString('pt-BR')}
                                      </span>
                                    ) : (
                                      editVoto && editVoto.partidoIdx === partidoIdx && editVoto.candidatoIdx === candidatoIdx ? (
                                        <input
                                          type="number"
                                          min={0}
                                          value={c.votos}
                                          autoFocus
                                          onChange={e => {
                                            const value = e.target.value
                                            updateLocalState(partidoIdx, candidatoIdx, 'votos', value)
                                          }}
                                          onBlur={() => {
                                            saveVotosChange(partidoIdx, candidatoIdx, c.votos)
                                            setEditVoto(null)
                                          }}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              saveVotosChange(partidoIdx, candidatoIdx, c.votos)
                                              setEditVoto(null)
                                            }
                                          }}
                                          className="bg-transparent border-b border-gray-200 focus:border-blue-400 outline-none w-full text-xs py-0.5 px-1 text-right"
                                          style={{ textAlign: 'right' }}
                                        />
                                      ) : (
                                        <span
                                          className="cursor-pointer select-text"
                                          onClick={() => setEditVoto({ partidoIdx: partidoIdx, candidatoIdx })}
                                        >
                                          {Number(c.votos).toLocaleString('pt-BR')}
                                        </span>
                                      )
                                    )}
                                  </td>
                                  <td className="pl-2 text-right whitespace-nowrap font-normal align-top w-8">
                                    {(hoveredRow?.partidoIdx === partidoIdx && hoveredRow?.candidatoIdx === candidatoIdx) || 
                                     (editingName?.partidoIdx === partidoIdx && editingName?.candidatoIdx === candidatoIdx) ? (
                                      <button
                                        onClick={() => {
                                          if (confirm(`Tem certeza que deseja excluir o candidato ${c.nome}?`)) {
                                            handleExcluirCandidato(partidoIdx, candidatoIdx)
                                          }
                                        }}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    ) : null}
                                  </td>
                                </tr>
                              )})
                            })()}
                          </tbody>
                        </table>

                        <div className="border-t border-border-card my-1"></div>

                        <table className="w-full text-xs">
                          <tbody>
                            {(() => {
                              const mulheres = partido.candidatos
                                .map((candidato, originalIdx) => ({ candidato, originalIdx }))
                                .filter(({ candidato }) => candidato.nome !== 'VOTOS LEGENDA' && candidato.genero === 'mulher')
                                .sort((a, b) => b.candidato.votos - a.candidato.votos)
                              return mulheres.map(({ candidato: c, originalIdx: candidatoIdx }, idx) => {
                                return (
                                <tr 
                                  key={`mulher-${c.nome}-${idx}`}
                                  className="group relative hover:bg-bg-app transition-colors"
                                  onMouseEnter={() => setHoveredRow({ partidoIdx: partidoIdx, candidatoIdx })}
                                  onMouseLeave={() => {
                                    if (!(editingName?.partidoIdx === partidoIdx && editingName?.candidatoIdx === candidatoIdx)) {
                                      setHoveredRow(null)
                                    }
                                  }}
                                >
                                  <td className="pr-1 text-left font-normal align-top">
                                    <div className="flex items-center gap-1">
                                      <span className="text-xs text-text-secondary">{idx + 1}.</span>
                                      {modoImpressao ? (
                                        <span className="text-xs font-medium text-text-primary">{c.nome}</span>
                                      ) : (
                                        <input
                                          type="text"
                                          value={editingName?.partidoIdx === partidoIdx && editingName?.candidatoIdx === candidatoIdx 
                                            ? editingName.tempValue 
                                            : c.nome}
                                          onFocus={() => startEditingName(partidoIdx, candidatoIdx)}
                                          onChange={e => {
                                            if (editingName?.partidoIdx === partidoIdx && editingName?.candidatoIdx === candidatoIdx) {
                                              setEditingName({ ...editingName, tempValue: e.target.value })
                                            }
                                          }}
                                          onBlur={() => saveNameChange(partidoIdx, candidatoIdx)}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              e.currentTarget.blur()
                                            } else if (e.key === 'Escape') {
                                              setEditingName(null)
                                              e.currentTarget.blur()
                                            }
                                          }}
                                          className="bg-transparent border-b border-border-card focus:border-accent-gold outline-none w-32 text-xs py-0.5 px-1 text-text-primary"
                                        />
                                      )}
                                    </div>
                                  </td>
                                  <td className="pl-1 text-right whitespace-nowrap font-normal align-top">
                                    {modoImpressao ? (
                                      <span className="text-xs font-semibold text-accent-gold">
                                        {Number(c.votos).toLocaleString('pt-BR')}
                                      </span>
                                    ) : (
                                      editVoto && editVoto.partidoIdx === partidoIdx && editVoto.candidatoIdx === candidatoIdx ? (
                                        <input
                                          type="number"
                                          min={0}
                                          value={c.votos}
                                          autoFocus
                                          onChange={e => {
                                            const value = e.target.value
                                            updateLocalState(partidoIdx, candidatoIdx, 'votos', value)
                                          }}
                                          onBlur={() => {
                                            saveVotosChange(partidoIdx, candidatoIdx, c.votos)
                                            setEditVoto(null)
                                          }}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              saveVotosChange(partidoIdx, candidatoIdx, c.votos)
                                              setEditVoto(null)
                                            }
                                          }}
                                          className="bg-transparent border-b border-border-card focus:border-accent-gold outline-none text-xs py-0.5 px-1 text-right text-text-primary"
                                          style={{ textAlign: 'right' }}
                                        />
                                      ) : (
                                        <span
                                          className="cursor-pointer select-text text-accent-gold font-semibold"
                                          onClick={() => setEditVoto({ partidoIdx: partidoIdx, candidatoIdx })}
                                        >
                                          {Number(c.votos).toLocaleString('pt-BR')}
                                        </span>
                                      )
                                    )}
                                  </td>
                                  <td className="pl-1 text-right font-normal align-top w-6">
                                    {(hoveredRow?.partidoIdx === partidoIdx && hoveredRow?.candidatoIdx === candidatoIdx) || 
                                     (editingName?.partidoIdx === partidoIdx && editingName?.candidatoIdx === candidatoIdx) ? (
                                      <button
                                        onClick={() => {
                                          if (confirm(`Tem certeza que deseja excluir o candidato ${c.nome}?`)) {
                                            handleExcluirCandidato(partidoIdx, candidatoIdx)
                                          }
                                        }}
                                        className="text-status-error hover:text-status-error/80 hover:bg-status-error/10 p-0.5 rounded"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                  </td>
                                </tr>
                              )})
                            })()}
                          </tbody>
                        </table>
                      </div>

                      {/* Input de Votos de Legenda */}
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-700">VOTOS LEGENDA:</span>
                          {isChapasEstaduais && modoImpressao ? (
                            <span className="text-xs font-semibold text-gray-700">
                              {(votosLegenda[partido.nome] || 0).toLocaleString('pt-BR')}
                            </span>
                          ) : (
                            <input
                              type="text"
                              inputMode="numeric"
                              pattern="[0-9.]*"
                              value={votosLegendaTemp[partido.nome] 
                                ? votosLegendaTemp[partido.nome] 
                                : (votosLegenda[partido.nome] || 0).toLocaleString('pt-BR')}
                              onChange={e => {
                                const raw = e.target.value.replace(/\./g, '')
                                const num = Number(raw)
                                if (!isNaN(num) && num >= 0) {
                                  setVotosLegendaTemp(prev => ({ ...prev, [partido.nome]: raw || '0' }))
                                } else if (raw === '') {
                                  setVotosLegendaTemp(prev => ({ ...prev, [partido.nome]: '0' }))
                                }
                              }}
                              onBlur={() => {
                                const raw = votosLegendaTemp[partido.nome]
                                if (raw) {
                                  const num = Number(raw.replace(/\./g, ''))
                                  if (!isNaN(num) && num >= 0) {
                                    setVotosLegenda(prev => ({ ...prev, [partido.nome]: num }))
                                    // Limpar temp removendo a chave
                                    setVotosLegendaTemp(prev => {
                                      const novo = { ...prev }
                                      delete novo[partido.nome]
                                      return novo
                                    })
                                    // Votos legenda salvos via botão "Salvar Mudanças"
                                  }
                                }
                              }}
                              onKeyDown={e => {
                                if (e.key === 'Enter') {
                                  e.currentTarget.blur()
                                }
                              }}
                              className="text-xs font-medium text-gray-700 bg-transparent border-b border-gray-200 focus:border-blue-400 outline-none w-24 text-right px-1"
                            />
                          )}
                        </div>
                      </div>

                      <button
                        onClick={() => setDialogAberto(partidoIdx)}
                        className="mt-2 px-3 py-1 text-xs bg-accent-gold-soft text-accent-gold rounded hover:bg-accent-gold-soft/80 flex items-center gap-1 justify-center"
                      >
                        <Plus className="h-3 w-3" />
                        Adicionar Candidato
                      </button>
                    </div>

                    <div className="w-full mt-auto pt-2">
                      <div className="font-bold text-xs mb-0.5 text-center">VOTOS PROJETADOS</div>
                      <div className="text-base font-extrabold mb-1 text-center">{getVotosProjetados(partido.candidatos, partido.nome).toLocaleString('pt-BR')}</div>
                      <div className="font-bold text-xs mb-0.5 text-center">PROJEÇÃO ELEITOS</div>
                      <div className="text-base font-extrabold mb-1 text-center">{getProjecaoEleitos(getVotosProjetados(partido.candidatos, partido.nome))}</div>
                      {/* min-h fixa: com mt-auto no bloco, alturas diferentes do chip deslocavam "VOTOS PROJETADOS" entre cards */}
                      <div className="mb-1 flex min-h-[10rem] w-full items-start justify-center px-0.5">
                        {feedbackVagasChip ? (
                          <span
                            className={cn(
                              'inline-flex max-w-full flex-col items-center justify-center gap-1 rounded-lg border px-2 py-1 text-center text-[11px] font-medium leading-tight tracking-tight shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]',
                              feedbackVagasChip.tone === 'positive' && 'border-emerald-200/70 bg-emerald-50/80',
                              feedbackVagasChip.tone === 'negative' && 'border-red-200/70 bg-red-50/80',
                              feedbackVagasChip.tone === 'neutral' && 'border-slate-200/80 bg-white/90'
                            )}
                            title={
                              [
                                feedbackVagasChip.text,
                                feedbackVagasChip.segundaLinha,
                                feedbackVagasChip.notaImpacto,
                              ]
                                .filter(Boolean)
                                .join('\n')
                            }
                          >
                            <span
                              className={cn(
                                feedbackVagasChip.tone === 'positive' && 'text-emerald-900',
                                feedbackVagasChip.tone === 'negative' && 'text-red-900',
                                feedbackVagasChip.tone === 'neutral' && 'text-text-secondary'
                              )}
                            >
                              {feedbackVagasChip.text}
                            </span>
                            {feedbackVagasChip.segundaLinha ? (
                              <span className="text-[10px] font-semibold leading-tight text-red-900">
                                {feedbackVagasChip.segundaLinha}
                              </span>
                            ) : null}
                            {feedbackVagasChip.notaImpacto ? (
                              <span className="w-full max-w-full text-left text-[9px] font-normal leading-snug text-gray-600 whitespace-pre-line">
                                {feedbackVagasChip.notaImpacto}
                              </span>
                            ) : null}
                          </span>
                        ) : null}
                      </div>
                      <div className="text-[10px] text-gray-500 mb-1 text-center">{getVotosProjetados(partido.candidatos, partido.nome).toLocaleString('pt-BR')} / {quociente.toLocaleString('pt-BR')} = {getProjecaoEleitos(getVotosProjetados(partido.candidatos, partido.nome))}</div>
                    </div>
                  </div>
                )
              })}
          </div>

          {/* Seção de detalhes das sobras - Método D'Hondt */}
          <div className="mt-4 p-4 bg-gray-50 rounded-lg max-w-4xl">
            <div className="text-base font-semibold mb-3 text-gray-900">
              📊 Cálculo de Sobras - Método D'Hondt (Legislação Brasileira)
            </div>
            <div className="text-sm text-gray-700 mb-3">
              <strong>Fórmula:</strong> Quociente Partidário = Votos ÷ (Vagas Obtidas + 1)
            </div>
            
            <div className="grid grid-cols-5 gap-4">
              {(() => {
                const { ordenadosPorSobras } = calcularSobras()
                
                return ordenadosPorSobras.map((resultado, index) => (
                  <div key={resultado.partido} className="bg-white p-3 rounded border border-gray-200">
                    <div className="font-semibold text-sm mb-2 text-gray-900">
                      {resultado.partido}
                    </div>
                    
                    <div className="space-y-1 text-xs">
                      <div className="flex justify-between">
                        <span>Votos Totais:</span>
                        <span className="font-medium">{resultado.votosTotal.toLocaleString('pt-BR')}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Vagas Diretas:</span>
                        <span className="font-medium">{resultado.vagasDiretas}</span>
                      </div>
                      
                      <div className="flex justify-between">
                        <span>Projeção:</span>
                        <span className="font-medium">{resultado.projecaoEleitos}</span>
                      </div>
                      
                      <div className="border-t pt-1 mt-2">
                        <div className="flex justify-between">
                          <span>Quociente Partidário:</span>
                          <span className="font-bold text-gray-700">
                            {resultado.quocientePartidario.toLocaleString('pt-BR', { 
                              minimumFractionDigits: 2, 
                              maximumFractionDigits: 2 
                            })}
                          </span>
                        </div>
                        
                        <div className="text-xs text-gray-500 mt-1 whitespace-nowrap">
                          {resultado.votosTotal.toLocaleString('pt-BR')} ÷ ({resultado.vagasDiretas} + 1) = {resultado.quocientePartidario.toLocaleString('pt-BR', { 
                            minimumFractionDigits: 2, 
                            maximumFractionDigits: 2 
                          })}
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              })()}
            </div>
            
            {/* Seção de distribuição completa das vagas */}
            <div className="mt-4 p-4 bg-gray-50 rounded-lg border border-gray-200">
              <div className="text-base font-semibold mb-3 text-gray-900">
                🎯 Distribuição Completa das {numVagas} Vagas - Método D'Hondt
              </div>
              
              {(() => {
                const simulacao = simularDistribuicaoCompleta()
                
                return (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm font-semibold text-gray-900 mb-2">📊 Resumo das Vagas</div>
                        <div className="text-xs space-y-1">
                          <div className="flex justify-between">
                            <span>Vagas Diretas:</span>
                            <span className="font-medium">{simulacao.vagasDistribuidas}</span>
                          </div>
                          <div className="flex justify-between">
                            <span>Vagas por Sobras:</span>
                            <span className="font-medium">{simulacao.vagasRestantes}</span>
                          </div>
                          <div className="flex justify-between font-bold">
                            <span>Total de Vagas:</span>
                            <span>{simulacao.totalVagas}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-white p-3 rounded border">
                        <div className="text-sm font-semibold text-gray-900 mb-2">🏆 Vagas por Partido</div>
                        <div className="text-xs space-y-1">
                          {simulacao.partidosComVagas.map(partido => (
                            <div key={partido.partido} className="flex justify-between">
                              <span>{partido.partido}:</span>
                              <span className="font-medium">{partido.vagasObtidas} vaga{partido.vagasObtidas !== 1 ? 's' : ''}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Histórico das sobras */}
                    <div className="bg-white p-3 rounded border">
                      <div className="text-sm font-semibold text-gray-900 mb-2">📋 Histórico das Sobras - Método D'Hondt</div>
                      <div className="text-xs space-y-3">
                        {simulacao.historicoSobras.map((sobra, index) => {
                          const quocientesRodada = simulacao.partidosComVagas
                            .filter(p => p.vagasObtidas > 0 || index === 0)
                            .map(p => {
                              let vagasAntes: number
                              if (index === 0) {
                                vagasAntes = p.vagasDiretas
                              } else {
                                let vagasGanhasAteAgora = 0
                                for (let j = 0; j < index; j++) {
                                  if (simulacao.historicoSobras[j].partido === p.partido) {
                                    vagasGanhasAteAgora++
                                  }
                                }
                                vagasAntes = p.vagasDiretas + vagasGanhasAteAgora
                              }
                              
                              return {
                                partido: p.partido,
                                votos: p.votosTotal,
                                vagasAntes: vagasAntes,
                                quocientePartidario: p.votosTotal / (vagasAntes + 1)
                              }
                            })
                            .sort((a, b) => b.quocientePartidario - a.quocientePartidario)

                          return (
                            <div key={index} className="border rounded-lg p-3 bg-gray-50">
                              <div className="flex items-center gap-3 mb-2 p-2 bg-white rounded">
                                <span className="font-bold text-gray-700">🎯 Rodada {sobra.rodada}</span>
                                <span className="text-gray-600">→</span>
                                <span className="font-medium bg-gray-100 px-2 py-1 rounded">{sobra.partido}</span>
                                <span className="text-gray-600">ganha a</span>
                                <span className="font-bold text-gray-700 bg-gray-100 px-2 py-1 rounded">Vaga #{sobra.vaga}</span>
                              </div>

                              <div className="mb-2 p-2 bg-white rounded">
                                <div className="font-semibold text-gray-800 mb-1">📊 Cálculo dos Quocientes Partidários:</div>
                                <div className="space-y-1">
                                  {quocientesRodada.map((q) => (
                                    <div key={q.partido} className={`flex justify-between items-center p-1 rounded ${
                                      q.partido === sobra.partido ? 'bg-gray-100' : 'bg-gray-50'
                                    }`}>
                                      <span className="font-medium">{q.partido}:</span>
                                      <span className="text-xs text-gray-600">
                                        {q.votos.toLocaleString('pt-BR')} ÷ ({q.vagasAntes} + 1) = 
                                      </span>
                                      <span className="font-bold text-gray-700">
                                        {q.quocientePartidario.toLocaleString('pt-BR', { 
                                          minimumFractionDigits: 2, 
                                          maximumFractionDigits: 2 
                                        })}
                                      </span>
                                      {q.partido === sobra.partido && (
                                        <span className="text-gray-600 font-bold ml-2">🏆 MAIOR</span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="p-2 bg-gray-100 rounded">
                                <div className="font-semibold text-gray-800">
                                  ✅ Resultado: {sobra.partido} ganha a Vaga #{sobra.vaga} com quociente partidário de{' '}
                                  {sobra.quocientePartidario.toLocaleString('pt-BR', { 
                                    minimumFractionDigits: 2, 
                                    maximumFractionDigits: 2 
                                  })}
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>
                    </div>

                    {/* Seção dos candidatos eleitos */}
                    <div className="bg-white p-4 rounded border">
                      <div className="text-sm font-semibold text-gray-900 mb-3">🏆 Candidatos Eleitos</div>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                        {(() => {
                          try {
                            const candidatosEleitos = calcularCandidatosEleitos()
                            
                            if (!candidatosEleitos || candidatosEleitos.length === 0) {
                              return (
                                <div className="col-span-full text-center text-gray-500 py-4">
                                  Nenhum candidato eleito encontrado
                                </div>
                              )
                            }
                            
                            const candidatosPorPartido = candidatosEleitos.reduce((acc, candidato) => {
                              if (candidato && candidato.partido) {
                                if (!acc[candidato.partido]) {
                                  acc[candidato.partido] = []
                                }
                                acc[candidato.partido].push(candidato)
                              }
                              return acc
                            }, {} as { [partido: string]: typeof candidatosEleitos })

                            const partidosOrdenados = ordenarPartidos(
                              Object.keys(candidatosPorPartido).map(nomePartido => ({ 
                                nome: nomePartido, 
                                candidatos: candidatosPorPartido[nomePartido] || [] 
                              }))
                            ).filter(item => item.candidatos.length > 0)

                            return partidosOrdenados.map(({ nome: partido, candidatos }) => (
                              <div key={partido} className="border rounded-lg p-3">
                                <div className={`font-semibold text-sm mb-2 text-center ${coresPartidosAtivos[partido as keyof typeof coresPartidosAtivos]?.cor || 'bg-gray-200'} ${coresPartidosAtivos[partido as keyof typeof coresPartidosAtivos]?.corTexto || 'text-gray-800'}`}>{partido}</div>
                                <div className="space-y-2">
                                  {candidatos.map((candidato, index) => (
                                    <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                                      <div className="flex items-center gap-2">
                                        <span className="font-bold text-accent-gold">#{candidato.posicao}</span>
                                        <span className="font-medium">{candidato.nome}</span>
                                      </div>
                                      <div className="text-right">
                                        <div className="font-semibold">
                                          {candidato.votos.toLocaleString('pt-BR')}
                                        </div>
                                        <div className={`text-xs ${candidato.tipoEleicao === 'direta' ? 'text-green-600' : 'text-orange-600'}`}>{candidato.tipoEleicao === 'direta' ? 'Direta' : 'Sobra'}</div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            ))
                          } catch (error) {
                            return (
                              <div className="col-span-full text-center text-red-500 py-4">
                                Erro ao carregar candidatos eleitos
                              </div>
                            )
                          }
                        })()}
                      </div>
                    </div>
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
        </div>

        {/* Modal para adicionar novo candidato */}
        {dialogAberto !== null && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Adicionar Candidato</h2>
                <button
                  onClick={() => {
                    setDialogAberto(null)
                    setNovoCandidato({ nome: '', votos: 0, genero: 'homem' })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nome do Candidato</label>
                  <input
                    type="text"
                    placeholder="Nome do candidato"
                    value={novoCandidato.nome}
                    onChange={(e) => setNovoCandidato(prev => ({ ...prev, nome: e.target.value }))}
                    disabled={salvandoCandidato}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Votos</label>
                  <input
                    type="number"
                    placeholder="0"
                    min="0"
                    value={novoCandidato.votos}
                    onChange={(e) => setNovoCandidato(prev => ({ ...prev, votos: parseInt(e.target.value) || 0 }))}
                    disabled={salvandoCandidato}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Gênero</label>
                  <div className="flex gap-4">
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="genero"
                        value="homem"
                        checked={novoCandidato.genero === 'homem'}
                        onChange={(e) => setNovoCandidato(prev => ({ ...prev, genero: e.target.value as 'homem' | 'mulher' }))}
                        disabled={salvandoCandidato}
                        className="w-4 h-4 text-accent-gold"
                      />
                      <span className="text-sm">Homem</span>
                    </label>
                    <label className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="genero"
                        value="mulher"
                        checked={novoCandidato.genero === 'mulher'}
                        onChange={(e) => setNovoCandidato(prev => ({ ...prev, genero: e.target.value as 'homem' | 'mulher' }))}
                        disabled={salvandoCandidato}
                        className="w-4 h-4 text-accent-gold"
                      />
                      <span className="text-sm">Mulher</span>
                    </label>
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setDialogAberto(null)
                      setNovoCandidato({ nome: '', votos: 0, genero: 'homem' })
                    }}
                    disabled={salvandoCandidato}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={() => handleAdicionarCandidato(dialogAberto)}
                    disabled={salvandoCandidato || !novoCandidato.nome.trim()}
                    className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 disabled:opacity-50"
                  >
                    {salvandoCandidato ? 'Salvando...' : 'Adicionar'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para adicionar novo partido */}
        {dialogNovoPartidoAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Adicionar Partido</h2>
                <button
                  onClick={() => {
                    setDialogNovoPartidoAberto(false)
                    setNovoPartido({ nome: '', cor: 'bg-gray-500', corTexto: 'text-white' })
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Nome do Partido</label>
                  <input
                    type="text"
                    placeholder="Nome do partido"
                    value={novoPartido.nome}
                    onChange={(e) => setNovoPartido(prev => ({ ...prev, nome: e.target.value }))}
                    disabled={salvandoPartido}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">Cor</label>
                  <select
                    value={novoPartido.cor}
                    onChange={(e) => {
                      const cor = e.target.value
                      const corTexto = cor.includes('yellow') || cor.includes('gray-200') ? 'text-gray-900' : 'text-white'
                      setNovoPartido(prev => ({ ...prev, cor, corTexto }))
                    }}
                    disabled={salvandoPartido}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  >
                    <option value="bg-gray-500">Cinza</option>
                    <option value="bg-red-600">Vermelho</option>
                    <option value="bg-blue-600">Azul</option>
                    <option value="bg-green-600">Verde</option>
                    <option value="bg-yellow-400">Amarelo</option>
                    <option value="bg-purple-500">Roxo</option>
                    <option value="bg-orange-500">Laranja</option>
                    <option value="bg-pink-500">Rosa</option>
                    <option value="bg-indigo-500">Índigo</option>
                    <option value="bg-teal-500">Verde-água</option>
                  </select>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setDialogNovoPartidoAberto(false)
                      setNovoPartido({ nome: '', cor: 'bg-gray-500', corTexto: 'text-white' })
                    }}
                    disabled={salvandoPartido}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleAdicionarPartido}
                    disabled={salvandoPartido || !novoPartido.nome.trim()}
                    className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 disabled:opacity-50"
                  >
                    {salvandoPartido ? 'Salvando...' : 'Adicionar Partido'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Modal para editar nome do partido */}
        {dialogEditarPartidoAberto && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">Editar Partido</h2>
                <button
                  onClick={() => {
                    setDialogEditarPartidoAberto(null)
                    setNomePartidoEdicao('')
                  }}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">Novo nome do partido</label>
                  <input
                    type="text"
                    placeholder="Nome do partido"
                    value={nomePartidoEdicao}
                    onChange={(e) => setNomePartidoEdicao(e.target.value)}
                    disabled={salvandoEdicaoPartido}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
                  />
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => {
                      setDialogEditarPartidoAberto(null)
                      setNomePartidoEdicao('')
                    }}
                    disabled={salvandoEdicaoPartido}
                    className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                  <button
                    onClick={handleSalvarEdicaoPartido}
                    disabled={salvandoEdicaoPartido || !nomePartidoEdicao.trim()}
                    className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 disabled:opacity-50"
                  >
                    {salvandoEdicaoPartido ? 'Salvando...' : 'Salvar Nome'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Diálogo de Análise - REPUBLICANOS */}
        {openAnaliseRepublicanos && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold">REPUBLICANOS — Análise</h2>
                <button
                  onClick={() => setOpenAnaliseRepublicanos(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              {(() => {
                const a = analisarRepublicanos()
                return (
                  <div className="space-y-3 text-sm">
                    <div className="grid grid-cols-5 gap-2">
                      <div className="p-2 bg-gray-50 rounded border text-center">
                        <div className="text-[11px] text-gray-600">Votos</div>
                        <div className="text-sm font-bold">{a.cenarios.atual.votos.toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="p-2 bg-gray-50 rounded border text-center">
                        <div className="text-[11px] text-gray-600">QE</div>
                        <div className="text-sm font-bold">{quociente.toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="p-2 bg-gray-50 rounded border text-center">
                        <div className="text-[11px] text-gray-600">80% QE</div>
                        <div className="text-sm font-bold">{getQuocienteMinimo().toLocaleString('pt-BR')}</div>
                      </div>
                      <div className="p-2 bg-gray-50 rounded border text-center">
                        <div className="text-[11px] text-gray-600">Vagas</div>
                        <div className="text-sm font-bold">{a.cenarios.atual.vagasTotais}</div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs ${a.cenarios.atual.elegivel ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
                        {a.cenarios.atual.elegivel ? '≥ 80% do QE' : '< 80% do QE'}
                      </span>
                      <span className="px-2 py-1 rounded text-xs border border-gray-300">
                        {a.cenarios.atual.vagasDiretas} diretas + {a.cenarios.atual.vagasSobra} sobras
                      </span>
                    </div>

                    <div className="p-2 bg-gray-50 rounded border text-xs">
                      <div className="font-medium mb-2">Análise de Risco — Quanto cada adversário precisa crescer para nos tirar vagas:</div>
                      
                      {a.riscos.map((risco, index) => (
                        <div key={risco.partido} className="mb-2 p-2 bg-white rounded border">
                          <div className="font-medium text-gray-800">{risco.partido}</div>
                          <div className="grid grid-cols-2 gap-2 mt-1 text-[11px]">
                            <div>
                              <span className="text-gray-600">Para vaga direta:</span>
                              <span className="font-semibold ml-1">+{risco.deltaParaDireta.toLocaleString('pt-BR')} votos</span>
                            </div>
                            <div>
                              <span className="text-gray-600">Para sobra:</span>
                              <span className="font-semibold ml-1">
                                {risco.deltaParaSobra === Infinity ? '—' : `+${risco.deltaParaSobra.toLocaleString('pt-BR')}`}
                              </span>
                            </div>
                          </div>
                          <div className="mt-1 text-[10px] text-gray-600">
                            Menor delta: <strong>+{risco.deltaMinimo.toLocaleString('pt-BR')} votos</strong>
                            {index === 0 && ' (MAIS PERIGOSO)'}
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="text-xs text-gray-700 font-medium">{a.conclusao}</div>
                  </div>
                )
              })()}
              <div className="mt-4 flex justify-end">
                <button
                  onClick={() => setOpenAnaliseRepublicanos(false)}
                  className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

