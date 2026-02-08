'use client'

import React, { useEffect, useState, useRef } from 'react'
import { Trash2, Plus, RefreshCw, Check, Printer, Info, Eye, EyeOff, X, Maximize2, Minimize2 } from 'lucide-react'
import {
  CenarioCompleto,
  PartidoCenario,
  obterCenarioAtivo,
  atualizarCenario,
  carregarCenario,
  criarCenarioBase,
  dadosIniciais
} from '@/lib/chapasService'
import CenariosTabs from '@/components/cenarios-tabs'

// Configuração de cores dos partidos - Tema Premium Bege/Ouro
const coresPartidos = {
  'PT': { cor: 'bg-accent-gold', corTexto: 'text-white' },
  'PSD/MDB': { cor: 'bg-accent-gold-soft', corTexto: 'text-text-primary' },
  'PP': { cor: 'bg-text-secondary', corTexto: 'text-white' },
  'REPUBLICANOS': { cor: 'bg-text-primary', corTexto: 'text-white' },
  'PODEMOS': { cor: 'bg-accent-gold', corTexto: 'text-white' }
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
const criarPartidosIniciais = (): PartidoLocal[] => {
  return Object.keys(coresPartidos).map(nome => ({
    nome,
    ...coresPartidos[nome as keyof typeof coresPartidos],
    candidatos: []
  }))
}

const initialQuociente = 190000

export default function ChapasPage() {
  const [loading, setLoading] = useState(false)
  const contentRef = useRef<HTMLDivElement>(null)
  const [modoImpressao, setModoImpressao] = useState(false)

  const [partidos, setPartidos] = useState<PartidoLocal[]>(criarPartidosIniciais())
  const [quociente, setQuociente] = useState(initialQuociente)
  const [quocienteCarregado, setQuocienteCarregado] = useState(false)
  const [cenarioAtivo, setCenarioAtivo] = useState<CenarioCompleto | null>(null)

  const [editVoto, setEditVoto] = useState<{ partidoIdx: number; candidatoNome: string } | null>(null)
  const [hoveredRow, setHoveredRow] = useState<{ partidoIdx: number; candidatoNome: string } | null>(null)
  const [editingName, setEditingName] = useState<{ partidoIdx: number; candidatoNome: string; tempValue: string } | null>(null)
  const [votosLegenda, setVotosLegenda] = useState<{ [partido: string]: number }>({})

  // Estados para adicionar novo candidato
  const [dialogAberto, setDialogAberto] = useState<number | null>(null)
  const [novoCandidato, setNovoCandidato] = useState({ nome: '', votos: 0, genero: 'homem' as 'homem' | 'mulher' })
  const [salvandoCandidato, setSalvandoCandidato] = useState(false)
  
  // Estados para adicionar novo partido
  const [dialogNovoPartidoAberto, setDialogNovoPartidoAberto] = useState(false)
  const [novoPartido, setNovoPartido] = useState({ nome: '', cor: 'bg-gray-500', corTexto: 'text-white' })
  const [salvandoPartido, setSalvandoPartido] = useState(false)

  // Adicionar estado para edição temporária dos votos de legenda
  const [votosLegendaTemp, setVotosLegendaTemp] = useState<{ [partido: string]: string }>({})
  const [salvandoMudancas, setSalvandoMudancas] = useState(false)
  const [notificacaoAutoSave, setNotificacaoAutoSave] = useState<string | null>(null)
  const [carregandoCenario, setCarregandoCenario] = useState(false)
  const [dadosCarregados, setDadosCarregados] = useState(false)
  const [numVagas, setNumVagas] = useState(10)
  const [openAnaliseRepublicanos, setOpenAnaliseRepublicanos] = useState(false)
  const [mostrarDetalhesSobras, setMostrarDetalhesSobras] = useState(false)
  
  // Estado para gerenciar partidos ocultos
  const [partidosOcultos, setPartidosOcultos] = useState<{ [partidoNome: string]: boolean }>({})
  const [isFullscreen, setIsFullscreen] = useState(false)
  const fullscreenRef = useRef<HTMLDivElement>(null)

  const mostrarNotificacaoAutoSave = (mensagem: string) => {
    setNotificacaoAutoSave(mensagem)
    setTimeout(() => setNotificacaoAutoSave(null), 3000)
  }

  // Função para alternar visibilidade de partido
  const togglePartidoVisibilidade = (partidoNome: string) => {
    setPartidosOcultos(prev => ({
      ...prev,
      [partidoNome]: !prev[partidoNome]
    }))
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
      const cenarioBase = await carregarCenario('base')
      if (cenarioBase) {
        setCenarioAtivo(cenarioBase)
        const partidosOrdenados = ordenarPartidos(cenarioBase.partidos)
        setPartidos(partidosOrdenados)
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
        mostrarNotificacaoAutoSave('Dados carregados com sucesso')
      } else {
        // Se não existe cenário base, criar um com dados iniciais
        const partidosIniciais = criarPartidosIniciais()
        // Popular com dados iniciais
        dadosIniciais.forEach(item => {
          const partido = partidosIniciais.find(p => p.nome === item.partido)
          if (partido) {
            partido.candidatos.push({
              nome: item.nome,
              votos: item.votos,
              genero: item.nome.includes('MULHER') || item.nome === 'MARINA SANTOS' || item.nome === 'RAISSA PROTETORA' || item.nome === 'ANA FIDELIS' || item.nome === 'GABRIELA' || item.nome === 'SAMANTA CAVALCA' ? 'mulher' : undefined
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
        await criarCenarioBase(partidosConvertidos, initialQuociente)
        await carregarDadosSupabase()
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido'
      console.error('Erro ao carregar dados:', error)
      alert(`Erro ao carregar dados: ${errorMessage}. Verifique se as tabelas foram criadas no banco de dados.`)
    }
  }

  // Carregar dados do Supabase ao abrir a página
  useEffect(() => {
    if (dadosCarregados) return
    
    async function carregarDadosIniciais() {
      try {
        setDadosCarregados(true)
        
        // Primeiro tentar carregar cenário ativo (se existir)
        try {
          const cenarioAtivo = await obterCenarioAtivo()
          if (cenarioAtivo) {
            setCenarioAtivo(cenarioAtivo)
            const partidosOrdenados = ordenarPartidos(cenarioAtivo.partidos)
            setPartidos(partidosOrdenados)
            setQuociente(cenarioAtivo.quocienteEleitoral)
            setQuocienteCarregado(true)
            
            const votosLegendaTemp: { [partido: string]: number } = {}
            cenarioAtivo.partidos.forEach(partido => {
              if (partido.votosLegenda) {
                votosLegendaTemp[partido.nome] = partido.votosLegenda
              }
            })
            setVotosLegenda(votosLegendaTemp)
            
            return
          }
        } catch (cenarioError) {
          // Nenhum cenário ativo encontrado, carregando cenário base
        }
        
        // Se não há cenário ativo, carregar o cenário base
        await carregarDadosSupabase()
      } catch (error: any) {
        const errorMessage = error?.message || 'Erro desconhecido'
        console.error('Erro ao carregar dados iniciais:', error)
        alert(`Erro ao carregar dados iniciais: ${errorMessage}. Verifique se as tabelas foram criadas no banco de dados.`)
        setDadosCarregados(false)
      }
    }
    
    carregarDadosIniciais()
  }, [dadosCarregados])

  // Função para ordenar partidos na ordem fixa
  const ordenarPartidos = <T extends { nome: string }>(partidosParaOrdenar: T[]): T[] => {
    const ordemPartidos = ['PT', 'PSD/MDB', 'PP', 'REPUBLICANOS', 'PODEMOS']
    const partidosOrdenados = ordemPartidos
      .map(nomePartido => partidosParaOrdenar.find(p => p.nome === nomePartido))
      .filter(Boolean) as T[]
    
    const partidosRestantes = partidosParaOrdenar.filter(
      p => !ordemPartidos.includes(p.nome)
    )
    
    return [...partidosOrdenados, ...partidosRestantes]
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

  // Função para salvar mudanças no cenário ativo
  const salvarMudancasCenario = async () => {
    if (cenarioAtivo) {
      setSalvandoMudancas(true)
      try {
        const partidosConvertidos = converterPartidosParaCenario()
        await atualizarCenario(cenarioAtivo.id, partidosConvertidos, quociente)
        
        const cenarioVerificado = await carregarCenario(cenarioAtivo.id)
        if (cenarioVerificado) {
          setCenarioAtivo(cenarioVerificado)
        }
        
        setTimeout(() => setSalvandoMudancas(false), 2000)
        mostrarNotificacaoAutoSave(`Mudanças salvas no cenário "${cenarioAtivo.nome}" com QE: ${quociente.toLocaleString('pt-BR')}`)
      } catch (error) {
        setSalvandoMudancas(false)
        alert('Erro ao salvar mudanças. Tente novamente.')
      }
    } else {
      alert('Nenhum cenário ativo encontrado. Tente selecionar um cenário primeiro.')
    }
  }

  // Função para atualizar apenas o estado local
  const updateLocalState = (partidoIdx: number, candidatoNome: string, field: 'nome' | 'votos', value: string) => {
    setPartidos(prev => prev.map((p, i) => {
      if (i !== partidoIdx) return p
      const candidatos = p.candidatos.map((c) => {
        if (c.nome !== candidatoNome) return c
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
  const startEditingName = (partidoIdx: number, candidatoNome: string) => {
    const candidato = partidos[partidoIdx].candidatos.find(c => c.nome === candidatoNome)
    if (candidato) {
      setEditingName({ partidoIdx, candidatoNome, tempValue: candidato.nome })
      setHoveredRow({ partidoIdx, candidatoNome })
    }
  }

  // Função para salvar nome
  const saveNameChange = async (partidoIdx: number, oldNome: string) => {
    if (!editingName || editingName.partidoIdx !== partidoIdx || editingName.candidatoNome !== oldNome) {
      setEditingName(null)
      setHoveredRow(null)
      return
    }

    const newNome = editingName.tempValue.trim()
    
    if (newNome && newNome !== oldNome) {
      try {
        setPartidos(prev => prev.map((p, i) => {
          if (i !== partidoIdx) return p
          return {
            ...p,
            candidatos: p.candidatos.map(c => 
              c.nome === oldNome ? { ...c, nome: newNome } : c
            )
          }
        }))

        if (!cenarioAtivo) {
          throw new Error('Cenário base não encontrado')
        }
        
        const partidosConvertidos = converterPartidosParaCenario()
        await atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)
      } catch (error) {
        setPartidos(prev => prev.map((p, i) => {
          if (i !== partidoIdx) return p
          return {
            ...p,
            candidatos: p.candidatos.map(c => 
              c.nome === newNome ? { ...c, nome: oldNome } : c
            )
          }
        }))
        alert('Erro ao salvar alteração. Tente novamente.')
      }
    }
    
    setEditingName(null)
    setHoveredRow(null)
  }

  // Função para salvar votos
  const saveVotosChange = async (partidoIdx: number, candidatoNome: string, votos: number) => {
    try {
      setPartidos(prev => prev.map((p, i) => {
        if (i !== partidoIdx) return p
        return {
          ...p,
          candidatos: p.candidatos.map(c => 
            c.nome === candidatoNome ? { ...c, votos } : c
          )
        }
      }))
      
      if (!cenarioAtivo) {
        throw new Error('Cenário base não encontrado')
      }
      
      const partidosConvertidos = converterPartidosParaCenario()
      await atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)
    } catch (error) {
      // Erro silencioso
    }
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
  const handleExcluirCandidato = async (partidoIdx: number, candidatoNome: string) => {
    try {
      if (!cenarioAtivo) {
        throw new Error('Cenário base não encontrado')
      }
      
      setPartidos(prev => prev.map((p, i) => {
        if (i !== partidoIdx) return p
        return {
          ...p,
          candidatos: p.candidatos.filter(c => c.nome !== candidatoNome)
        }
      }))

      const partidosConvertidos = converterPartidosParaCenario()
      await atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)
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
      
      setVotosLegenda(prev => {
        const novo = { ...prev }
        delete novo[partidoNome]
        return novo
      })

      const partidosConvertidos = converterPartidosParaCenario().filter(p => p.nome !== partidoNome)
      await atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)
      
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
      
      await atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)
      
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
      await atualizarCenario(cenarioAtivo.id, partidosConvertidos, cenarioAtivo.quocienteEleitoral)

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

  // Análise simples do REPUBLICANOS
  const analisarRepublicanos = () => {
    const partidoNome = 'REPUBLICANOS'
    const partido = partidos.find(p => p.nome === partidoNome)
    const votos = partido ? getVotosProjetados(partido.candidatos, partido.nome) : 0
    const minimo80 = getQuocienteMinimo()
    const atingiuMinimo = votos >= minimo80
    const vagasDiretas = calcularVagasDiretas(votos)

    const simulacao = simularDistribuicaoCompleta()
    const infoPartidoSim = simulacao.partidosComVagas.find(p => p.partido === partidoNome)
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
    const adversarios = partidos.filter(p => p.nome !== partidoNome)

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
      conclusao: vagasTotaisPrevistas > 0 
        ? `REPUBLICANOS elege ${vagasTotaisPrevistas} candidato(s) (${vagasDiretas} diretas + ${vagasSobra} sobras)`
        : `REPUBLICANOS não elege ninguém`
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto p-4">
        {/* Notificação de auto-save */}
        {notificacaoAutoSave && (
          <div className="fixed top-4 right-4 z-50 bg-green-500 text-white px-4 py-2 rounded-lg shadow-lg flex items-center gap-2">
            <Check className="h-4 w-4" />
            <span className="text-sm">{notificacaoAutoSave}</span>
          </div>
        )}

        {/* Indicador de carregamento */}
        {!dadosCarregados && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex flex-col items-center gap-4">
              <RefreshCw className="h-8 w-8 animate-spin text-accent-gold" />
              <span className="text-gray-700">Carregando dados...</span>
            </div>
          </div>
        )}
        
        <div ref={fullscreenRef} className={`${isFullscreen ? 'bg-white p-4 max-h-screen overflow-y-auto' : 'bg-transparent'} transition-all duration-300`}>
          <div ref={contentRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full space-y-4 py-4">
            {/* Controles (título na navbar) */}
            <div className="flex items-center justify-between mb-4">
              <div />
              <div className="flex items-center gap-2">
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
              partidosAtuais={converterPartidosParaCenario()}
              quocienteAtual={quociente}
              onCenarioChange={(cenario) => {
                setCenarioAtivo(cenario)
                const partidosOrdenados = ordenarPartidos(cenario.partidos)
                setPartidos(partidosOrdenados)
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
                  const novoCenario = await carregarCenario(cenarioId)
                  if (novoCenario) {
                    setCenarioAtivo(novoCenario)
                    const partidosOrdenados = ordenarPartidos(novoCenario.partidos)
                    setPartidos(partidosOrdenados)
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
                    onBlur={async () => {
                      if (cenarioAtivo) {
                        const partidosConvertidos = converterPartidosParaCenario()
                        await atualizarCenario(cenarioAtivo.id, partidosConvertidos, quociente)
                        mostrarNotificacaoAutoSave('Quociente eleitoral atualizado')
                      }
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
              <button
                onClick={() => setDialogNovoPartidoAberto(true)}
                className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 flex items-center gap-2 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" />
                Adicionar Partido
              </button>
            </div>
          </div>

          {/* Grid de partidos */}
          <div className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {ordenarPartidos(partidos)
              .filter(partido => !partidosOcultos[partido.nome])
              .map((partido, pIdx) => {
                const partidoIdx = partidos.findIndex(p => p.nome === partido.nome)
                
                const atingiuMinimo = partidoAtingiuMinimo(partido.nome)
                const quocienteMinimo = getQuocienteMinimo()
                const votosProjetados = getVotosProjetados(partido.candidatos, partido.nome)
                
                return (
                  <div key={partido.nome} className={`flex flex-col items-center bg-white rounded-lg shadow-sm border border-card p-4 h-full ${
                    atingiuMinimo 
                      ? 'border-border-card' 
                      : 'border-status-error/50 bg-status-error/5'
                  }`}>
                    <div className={`w-full py-2 px-3 font-bold text-sm mb-3 rounded text-center ${
                      atingiuMinimo 
                        ? 'bg-bg-surface text-text-primary' 
                        : 'bg-status-error/10 text-status-error'
                    }`}>
                      <div className="flex items-center justify-center relative">
                        <span className="px-2">{partido.nome}</span>
                        <div className="absolute right-0 top-1/2 -translate-y-1/2 flex items-center gap-1">
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
                          {partido.nome === 'REPUBLICANOS' && (
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
                    
                    <div className="w-full flex flex-col flex-1 overflow-y-auto">
                      <div className="space-y-0.5">
                        <table className="w-full text-xs">
                          <tbody>
                            {(() => {
                              const { homens } = separarCandidatosPorGenero(partido.candidatos)
                              return homens.map((c, idx) => (
                                <tr 
                                  key={`homem-${c.nome}-${idx}`}
                                  className="group relative hover:bg-bg-app transition-colors"
                                  onMouseEnter={() => setHoveredRow({ partidoIdx: pIdx, candidatoNome: c.nome })}
                                  onMouseLeave={() => {
                                    if (!(editingName?.partidoIdx === pIdx && editingName?.candidatoNome === c.nome)) {
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
                                          value={editingName?.partidoIdx === pIdx && editingName?.candidatoNome === c.nome 
                                            ? editingName.tempValue 
                                            : c.nome}
                                          onFocus={() => startEditingName(pIdx, c.nome)}
                                          onChange={e => {
                                            if (editingName?.partidoIdx === pIdx && editingName?.candidatoNome === c.nome) {
                                              setEditingName({ ...editingName, tempValue: e.target.value })
                                            }
                                          }}
                                          onBlur={() => saveNameChange(pIdx, c.nome)}
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
                                      editVoto && editVoto.partidoIdx === pIdx && editVoto.candidatoNome === c.nome ? (
                                        <input
                                          type="number"
                                          min={0}
                                          value={c.votos}
                                          autoFocus
                                          onChange={e => {
                                            const value = e.target.value
                                            updateLocalState(pIdx, c.nome, 'votos', value)
                                          }}
                                          onBlur={() => {
                                            saveVotosChange(pIdx, c.nome, c.votos)
                                            setEditVoto(null)
                                          }}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              saveVotosChange(pIdx, c.nome, c.votos)
                                              setEditVoto(null)
                                            }
                                          }}
                                          className="bg-transparent border-b border-gray-200 focus:border-blue-400 outline-none w-full text-xs py-0.5 px-1 text-right"
                                          style={{ textAlign: 'right' }}
                                        />
                                      ) : (
                                        <span
                                          className="cursor-pointer select-text"
                                          onClick={() => setEditVoto({ partidoIdx: pIdx, candidatoNome: c.nome })}
                                        >
                                          {Number(c.votos).toLocaleString('pt-BR')}
                                        </span>
                                      )
                                    )}
                                  </td>
                                  <td className="pl-2 text-right whitespace-nowrap font-normal align-top w-8">
                                    {(hoveredRow?.partidoIdx === pIdx && hoveredRow?.candidatoNome === c.nome) || 
                                     (editingName?.partidoIdx === pIdx && editingName?.candidatoNome === c.nome) ? (
                                      <button
                                        onClick={() => {
                                          if (confirm(`Tem certeza que deseja excluir o candidato ${c.nome}?`)) {
                                            handleExcluirCandidato(pIdx, c.nome)
                                          }
                                        }}
                                        className="text-red-500 hover:text-red-700 hover:bg-red-50 p-1 rounded"
                                      >
                                        <Trash2 className="h-4 w-4" />
                                      </button>
                                    ) : null}
                                  </td>
                                </tr>
                              ))
                            })()}
                          </tbody>
                        </table>

                        <div className="border-t border-border-card my-1"></div>

                        <table className="w-full text-xs">
                          <tbody>
                            {(() => {
                              const { mulheres } = separarCandidatosPorGenero(partido.candidatos)
                              return mulheres.map((c, idx) => (
                                <tr 
                                  key={`mulher-${c.nome}-${idx}`}
                                  className="group relative hover:bg-bg-app transition-colors"
                                  onMouseEnter={() => setHoveredRow({ partidoIdx: pIdx, candidatoNome: c.nome })}
                                  onMouseLeave={() => {
                                    if (!(editingName?.partidoIdx === pIdx && editingName?.candidatoNome === c.nome)) {
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
                                          value={editingName?.partidoIdx === pIdx && editingName?.candidatoNome === c.nome 
                                            ? editingName.tempValue 
                                            : c.nome}
                                          onFocus={() => startEditingName(pIdx, c.nome)}
                                          onChange={e => {
                                            if (editingName?.partidoIdx === pIdx && editingName?.candidatoNome === c.nome) {
                                              setEditingName({ ...editingName, tempValue: e.target.value })
                                            }
                                          }}
                                          onBlur={() => saveNameChange(pIdx, c.nome)}
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
                                      editVoto && editVoto.partidoIdx === pIdx && editVoto.candidatoNome === c.nome ? (
                                        <input
                                          type="number"
                                          min={0}
                                          value={c.votos}
                                          autoFocus
                                          onChange={e => {
                                            const value = e.target.value
                                            updateLocalState(pIdx, c.nome, 'votos', value)
                                          }}
                                          onBlur={() => {
                                            saveVotosChange(pIdx, c.nome, c.votos)
                                            setEditVoto(null)
                                          }}
                                          onKeyDown={e => {
                                            if (e.key === 'Enter') {
                                              saveVotosChange(pIdx, c.nome, c.votos)
                                              setEditVoto(null)
                                            }
                                          }}
                                          className="bg-transparent border-b border-border-card focus:border-accent-gold outline-none text-xs py-0.5 px-1 text-right text-text-primary"
                                          style={{ textAlign: 'right' }}
                                        />
                                      ) : (
                                        <span
                                          className="cursor-pointer select-text text-accent-gold font-semibold"
                                          onClick={() => setEditVoto({ partidoIdx: pIdx, candidatoNome: c.nome })}
                                        >
                                          {Number(c.votos).toLocaleString('pt-BR')}
                                        </span>
                                      )
                                    )}
                                  </td>
                                  <td className="pl-1 text-right font-normal align-top w-6">
                                    {(hoveredRow?.partidoIdx === pIdx && hoveredRow?.candidatoNome === c.nome) || 
                                     (editingName?.partidoIdx === pIdx && editingName?.candidatoNome === c.nome) ? (
                                      <button
                                        onClick={() => {
                                          if (confirm(`Tem certeza que deseja excluir o candidato ${c.nome}?`)) {
                                            handleExcluirCandidato(pIdx, c.nome)
                                          }
                                        }}
                                        className="text-status-error hover:text-status-error/80 hover:bg-status-error/10 p-0.5 rounded"
                                      >
                                        <Trash2 className="h-3.5 w-3.5" />
                                      </button>
                                    ) : null}
                                  </td>
                                </tr>
                              ))
                            })()}
                          </tbody>
                        </table>
                      </div>

                      {/* Input de Votos de Legenda */}
                      <div className="mt-3 pt-2 border-t border-gray-200">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-semibold text-gray-700">VOTOS LEGENDA:</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9.]*"
                            value={votosLegendaTemp[partido.nome] !== undefined 
                              ? votosLegendaTemp[partido.nome] 
                              : (votosLegenda[partido.nome] || 0).toLocaleString('pt-BR')}
                            onChange={e => {
                              const raw = e.target.value.replace(/\./g, '')
                              const num = Number(raw)
                              if (!isNaN(num) && num >= 0) {
                                setVotosLegendaTemp({ ...votosLegendaTemp, [partido.nome]: raw })
                              } else if (raw === '') {
                                setVotosLegendaTemp({ ...votosLegendaTemp, [partido.nome]: '0' })
                              }
                            }}
                            onBlur={async () => {
                              const raw = votosLegendaTemp[partido.nome]
                              if (raw !== undefined) {
                                const num = Number(raw.replace(/\./g, ''))
                                if (!isNaN(num) && num >= 0) {
                                  const novoVotosLegenda = { ...votosLegenda, [partido.nome]: num }
                                  setVotosLegenda(novoVotosLegenda)
                                  setVotosLegendaTemp({ ...votosLegendaTemp, [partido.nome]: '' })
                                  
                                  if (cenarioAtivo) {
                                    const partidosConvertidos = converterPartidosParaCenario()
                                    await atualizarCenario(cenarioAtivo.id, partidosConvertidos, quociente)
                                    mostrarNotificacaoAutoSave('Votos de legenda atualizados')
                                  }
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
                        </div>
                      </div>

                      <button
                        onClick={() => setDialogAberto(pIdx)}
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
                                <div className={`font-semibold text-sm mb-2 text-center ${coresPartidos[partido as keyof typeof coresPartidos]?.cor || 'bg-gray-200'} ${coresPartidos[partido as keyof typeof coresPartidos]?.corTexto || 'text-gray-800'}`}>{partido}</div>
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

