'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Check, Loader2, Save } from 'lucide-react'
import {
  classificarObraFase,
  OBRA_FASE_LABEL,
  valorExibidoMapaObra,
  type ObraFaseMapa,
} from '@/lib/obras-mapa'
import type { JadyelObraMapaRow, JadyelObraPeriodo } from '@/lib/jadyel-obras-planilha'
import { JADYEL_OBRA_STATUS_SUGESTOES } from '@/lib/jadyel-obras-mapa'
import { chromeButtonClass, chromeFilterChipClass } from '@/lib/button-chrome'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

const PERIODOS: Array<{ id: JadyelObraPeriodo | 'todos'; label: string }> = [
  { id: 'todos', label: 'Todos os mandatos' },
  { id: '2026', label: '2026' },
  { id: '2025', label: '2025' },
  { id: '2023-24', label: '2023–24' },
]

const TIPO_LABEL: Record<string, string> = {
  asfalto: 'Asfalto',
  paralelepipedo: 'Paralelepípedo',
  'quadras-esportivas': 'Quadras e areninhas',
  'maquinario-agricola': 'Maquinário agrícola',
  'passagens-cisternas': 'Passagens e cisternas',
  outros: 'Outros',
}

function formatCurrency(value?: number | null): string {
  if (value == null || !Number.isFinite(value)) return '—'
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(value)
}

interface MapaObrasListaStatusProps {
  onStatusSalvo?: () => void
}

