'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Eye, ExternalLink, Loader2, MapPin, Pencil, Plus, RefreshCw, Settings2, Trash2 } from 'lucide-react'
import {
  TseCard,
  TseCarregando,
  TseErro,
  TseFilterBar,
  TsePage,
  TsePill,
  TsePillValor,
  TseSelectGrande,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseTabela,
} from '@/components/tse/tse-ui'
import { usePermissions } from '@/hooks/use-permissions'
import { cn, formatDateShort } from '@/lib/utils'
import type { CargoFotoCandidato } from '@/lib/candidatos-foto-divulgacand'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import { URL_CONSULTA_FNS } from '@/lib/fns-proposta-normalize'
import {
  calcularResumoMac,
  calcularResumoPap,
  calcularResumoSuas,
  filtrarPropostasFns,
  type PropostaFns,
} from '@/lib/fns-tetos-saldo'
import { classificaPorteSuasFromFaixas } from '@/lib/suas-porte'
import type { LimitesMunicipioResponse } from '@/lib/limites-tetos-types'
import { getPopulacaoMunicipio, type MunicipioPopulacao } from '@/lib/populacao-ibge-local'
import { formatarMoedaFicha } from '@/lib/ficha-lideranca-resumo'
import {
  excluirEmendaSuas,
  fetchEmendasSuas,
  fetchExercicioAtivo,
  fetchLimitesMunicipio,
  fetchMunicipiosFicha,
  fetchPopulacaoIbge,
  fetchPropostasFns,
  salvarEmendaSuas,
  type EmendaSuas,
  type EmendaSuasForm,
} from '@/lib/services/ficha-atendimento-client'
import { FichaAtendimentoTetosBloco, type ResumosMacPapModalidade } from './tetos-bloco'
import { FichaAtendimentoEditarLimites } from './editar-limites-modal'
import { FichaAtendimentoResultadosEleicao } from './resultados-eleicao'
import { FichaLiderancaResumo } from './lideranca-resumo-modal'
import { FichaAtendimentoEmendasMandato } from './emendas-mandato'
import { FichaAtendimentoPropostaDetalhe } from './proposta-detalhe-modal'
import { SuasModal } from './suas-modal'

type LinhaProposta = PropostaFns & {
  origem: 'FNS' | 'SUAS'
  emendaSuasId?: string
}

type FichaLideranca = { candidato: ResultadoEleicao; cargo: CargoFotoCandidato }

const TIPO_PROPOSTA_SUAS = 'INCREMENTO SUAS'
const TIPO_RECURSO_SUAS = 'EMENDA/PROJETO'

const emptySuasForm = (municipio: string): EmendaSuasForm => ({
  municipio,
  tipo_proposta: TIPO_PROPOSTA_SUAS,
  tipo_recurso: TIPO_RECURSO_SUAS,
  valor_proposta: 0,
  valor_pagar: 0,
})

const botaoIconeLinha =
  'rounded-md p-1.5 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)] disabled:opacity-50'

