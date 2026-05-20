'use client'

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import { cn, formatDateShort } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { FichaAtendimentoTetosBloco } from '@/components/ficha-atendimento-teto-card'
import { FichaAtendimentoEditarLimites } from '@/components/ficha-atendimento-editar-limites'
import { FichaAtendimentoResultadosEleicao } from '@/components/ficha-atendimento-resultados-eleicao'
import { FichaLiderancaResumo } from '@/components/ficha-lideranca-resumo'
import type { CargoFotoCandidato } from '@/lib/candidatos-foto-divulgacand'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'
import { FichaAtendimentoEmendasMandato } from '@/components/ficha-atendimento-emendas-mandato'
import { FichaAtendimentoPropostaDetalhe } from '@/components/ficha-atendimento-proposta-detalhe'
import { URL_CONSULTA_FNS } from '@/lib/fns-proposta-normalize'
import {
  filtrarPropostasFns,
  calcularResumoMac,
  calcularResumoPap,
  calcularResumoSuas,
  type PropostaFns,
} from '@/lib/fns-tetos-saldo'
import { classificaPorteSuasFromFaixas } from '@/lib/suas-porte'
import type { LimitesMunicipioResponse } from '@/lib/limites-tetos-types'
import {
  getPopulacaoMunicipio,
  type MunicipioPopulacao,
} from '@/lib/populacao-ibge-local'
import {
  Loader2,
  RefreshCw,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Settings2,
  Eye,
  ExternalLink,
} from 'lucide-react'

interface EmendaSuas {
  id: string
  municipio: string
  tipo_proposta: string
  tipo_recurso: string
  valor_proposta: number
  valor_pagar: number
  created_at?: string
  updated_at?: string
}

type LinhaProposta = PropostaFns & {
  origem: 'FNS' | 'SUAS'
  emendaSuasId?: string
}

const TIPO_PROPOSTA_SUAS = 'INCREMENTO SUAS'
const TIPO_RECURSO_SUAS = 'EMENDA/PROJETO'

