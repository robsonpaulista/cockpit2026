'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { MapPinned, Plus, UserRound, X } from 'lucide-react'
import { PollModal } from '@/components/poll-modal'
import { PollReportModal } from '@/components/poll-report-modal'
import { TendenciaTemporalPanel } from '@/components/pesquisa/TendenciaTemporalPanel'
import { GerarPublicoPesquisaPanel } from '@/components/pesquisa/gerar-publico-pesquisa-panel'
import {
  PesquisasCadastradasTabela,
  dataPesquisaMs,
  formatarDataPesquisa,
} from '@/components/pesquisa/pesquisas-cadastradas-tabela'
import {
  TseBusca,
  TseCarregando,
  TseErro,
  TseFilterBar,
  TsePage,
  TsePillSelect,
  TseSegmentado,
  TseSelectGrande,
  TseTabs,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  type TseAba,
} from '@/components/tse/tse-ui'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import { useAllowedHubTabs } from '@/hooks/use-allowed-hub-tabs'
import municipiosPiaui from '@/lib/municipios-piaui.json'
import {
  buildCidadeToRegiaoMap,
  getRegiaoParaCidade,
  REGIOES_PI_ORDER,
  type RegiaoPiaui,
} from '@/lib/piaui-regiao'
import {
  DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE,
  normalizarLinhaEspontanea,
} from '@/lib/espontanea-normalize'
import { gerarResumoLegendaSerieGrafico, metaTiposFromRowSet } from '@/lib/pesquisa-desempenho-feedback'
import {
  CARGO_PESQUISA_LABEL,
  excluirPesquisa,
  fetchCidadesPesquisa,
  fetchPesquisas,
  type CargoPesquisa,
  type CidadePesquisa,
  type Pesquisa,
  type TipoPesquisa,
} from '@/lib/services/pesquisa-client'
import type { AIAgentPageContext } from '@/components/ai-agent'
import { useRegisterJarvisHostProps } from '@/contexts/jarvis-host-props-context'

type PesquisaTab = 'tendencia' | 'cadastradas' | 'gerar-publico'

const TABS: readonly TseAba<PesquisaTab>[] = [
  { id: 'tendencia', label: 'Tendência temporal' },
  { id: 'cadastradas', label: 'Pesquisas cadastradas' },
  { id: 'gerar-publico', label: 'Gerar público' },
]

type TipoGraficoPesquisa = 'todas' | TipoPesquisa

const OPCOES_TIPO: readonly { id: TipoGraficoPesquisa; label: string }[] = [
  { id: 'todas', label: 'Todas' },
  { id: 'estimulada', label: 'Estimulada' },
  { id: 'espontanea', label: 'Espontânea' },
]

const CANDIDATO_PADRAO_KEY = 'candidatoPadraoPesquisa'
const AJUSTE_NS_PCT = Math.round(DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE * 100)

function parsePesquisaTab(value: string | null): PesquisaTab {
  if (value === 'cadastradas') return 'cadastradas'
  if (value === 'gerar-publico') return 'gerar-publico'
  return 'tendencia'
}

/** Metadado interno no objeto da série (removido antes do gráfico): tipos de pesquisa naquela data. */
const META_TIPOS_NA_DATA = '__tiposNaData' as const

type LinhaSerie = Record<string, string | number | undefined>

function rowSemMetaTipos(row: Record<string, unknown>): LinhaSerie {
  const { [META_TIPOS_NA_DATA]: _tipos, ...rest } = row
  return rest as LinhaSerie
}

/** Linha só espontânea → pode normalizar NS sem misturar com estimulada. */
function linhaSoEspontaneaParaGrafico(tipos: unknown): boolean {
  return tipos instanceof Set && tipos.size === 1 && tipos.has('espontanea')
}

/** Mesmo JSON e faixas latitudinais do gráfico Histórico de pesquisas em /dashboard (cockpit). */
const CIDADE_PARA_REGIAO_PESQUISA = buildCidadeToRegiaoMap(
  municipiosPiaui as ReadonlyArray<{ nome: string; lat: number }>,
)

