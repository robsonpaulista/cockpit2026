'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  cargoAnoKey,
  cargoPermiteSelecaoCandidatos,
  cargosVotacaoSecao,
  isVotavelLegendaBweb,
  listarCargosAno,
  normalizarNomeCargo,
  normalizeMunicipioComparacao,
  parseCargosComparacaoParam,
  parseModoComparacaoSecao,
  parseVotacaoSecaoAno,
  parseVotacaoSecaoAnos,
  rotuloCargoAno,
  serializarAnosVotacaoSecao,
  serializarCargosComparacao,
  VOTACAO_SECAO_ANOS,
  VOTACAO_SECAO_ANO_PADRAO,
  type ModoComparacaoSecao,
  type VotacaoSecaoAno,
} from '@/lib/votacao-secao'
import type { VotacaoSecaoItem, VotacaoSecaoResumo } from '@/lib/votacao-secao'
import { ModalMapearVotoCasado } from '@/components/modal-mapear-voto-casado'
import {
  analisesComparacaoEntreCargos,
  contarSecoesSemelhantes,
  mapaParesSemelhantesPorSecao,
  MARGEM_VOTOS_CASADOS,
  MARGEM_VOTOS_PARECIDOS,
  paresSemelhantesAgregados,
  type AnaliseComparacaoVotos,
  type ParSemelhanteSecao,
} from '@/lib/votacao-secao-correlacao'
import {
  agruparMatrizPorBairro,
  agruparMatrizPorLocal,
  contarBairrosMatriz,
  idsCandidatosPadrao,
  listarCandidatosSecao,
  montarMatrizVotacaoSecao,
  type CandidatoMatrizColuna,
  type GrupoBairroMatriz,
  type GrupoLocalMatriz,
  type LinhaMatrizSecao,
} from '@/lib/votacao-secao-matriz'

const LOCAIS_POR_PAGINA = 25
const BAIRROS_POR_PAGINA = 20
/** Máximo de candidatos por cargo no mapeamento automático de voto casado. */
const TOP_CANDIDATOS_MAPEAMENTO_CASADO = 25
const AGRUPAMENTOS = [
  { id: 'local', label: 'Por local' },
  { id: 'bairro', label: 'Por bairro' },
] as const
type AgrupamentoMatriz = (typeof AGRUPAMENTOS)[number]['id']

const MODOS_COMPARACAO = [
  { id: 'cargo' as const, label: 'Por cargo' },
  { id: 'comparar' as const, label: 'Comparar cargos' },
]

function abreviarCargo(dsCargo: string): string {
  const map: Record<string, string> = {
    'Deputado Federal': 'Fed.',
    'Deputado Estadual': 'Est.',
    Governador: 'Gov.',
    Senador: 'Sen.',
    Prefeito: 'Pref.',
    Vereador: 'Ver.',
  }
  return map[dsCargo] ?? dsCargo
}

function chaveCargoCandidato(c: CandidatoMatrizColuna): string {
  return c.anoEleicao != null ? cargoAnoKey(c.anoEleicao as VotacaoSecaoAno, c.dsCargo) : c.dsCargo
}

function rotuloCabecalhoCandidato(c: CandidatoMatrizColuna, multiAno: boolean): string {
  if (multiAno && c.anoEleicao != null) {
    return `${abreviarCargo(c.dsCargo)} ${c.anoEleicao}`
  }
  return abreviarCargo(c.dsCargo)
}

function normalizeCityName(city: string): string {
  return normalizeMunicipioComparacao(city)
}

const selectFiltroClass =
  'h-10 w-full rounded-lg border border-card bg-background px-3 text-sm text-text-primary disabled:opacity-50'

function CampoFiltro({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 flex-col gap-1.5', className)}>
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </div>
  )
}

function anosIguais(
  a: readonly VotacaoSecaoAno[],
  b: readonly VotacaoSecaoAno[],
): boolean {
  return serializarAnosVotacaoSecao(a) === serializarAnosVotacaoSecao(b)
}

function listasIguais(a: readonly string[], b: readonly string[]): boolean {
  if (a.length !== b.length) return false
  return a.every((v, i) => v === b[i])
}