export function FichaAtendimentoPanel() {
  const router = useRouter()
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()

  const [municipios, setMunicipios] = useState<string[]>([])
  const [municipioSel, setMunicipioSel] = useState<string>('')
  const [propostasFns, setPropostasFns] = useState<PropostaFns[]>([])
  const [emendasSuas, setEmendasSuas] = useState<EmendaSuas[]>([])
  const [populacaoLista, setPopulacaoLista] = useState<MunicipioPopulacao[]>([])
  const [loadingFns, setLoadingFns] = useState<boolean>(false)
  const [loadingSuas, setLoadingSuas] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [suasForm, setSuasForm] = useState<EmendaSuasForm | null>(null)
  const [suasSaving, setSuasSaving] = useState<boolean>(false)
  const [deletingSuasId, setDeletingSuasId] = useState<string | null>(null)
  const [limitesDb, setLimitesDb] = useState<LimitesMunicipioResponse | null>(null)
  const [loadingLimites, setLoadingLimites] = useState<boolean>(false)
  const [exercicioAtivo, setExercicioAtivo] = useState<number | null>(null)
  const [limitesModalOpen, setLimitesModalOpen] = useState<boolean>(false)
  const [detalheProposta, setDetalheProposta] = useState<LinhaProposta | null>(null)
  const [fichaLideranca, setFichaLideranca] = useState<FichaLideranca | null>(null)
  const [autoPrintFicha, setAutoPrintFicha] = useState<boolean>(false)

  useEffect(() => {
    if (permLoading) return
    if (!isAdmin && !canAccess('ficha-atendimento') && !canAccess('territorio')) {
      router.replace('/dashboard')
    }
  }, [permLoading, isAdmin, canAccess, router])

  const recarregarExercicio = useCallback(() => {
    fetchExercicioAtivo()
      .then((ex) => {
        if (ex) setExercicioAtivo(ex)
      })
      .catch(() => setExercicioAtivo((atual) => atual ?? 2025))
  }, [])

  useEffect(() => {
    void fetchMunicipiosFicha().then(setMunicipios)
    recarregarExercicio()
    fetchPopulacaoIbge()
      .then(setPopulacaoLista)
      .catch(() => setPopulacaoLista([]))
  }, [recarregarExercicio])

  const loadLimites = useCallback(async (municipio: string) => {
    if (!municipio) {
      setLimitesDb(null)
      return
    }
    setLoadingLimites(true)
    try {
      const data = await fetchLimitesMunicipio(municipio)
      setLimitesDb(data)
      setExercicioAtivo(data.exercicio)
    } catch {
      setLimitesDb(null)
    } finally {
      setLoadingLimites(false)
    }
  }, [])

  const loadFns = useCallback(async (municipio: string, ano: number) => {
    if (!municipio) {
      setPropostasFns([])
      return
    }
    setLoadingFns(true)
    setError(null)
    try {
      setPropostasFns(await fetchPropostasFns(municipio, ano))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao consultar FNS')
      setPropostasFns([])
    } finally {
      setLoadingFns(false)
    }
  }, [])

  const loadSuas = useCallback(async (municipio: string) => {
    if (!municipio) {
      setEmendasSuas([])
      return
    }
    setLoadingSuas(true)
    try {
      setEmendasSuas(await fetchEmendasSuas(municipio))
    } catch {
      setEmendasSuas([])
    } finally {
      setLoadingSuas(false)
    }
  }, [])

  useEffect(() => {
    if (!municipioSel) {
      setPropostasFns([])
      setEmendasSuas([])
      return
    }
    void loadSuas(municipioSel)
    void loadLimites(municipioSel)
  }, [municipioSel, loadSuas, loadLimites])

  useEffect(() => {
    if (!municipioSel || !exercicioAtivo) return
    void loadFns(municipioSel, exercicioAtivo)
  }, [municipioSel, exercicioAtivo, loadFns])

  const propostasFnsFiltradas = useMemo(() => filtrarPropostasFns(propostasFns), [propostasFns])

  const populacao = municipioSel ? getPopulacaoMunicipio(populacaoLista, municipioSel) : null
  const classificacaoSuas = useMemo(() => {
    if (limitesDb?.classificacao_suas) {
      return {
        porte: limitesDb.classificacao_suas.porte,
        valorFormatado: limitesDb.classificacao_suas.valor_formatado,
        valorNumerico: limitesDb.classificacao_suas.valor_numerico,
      }
    }
    return classificaPorteSuasFromFaixas(populacao, limitesDb?.suas_faixas)
  }, [limitesDb, populacao])

  const linhasTabela = useMemo((): LinhaProposta[] => {
    const fns: LinhaProposta[] = propostasFnsFiltradas.map((p) => ({ ...p, origem: 'FNS' }))
    const suas: LinhaProposta[] = emendasSuas.map((e) => ({
      nuProposta: `SUAS-${e.id.slice(0, 8)}`,
      municipio: e.municipio,
      vlProposta: e.valor_proposta,
      vlPagar: e.valor_pagar,
      coTipoProposta: e.tipo_proposta,
      dsTipoRecurso: e.tipo_recurso,
      dtCadastramento: e.created_at ?? '',
      dsSituacaoProposta: 'Lançamento local',
      exercicio: exercicioAtivo ?? undefined,
      origem: 'SUAS',
      emendaSuasId: e.id,
    }))
    const tempo = (d: string | undefined) => (d ? new Date(d).getTime() : 0)
    return [...fns, ...suas].sort((a, b) => tempo(b.dtCadastramento) - tempo(a.dtCadastramento))
  }, [propostasFnsFiltradas, emendasSuas, exercicioAtivo])

  const resumosMacPap = useMemo((): ResumosMacPapModalidade => {
    const valor = (tipo: 'mac' | 'pap', mod: 'individual' | 'coletiva') => limitesDb?.[tipo]?.[mod]?.valor ?? null
    return {
      mac: {
        individual: calcularResumoMac(linhasTabela, valor('mac', 'individual'), 'individual'),
        coletiva: calcularResumoMac(linhasTabela, valor('mac', 'coletiva'), 'coletiva'),
      },
      pap: {
        individual: calcularResumoPap(linhasTabela, valor('pap', 'individual'), 'individual'),
        coletiva: calcularResumoPap(linhasTabela, valor('pap', 'coletiva'), 'coletiva'),
      },
    }
  }, [linhasTabela, limitesDb])

  const resumoSuas = useMemo(() => {
    const propostas = emendasSuas.reduce((acc, e) => acc + (e.valor_proposta || 0), 0)
    const pagar = emendasSuas.reduce((acc, e) => acc + (e.valor_pagar || 0), 0)
    return calcularResumoSuas(classificacaoSuas.valorNumerico, propostas, pagar)
  }, [classificacaoSuas.valorNumerico, emendasSuas])

  const carregando = loadingFns || loadingSuas || loadingLimites

  const handleRefresh = () => {
    if (!municipioSel) return
    if (exercicioAtivo) void loadFns(municipioSel, exercicioAtivo)
    void loadSuas(municipioSel)
    void loadLimites(municipioSel)
  }

  const saveSuas = async () => {
    if (!suasForm) return
    setSuasSaving(true)
    try {
      await salvarEmendaSuas({ ...suasForm, municipio: municipioSel || suasForm.municipio })
      setSuasForm(null)
      await loadSuas(municipioSel)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar SUAS')
    } finally {
      setSuasSaving(false)
    }
  }

  const deleteSuas = async (id: string) => {
    setDeletingSuasId(id)
    try {
      await excluirEmendaSuas(id)
      await loadSuas(municipioSel)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally {
      setDeletingSuasId(null)
    }
  }

  if (permLoading) {
    return (
      <TsePage>
        <TseCarregando texto="Verificando permissões…" />
      </TsePage>
    )
  }

  return (
    <TsePage>
      <TseFilterBar>
        <TseSelectGrande
          icone={MapPin}
          rotulo="Município"
          value={municipioSel}
          onChange={(e) => setMunicipioSel(e.target.value)}
        >
          <option value="">Selecione o município…</option>
          {municipios.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </TseSelectGrande>
        <TsePillValor rotulo="Exercício">{exercicioAtivo ?? '—'}</TsePillValor>
        {populacao != null ? (
          <TsePillValor rotulo="População (IBGE)">{populacao.toLocaleString('pt-BR')}</TsePillValor>
        ) : null}
        {carregando && municipioSel ? (
          <span className="inline-flex items-center gap-2 text-[12px] text-[var(--tse-muted)]">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-[var(--tse-yellow)]" />
            Consultando FNS e SUAS…
          </span>
        ) : null}
        <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
          <button
            type="button"
            onClick={() => setLimitesModalOpen(true)}
            disabled={!municipioSel}
            className={tseBotaoCinzaClass}
          >
            <Settings2 className={tseBotaoIconeClass} />
            Limites
          </button>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={!municipioSel || carregando}
            className={tseBotaoCinzaClass}
          >
            <RefreshCw className={cn(tseBotaoIconeClass, carregando && 'animate-spin')} />
            Atualizar
          </button>
        </div>
      </TseFilterBar>

      {error ? (
        <div className="mt-4">
          <TseErro>{error}</TseErro>
        </div>
      ) : null}

      {!municipioSel ? (
        <div className="mt-5">
          <TseVazio>
            Selecione um município para ver os tetos MAC, PAP e SUAS, as propostas do FNS, os resultados eleitorais e as
            emendas do mandato.
          </TseVazio>
        </div>
      ) : (
        <div className="mt-5 space-y-5">
          <FichaAtendimentoTetosBloco
            municipio={municipioSel}
            resumos={resumosMacPap}
            resumoSuas={resumoSuas}
            populacao={populacao}
            classificacaoSuas={classificacaoSuas}
            exercicioAtivo={exercicioAtivo}
          />

          <FichaAtendimentoResultadosEleicao
            municipio={municipioSel}
            onVerFicha={(candidato, cargo) => {
              setAutoPrintFicha(false)
              setFichaLideranca({ candidato, cargo })
            }}
            onImprimirFicha={(candidato, cargo) => {
              setAutoPrintFicha(true)
              setFichaLideranca({ candidato, cargo })
            }}
          />

          <FichaAtendimentoEmendasMandato municipio={municipioSel} />

          <TseCard
            titulo="Propostas e lançamentos"
            subtitulo={`FNS (exceto PROGRAMA) e SUAS local${exercicioAtivo ? ` · exercício ${exercicioAtivo} ao vivo no FNS` : ''}`}
            acao={
              <button
                type="button"
                onClick={() => setSuasForm(emptySuasForm(municipioSel))}
                className={tseBotaoPrimarioClass}
              >
                <Plus className="h-4 w-4" />
                Lançamento SUAS
              </button>
            }
          >
            <div className="mt-4">
              {linhasTabela.length === 0 ? (
                loadingFns ? (
                  <TseCarregando texto="Consultando propostas no FNS…" className="min-h-[10rem]" />
                ) : (
                  <TseVazio>Nenhuma proposta encontrada para este município.</TseVazio>
                )
              ) : (
                <div className={cn(tseTabela.container, 'shadow-none ring-1 ring-[#EEEEEE]')}>
                  <table className={cn(tseTabela.table, 'min-w-[960px]')} data-tse-tabela>
                    <thead className={tseTabela.thead}>
                      <tr>
                        <th className={tseTabela.th}>Origem</th>
                        <th className={tseTabela.th}>Proposta</th>
                        <th className={tseTabela.th}>Exerc.</th>
                        <th className={tseTabela.th}>Tipo</th>
                        <th className={tseTabela.th}>Recurso</th>
                        <th className={tseTabela.th}>Situação</th>
                        <th className={cn(tseTabela.th, 'text-right')}>Valor proposta</th>
                        <th className={cn(tseTabela.th, 'text-right')}>A pagar</th>
                        <th className={tseTabela.th}>Data</th>
                        <th className={tseTabela.th} aria-label="Ações" />
                      </tr>
                    </thead>
                    <tbody>
                      {linhasTabela.map((row) => {
                        const suas = row.origem === 'SUAS' ? emendasSuas.find((x) => x.id === row.emendaSuasId) : null
                        return (
                          <tr key={`${row.origem}-${row.nuProposta}`} className={tseTabela.tr}>
                            <td className={tseTabela.td}>
                              <TsePill tom={row.origem === 'FNS' ? 'neutro' : 'amarelo'} className="text-[10px]">
                                {row.origem}
                              </TsePill>
                            </td>
                            <td className={cn(tseTabela.td, 'max-w-[9rem] truncate font-mono text-[12px]')} title={row.nuProposta}>
                              {row.nuProposta}
                            </td>
                            <td className={cn(tseTabela.td, 'tabular-nums text-[var(--tse-muted)]')}>
                              {row.exercicio ?? (row.origem === 'SUAS' ? exercicioAtivo : '—')}
                            </td>
                            <td className={cn(tseTabela.td, 'max-w-[10rem] truncate')} title={row.coTipoProposta || ''}>
                              {row.coTipoProposta || '—'}
                            </td>
                            <td className={cn(tseTabela.td, 'max-w-[12rem] truncate')} title={row.dsTipoRecurso || ''}>
                              {row.dsTipoRecurso || '—'}
                            </td>
                            <td
                              className={cn(tseTabela.td, 'max-w-[10rem] truncate text-[var(--tse-muted)]')}
                              title={row.dsSituacaoProposta || ''}
                            >
                              {row.dsSituacaoProposta || '—'}
                            </td>
                            <td className={cn(tseTabela.td, 'whitespace-nowrap text-right font-bold tabular-nums')}>
                              {formatarMoedaFicha(row.vlProposta)}
                            </td>
                            <td className={cn(tseTabela.td, 'whitespace-nowrap text-right tabular-nums')}>
                              {formatarMoedaFicha(row.vlPagar)}
                            </td>
                            <td className={cn(tseTabela.td, 'whitespace-nowrap text-[var(--tse-muted)]')}>
                              {row.dtCadastramento ? formatDateShort(row.dtCadastramento) : '—'}
                            </td>
                            <td className="px-2 py-1">
                              <div className="flex justify-end gap-0.5">
                                <button
                                  type="button"
                                  onClick={() => setDetalheProposta(row)}
                                  className={botaoIconeLinha}
                                  aria-label="Ver detalhes"
                                  title="Detalhes"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                </button>
                                {row.origem === 'FNS' ? (
                                  <a
                                    href={row.urlConsultaFns ?? URL_CONSULTA_FNS}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={botaoIconeLinha}
                                    aria-label="Abrir no Consulta FNS"
                                    title="Consulta FNS"
                                  >
                                    <ExternalLink className="h-3.5 w-3.5" />
                                  </a>
                                ) : null}
                                {suas ? (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => setSuasForm({ ...suas })}
                                      className={botaoIconeLinha}
                                      aria-label="Editar"
                                      title="Editar"
                                    >
                                      <Pencil className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={deletingSuasId === suas.id}
                                      onClick={() => void deleteSuas(suas.id)}
                                      className={cn(botaoIconeLinha, 'hover:text-red-600')}
                                      aria-label="Excluir"
                                      title="Excluir"
                                    >
                                      {deletingSuasId === suas.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-3.5 w-3.5" />
                                      )}
                                    </button>
                                  </>
                                ) : null}
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </TseCard>
        </div>
      )}

      <p className="mt-5 text-[11px] text-[var(--tse-muted)]">
        MAC/PAP: limites por exercício (planilhas/banco); propostas via API pública do FNS. SUAS: teto calculado pela
        população (arquivo IBGE local); propostas SUAS são registradas neste sistema (tabela{' '}
        <code className="text-[10px]">emendas_suas</code>).
      </p>

      {limitesModalOpen && municipioSel ? (
        <FichaAtendimentoEditarLimites
          municipio={municipioSel}
          onClose={() => setLimitesModalOpen(false)}
          onSaved={() => {
            void loadLimites(municipioSel)
            recarregarExercicio()
          }}
        />
      ) : null}

      {fichaLideranca && municipioSel ? (
        <FichaLiderancaResumo
          key={`${fichaLideranca.cargo}-${fichaLideranca.candidato.numeroUrna}-${fichaLideranca.candidato.nomeUrnaCandidato}`}
          onClose={() => {
            setFichaLideranca(null)
            setAutoPrintFicha(false)
          }}
          municipio={municipioSel}
          candidato={fichaLideranca.candidato}
          cargo={fichaLideranca.cargo}
          limitesDb={limitesDb}
          propostasFns={propostasFnsFiltradas}
          emendasSuas={emendasSuas}
          populacao={populacao}
          classificacaoSuas={classificacaoSuas}
          exercicioAtivo={exercicioAtivo}
          autoPrint={autoPrintFicha}
          onPrinted={() => setAutoPrintFicha(false)}
        />
      ) : null}

      {detalheProposta ? (
        <FichaAtendimentoPropostaDetalhe
          proposta={detalheProposta}
          origem={detalheProposta.origem}
          onClose={() => setDetalheProposta(null)}
        />
      ) : null}

      {suasForm ? (
        <SuasModal
          form={suasForm}
          saving={suasSaving}
          onClose={() => setSuasForm(null)}
          onChange={setSuasForm}
          onSave={() => void saveSuas()}
        />
      ) : null}
    </TsePage>
  )
}