const normalizarTexto = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toUpperCase()

export default function PesquisaPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = useMemo(() => parsePesquisaTab(searchParams.get('tab')), [searchParams])
  const [polls, setPolls] = useState<Pesquisa[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [erro, setErro] = useState<string | null>(null)
  const [showModal, setShowModal] = useState<boolean>(false)
  const [editingPoll, setEditingPoll] = useState<Pesquisa | null>(null)
  const [tipoGrafico, setTipoGrafico] = useState<TipoGraficoPesquisa>('todas')
  const [filtroCargo, setFiltroCargo] = useState<'' | CargoPesquisa>('')
  const [filtroCidade, setFiltroCidade] = useState<string>('')
  const [filtroRegiao, setFiltroRegiao] = useState<'' | RegiaoPiaui>('')
  const [cities, setCities] = useState<CidadePesquisa[]>([])
  const [candidatoPadrao, setCandidatoPadrao] = useState<string>('')
  const [graficoTelaCheia, setGraficoTelaCheia] = useState<boolean>(false)
  const [pollParaRelatorio, setPollParaRelatorio] = useState<Pesquisa | null>(null)
  const [openedReportFromQuery, setOpenedReportFromQuery] = useState<string | null>(null)
  const [buscaCandidato, setBuscaCandidato] = useState<string>('')

  const onTabChange = useCallback(
    (tab: PesquisaTab) => {
      const params = new URLSearchParams(searchParams.toString())
      if (tab === 'tendencia') params.delete('tab')
      else params.set('tab', tab)
      params.delete('view')
      const qs = params.toString()
      router.replace(qs ? `/dashboard/pesquisa?${qs}` : '/dashboard/pesquisa')
    },
    [router, searchParams],
  )

  const visibleTabs = useAllowedHubTabs('pesquisa', TABS, activeTab, onTabChange)

  const contextoAgentePesquisa = useMemo<AIAgentPageContext>(
    () => ({
      kind: 'pesquisa',
      candidatoPadrao: candidatoPadrao || undefined,
      pollsCount: polls.length,
    }),
    [candidatoPadrao, polls.length],
  )

  useRegisterJarvisHostProps({
    pageContext: contextoAgentePesquisa,
    loadingPolls: loading,
    pollsCount: polls.length,
    candidatoPadrao: candidatoPadrao || undefined,
  })

  const carregarPesquisas = useCallback(async (options?: { silent?: boolean }) => {
    if (!options?.silent) setLoading(true)
    try {
      setPolls(await fetchPesquisas())
      setErro(null)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao carregar pesquisas.')
    } finally {
      if (!options?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregarPesquisas()
    fetchCidadesPesquisa({ sincronizarSeVazio: true })
      .then(setCities)
      .catch(() => setCities([]))
    const salvo = localStorage.getItem(CANDIDATO_PADRAO_KEY)
    if (salvo) setCandidatoPadrao(salvo)
  }, [carregarPesquisas])

  useEffect(() => {
    if (cities.length === 0) return
    const cidadeIdParam = searchParams.get('cidade_id')
    if (cidadeIdParam && cities.some((c) => c.id === cidadeIdParam)) {
      setFiltroCidade(cidadeIdParam)
      return
    }
    const cidadeParam = searchParams.get('cidade')
    if (!cidadeParam) return
    const alvo = normalizarTexto(cidadeParam)
    const matched = cities.find((c) => normalizarTexto(c.name) === alvo)
    if (matched) setFiltroCidade(matched.id)
  }, [cities, searchParams])

  useEffect(() => {
    const pollIdParam = searchParams.get('open_report_poll_id')
    if (!pollIdParam || openedReportFromQuery === pollIdParam || polls.length === 0) return
    const alvo = polls.find((p) => p.id === pollIdParam)
    if (alvo) {
      setPollParaRelatorio(alvo)
      setOpenedReportFromQuery(pollIdParam)
    }
  }, [polls, searchParams, openedReportFromQuery])

  useEffect(() => {
    if (!graficoTelaCheia) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setGraficoTelaCheia(false)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prevOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [graficoTelaCheia])

  const candidatosDisponiveis = useMemo(
    () =>
      Array.from(new Set(polls.map((p) => p.candidato_nome).filter(Boolean))).sort((a, b) =>
        a.localeCompare(b, 'pt-BR'),
      ),
    [polls],
  )

  useEffect(() => {
    if (candidatosDisponiveis.length === 0) return
    setCandidatoPadrao((atual) => {
      const salvo = localStorage.getItem(CANDIDATO_PADRAO_KEY)
      if (salvo && candidatosDisponiveis.includes(salvo)) return salvo
      return atual || salvo || candidatosDisponiveis[0]
    })
  }, [candidatosDisponiveis])

  const escolherCandidato = (nome: string) => {
    setCandidatoPadrao(nome)
    localStorage.setItem(CANDIDATO_PADRAO_KEY, nome)
  }

  const resumoBase = useMemo(() => {
    const institutos = new Set(polls.map((p) => p.instituto).filter(Boolean))
    const ultima = polls.reduce<string | null>(
      (acc, p) => (!acc || dataPesquisaMs(p.data) > dataPesquisaMs(acc) ? p.data : acc),
      null,
    )
    return { institutos: institutos.size, ultima }
  }, [polls])

  const cidadeSelecionadaNome = cities.find((c) => c.id === filtroCidade)?.name || searchParams.get('cidade') || ''
  const hrefAtendimento = cidadeSelecionadaNome
    ? `/dashboard/resumo-eleicoes?cidade=${encodeURIComponent(cidadeSelecionadaNome)}&returnFromPesquisa=1`
    : '/dashboard/resumo-eleicoes?returnFromPesquisa=1'

  const pollsFiltrados = useMemo(
    () =>
      polls
        .filter((poll) => {
          if (tipoGrafico !== 'todas' && poll.tipo !== tipoGrafico) return false
          if (filtroCargo && poll.cargo !== filtroCargo) return false
          if (filtroCidade && poll.cidade_id !== filtroCidade) return false
          if (filtroRegiao) {
            const nomeCidade = poll.cities?.name?.trim()
            if (!nomeCidade) return false
            if (getRegiaoParaCidade(nomeCidade, CIDADE_PARA_REGIAO_PESQUISA) !== filtroRegiao) return false
          }
          return true
        })
        .reverse(),
    [polls, tipoGrafico, filtroCargo, filtroCidade, filtroRegiao],
  )

  const pollsCadastradasExibicao = useMemo(() => {
    const q = normalizarTexto(buscaCandidato)
    if (!q) return pollsFiltrados
    return pollsFiltrados.filter((p) => normalizarTexto(p.candidato_nome || '').includes(q))
  }, [pollsFiltrados, buscaCandidato])

  const serie = useMemo(() => {
    const candidatosUnicos = Array.from(new Set(pollsFiltrados.map((p) => p.candidato_nome).filter(Boolean)))
    const datasUnicas = new Map<string, Record<string, unknown>>()

    pollsFiltrados.forEach((poll) => {
      const dataBr = formatarDataPesquisa(poll.data)
      let linha = datasUnicas.get(dataBr)
      if (!linha) {
        linha = { data: dataBr, [META_TIPOS_NA_DATA]: new Set<TipoPesquisa>() }
        datasUnicas.set(dataBr, linha)
      }
      ;(linha[META_TIPOS_NA_DATA] as Set<TipoPesquisa>).add(poll.tipo)
      const sufixo = poll.candidato_nome.replace(/\s+/g, '_')
      linha[`intencao_${sufixo}`] = poll.intencao
      linha[`rejeicao_${sufixo}`] = poll.rejeicao
      linha[`instituto_${sufixo}`] = poll.instituto
    })

    const msDataBr = (valor: unknown): number => new Date(String(valor).split('/').reverse().join('-')).getTime()
    const bruta = Array.from(datasUnicas.values()).sort((a, b) => msDataBr(a.data) - msDataBr(b.data))

    /**
     * Gráfico: ajuste de NS na espontânea; com «Todas», o mesmo ajuste nas datas em que só há espontânea
     * (evita misturar % de estimulada e espontânea na mesma linha). Tabela segue bruta.
     */
    const pesquisaData = bruta.map((row) => {
      const plain = rowSemMetaTipos(row)
      const aplicarNorm =
        tipoGrafico === 'espontanea' ||
        (tipoGrafico === 'todas' && linhaSoEspontaneaParaGrafico(row[META_TIPOS_NA_DATA]))
      return aplicarNorm ? normalizarLinhaEspontanea(plain, DEFAULT_ESPONTANEA_NAO_SABE_EXPANSION_RATE) : plain
    })

    const ultima = pesquisaData[pesquisaData.length - 1]
    const candidatos = !ultima
      ? [...candidatosUnicos].sort((a, b) => a.localeCompare(b, 'pt-BR'))
      : candidatosUnicos
          .map((nome) => {
            const v = ultima[`intencao_${nome.replace(/\s+/g, '_')}`]
            return { nome, intencao: typeof v === 'number' && Number.isFinite(v) ? v : -1 }
          })
          .sort((a, b) => b.intencao - a.intencao)
          .map((x) => x.nome)

    const pollsFeedback = pollsFiltrados.map((p) => ({
      data: p.data,
      instituto: p.instituto,
      candidato_nome: p.candidato_nome,
      tipo: p.tipo,
      cidade_id: p.cidade_id ?? null,
      intencao: p.intencao ?? 0,
      rejeicao: p.rejeicao ?? 0,
      cities: p.cities,
    }))
    const metaPorLinha = bruta.map((row) => metaTiposFromRowSet(row[META_TIPOS_NA_DATA]))
    const resumoLegenda: Record<string, string> = {}
    for (const nome of candidatos) {
      resumoLegenda[nome] = gerarResumoLegendaSerieGrafico(nome, pesquisaData, pollsFeedback, metaPorLinha)
    }

    return { pesquisaData, candidatos, resumoLegenda }
  }, [pollsFiltrados, tipoGrafico])

  const subtituloTelaCheia = useMemo(() => {
    const row = serie.pesquisaData[serie.pesquisaData.length - 1]
    const sufixoAjuste =
      tipoGrafico === 'espontanea'
        ? ` · Espontânea no gráfico: ${AJUSTE_NS_PCT}% do «Não sabe» redistribuído (branco/nulo inalterado)`
        : tipoGrafico === 'todas'
          ? ` · «Todas»: nas datas só espontânea, mesmo ajuste de NS (${AJUSTE_NS_PCT}% redistribuído)`
          : ''
    if (!row) return `Mesmos filtros da página${sufixoAjuste}`
    const dataLabel = row.data != null ? String(row.data) : ''
    const institutos = Array.from(
      new Set(
        Object.keys(row)
          .filter((k) => k.startsWith('instituto_') && String(row[k] ?? '').trim())
          .map((k) => String(row[k]).trim()),
      ),
    ).sort((a, b) => a.localeCompare(b, 'pt-BR'))
    if (institutos.length === 0) return `${dataLabel} · mesmos filtros da página${sufixoAjuste}`
    return `${dataLabel} — ${institutos.length === 1 ? 'Instituto' : 'Institutos'}: ${institutos.join(', ')}${sufixoAjuste}`
  }, [serie.pesquisaData, tipoGrafico])

  const emptyGraficoMessage =
    polls.length === 0 ? 'Nenhuma pesquisa cadastrada.' : 'Nenhum registro com os filtros atuais.'

  const abrirNovaPesquisa = () => {
    setEditingPoll(null)
    setShowModal(true)
  }

  const removerPesquisa = async (p: Pesquisa) => {
    if (!confirm(`Excluir a pesquisa ${p.instituto} de ${p.candidato_nome}?`)) return
    try {
      await excluirPesquisa(p.id)
      await carregarPesquisas({ silent: true })
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao excluir pesquisa.')
    }
  }

  const filtrosAtivos = Boolean(filtroCargo || filtroCidade || filtroRegiao || tipoGrafico !== 'todas')

  const filtrosPesquisa = (extra?: ReactNode) => (
    <div className="flex flex-wrap items-end gap-x-8 gap-y-3">
      <div className="flex flex-col gap-1 text-[13px] font-semibold">
        Tipo
        <TseSegmentado opcoes={OPCOES_TIPO} valor={tipoGrafico} onChange={setTipoGrafico} />
      </div>
      <TsePillSelect
        rotulo="Cargo"
        value={filtroCargo}
        onChange={(e) => setFiltroCargo(e.target.value as '' | CargoPesquisa)}
      >
        <option value="">Todos</option>
        {(Object.keys(CARGO_PESQUISA_LABEL) as CargoPesquisa[]).map((c) => (
          <option key={c} value={c}>
            {CARGO_PESQUISA_LABEL[c]}
          </option>
        ))}
      </TsePillSelect>
      <TsePillSelect rotulo="Cidade" value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)}>
        <option value="">Todas</option>
        {cities.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </TsePillSelect>
      <TsePillSelect
        rotulo="Região"
        value={filtroRegiao}
        onChange={(e) => setFiltroRegiao(e.target.value as '' | RegiaoPiaui)}
        title="Município mapeado por latitude (Norte, Centro-Norte, Centro-Sul, Sul), como no cockpit."
      >
        <option value="">Todas</option>
        {REGIOES_PI_ORDER.map((r) => (
          <option key={r} value={r}>
            {r}
          </option>
        ))}
      </TsePillSelect>
      {filtrosAtivos ? (
        <button
          type="button"
          onClick={() => {
            setTipoGrafico('todas')
            setFiltroCargo('')
            setFiltroCidade('')
            setFiltroRegiao('')
          }}
          className="pb-1 text-[12px] font-bold uppercase tracking-wide text-[var(--tse-olive)] hover:underline"
        >
          Limpar filtros
        </button>
      ) : null}
      {extra}
    </div>
  )

  return (
    <TsePage>
      <TseFilterBar>
        <TseSelectGrande
          icone={UserRound}
          rotulo="Candidato em foco"
          value={candidatoPadrao}
          onChange={(e) => escolherCandidato(e.target.value)}
        >
          <option value="">Selecione um candidato</option>
          {candidatosDisponiveis.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </TseSelectGrande>
        <div className="text-[13px] leading-tight">
          <p className="font-bold">
            {polls.length.toLocaleString('pt-BR')} {polls.length === 1 ? 'pesquisa cadastrada' : 'pesquisas cadastradas'}
          </p>
          <p className="text-[var(--tse-muted)]">
            {resumoBase.institutos} {resumoBase.institutos === 1 ? 'instituto' : 'institutos'}
            {resumoBase.ultima ? ` · última em ${formatarDataPesquisa(resumoBase.ultima)}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <Link href={hrefAtendimento} className={tseBotaoCinzaClass}>
            <MapPinned className={tseBotaoIconeClass} aria-hidden />
            Atendimento
          </Link>
          <button type="button" onClick={abrirNovaPesquisa} className={tseBotaoPrimarioClass}>
            <Plus className="h-4 w-4" aria-hidden />
            Nova pesquisa
          </button>
        </div>
      </TseFilterBar>

      <TseTabs className="mt-5" abas={visibleTabs} ativa={activeTab} onChange={onTabChange} />

      {erro ? (
        <div className="mt-4">
          <TseErro>{erro}</TseErro>
        </div>
      ) : null}

      <div className="mt-5">
        {activeTab === 'tendencia' ? (
          <div className="flex flex-col gap-4">
            {filtrosPesquisa()}
            <TendenciaTemporalPanel
              pesquisaData={serie.pesquisaData}
              candidatos={serie.candidatos}
              candidatoPadrao={candidatoPadrao}
              resumoLegendaPorCandidato={serie.resumoLegenda}
              onTelaCheia={() => setGraficoTelaCheia(true)}
              loading={loading}
              emptyMessage={emptyGraficoMessage}
            />
          </div>
        ) : activeTab === 'gerar-publico' ? (
          <GerarPublicoPesquisaPanel />
        ) : (
          <div className="flex flex-col gap-4">
            {filtrosPesquisa(
              <div className="ml-auto">
                <TseBusca value={buscaCandidato} onChange={setBuscaCandidato} placeholder="Buscar candidato…" />
              </div>,
            )}
            {loading ? (
              <TseCarregando texto="Carregando pesquisas…" className="min-h-[30vh]" />
            ) : polls.length === 0 ? (
              <TseVazio>
                Nenhuma pesquisa cadastrada ainda.{' '}
                <button
                  type="button"
                  onClick={abrirNovaPesquisa}
                  className="font-bold text-[var(--tse-olive)] hover:underline"
                >
                  Adicionar a primeira
                </button>
              </TseVazio>
            ) : pollsCadastradasExibicao.length === 0 ? (
              <TseVazio>
                {buscaCandidato.trim()
                  ? `Nenhuma pesquisa de «${buscaCandidato.trim()}» com os filtros atuais.`
                  : 'Nenhuma pesquisa corresponde aos filtros atuais.'}
              </TseVazio>
            ) : (
              <>
                <p className="text-[12px] text-[var(--tse-muted)]">
                  {pollsCadastradasExibicao.length.toLocaleString('pt-BR')} de {polls.length.toLocaleString('pt-BR')}{' '}
                  registros · linhas do candidato em foco marcadas em amarelo
                </p>
                <PesquisasCadastradasTabela
                  key={`${tipoGrafico}|${filtroCargo}|${filtroCidade}|${filtroRegiao}|${buscaCandidato}`}
                  pesquisas={pollsCadastradasExibicao}
                  candidatoFoco={candidatoPadrao}
                  onRelatorio={setPollParaRelatorio}
                  onEditar={(p) => {
                    setEditingPoll(p)
                    setShowModal(true)
                  }}
                  onExcluir={(p) => void removerPesquisa(p)}
                />
              </>
            )}
          </div>
        )}
      </div>

      {showModal ? (
        <PollModal
          key={editingPoll?.id ?? 'nova'}
          poll={editingPoll}
          cidades={cities}
          candidatos={candidatosDisponiveis}
          onClose={() => {
            setShowModal(false)
            setEditingPoll(null)
          }}
          onUpdate={carregarPesquisas}
        />
      ) : null}

      {pollParaRelatorio ? (
        <PollReportModal
          poll={{
            id: pollParaRelatorio.id,
            instituto: pollParaRelatorio.instituto,
            candidato_nome: pollParaRelatorio.candidato_nome,
            data: pollParaRelatorio.data,
            cidade: pollParaRelatorio.cities?.name || undefined,
          }}
          onClose={() => setPollParaRelatorio(null)}
        />
      ) : null}

      {graficoTelaCheia && typeof document !== 'undefined'
        ? createPortal(
            <div
              style={TSE_TOKENS}
              className="fixed inset-0 z-[1200] flex h-[100dvh] w-full flex-col bg-[var(--tse-bg)] text-[var(--tse-text)]"
              role="dialog"
              aria-modal="true"
              aria-labelledby="pesquisa-tendencia-tela-cheia-titulo"
            >
              <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#EEEEEE] bg-white px-6 py-4">
                <div className="min-w-0">
                  <h2 id="pesquisa-tendencia-tela-cheia-titulo" className="text-[17px] font-bold">
                    Tendência temporal de intenção
                  </h2>
                  <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">{subtituloTelaCheia}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setGraficoTelaCheia(false)}
                  aria-label="Fechar tela cheia"
                  className="rounded-md p-1 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                <TendenciaTemporalPanel
                  pesquisaData={serie.pesquisaData}
                  candidatos={serie.candidatos}
                  candidatoPadrao={candidatoPadrao}
                  resumoLegendaPorCandidato={serie.resumoLegenda}
                  showHeader={false}
                  fillAvailable
                  loading={loading}
                  emptyMessage={emptyGraficoMessage}
                />
              </div>
            </div>,
            document.body,
          )
        : null}
    </TsePage>
  )
}