function formatMoney(n: number | null | undefined): string {
  if (n == null || Number.isNaN(Number(n))) return '—'
  return Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

function emptySuasForm(municipio: string): Omit<EmendaSuas, 'id'> & { id?: string } {
  return {
    municipio,
    tipo_proposta: TIPO_PROPOSTA_SUAS,
    tipo_recurso: TIPO_RECURSO_SUAS,
    valor_proposta: 0,
    valor_pagar: 0,
  }
}

export default function FichaAtendimentoPage() {
  const router = useRouter()
  const pageShellClass = 'bg-white min-h-full'
  const sectionShellClass = 'rounded-2xl bg-surface p-5 shadow-sm border border-card'
  const { canAccess, isAdmin, loading: permLoading } = usePermissions()

  const [municipios, setMunicipios] = useState<string[]>([])
  const [municipioSel, setMunicipioSel] = useState('')
  const [propostasFns, setPropostasFns] = useState<PropostaFns[]>([])
  const [emendasSuas, setEmendasSuas] = useState<EmendaSuas[]>([])
  const [populacaoLista, setPopulacaoLista] = useState<MunicipioPopulacao[]>([])
  const [loadingFns, setLoadingFns] = useState(false)
  const [loadingSuas, setLoadingSuas] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [suasModalOpen, setSuasModalOpen] = useState(false)
  const [suasForm, setSuasForm] = useState(emptySuasForm(''))
  const [suasSaving, setSuasSaving] = useState(false)
  const [deletingSuasId, setDeletingSuasId] = useState<string | null>(null)
  const [limitesDb, setLimitesDb] = useState<LimitesMunicipioResponse | null>(null)
  const [loadingLimites, setLoadingLimites] = useState(false)
  const [exercicioAtivo, setExercicioAtivo] = useState<number | null>(null)
  const [limitesModalOpen, setLimitesModalOpen] = useState(false)
  const [detalheProposta, setDetalheProposta] = useState<LinhaProposta | null>(null)
  const [fichaLideranca, setFichaLideranca] = useState<{
    candidato: ResultadoEleicao
    cargo: CargoFotoCandidato
  } | null>(null)
  const [autoPrintFicha, setAutoPrintFicha] = useState(false)

  useEffect(() => {
    if (permLoading) return
    if (!isAdmin && !canAccess('territorio')) router.replace('/dashboard')
  }, [permLoading, isAdmin, canAccess, router])

  useEffect(() => {
    fetch('/api/consultar-tetos?only_municipios=true')
      .then((r) => r.json())
      .then((data) => {
        const lista = data.municipios ?? []
        if (lista.length > 0) {
          setMunicipios(lista)
          return
        }
        return fetch('/api/limites-tetos')
          .then((r2) => r2.json())
          .then((d2) => setMunicipios(d2.municipios ?? []))
      })
      .catch(() =>
        fetch('/api/limites-tetos')
          .then((r) => r.json())
          .then((data) => setMunicipios(data.municipios ?? []))
          .catch(() => setMunicipios([])),
      )

    fetch('/api/limites-tetos?config=true')
      .then((r) => r.json())
      .then((data) => {
        if (data.exercicio_ativo) setExercicioAtivo(data.exercicio_ativo)
      })
      .catch(() => setExercicioAtivo(2025))

    fetch('/populacaoibge.json')
      .then((r) => r.json())
      .then((data: MunicipioPopulacao[]) => setPopulacaoLista(data))
      .catch(() => setPopulacaoLista([]))
  }, [])

  const loadLimites = useCallback(async (municipio: string) => {
    if (!municipio) {
      setLimitesDb(null)
      return
    }
    setLoadingLimites(true)
    try {
      const res = await fetch(`/api/limites-tetos?municipio=${encodeURIComponent(municipio)}`)
      const data = (await res.json()) as LimitesMunicipioResponse & { error?: string }
      if (!res.ok) {
        setLimitesDb(null)
        return
      }
      setLimitesDb(data)
      setExercicioAtivo(data.exercicio)
    } catch {
      setLimitesDb(null)
    } finally {
      setLoadingLimites(false)
    }
  }, [])

  const loadFns = useCallback(async (municipio: string) => {
    if (!municipio) {
      setPropostasFns([])
      return
    }
    setLoadingFns(true)
    setError(null)
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 30_000)
      const res = await fetch(
        `/api/consultar-tetos?municipio=${encodeURIComponent(municipio)}`,
        { signal: controller.signal },
      )
      clearTimeout(timeoutId)
      if (!res.ok) {
        if (res.status === 504) {
          throw new Error('A consulta demorou demais. Tente novamente em instantes.')
        }
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Erro ${res.status}`)
      }
      const data = await res.json()
      setPropostasFns(data.propostas ?? [])
    } catch (e: unknown) {
      const msg =
        e instanceof Error && e.name === 'AbortError'
          ? 'Consulta cancelada por tempo limite.'
          : e instanceof Error
            ? e.message
            : 'Erro ao consultar FNS'
      setError(msg)
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
      const res = await fetch(`/api/emendas-suas?municipio=${encodeURIComponent(municipio)}`)
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setEmendasSuas([])
        return
      }
      setEmendasSuas(data.emendas ?? [])
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
    void loadFns(municipioSel)
    void loadSuas(municipioSel)
    void loadLimites(municipioSel)
  }, [municipioSel, loadFns, loadSuas, loadLimites])

  const propostasFnsFiltradas = useMemo(
    () => filtrarPropostasFns(propostasFns),
    [propostasFns],
  )

  const limiteMac = limitesDb?.mac?.valor ?? null
  const limitePap = limitesDb?.pap?.valor ?? null
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

  const resumoMac = useMemo(
    () => calcularResumoMac(propostasFnsFiltradas, limiteMac),
    [propostasFnsFiltradas, limiteMac],
  )
  const resumoPap = useMemo(
    () => calcularResumoPap(propostasFnsFiltradas, limitePap),
    [propostasFnsFiltradas, limitePap],
  )

  const totalSuasPropostas = useMemo(
    () => emendasSuas.reduce((acc, e) => acc + (e.valor_proposta || 0), 0),
    [emendasSuas],
  )
  const totalSuasPagar = useMemo(
    () => emendasSuas.reduce((acc, e) => acc + (e.valor_pagar || 0), 0),
    [emendasSuas],
  )

  const resumoSuas = useMemo(
    () =>
      calcularResumoSuas(
        classificacaoSuas.valorNumerico,
        totalSuasPropostas,
        totalSuasPagar,
      ),
    [classificacaoSuas.valorNumerico, totalSuasPropostas, totalSuasPagar],
  )

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
      origem: 'SUAS',
      emendaSuasId: e.id,
    }))
    return [...fns, ...suas].sort((a, b) => {
      const da = a.dtCadastramento ? new Date(a.dtCadastramento).getTime() : 0
      const db = b.dtCadastramento ? new Date(b.dtCadastramento).getTime() : 0
      return db - da
    })
  }, [propostasFnsFiltradas, emendasSuas])

  const handleRefresh = () => {
    if (municipioSel) {
      void loadFns(municipioSel)
      void loadSuas(municipioSel)
      void loadLimites(municipioSel)
    }
  }

  const openNovaSuas = () => {
    setSuasForm(emptySuasForm(municipioSel))
    setSuasModalOpen(true)
  }

  const openEditSuas = (e: EmendaSuas) => {
    setSuasForm({ ...e })
    setSuasModalOpen(true)
  }

  const saveSuas = async () => {
    if (!municipioSel && !suasForm.municipio) return
    setSuasSaving(true)
    try {
      const payload = {
        ...suasForm,
        municipio: municipioSel || suasForm.municipio,
      }
      const isEdit = Boolean(suasForm.id)
      const res = await fetch('/api/emendas-suas', {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      setSuasModalOpen(false)
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
      const res = await fetch(`/api/emendas-suas?id=${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Erro ao excluir')
      }
      await loadSuas(municipioSel)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally {
      setDeletingSuasId(null)
    }
  }

  if (permLoading) {
    return (
      <div className={cn('flex items-center justify-center p-12', pageShellClass)}>
        <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
      </div>
    )
  }

  return (
    <div className={cn('flex min-h-0 flex-1 flex-col w-full', pageShellClass)}>
      <div className="flex w-full min-w-0 flex-1 flex-col gap-5 px-4 py-6 lg:px-6 xl:gap-6">
        <header className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between lg:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl font-semibold text-text-primary xl:text-2xl">
              Ficha de Atendimento
            </h1>
            <p className="mt-1 text-sm text-text-secondary lg:max-w-3xl xl:max-w-none">
              Tetos MAC, PAP e SUAS centralizados no banco
              {exercicioAtivo ? ` (exercício ${exercicioAtivo})` : ''}, com propostas FNS e lançamentos
              SUAS locais.
            </p>
          </div>
          <div className="flex flex-wrap items-end gap-2 sm:gap-3 shrink-0">
            <label className="flex min-w-[12rem] max-w-[min(100%,20rem)] flex-col gap-1">
              <span className="text-xs font-medium text-text-secondary">Município (PI)</span>
              <select
                value={municipioSel}
                onChange={(e) => setMunicipioSel(e.target.value)}
                className="w-full rounded-lg border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40"
              >
                <option value="">Selecione…</option>
                {municipios.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <button
              type="button"
              onClick={() => setLimitesModalOpen(true)}
              disabled={!municipioSel}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-background/80 disabled:opacity-50"
            >
              <Settings2 className="h-4 w-4" />
              Limites
            </button>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={!municipioSel || loadingFns || loadingSuas || loadingLimites}
              className={cn(
                'inline-flex shrink-0 items-center gap-2 rounded-xl border border-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-background/80 disabled:opacity-50',
                sidebarPrimaryCTAButtonClass,
              )}
            >
              <RefreshCw
                className={cn(
                  'h-4 w-4',
                  (loadingFns || loadingSuas || loadingLimites) && 'animate-spin',
                )}
              />
              Atualizar
            </button>
          </div>
        </header>

        {(loadingFns || loadingSuas || loadingLimites) && municipioSel && (
          <p className="inline-flex items-center gap-2 text-xs text-text-secondary -mt-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Consultando FNS e emendas SUAS…
          </p>
        )}

        {error && (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </p>
        )}

        <FichaAtendimentoTetosBloco
          municipio={municipioSel || null}
          resumoMac={municipioSel ? resumoMac : null}
          resumoPap={municipioSel ? resumoPap : null}
          resumoSuas={municipioSel ? resumoSuas : null}
          populacao={populacao}
          classificacaoSuas={classificacaoSuas}
        />

        <FichaAtendimentoEditarLimites
          open={limitesModalOpen}
          municipio={municipioSel}
          onClose={() => setLimitesModalOpen(false)}
          onSaved={() => {
            if (municipioSel) void loadLimites(municipioSel)
            fetch('/api/limites-tetos?config=true')
              .then((r) => r.json())
              .then((data) => {
                if (data.exercicio_ativo) setExercicioAtivo(data.exercicio_ativo)
              })
              .catch(() => {})
          }}
        />

        {municipioSel ? (
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
        ) : null}

        <FichaLiderancaResumo
          open={fichaLideranca != null && Boolean(municipioSel)}
          onClose={() => {
            setFichaLideranca(null)
            setAutoPrintFicha(false)
          }}
          municipio={municipioSel}
          candidato={fichaLideranca?.candidato ?? null}
          cargo={fichaLideranca?.cargo ?? 'prefeito'}
          limitesDb={limitesDb}
          propostasFns={propostasFnsFiltradas}
          emendasSuas={emendasSuas}
          populacao={populacao}
          classificacaoSuas={classificacaoSuas}
          exercicioAtivo={exercicioAtivo}
          autoPrint={autoPrintFicha}
          onPrinted={() => setAutoPrintFicha(false)}
        />

        {municipioSel ? <FichaAtendimentoEmendasMandato municipio={municipioSel} /> : null}

        <section className={cn(sectionShellClass, 'flex min-w-0 flex-1 flex-col overflow-hidden')}>
          <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-text-primary">Propostas e lançamentos</h2>
              <p className="text-xs text-text-secondary mt-0.5">
                FNS (exceto PROGRAMA) + SUAS local. Use o ícone de detalhes ou o link para o portal
                Consulta FNS.
              </p>
            </div>
            <button
              type="button"
              disabled={!municipioSel}
              onClick={openNovaSuas}
              className={cn(
                'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
                sidebarPrimaryCTAButtonClass,
              )}
            >
              <Plus className="h-4 w-4" />
              Lançamento SUAS
            </button>
          </div>

          {!municipioSel ? (
            <p className="text-sm text-text-secondary py-8 text-center">
              Selecione um município para listar propostas.
            </p>
          ) : linhasTabela.length === 0 && !loadingFns ? (
            <p className="text-sm text-text-secondary py-8 text-center">
              Nenhuma proposta encontrada para este município.
            </p>
          ) : (
            <div className="min-w-0 w-full overflow-x-auto">
              <table className="w-full table-fixed text-left text-sm lg:table-auto">
                <colgroup>
                  <col className="w-[4.5rem] lg:w-[5%]" />
                  <col className="w-[7.5rem] lg:w-[14%]" />
                  <col className="w-[5.5rem] lg:w-[10%]" />
                  <col className="hidden sm:table-column lg:w-[18%]" />
                  <col className="hidden md:table-column lg:w-[12%]" />
                  <col className="w-[6.5rem] lg:w-[11%]" />
                  <col className="w-[6.5rem] lg:w-[11%]" />
                  <col className="w-[5.5rem] lg:w-[8%]" />
                  <col className="w-16 lg:w-[5%]" />
                </colgroup>
                <thead>
                  <tr className="border-b border-card text-xs text-text-secondary">
                    <th className="py-2 pr-2 font-medium lg:pr-3">Origem</th>
                    <th className="py-2 pr-2 font-medium lg:pr-3">Proposta</th>
                    <th className="py-2 pr-2 font-medium lg:pr-3">Tipo</th>
                    <th className="hidden py-2 pr-2 font-medium sm:table-cell lg:pr-3">Recurso</th>
                    <th className="hidden py-2 pr-2 font-medium md:table-cell lg:pr-3">Situação</th>
                    <th className="py-2 pr-2 font-medium text-right lg:pr-3">Valor proposta</th>
                    <th className="py-2 pr-2 font-medium text-right lg:pr-3">A pagar</th>
                    <th className="py-2 font-medium">Data</th>
                    <th className="py-2" />
                  </tr>
                </thead>
                <tbody>
                  {linhasTabela.map((row) => (
                    <tr key={`${row.origem}-${row.nuProposta}`} className="border-b border-card/60">
                      <td className="py-2.5 pr-2 lg:pr-3">
                        <span
                          className={cn(
                            'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase',
                            row.origem === 'FNS'
                              ? 'bg-slate-100 text-slate-700'
                              : 'bg-amber-100 text-amber-800',
                          )}
                        >
                          {row.origem}
                        </span>
                      </td>
                      <td className="py-2.5 pr-2 font-mono text-xs truncate lg:pr-3" title={row.nuProposta}>
                        {row.nuProposta}
                      </td>
                      <td className="py-2.5 pr-2 truncate lg:pr-3" title={row.coTipoProposta || ''}>
                        {row.coTipoProposta || '—'}
                      </td>
                      <td
                        className="hidden py-2.5 pr-2 truncate sm:table-cell lg:pr-3"
                        title={row.dsTipoRecurso || ''}
                      >
                        {row.dsTipoRecurso || '—'}
                      </td>
                      <td
                        className="hidden py-2.5 pr-2 truncate md:table-cell lg:pr-3 text-text-secondary"
                        title={row.dsSituacaoProposta || ''}
                      >
                        {row.dsSituacaoProposta || '—'}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums whitespace-nowrap lg:pr-3">
                        {formatMoney(row.vlProposta)}
                      </td>
                      <td className="py-2.5 pr-2 text-right tabular-nums whitespace-nowrap lg:pr-3">
                        {formatMoney(row.vlPagar)}
                      </td>
                      <td className="py-2.5 text-text-secondary whitespace-nowrap">
                        {row.dtCadastramento ? formatDateShort(row.dtCadastramento) : '—'}
                      </td>
                      <td className="py-2.5">
                        <div className="flex gap-0.5 justify-end">
                          <button
                            type="button"
                            onClick={() => setDetalheProposta(row)}
                            className="p-1.5 rounded-lg hover:bg-background text-text-secondary"
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
                              className="p-1.5 rounded-lg hover:bg-background text-accent-gold"
                              aria-label="Abrir no Consulta FNS"
                              title="Consulta FNS"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          ) : null}
                          {row.origem === 'SUAS' && row.emendaSuasId ? (
                            <>
                              <button
                                type="button"
                                onClick={() => {
                                  const e = emendasSuas.find((x) => x.id === row.emendaSuasId)
                                  if (e) openEditSuas(e)
                                }}
                                className="p-1.5 rounded-lg hover:bg-background text-text-secondary"
                                aria-label="Editar"
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                disabled={deletingSuasId === row.emendaSuasId}
                                onClick={() => void deleteSuas(row.emendaSuasId!)}
                                className="p-1.5 rounded-lg hover:bg-red-50 text-red-600"
                                aria-label="Excluir"
                              >
                                {deletingSuasId === row.emendaSuasId ? (
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
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <p className="text-[11px] text-text-secondary pb-4">
          MAC/PAP: limites em planilhas 2025; propostas via API pública do FNS. SUAS: teto calculado
          pela população (arquivo IBGE local); propostas SUAS são registradas neste sistema (tabela{' '}
          <code className="text-[10px]">emendas_suas</code>).
        </p>
      </div>

      <FichaAtendimentoPropostaDetalhe
        open={detalheProposta != null}
        proposta={detalheProposta}
        origem={detalheProposta?.origem ?? 'FNS'}
        onClose={() => setDetalheProposta(null)}
      />

      {suasModalOpen && (
        <SuasModal
          form={suasForm}
          saving={suasSaving}
          onClose={() => setSuasModalOpen(false)}
          onChange={setSuasForm}
          onSave={() => void saveSuas()}
        />
      )}
    </div>
  )
}

function SuasModal({
  form,
  saving,
  onClose,
  onChange,
  onSave,
}: {
  form: Omit<EmendaSuas, 'id'> & { id?: string }
  saving: boolean
  onClose: () => void
  onChange: (f: Omit<EmendaSuas, 'id'> & { id?: string }) => void
  onSave: () => void
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40">
      <div className="w-full max-w-md rounded-2xl bg-surface border border-card shadow-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-text-primary">
            {form.id ? 'Editar lançamento SUAS' : 'Novo lançamento SUAS'}
          </h3>
          <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-background">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3">
          <Field label="Município">
            <input
              value={form.municipio}
              readOnly
              className="w-full rounded-xl border border-card bg-background/60 px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Tipo de proposta">
            <input
              value={form.tipo_proposta}
              onChange={(e) => onChange({ ...form, tipo_proposta: e.target.value })}
              className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Tipo de recurso">
            <input
              value={form.tipo_recurso}
              onChange={(e) => onChange({ ...form, tipo_recurso: e.target.value })}
              className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Valor da proposta (R$)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.valor_proposta}
              onChange={(e) =>
                onChange({ ...form, valor_proposta: parseFloat(e.target.value) || 0 })
              }
              className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
            />
          </Field>
          <Field label="Valor a pagar (R$)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.valor_pagar}
              onChange={(e) => onChange({ ...form, valor_pagar: parseFloat(e.target.value) || 0 })}
              className="w-full rounded-xl border border-card bg-background px-3 py-2 text-sm"
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-card px-4 py-2 text-sm"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-white',
              sidebarPrimaryCTAButtonClass,
            )}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </button>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-text-secondary">{label}</span>
      {children}
    </label>
  )
}