export function MapaObrasListaStatus({ onStatusSalvo }: MapaObrasListaStatusProps) {
  const [obras, setObras] = useState<JadyelObraMapaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [periodo, setPeriodo] = useState<JadyelObraPeriodo | 'todos'>('todos')
  const [busca, setBusca] = useState('')
  const [draftStatus, setDraftStatus] = useState<Record<string, string>>({})
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const params = new URLSearchParams({ escopo: 'lista', periodo })
      const res = await fetch(`/api/obras/mapa?${params.toString()}`, { cache: 'no-store' })
      const json = (await res.json()) as {
        obras?: JadyelObraMapaRow[]
        error?: string
        setupRequired?: boolean
        retryable?: boolean
      }
      if (!res.ok) {
        if (json.setupRequired) {
          throw new Error('Execute database/create-obras-mapa-jadyel-status.sql no Supabase para salvar status.')
        }
        throw new Error(json.error ?? 'Falha ao carregar lista de obras.')
      }
      setObras(json.obras ?? [])
      setDraftStatus(
        Object.fromEntries((json.obras ?? []).map((obra) => [obra.id, obra.status ?? '']))
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar obras.')
      setObras([])
    } finally {
      setLoading(false)
    }
  }, [periodo])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const filtradas = useMemo(() => {
    const q = busca.trim().toLowerCase()
    if (!q) return obras
    return obras.filter((obra) => {
      const blob = [obra.municipio, obra.obra, obra.orgao, obra.sei, obra.status, obra.obs]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
      return blob.includes(q)
    })
  }, [busca, obras])

  const salvarStatus = useCallback(
    async (obraId: string) => {
      setSavingId(obraId)
      setSavedId(null)
      setError('')
      try {
        const status = draftStatus[obraId]?.trim() || null
        const res = await fetch(`/api/obras/mapa/${encodeURIComponent(obraId)}/status`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status }),
        })
        const json = (await res.json()) as { error?: string; setupRequired?: boolean }
        if (!res.ok) {
          if (json.setupRequired) {
            throw new Error('Execute database/create-obras-mapa-jadyel-status.sql no Supabase.')
          }
          throw new Error(json.error ?? 'Falha ao salvar status.')
        }
        setObras((prev) =>
          prev.map((obra) => (obra.id === obraId ? { ...obra, status: status ?? null } : obra))
        )
        setSavedId(obraId)
        onStatusSalvo?.()
        window.setTimeout(() => setSavedId((cur) => (cur === obraId ? null : cur)), 2000)
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao salvar status.')
      } finally {
        setSavingId(null)
      }
    },
    [draftStatus, onStatusSalvo]
  )

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-xl border border-card bg-bg-surface p-4">
        <h2 className="text-base font-semibold text-text-primary">Obras da planilha Jadyel</h2>
        <p className={cn('mt-1 max-w-3xl', typographyBodyMutedClass)}>
          Lista extraída das planilhas 2023–24, 2025 e 2026. Informe o status de cada obra para alimentar o mapa
          (asfalto, paralelepípedo, quadras e areninhas).
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {PERIODOS.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setPeriodo(p.id)}
            className={chromeFilterChipClass(periodo === p.id)}
          >
            {p.label}
          </button>
        ))}
        <input
          type="search"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar município, obra, SEI…"
          className="ml-auto min-w-[12rem] flex-1 rounded-lg border border-card bg-bg-app px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft sm:max-w-xs"
        />
      </div>

      {error ? <p className="text-sm text-status-danger">{error}</p> : null}

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-text-muted">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Carregando obras…
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-card bg-bg-surface">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-card bg-bg-app/60 text-xs uppercase tracking-wide text-text-secondary">
                <tr>
                  <th className="px-3 py-2.5">Mandato</th>
                  <th className="px-3 py-2.5">Município</th>
                  <th className="px-3 py-2.5">Obra</th>
                  <th className="px-3 py-2.5">Tipo</th>
                  <th className="px-3 py-2.5">Cota</th>
                  <th className="px-3 py-2.5">Órgão / SEI</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Fase no mapa</th>
                  <th className="px-3 py-2.5" />
                </tr>
              </thead>
              <tbody className="divide-y divide-card">
                {filtradas.map((obra) => {
                  const fase = classificarObraFase(obra.status) as ObraFaseMapa
                  const dirty = (draftStatus[obra.id] ?? '') !== (obra.status ?? '')
                  return (
                    <tr key={obra.id} className="align-top hover:bg-bg-app/30">
                      <td className="px-3 py-3 tabular-nums text-text-secondary">{obra.periodo}</td>
                      <td className="px-3 py-3 font-medium text-text-primary">{obra.municipio}</td>
                      <td className="max-w-md px-3 py-3 text-text-primary">
                        <p>{obra.obra}</p>
                        {obra.obs ? <p className={cn('mt-1', typographyBodyMutedClass)}>{obra.obs}</p> : null}
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{TIPO_LABEL[obra.tipo] ?? obra.tipo}</td>
                      <td className="px-3 py-3 tabular-nums text-text-secondary">{formatCurrency(valorExibidoMapaObra(obra))}</td>
                      <td className="px-3 py-3 text-text-secondary">
                        <div>{obra.orgao ?? '—'}</div>
                        <div className="text-xs text-text-muted">{obra.sei ?? '—'}</div>
                      </td>
                      <td className="min-w-[12rem] px-3 py-3">
                        <input
                          list={`status-sugestoes-${obra.id}`}
                          value={draftStatus[obra.id] ?? ''}
                          onChange={(e) =>
                            setDraftStatus((prev) => ({ ...prev, [obra.id]: e.target.value }))
                          }
                          placeholder="Ex.: Em andamento"
                          className="w-full rounded-lg border border-card bg-bg-app px-2.5 py-1.5 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                        />
                        <datalist id={`status-sugestoes-${obra.id}`}>
                          {JADYEL_OBRA_STATUS_SUGESTOES.map((s) => (
                            <option key={s} value={s} />
                          ))}
                        </datalist>
                      </td>
                      <td className="px-3 py-3 text-text-secondary">{OBRA_FASE_LABEL[fase]}</td>
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          disabled={!dirty || savingId === obra.id}
                          onClick={() => void salvarStatus(obra.id)}
                          className={cn(chromeButtonClass, 'whitespace-nowrap')}
                        >
                          {savingId === obra.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                          ) : savedId === obra.id ? (
                            <Check className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <Save className="h-3.5 w-3.5" aria-hidden />
                          )}
                          Salvar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {filtradas.length === 0 ? (
            <p className="px-4 py-10 text-center text-sm text-text-muted">Nenhuma obra encontrada.</p>
          ) : null}
        </div>
      )}
    </div>
  )
}