export default function VotacaoSecaoPage() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [municipios, setMunicipios] = useState<string[]>([])
  const [cidade, setCidade] = useState('')
  const [anos, setAnos] = useState<VotacaoSecaoAno[]>([VOTACAO_SECAO_ANO_PADRAO])
  const anoPrincipal = anos[0] ?? VOTACAO_SECAO_ANO_PADRAO
  const multiAno = anos.length > 1
  const [cargo, setCargo] = useState<string>(cargosVotacaoSecao(VOTACAO_SECAO_ANO_PADRAO)[0])
  const [modoComparacao, setModoComparacao] = useState<ModoComparacaoSecao>('cargo')
  const [cargosComparacao, setCargosComparacao] = useState<string[]>(() =>
    listarCargosAno([VOTACAO_SECAO_ANO_PADRAO]).map(({ ano, cargo: c }) => cargoAnoKey(ano, c)),
  )
  const cargosDisponiveis = useMemo(
    () =>
      multiAno
        ? listarCargosAno(anos).map(({ ano, cargo: c }) => cargoAnoKey(ano, c))
        : [...cargosVotacaoSecao(anoPrincipal)],
    [anos, multiAno, anoPrincipal],
  )
  const modoComparar = multiAno || modoComparacao === 'comparar'
  const anosKey = useMemo(() => serializarAnosVotacaoSecao(anos), [anos])
  const permiteSelecaoCandidatos =
    modoComparar || cargoPermiteSelecaoCandidatos(cargo)
  const [loading, setLoading] = useState(false)
  const [loadingMunicipios, setLoadingMunicipios] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [resumo, setResumo] = useState<VotacaoSecaoResumo | null>(null)
  const [secoes, setSecoes] = useState<VotacaoSecaoItem[]>([])
  const [pagina, setPagina] = useState(1)
  const [candidatosSel, setCandidatosSel] = useState<string[]>([])
  const [buscaCandidato, setBuscaCandidato] = useState('')
  const [agrupamento, setAgrupamento] = useState<AgrupamentoMatriz>('bairro')
  const [locaisExpandidos, setLocaisExpandidos] = useState<Set<string>>(new Set())
  const [bairrosExpandidos, setBairrosExpandidos] = useState<Set<string>>(new Set())
  const [filtroSoSemelhantes, setFiltroSoSemelhantes] = useState(false)
  const [modalVotoCasadoAberto, setModalVotoCasadoAberto] = useState(false)
  const [paresCasadosChaves, setParesCasadosChaves] = useState<Set<string> | null>(null)
  const [margemSemelhancaAtiva, setMargemSemelhancaAtiva] = useState(MARGEM_VOTOS_PARECIDOS)

  useEffect(() => {
    setLoadingMunicipios(true)
    const qs = new URLSearchParams({
      only_municipios: 'true',
      anos: anosKey,
    })
    fetch(`/api/resumo-eleicoes/votacao-secao?${qs}`)
      .then((r) => r.json())
      .then((data) => {
        setMunicipios(data.municipios ?? [])
      })
      .catch(() => setMunicipios([]))
      .finally(() => setLoadingMunicipios(false))
  }, [anosKey])

  useEffect(() => {
    if (multiAno) return
    const lista = cargosVotacaoSecao(anoPrincipal)
    setCargo((prev) => (lista.includes(prev) ? prev : lista[0]))
  }, [anoPrincipal, multiAno])

  const syncQuery = useCallback(
    (patch: {
      cidade?: string
      anos?: readonly VotacaoSecaoAno[]
      cargo?: string
      modo?: ModoComparacaoSecao
      cargosComparacao?: readonly string[]
    }) => {
      const params = new URLSearchParams(searchParams.toString())
      if (patch.cidade !== undefined) {
        if (patch.cidade) params.set('cidade', patch.cidade)
        else params.delete('cidade')
      }
      if (patch.anos !== undefined) {
        params.set('anos', serializarAnosVotacaoSecao(patch.anos))
        params.delete('ano')
      }
      if (patch.cargo !== undefined) {
        if (patch.cargo) params.set('cargo', patch.cargo)
        else params.delete('cargo')
      }
      if (patch.modo !== undefined) {
        if (patch.modo === 'comparar') params.set('modo', 'comparar')
        else params.delete('modo')
      }
      if (patch.cargosComparacao !== undefined) {
        const anosRef = patch.anos ?? anos
        const todosDisponiveis =
          anosRef.length > 1
            ? listarCargosAno(anosRef).map(({ ano, cargo: c }) => cargoAnoKey(ano, c))
            : [...cargosVotacaoSecao(anosRef[0] ?? VOTACAO_SECAO_ANO_PADRAO)]
        const serializado = serializarCargosComparacao(patch.cargosComparacao)
        const todosSerializado = serializarCargosComparacao(todosDisponiveis)
        if (patch.cargosComparacao.length > 0 && serializado !== todosSerializado) {
          params.set('cargos', serializado)
        } else {
          params.delete('cargos')
        }
      }
      const qs = params.toString()
      const atual = searchParams.toString()
      if (qs === atual) return
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams, anos],
  )

  const searchKey = searchParams.toString()

  useEffect(() => {
    const sp = new URLSearchParams(searchKey)
    const cargoParam = sp.get('cargo')
    const anosFromUrl = parseVotacaoSecaoAnos(sp.get('anos'), sp.get('ano'))
    const modoFromUrl = parseModoComparacaoSecao(sp.get('modo'))
    const modoEfetivo = anosFromUrl.length > 1 ? 'comparar' : modoFromUrl
    const cargosFromUrl = parseCargosComparacaoParam(sp.get('cargos'), anosFromUrl)

    setAnos((prev) => (anosIguais(prev, anosFromUrl) ? prev : anosFromUrl))
    setModoComparacao((prev) => (prev === modoEfetivo ? prev : modoEfetivo))
    setCargosComparacao((prev) =>
      listasIguais(prev, cargosFromUrl) ? prev : cargosFromUrl,
    )

    const cargosAnoUnico =
      anosFromUrl.length === 1 ? cargosVotacaoSecao(anosFromUrl[0]) : []
    if (cargoParam && cargosAnoUnico.includes(cargoParam)) {
      setCargo((prev) => (prev === cargoParam ? prev : cargoParam))
    }
  }, [searchKey])

  useEffect(() => {
    const cidadeParam = new URLSearchParams(searchKey).get('cidade')
    if (!cidadeParam) return

    const alvo = municipios.find((m) => normalizeCityName(m) === normalizeCityName(cidadeParam))
    const proxima = alvo ?? cidadeParam
    setCidade((prev) =>
      normalizeCityName(prev) === normalizeCityName(proxima) ? prev : proxima,
    )
  }, [municipios, searchKey])

  const carregar = useCallback(
    async (
      nomeCidade: string,
      cargoSel: string,
      anosSel: readonly VotacaoSecaoAno[],
      modoSel: ModoComparacaoSecao,
      nrPreselecao?: number | null,
    ) => {
      const alvo = nomeCidade.trim()
      if (!alvo) return
      setLoading(true)
      setError(null)
      setPagina(1)
      setLocaisExpandidos(new Set())
      setBairrosExpandidos(new Set())
      try {
        const comparar = anosSel.length > 1 || modoSel === 'comparar'
        const params = new URLSearchParams({
          cidade: alvo,
          cargo: comparar ? 'todos' : cargoSel,
          anos: serializarAnosVotacaoSecao(anosSel),
        })
        const res = await fetch(`/api/resumo-eleicoes/votacao-secao?${params.toString()}`)
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          throw new Error(data.error || `Erro ${res.status}`)
        }
        const listaSecoes = (data.secoes ?? []) as VotacaoSecaoItem[]
        setResumo(data.resumo ?? null)
        setSecoes(listaSecoes)

        if (comparar) {
          setCandidatosSel([])
        } else {
          const todos = listarCandidatosSecao(listaSecoes)
          if (nrPreselecao != null && nrPreselecao > 0) {
            const match = todos.find(
              (c) =>
                c.nrVotavel === nrPreselecao &&
                normalizarNomeCargo(c.dsCargo) === normalizarNomeCargo(cargoSel),
            )
            setCandidatosSel(match ? [match.id] : idsCandidatosPadrao(todos, cargoSel))
          } else {
            setCandidatosSel(idsCandidatosPadrao(todos, cargoSel))
          }
        }
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar votação por seção')
        setResumo(null)
        setSecoes([])
        setCandidatosSel([])
      } finally {
        setLoading(false)
      }
    },
    [],
  )

  useEffect(() => {
    if (!cidade) return
    const anosSel = parseVotacaoSecaoAnos(anosKey, null)
    const sp = new URLSearchParams(searchKey)
    const nrRaw = Number.parseInt(sp.get('nr') ?? '', 10)
    const nrPreselecao = Number.isFinite(nrRaw) && nrRaw > 0 ? nrRaw : null
    void carregar(cidade, cargo, anosSel, modoComparacao, nrPreselecao)
  }, [cidade, cargo, anosKey, modoComparacao, carregar, searchKey])

  const todosCandidatos = useMemo(
    () =>
      listarCandidatosSecao(
        secoes,
        modoComparar ? cargosComparacao : null,
      ),
    [secoes, modoComparar, cargosComparacao],
  )

  const candidatosPorCargo = useMemo(() => {
    const mapa = new Map<string, CandidatoMatrizColuna[]>()
    for (const c of todosCandidatos) {
      const chave = chaveCargoCandidato(c)
      const lista = mapa.get(chave) ?? []
      lista.push(c)
      mapa.set(chave, lista)
    }
    return mapa
  }, [todosCandidatos])

  const matriz = useMemo(
    () => montarMatrizVotacaoSecao(secoes, candidatosSel),
    [secoes, candidatosSel],
  )

  const analisesComparacao = useMemo(
    () =>
      modoComparar && matriz.candidatos.length >= 2
        ? analisesComparacaoEntreCargos(matriz.linhas, matriz.candidatos)
        : [],
    [modoComparar, matriz],
  )

  const destacarSemelhanca = modoComparar && matriz.candidatos.length >= 2

  const paresPorSecao = useMemo(
    () =>
      destacarSemelhanca
        ? mapaParesSemelhantesPorSecao(
            matriz.linhas,
            matriz.candidatos,
            margemSemelhancaAtiva,
            paresCasadosChaves,
          )
        : new Map<string, ParSemelhanteSecao[]>(),
    [destacarSemelhanca, matriz.linhas, matriz.candidatos, margemSemelhancaAtiva, paresCasadosChaves],
  )

  const totalSecoesSemelhantes = useMemo(
    () => contarSecoesSemelhantes(paresPorSecao),
    [paresPorSecao],
  )

  useEffect(() => {
    setFiltroSoSemelhantes(false)
    setParesCasadosChaves(null)
    setMargemSemelhancaAtiva(MARGEM_VOTOS_PARECIDOS)
  }, [cidade, anosKey, modoComparacao])

  const podeMapearVotoCasado =
    !multiAno && modoComparar && Boolean(cidade) && secoes.length > 0 && cargosComparacao.length >= 2

  const candidatosParaMapeamento = useMemo(() => {
    const todos = listarCandidatosSecao(secoes, cargosComparacao)
    const porCargo = new Map<string, CandidatoMatrizColuna[]>()
    for (const c of todos) {
      if (isVotavelLegendaBweb(c.nrVotavel)) continue
      const lista = porCargo.get(c.dsCargo) ?? []
      lista.push(c)
      porCargo.set(c.dsCargo, lista)
    }
    return [...porCargo.values()].flatMap((lista) =>
      [...lista]
        .sort((a, b) => b.totalVotos - a.totalVotos)
        .slice(0, TOP_CANDIDATOS_MAPEAMENTO_CASADO),
    )
  }, [secoes, cargosComparacao])

  const linhasMapeamento = useMemo(
    () =>
      montarMatrizVotacaoSecao(
        secoes,
        candidatosParaMapeamento.map((c) => c.id),
      ).linhas,
    [secoes, candidatosParaMapeamento],
  )

  const gruposLocal = useMemo(
    () => agruparMatrizPorLocal(matriz.linhas),
    [matriz.linhas],
  )

  const gruposBairro = useMemo(
    () => agruparMatrizPorBairro(matriz.linhas),
    [matriz.linhas],
  )

  const grupoTemSecaoSemelhante = useCallback(
    (secoes: LinhaMatrizSecao[]) =>
      secoes.some((s) => (paresPorSecao.get(s.localId)?.length ?? 0) > 0),
    [paresPorSecao],
  )

  const gruposBairroVisiveis = useMemo(() => {
    if (!filtroSoSemelhantes || !destacarSemelhanca) return gruposBairro
    return gruposBairro.filter((g) =>
      g.locais.some((l) => grupoTemSecaoSemelhante(l.secoes)),
    )
  }, [gruposBairro, filtroSoSemelhantes, destacarSemelhanca, grupoTemSecaoSemelhante])

  const gruposLocalVisiveis = useMemo(() => {
    if (!filtroSoSemelhantes || !destacarSemelhanca) return gruposLocal
    return gruposLocal.filter((g) => grupoTemSecaoSemelhante(g.secoes))
  }, [gruposLocal, filtroSoSemelhantes, destacarSemelhanca, grupoTemSecaoSemelhante])

  const totalBairros = useMemo(() => contarBairrosMatriz(matriz.linhas), [matriz.linhas])
  const secoesComBairro = useMemo(
    () => matriz.linhas.filter((l) => l.nmBairro?.trim()).length,
    [matriz.linhas],
  )

  const totalPaginas =
    agrupamento === 'bairro'
      ? Math.max(1, Math.ceil(gruposBairroVisiveis.length / BAIRROS_POR_PAGINA))
      : Math.max(1, Math.ceil(gruposLocalVisiveis.length / LOCAIS_POR_PAGINA))

  const gruposLocalPagina = useMemo(() => {
    const start = (pagina - 1) * LOCAIS_POR_PAGINA
    return gruposLocalVisiveis.slice(start, start + LOCAIS_POR_PAGINA)
  }, [gruposLocalVisiveis, pagina])

  const gruposBairroPagina = useMemo(() => {
    const start = (pagina - 1) * BAIRROS_POR_PAGINA
    return gruposBairroVisiveis.slice(start, start + BAIRROS_POR_PAGINA)
  }, [gruposBairroVisiveis, pagina])

  const chaveLocalExpandido = (bairroId: string | null, localId: string) =>
    bairroId ? `${bairroId}::${localId}` : localId

  const toggleLocal = (localId: string, bairroId: string | null = null) => {
    const key = chaveLocalExpandido(bairroId, localId)
    setLocaisExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const toggleBairro = (id: string) => {
    setBairrosExpandidos((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const expandirTodos = () => {
    if (agrupamento === 'bairro') {
      setBairrosExpandidos(new Set(gruposBairro.map((g) => g.id)))
      setLocaisExpandidos(
        new Set(
          gruposBairro.flatMap((b) => b.locais.map((l) => chaveLocalExpandido(b.id, l.id))),
        ),
      )
      return
    }
    setLocaisExpandidos(new Set(gruposLocal.map((g) => g.id)))
  }

  const recolherTodos = () => {
    setLocaisExpandidos(new Set())
    setBairrosExpandidos(new Set())
  }

  const candidatosDisponiveisFiltrados = useMemo(() => {
    const q = buscaCandidato.trim().toLowerCase()
    if (!q) return todosCandidatos
    return todosCandidatos.filter(
      (c) =>
        c.nmVotavel.toLowerCase().includes(q) ||
        String(c.nrVotavel).includes(q),
    )
  }, [todosCandidatos, buscaCandidato])

  const toggleCandidato = (id: string) => {
    setCandidatosSel((prev) => {
      if (prev.includes(id)) {
        if (!modoComparar && prev.length <= 1) return prev
        return prev.filter((x) => x !== id)
      }
      return [...prev, id]
    })
  }

  const toggleCargoComparacao = (cargoChave: string) => {
    const ativo = cargosComparacao.includes(cargoChave)
    const next = ativo
      ? cargosComparacao.filter((c) => c !== cargoChave)
      : [...cargosComparacao, cargoChave]
    if (next.length === 0) return

    setCargosComparacao(next)
    setCandidatosSel((sel) =>
      sel.filter((id) => {
        const cand = todosCandidatos.find((c) => c.id === id)
        return cand ? next.includes(chaveCargoCandidato(cand)) : false
      }),
    )
    syncQuery({ cidade, anos, cargo, modo: modoComparacao, cargosComparacao: next })
  }

  const toggleAno = (a: VotacaoSecaoAno) => {
    const tem = anos.includes(a)
    const next: VotacaoSecaoAno[] = tem
      ? anos.length <= 1
        ? anos
        : (anos.filter((x) => x !== a) as VotacaoSecaoAno[])
      : ([...anos, a].sort((x, y) => y - x) as VotacaoSecaoAno[])

    if (next === anos) return

    setAnos(next)
    setPagina(1)
    recolherTodos()
    setCandidatosSel([])

    const proximoModo: ModoComparacaoSecao = next.length > 1 ? 'comparar' : modoComparacao
    if (next.length > 1) setModoComparacao('comparar')

    const cargosProx =
      next.length > 1
        ? listarCargosAno(next).map(({ ano, cargo: c }) => cargoAnoKey(ano, c))
        : [...cargosVotacaoSecao(next[0])]

    setCargosComparacao(cargosProx)

    if (next.length === 1) {
      const lista = cargosVotacaoSecao(next[0])
      setCargo(lista.includes(cargo) ? cargo : lista[0])
    }

    syncQuery({
      cidade,
      anos: next,
      cargo: next.length === 1 ? cargo : undefined,
      modo: proximoModo,
      cargosComparacao: proximoModo === 'comparar' ? cargosProx : undefined,
    })
  }

  const selecionarTop = (n: number) => {
    setCandidatosSel(todosCandidatos.slice(0, n).map((c) => c.id))
  }

  const filtrarCandidatosBusca = useCallback(
    (lista: CandidatoMatrizColuna[]) => {
      const q = buscaCandidato.trim().toLowerCase()
      if (!q) return lista
      return lista.filter(
        (c) =>
          c.nmVotavel.toLowerCase().includes(q) || String(c.nrVotavel).includes(q),
      )
    },
    [buscaCandidato],
  )

  return (
    <div className="min-h-screen w-full min-w-0 bg-bg-surface pb-12">
      <div className="w-full min-w-0 px-4 py-6 lg:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-4">
          <Link
            href={
              cidade
                ? `/dashboard/resumo-eleicoes?cidade=${encodeURIComponent(cidade)}`
                : '/dashboard/resumo-eleicoes'
            }
            className="inline-flex items-center gap-2 rounded-lg border border-card bg-surface px-3 py-2 text-sm text-text-primary hover:bg-background"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao resumo
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-text-primary">Votação por seção</h1>
            <p className="text-sm text-text-secondary">
              Matriz comparativa · Eleições {anos.join(' e ')} · 1º turno · TSE (bweb)
              {multiAno && ' · comparação entre anos'}
            </p>
          </div>
        </div>

        <div className="mb-4 rounded-2xl border border-card bg-surface p-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-12 lg:items-end">
            <CampoFiltro
              label="Município"
              className={cn('sm:col-span-2', modoComparar ? 'lg:col-span-4' : 'lg:col-span-3')}
            >
              <select
                value={cidade}
                onChange={(e) => {
                  const novaCidade = e.target.value
                  setCidade(novaCidade)
                  syncQuery({ cidade: novaCidade, anos, cargo, modo: modoComparacao })
                }}
                disabled={loadingMunicipios}
                className={selectFiltroClass}
              >
                <option value="">Selecione…</option>
                {municipios.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </CampoFiltro>

            <CampoFiltro label="Anos" className="lg:col-span-2">
              <div className="flex h-10 items-center gap-2">
                {VOTACAO_SECAO_ANOS.map((a) => {
                  const ativo = anos.includes(a)
                  return (
                    <label
                      key={a}
                      className={cn(
                        'inline-flex h-9 min-w-[3.25rem] cursor-pointer items-center justify-center rounded-lg border px-3 text-sm font-medium tabular-nums',
                        ativo
                          ? 'border-accent-gold/50 bg-accent-gold/10 text-text-primary'
                          : 'border-card bg-background text-text-secondary',
                      )}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={ativo}
                        disabled={loading || (ativo && anos.length <= 1)}
                        onChange={() => toggleAno(a)}
                      />
                      {a}
                    </label>
                  )
                })}
              </div>
            </CampoFiltro>

            <CampoFiltro label="Modo" className="lg:col-span-2">
              <select
                value={modoComparar ? 'comparar' : modoComparacao}
                onChange={(e) => {
                  const novoModo = parseModoComparacaoSecao(e.target.value)
                  setModoComparacao(novoModo)
                  setCandidatosSel([])
                  setPagina(1)
                  recolherTodos()
                  if (novoModo === 'comparar') {
                    setCargosComparacao([...cargosDisponiveis])
                  }
                  syncQuery({
                    cidade,
                    anos,
                    cargo,
                    modo: novoModo,
                    cargosComparacao: novoModo === 'comparar' ? cargosDisponiveis : undefined,
                  })
                }}
                disabled={!cidade || loading || multiAno}
                title={
                  multiAno ? 'Com vários anos, a comparação entre cargos é automática' : undefined
                }
                className={cn(selectFiltroClass, multiAno && 'opacity-60')}
              >
                {MODOS_COMPARACAO.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.label}
                  </option>
                ))}
              </select>
            </CampoFiltro>

            {!modoComparar && (
              <CampoFiltro label="Cargo" className="lg:col-span-2">
                <select
                  value={cargo}
                  onChange={(e) => {
                    const novoCargo = e.target.value
                    setCargo(novoCargo)
                    syncQuery({ cidade, anos, cargo: novoCargo, modo: modoComparacao })
                  }}
                  disabled={!cidade || loading}
                  className={selectFiltroClass}
                >
                  {cargosDisponiveis.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </CampoFiltro>
            )}

            <CampoFiltro
              label="Agrupar"
              className={cn('lg:col-span-2', !modoComparar && 'lg:col-span-1')}
            >
              <select
                value={agrupamento}
                onChange={(e) => {
                  setAgrupamento(e.target.value as AgrupamentoMatriz)
                  setPagina(1)
                  recolherTodos()
                }}
                disabled={!cidade || loading}
                className={selectFiltroClass}
              >
                {AGRUPAMENTOS.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.label}
                  </option>
                ))}
              </select>
            </CampoFiltro>

            <div className="flex sm:col-span-2 lg:col-span-2 lg:justify-end">
              <button
                type="button"
                onClick={() => void carregar(cidade, cargo, anos, modoComparacao)}
                disabled={!cidade || loading}
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-4 text-sm font-medium text-text-primary hover:bg-accent-gold/15 disabled:opacity-50 lg:w-auto"
              >
                <RefreshCw className={cn('h-4 w-4 shrink-0', loading && 'animate-spin')} />
                Atualizar
              </button>
            </div>
          </div>

          {modoComparar && (
            <div className="mt-4 border-t border-card pt-4">
              <p className="mb-3 text-xs font-medium text-text-secondary">Cargos na comparação</p>
              {multiAno ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  {anos.map((anoRef) => {
                    const chips = cargosDisponiveis.filter((c) => c.startsWith(`${anoRef}|`))
                    if (chips.length === 0) return null
                    return (
                      <div
                        key={anoRef}
                        className="rounded-xl border border-card bg-background/40 p-3"
                      >
                        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-accent-gold">
                          Eleição {anoRef}
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {chips.map((c) => {
                            const ativo = cargosComparacao.includes(c)
                            return (
                              <label
                                key={c}
                                className={cn(
                                  'inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs',
                                  ativo
                                    ? 'border-accent-gold/50 bg-accent-gold/10 text-text-primary'
                                    : 'border-card bg-surface text-text-secondary',
                                )}
                              >
                                <input
                                  type="checkbox"
                                  className="sr-only"
                                  checked={ativo}
                                  disabled={!cidade || loading}
                                  onChange={() => toggleCargoComparacao(c)}
                                />
                                {rotuloCargoAno(c)}
                              </label>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {cargosDisponiveis.map((c) => {
                    const ativo = cargosComparacao.includes(c)
                    return (
                      <label
                        key={c}
                        className={cn(
                          'inline-flex cursor-pointer items-center rounded-full border px-2.5 py-1 text-xs',
                          ativo
                            ? 'border-accent-gold/50 bg-accent-gold/10 text-text-primary'
                            : 'border-card bg-background text-text-secondary',
                        )}
                      >
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={ativo}
                          disabled={!cidade || loading}
                          onChange={() => toggleCargoComparacao(c)}
                        />
                        {c}
                      </label>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {multiAno && (
            <p className="mt-4 rounded-lg border border-card bg-background/50 px-3 py-2 text-[11px] leading-relaxed text-text-secondary">
              Com dois anos selecionados, você compara cargos municipais e gerais na mesma matriz.
              Só aparecem municípios com dados em todos os anos marcados; as seções são alinhadas por
              zona, seção e local de votação.
            </p>
          )}
        </div>

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-status-danger/30 bg-status-danger/10 p-3 text-sm text-status-danger">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {!cidade && !loadingMunicipios && (
          <div className="rounded-xl border border-dashed border-card p-8 text-center text-sm text-text-secondary">
            Selecione um município para comparar candidatos por seção.
          </div>
        )}

        {loading && (
          <div className="flex items-center justify-center gap-2 py-16 text-text-secondary">
            <Loader2 className="h-6 w-6 animate-spin" />
            Carregando matriz…
          </div>
        )}

        {!loading && resumo && secoes.length > 0 && (
          <>
            <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
              <ResumoCard label="Município" valor={resumo.municipio} />
              <ResumoCard
                label={modoComparar ? 'Cargos' : 'Cargo'}
                valor={
                  modoComparar
                    ? cargosComparacao.map((c) => (multiAno ? rotuloCargoAno(c) : c)).join(' · ')
                    : cargo
                }
              />
              <ResumoCard label="Seções" valor={resumo.totalSecoes.toLocaleString('pt-BR')} />
              <ResumoCard label="Bairros" valor={String(totalBairros)} />
              <ResumoCard
                label={modoComparar ? 'Candidatos selecionados' : 'Candidatos no cargo'}
                valor={String(matriz.candidatos.length)}
              />
              <ResumoCard
                label="Exercício"
                valor={`${(resumo.anosEleicao ?? [resumo.anoEleicao]).join(' · ')} · ${resumo.nrTurno}º turno`}
              />
            </div>

            {secoesComBairro === 0 && (
              <div className="mb-4 rounded-xl border border-accent-gold/30 bg-accent-gold/10 px-4 py-3 text-xs text-text-secondary">
                Bairros ainda não carregados no banco. Execute{' '}
                <code className="rounded bg-background px-1">database/alter-votacao-secao-bairro.sql</code>{' '}
                e{' '}
                <code className="rounded bg-background px-1">
                  python scripts/enrich-votacao-secao-bairro.py --ano {anos.join(' / ')}
                </code>
                .
              </div>
            )}

            {secoesComBairro > 0 && agrupamento === 'local' && (
              <div className="mb-4 rounded-xl border border-card bg-background/40 px-4 py-2 text-xs text-text-secondary">
                Bairro oficial TSE disponível ({totalBairros} no município). Use{' '}
                <strong className="font-medium text-text-primary">Agrupar → Por bairro</strong> para comparar
                candidatos por região.
              </div>
            )}

            <div className="mb-4 rounded-2xl border border-card bg-surface p-4">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-semibold text-text-primary">Candidatos na matriz</h2>
                  <p className="text-xs text-text-secondary">
                    {modoComparar
                      ? paresCasadosChaves
                        ? `Pares de correlação aplicados (margem ${Math.round(margemSemelhancaAtiva * 100)}%).`
                        : 'Marque os cargos e adicione candidatos, ou use o mapeamento de correlação (um ano).'
                      : permiteSelecaoCandidatos
                        ? 'Compare quantos votos cada candidato teve em cada seção (padrão: top 12).'
                        : 'Todos os candidatos do cargo entram na matriz.'}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                {podeMapearVotoCasado && (
                  <button
                    type="button"
                    onClick={() => setModalVotoCasadoAberto(true)}
                    disabled={loading || candidatosParaMapeamento.length < 2}
                    className="rounded-lg border border-accent-gold/40 bg-accent-gold/10 px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-accent-gold/20 disabled:opacity-50"
                  >
                    Mapear correlação…
                  </button>
                )}
                {paresCasadosChaves && paresCasadosChaves.size > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setParesCasadosChaves(null)
                      setMargemSemelhancaAtiva(MARGEM_VOTOS_PARECIDOS)
                    }}
                    className="rounded-lg border border-card px-3 py-1.5 text-xs text-text-secondary hover:bg-background"
                  >
                    Limpar correlação
                  </button>
                )}
                {permiteSelecaoCandidatos && !modoComparar && (
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => selecionarTop(8)}
                      className="rounded border border-card px-2 py-1 text-xs hover:bg-background"
                    >
                      Top 8
                    </button>
                    <button
                      type="button"
                      onClick={() => selecionarTop(12)}
                      className="rounded border border-card px-2 py-1 text-xs hover:bg-background"
                    >
                      Top 12
                    </button>
                    <button
                      type="button"
                      onClick={() => selecionarTop(20)}
                      className="rounded border border-card px-2 py-1 text-xs hover:bg-background"
                    >
                      Top 20
                    </button>
                  </div>
                )}
                </div>
              </div>

              {permiteSelecaoCandidatos && (
                <div className="mb-3">
                  <input
                    type="search"
                    value={buscaCandidato}
                    onChange={(e) => setBuscaCandidato(e.target.value)}
                    placeholder="Buscar candidato por nome ou número…"
                    className="w-full rounded-lg border border-card bg-background px-3 py-1.5 text-sm"
                  />
                </div>
              )}

              <div className="mb-3 flex flex-wrap gap-1.5">
                {matriz.candidatos.map((c) => (
                  <CandidatoChip
                    key={c.id}
                    candidato={c}
                    ativo
                    mostrarCargo={modoComparar}
                    multiAno={multiAno}
                    onRemove={permiteSelecaoCandidatos ? () => toggleCandidato(c.id) : undefined}
                  />
                ))}
                {modoComparar && matriz.candidatos.length === 0 && (
                  <span className="text-xs text-text-secondary">
                    Adicione candidatos dos cargos marcados acima.
                  </span>
                )}
              </div>

              {permiteSelecaoCandidatos && modoComparar && (
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {cargosComparacao.map((cargoItem) => {
                    const lista = filtrarCandidatosBusca(candidatosPorCargo.get(cargoItem) ?? [])
                    const tituloCargo = multiAno ? rotuloCargoAno(cargoItem) : cargoItem
                    if (lista.length === 0) {
                      return (
                        <div
                          key={cargoItem}
                          className="rounded-lg border border-card bg-background/40 p-2 text-xs text-text-secondary"
                        >
                          <p className="font-medium text-text-primary">{tituloCargo}</p>
                          <p className="mt-1">Nenhum candidato encontrado.</p>
                        </div>
                      )
                    }
                    return (
                      <div
                        key={cargoItem}
                        className="flex max-h-52 flex-col rounded-lg border border-card bg-background/40"
                      >
                        <p className="border-b border-card px-2 py-1.5 text-xs font-semibold text-text-primary">
                          {tituloCargo}
                          <span className="ml-1 font-normal text-text-secondary">
                            ({lista.length})
                          </span>
                        </p>
                        <div className="overflow-y-auto p-1">
                          {lista.slice(0, buscaCandidato ? 30 : 20).map((c) => {
                            const selecionado = candidatosSel.includes(c.id)
                            return (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => toggleCandidato(c.id)}
                                className={cn(
                                  'flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs',
                                  selecionado
                                    ? 'bg-accent-gold/15 text-text-primary'
                                    : 'hover:bg-surface',
                                )}
                              >
                                <span>
                                  {c.nrVotavel} · {c.nmVotavel}
                                </span>
                                <span className="tabular-nums text-text-secondary">
                                  {c.totalVotos.toLocaleString('pt-BR')}
                                </span>
                              </button>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}

              {permiteSelecaoCandidatos && !modoComparar && buscaCandidato && (
                <div className="max-h-48 overflow-y-auto rounded-lg border border-card bg-background/50 p-2">
                  {candidatosDisponiveisFiltrados
                    .filter((c) => !candidatosSel.includes(c.id))
                    .slice(0, 20)
                    .map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          toggleCandidato(c.id)
                          setBuscaCandidato('')
                        }}
                        className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-xs hover:bg-surface"
                      >
                        <span>
                          {c.nrVotavel} · {c.nmVotavel}
                        </span>
                        <span className="tabular-nums text-text-secondary">
                          {c.totalVotos.toLocaleString('pt-BR')} total
                        </span>
                      </button>
                    ))}
                </div>
              )}
            </div>

            {modoComparar && analisesComparacao.length > 0 && (
              <PainelComparacaoVotos analises={analisesComparacao} />
            )}

            {modoComparar && matriz.candidatos.length >= 2 && analisesComparacao.length === 0 && (
              <div className="mb-4 rounded-xl border border-card bg-surface px-4 py-3 text-xs text-text-secondary">
                A comparação aparece quando há candidatos selecionados de cargos diferentes.
              </div>
            )}

            {(!modoComparar || matriz.candidatos.length > 0) && (
            <div className="overflow-hidden rounded-2xl border border-card bg-surface">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-card px-4 py-2 text-xs text-text-secondary">
                <span>
                  {agrupamento === 'bairro'
                    ? 'Bairros (TSE) · expanda para locais e seções · colunas = candidatos'
                    : 'Locais agrupados · expanda para seções · colunas = candidatos'}
                  {destacarSemelhanca && (
                    <span className="ml-2 text-text-secondary">
                      pílulas <span className="font-medium text-text-primary">NOME≈NOME</span> =
                      votos semelhantes (até {Math.round(margemSemelhancaAtiva * 100)}%)
                      {paresCasadosChaves?.size ? ' · só pares da correlação' : ''}
                    </span>
                  )}
                </span>
                <div className="flex flex-wrap gap-2">
                  {destacarSemelhanca && (
                    <button
                      type="button"
                      onClick={() => {
                        setFiltroSoSemelhantes((v) => !v)
                        setPagina(1)
                      }}
                      className={cn(
                        'rounded border px-2 py-1 transition-colors',
                        filtroSoSemelhantes
                          ? 'border-accent-gold/50 bg-accent-gold/15 text-text-primary'
                          : 'border-card hover:bg-background',
                      )}
                    >
                      {filtroSoSemelhantes
                        ? 'Mostrar todas as seções'
                        : `Só semelhantes (${totalSecoesSemelhantes})`}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={expandirTodos}
                    className="rounded border border-card px-2 py-1 hover:bg-background"
                  >
                    Expandir todos
                  </button>
                  <button
                    type="button"
                    onClick={recolherTodos}
                    className="rounded border border-card px-2 py-1 hover:bg-background"
                  >
                    Recolher todos
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full min-w-max text-left text-xs">
                  <thead>
                    <tr className="border-b border-card bg-background/70">
                      <th className="sticky left-0 z-20 min-w-[18rem] bg-background/95 px-2 py-2 font-medium backdrop-blur">
                        {agrupamento === 'bairro' ? 'Bairro / Local / Seção' : 'Local / Seção'}
                      </th>
                      {matriz.candidatos.map((c) => (
                        <th
                          key={c.id}
                          className="min-w-[5.5rem] max-w-[8rem] px-2 py-2 text-right font-medium align-bottom"
                          title={`${c.dsCargo} · ${c.nmVotavel} · total ${c.totalVotos.toLocaleString('pt-BR')}`}
                        >
                          {modoComparar && (
                            <div className="truncate text-[9px] font-normal uppercase text-accent-gold">
                              {rotuloCabecalhoCandidato(c, multiAno)}
                            </div>
                          )}
                          <div className="truncate">{c.nmVotavel.split(' ')[0]}</div>
                          <div className="truncate font-normal text-[10px] text-text-secondary">
                            {c.nrVotavel}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {agrupamento === 'bairro'
                      ? gruposBairroPagina.map((grupo) => (
                          <GrupoBairroRows
                            key={grupo.id}
                            grupo={grupo}
                            candidatos={matriz.candidatos}
                            bairroExpandido={bairrosExpandidos.has(grupo.id)}
                            locaisExpandidos={locaisExpandidos}
                            paresPorSecao={paresPorSecao}
                            destacarSemelhanca={destacarSemelhanca}
                            onToggleBairro={() => toggleBairro(grupo.id)}
                            onToggleLocal={(localId) => toggleLocal(localId, grupo.id)}
                          />
                        ))
                      : gruposLocalPagina.map((grupo) => {
                          const expandido = locaisExpandidos.has(grupo.id)
                          const multiSecao = grupo.totalSecoes > 1

                          return (
                            <GrupoLocalRows
                              key={grupo.id}
                              grupo={grupo}
                              candidatos={matriz.candidatos}
                              expandido={expandido}
                              multiSecao={multiSecao}
                              paresPorSecao={paresPorSecao}
                              destacarSemelhanca={destacarSemelhanca}
                              onToggle={() => toggleLocal(grupo.id)}
                            />
                          )
                        })}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-card bg-background/80 font-semibold">
                      <td className="sticky left-0 z-10 bg-background/95 px-2 py-2">
                        Total no município
                      </td>
                      {matriz.candidatos.map((c) => (
                        <td key={c.id} className="px-2 py-2 text-right tabular-nums">
                          {c.totalVotos.toLocaleString('pt-BR')}
                        </td>
                      ))}
                    </tr>
                  </tfoot>
                </table>
              </div>
              {totalPaginas > 1 && (
                <div className="flex items-center justify-between border-t border-card px-4 py-3 text-xs text-text-secondary">
                  <span>
                    Página {pagina} de {totalPaginas}
                    {agrupamento === 'bairro'
                      ? ` · ${gruposBairroVisiveis.length} bairros · ${matriz.linhas.length} seções`
                      : ` · ${gruposLocalVisiveis.length} locais · ${matriz.linhas.length} seções`}
                    {destacarSemelhanca && ` · ${totalSecoesSemelhantes} semelhantes`}
                  </span>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={pagina <= 1}
                      onClick={() => setPagina((p) => Math.max(1, p - 1))}
                      className="rounded border border-card px-2 py-1 disabled:opacity-50"
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      disabled={pagina >= totalPaginas}
                      onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                      className="rounded border border-card px-2 py-1 disabled:opacity-50"
                    >
                      Próxima
                    </button>
                  </div>
                </div>
              )}
            </div>
            )}
          </>
        )}

        <ModalMapearVotoCasado
          aberto={modalVotoCasadoAberto}
          onFechar={() => setModalVotoCasadoAberto(false)}
          municipio={cidade || resumo?.municipio || ''}
          ano={anoPrincipal}
          linhas={linhasMapeamento}
          candidatos={candidatosParaMapeamento}
          onAplicar={({ candidatoIds, paresChaves, margem }) => {
            setCandidatosSel(candidatoIds)
            setParesCasadosChaves(paresChaves)
            setMargemSemelhancaAtiva(margem)
            setPagina(1)
            recolherTodos()
          }}
        />
      </div>
    </div>
  )
}

function PilulasSemelhanca({
  pares,
  compacto = false,
}: {
  pares: ParSemelhanteSecao[]
  compacto?: boolean
}) {
  if (pares.length === 0) return null

  if (compacto && pares.length > 3) {
    return (
      <>
        {pares.slice(0, 2).map((p) => (
          <span
            key={`${p.idA}-${p.idB}`}
            className="inline-flex shrink-0 rounded-full border border-accent-gold/35 bg-accent-gold/10 px-1.5 py-px text-[9px] font-medium text-text-primary"
            title={`${p.nomeA} e ${p.nomeB} — votos semelhantes`}
          >
            {p.nomeA}≈{p.nomeB}
          </span>
        ))}
        <span className="shrink-0 text-[9px] text-text-secondary">+{pares.length - 2}</span>
      </>
    )
  }

  return (
    <>
      {pares.map((p) => (
        <span
          key={`${p.idA}-${p.idB}`}
          className="inline-flex shrink-0 rounded-full border border-accent-gold/35 bg-accent-gold/10 px-1.5 py-px text-[9px] font-medium text-text-primary"
          title={`${p.nomeA} e ${p.nomeB} — votos semelhantes nesta seção`}
        >
          {p.nomeA}≈{p.nomeB}
        </span>
      ))}
    </>
  )
}

function BadgeBairro({ bairro }: { bairro: string | null | undefined }) {
  const nome = bairro?.trim()
  if (!nome) return null
  return (
    <span className="inline-flex rounded-full border border-accent-gold/40 bg-accent-gold/10 px-2 py-0.5 text-[10px] font-medium text-text-primary">
      {nome}
    </span>
  )
}

function MetaLocalSecao({
  nrZona,
  nrSecao,
  nrLocalVotacao,
  nmBairro,
  endereco,
  ocultarBairro = false,
}: {
  nrZona: number
  nrSecao: number
  nrLocalVotacao: number | null
  nmBairro: string | null | undefined
  endereco: string | null | undefined
  ocultarBairro?: boolean
}) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-1 gap-y-1 text-[10px] text-text-secondary">
      <span>
        Zona {nrZona} · Seção {nrSecao}
        {nrLocalVotacao != null ? ` · Local ${nrLocalVotacao}` : ''}
      </span>
      {!ocultarBairro ? <BadgeBairro bairro={nmBairro} /> : null}
      {endereco ? <span className="basis-full sm:basis-auto">· {endereco}</span> : null}
    </div>
  )
}

function CelulasVotosMatriz({
  candidatos,
  votos,
  liderId,
  destacarLider = true,
}: {
  candidatos: CandidatoMatrizColuna[]
  votos: Record<string, number>
  liderId: string | null
  destacarLider?: boolean
}) {
  return (
    <>
      {candidatos.map((c) => {
        const qt = votos[c.id] ?? 0
        const lider = destacarLider && liderId === c.id && qt > 0
        return (
          <td
            key={c.id}
            className={cn(
              'px-2 py-2 text-right tabular-nums',
              lider && 'bg-accent-gold/15 font-semibold text-text-primary',
              !qt && 'text-text-secondary/40',
            )}
          >
            {qt > 0 ? qt.toLocaleString('pt-BR') : '—'}
          </td>
        )
      })}
    </>
  )
}

function GrupoBairroRows({
  grupo,
  candidatos,
  bairroExpandido,
  locaisExpandidos,
  paresPorSecao,
  destacarSemelhanca,
  onToggleBairro,
  onToggleLocal,
}: {
  grupo: GrupoBairroMatriz
  candidatos: CandidatoMatrizColuna[]
  bairroExpandido: boolean
  locaisExpandidos: Set<string>
  paresPorSecao: Map<string, ParSemelhanteSecao[]>
  destacarSemelhanca: boolean
  onToggleBairro: () => void
  onToggleLocal: (localId: string) => void
}) {
  const localUnico = grupo.totalLocais === 1 ? grupo.locais[0] : null
  const secoesGrupo = grupo.locais.flatMap((l) => l.secoes)
  const paresBairro = paresSemelhantesAgregados(secoesGrupo, paresPorSecao)

  if (localUnico && localUnico.totalSecoes === 1) {
    const secao = localUnico.secoes[0]
    const endereco = localUnico.dsEndereco?.trim()
    const pares = paresPorSecao.get(secao.localId) ?? []
    return (
      <tr className="border-b border-card/50 bg-accent-gold/5 hover:bg-accent-gold/10">
        <td className="sticky left-0 z-10 bg-accent-gold/5 px-2 py-2">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-semibold text-text-primary">
            <span>{grupo.nmBairro}</span>
            {destacarSemelhanca && <PilulasSemelhanca pares={pares} />}
          </div>
          <div className="mt-0.5 font-medium text-text-primary">
            {localUnico.nmLocalVotacao || 'Local não informado'}
          </div>
          <MetaLocalSecao
            nrZona={localUnico.nrZona}
            nrSecao={secao.nrSecao}
            nrLocalVotacao={localUnico.nrLocalVotacao}
            nmBairro={null}
            endereco={endereco}
            ocultarBairro
          />
        </td>
        <CelulasVotosMatriz candidatos={candidatos} votos={grupo.votos} liderId={grupo.liderId} />
      </tr>
    )
  }

  const rotuloContagem =
    grupo.totalLocais === 1
      ? `${grupo.totalSecoes} seções`
      : `${grupo.totalLocais} locais · ${grupo.totalSecoes} seções`

  return (
    <>
      <tr className="border-b border-card/50 bg-accent-gold/5 hover:bg-accent-gold/10">
        <td className="sticky left-0 z-10 bg-accent-gold/5 px-2 py-2">
          <button
            type="button"
            onClick={onToggleBairro}
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={bairroExpandido}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary">
              {bairroExpandido ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-text-primary">{grupo.nmBairro}</span>
                <span className="shrink-0 rounded-full border border-card bg-surface px-2 py-0.5 text-[10px] tabular-nums text-text-secondary">
                  {rotuloContagem}
                </span>
                {destacarSemelhanca && (
                  <PilulasSemelhanca pares={paresBairro} compacto={!bairroExpandido} />
                )}
              </span>
            </span>
          </button>
        </td>
        <CelulasVotosMatriz candidatos={candidatos} votos={grupo.votos} liderId={grupo.liderId} />
      </tr>
      {bairroExpandido
        ? grupo.locais.map((local) => (
            <GrupoLocalRows
              key={local.id}
              grupo={local}
              candidatos={candidatos}
              expandido={locaisExpandidos.has(`${grupo.id}::${local.id}`)}
              multiSecao={local.totalSecoes > 1}
              paresPorSecao={paresPorSecao}
              destacarSemelhanca={destacarSemelhanca}
              onToggle={() => onToggleLocal(local.id)}
              indent={1}
              ocultarBairro
            />
          ))
        : null}
    </>
  )
}

function GrupoLocalRows({
  grupo,
  candidatos,
  expandido,
  multiSecao,
  paresPorSecao,
  destacarSemelhanca,
  onToggle,
  indent = 0,
  ocultarBairro = false,
}: {
  grupo: GrupoLocalMatriz
  candidatos: CandidatoMatrizColuna[]
  expandido: boolean
  multiSecao: boolean
  paresPorSecao: Map<string, ParSemelhanteSecao[]>
  destacarSemelhanca: boolean
  onToggle: () => void
  indent?: number
  ocultarBairro?: boolean
}) {
  const tituloLocal = grupo.nmLocalVotacao || 'Local não informado'
  const endereco = grupo.dsEndereco?.trim()
  const padLeft = indent === 0 ? '' : indent === 1 ? 'pl-6' : 'pl-10'
  const paresLocal = paresSemelhantesAgregados(grupo.secoes, paresPorSecao)

  if (!multiSecao) {
    const secao = grupo.secoes[0]
    const pares = paresPorSecao.get(secao.localId) ?? []
    return (
      <tr className="border-b border-card/50 hover:bg-background/30">
        <td className={cn('sticky left-0 z-10 bg-surface px-2 py-2', padLeft)}>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 font-medium text-text-primary">
            <span>{tituloLocal}</span>
            {destacarSemelhanca && <PilulasSemelhanca pares={pares} />}
          </div>
          <MetaLocalSecao
            nrZona={grupo.nrZona}
            nrSecao={secao.nrSecao}
            nrLocalVotacao={grupo.nrLocalVotacao}
            nmBairro={grupo.nmBairro ?? secao.nmBairro}
            endereco={endereco}
            ocultarBairro={ocultarBairro}
          />
        </td>
        <CelulasVotosMatriz
          candidatos={candidatos}
          votos={secao.votos}
          liderId={secao.liderId}
        />
      </tr>
    )
  }

  return (
    <>
      <tr className="border-b border-card/50 bg-background/20 hover:bg-background/40">
        <td className={cn('sticky left-0 z-10 bg-background/30 px-2 py-2', padLeft)}>
          <button
            type="button"
            onClick={onToggle}
            className="flex w-full items-start gap-2 text-left"
            aria-expanded={expandido}
          >
            <span className="mt-0.5 shrink-0 text-text-secondary">
              {expandido ? (
                <ChevronDown className="h-4 w-4" />
              ) : (
                <ChevronRight className="h-4 w-4" />
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span className="font-semibold text-text-primary">{tituloLocal}</span>
                {!ocultarBairro ? <BadgeBairro bairro={grupo.nmBairro} /> : null}
                <span className="shrink-0 rounded-full border border-card bg-surface px-2 py-0.5 text-[10px] tabular-nums text-text-secondary">
                  {grupo.totalSecoes} seções
                </span>
                {destacarSemelhanca && !expandido && (
                  <PilulasSemelhanca pares={paresLocal} compacto />
                )}
              </span>
              <span className="mt-0.5 block">
                <MetaLocalSecao
                  nrZona={grupo.nrZona}
                  nrSecao={grupo.secoes[0]?.nrSecao ?? 0}
                  nrLocalVotacao={grupo.nrLocalVotacao}
                  nmBairro={grupo.nmBairro}
                  endereco={endereco}
                  ocultarBairro={ocultarBairro}
                />
              </span>
            </span>
          </button>
        </td>
        <CelulasVotosMatriz
          candidatos={candidatos}
          votos={grupo.votos}
          liderId={grupo.liderId}
        />
      </tr>
      {expandido
        ? grupo.secoes.map((secao) => (
            <LinhaSecaoMatriz
              key={secao.localId}
              secao={secao}
              candidatos={candidatos}
              pares={paresPorSecao.get(secao.localId) ?? []}
              destacarSemelhanca={destacarSemelhanca}
              indent={indent + 1}
              ocultarBairro={ocultarBairro}
            />
          ))
        : null}
    </>
  )
}

function LinhaSecaoMatriz({
  secao,
  candidatos,
  pares,
  destacarSemelhanca,
  indent = 0,
  ocultarBairro = false,
}: {
  secao: LinhaMatrizSecao
  candidatos: CandidatoMatrizColuna[]
  pares: ParSemelhanteSecao[]
  destacarSemelhanca: boolean
  indent?: number
  ocultarBairro?: boolean
}) {
  const padLeft = indent <= 0 ? 'pl-9' : indent === 1 ? 'pl-12' : 'pl-16'

  return (
    <tr className="border-b border-card/30 hover:bg-background/20">
      <td className={cn('sticky left-0 z-10 bg-surface/95 px-2 py-1.5', padLeft)}>
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-text-primary">
          <span>
            Seção <span className="tabular-nums font-medium">{secao.nrSecao}</span>
          </span>
          {destacarSemelhanca && <PilulasSemelhanca pares={pares} />}
        </div>
        <div className="text-[10px] text-text-secondary">
          Zona {secao.nrZona}
          {secao.nrLocalVotacao != null ? ` · Local ${secao.nrLocalVotacao}` : ''}
        </div>
        {!ocultarBairro ? <BadgeBairro bairro={secao.nmBairro} /> : null}
      </td>
      <CelulasVotosMatriz
        candidatos={candidatos}
        votos={secao.votos}
        liderId={secao.liderId}
      />
    </tr>
  )
}

function ResumoCard({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="rounded-xl border border-card bg-surface p-4">
      <p className="text-xs text-text-secondary">{label}</p>
      <p className="text-lg font-semibold text-text-primary truncate" title={valor}>
        {valor}
      </p>
    </div>
  )
}

function PainelComparacaoVotos({ analises }: { analises: AnaliseComparacaoVotos[] }) {
  const margemPct = Math.round(MARGEM_VOTOS_PARECIDOS * 100)

  return (
    <div className="mb-4 rounded-2xl border border-card bg-surface p-4">
      <h2 className="mb-1 text-sm font-semibold text-text-primary">Semelhança de votos por seção</h2>
      <p className="mb-3 text-xs text-text-secondary">
        O percentual indica em quantas seções os dois candidatos tiveram quantidade de votos
        semelhante (diferença de até {margemPct}%) — ex.: 100 × 140 → semelhante; 100 × 160 → não.
      </p>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {analises.map((a) => (
          <div
            key={`${a.candidatoA.id}::${a.candidatoB.id}`}
            className={cn(
              'rounded-xl border p-4',
              a.nivel === 'alta' && 'border-accent-gold/50 bg-accent-gold/10',
              a.nivel === 'media' && 'border-accent-gold/30 bg-accent-gold/5',
              a.nivel === 'baixa' && 'border-card bg-background/40',
              a.nivel === 'minima' && 'border-card bg-background/20',
            )}
          >
            <p className="text-[11px] font-medium text-text-secondary">
              {rotuloCabecalhoCandidato(a.candidatoA, Boolean(a.candidatoA.anoEleicao))}{' '}
              <span className="text-text-primary">{a.candidatoA.nmVotavel}</span>
              {' × '}
              {rotuloCabecalhoCandidato(a.candidatoB, Boolean(a.candidatoB.anoEleicao))}{' '}
              <span className="text-text-primary">{a.candidatoB.nmVotavel}</span>
            </p>
            <p className="mt-3 text-3xl font-bold tabular-nums text-text-primary">
              {a.pctSecoesParecidas.toFixed(0)}%
            </p>
            <p className="text-xs text-text-secondary">de semelhança entre os votos</p>
            <p className="mt-1 text-xs font-semibold text-text-primary">{a.rotuloNivel}</p>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-background"
              role="presentation"
            >
              <div
                className={cn(
                  'h-full rounded-full',
                  a.nivel === 'alta' && 'bg-accent-gold',
                  a.nivel === 'media' && 'bg-accent-gold/70',
                  a.nivel === 'baixa' && 'bg-text-secondary/40',
                  a.nivel === 'minima' && 'bg-text-secondary/25',
                )}
                style={{ width: `${Math.min(100, a.pctSecoesParecidas)}%` }}
              />
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-text-secondary">{a.resumo}</p>
            <p className="mt-1 text-[10px] text-text-secondary">
              {a.secoesParecidas} seções semelhantes · {a.secoesComAmbos} com votos nos dois ·{' '}
              {a.secoesTotal} seções no município
            </p>
          </div>
        ))}
      </div>
    </div>
  )
}

function CandidatoChip({
  candidato,
  ativo,
  mostrarCargo = false,
  multiAno = false,
  onRemove,
}: {
  candidato: CandidatoMatrizColuna
  ativo?: boolean
  mostrarCargo?: boolean
  multiAno?: boolean
  onRemove?: () => void
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px]',
        ativo
          ? 'border-accent-gold/40 bg-accent-gold/10 text-text-primary'
          : 'border-card bg-background text-text-secondary',
      )}
    >
      {mostrarCargo && (
        <span className="rounded bg-background/80 px-1 text-[9px] font-semibold uppercase text-accent-gold">
          {rotuloCabecalhoCandidato(candidato, multiAno)}
        </span>
      )}
      <span className="font-medium tabular-nums">{candidato.nrVotavel}</span>
      <span className="max-w-[8rem] truncate">{candidato.nmVotavel}</span>
      {onRemove ? (
        <button type="button" onClick={onRemove} className="rounded p-0.5 hover:bg-background" aria-label="Remover">
          <X className="h-3 w-3" />
        </button>
      ) : null}
    </span>
  )
}
