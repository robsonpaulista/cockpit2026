'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Loader2, Pencil, Plus, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { resumoTrZebra } from '@/lib/resumo-eleicoes-table-styles'

export type CenarioVotosLiderancasModal = 'aferido_jadyel' | 'promessa_lideranca' | 'legado_anterior'

export type LiderancaCrudRow = {
  id: number
  municipio: string
  nome: string
  cargo: string
  depEstadual: string
  liderancaAtual: string
  emDialogo: boolean
  expectativaLegado: number
  expectativaAferida: number
  promessa: number
  votacaoFinal2022: number
}

type FormState = {
  nome: string
  cargo: string
  depEstadual: string
  liderancaAtual: string
  expectativaLegado: string
  expectativaAferida: string
  promessa: string
}

export type LiderancaFormPrefill = {
  nome: string
  cargo?: string
  depEstadual?: string
  liderancaAtual?: string
  expectativaLegado?: number
  expectativaAferida?: number
  promessa?: number
}

const EMPTY_FORM: FormState = {
  nome: '',
  cargo: '',
  depEstadual: '',
  liderancaAtual: '',
  expectativaLegado: '0',
  expectativaAferida: '0',
  promessa: '0',
}

function formFromPrefill(prefill: LiderancaFormPrefill): FormState {
  return {
    nome: String(prefill.nome || '').trim(),
    cargo: String(prefill.cargo || '').trim(),
    depEstadual: String(prefill.depEstadual || '').trim(),
    liderancaAtual: String(prefill.liderancaAtual || '').trim(),
    expectativaLegado: String(prefill.expectativaLegado ?? 0),
    expectativaAferida: String(prefill.expectativaAferida ?? 0),
    promessa: String(prefill.promessa ?? 0),
  }
}

function valorCenario(row: LiderancaCrudRow, cenario: CenarioVotosLiderancasModal): number {
  if (cenario === 'promessa_lideranca') return row.promessa
  if (cenario === 'aferido_jadyel') return row.expectativaAferida
  return row.expectativaLegado
}

function labelCenario(cenario: CenarioVotosLiderancasModal): string {
  if (cenario === 'promessa_lideranca') return 'Promessa 2026'
  if (cenario === 'aferido_jadyel') return 'Aferido 2026'
  return 'Expectativa 2026'
}

function parseNum(value: string): number {
  const cleaned = String(value || '')
    .trim()
    .replace(/\./g, '')
    .replace(',', '.')
  const n = Number(cleaned)
  return Number.isFinite(n) ? n : 0
}

type ResumoLiderancasCrudModalProps = {
  cidade: string
  cenarioVotos: CenarioVotosLiderancasModal
  prefillNova?: LiderancaFormPrefill | null
  onClose: () => void
  onChanged?: () => void
}

export function ResumoLiderancasCrudModal({
  cidade,
  cenarioVotos,
  prefillNova = null,
  onClose,
  onChanged,
}: ResumoLiderancasCrudModalProps) {
  const [rows, setRows] = useState<LiderancaCrudRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const prefillAppliedRef = useRef<string | null>(null)

  const loadRows = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/territorio/liderancas?cidade=${encodeURIComponent(cidade)}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao carregar lideranças')
      setRows(Array.isArray(json.rows) ? (json.rows as LiderancaCrudRow[]) : [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar lideranças')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [cidade])

  useEffect(() => {
    void loadRows()
  }, [loadRows])

  useEffect(() => {
    if (!prefillNova?.nome) return
    const key = `${cidade}|${prefillNova.nome}|${prefillNova.cargo || ''}|${prefillNova.expectativaLegado ?? 0}`
    if (prefillAppliedRef.current === key) return
    prefillAppliedRef.current = key
    setCreating(true)
    setEditingId(null)
    setForm(formFromPrefill(prefillNova))
    setError(null)
  }, [cidade, prefillNova])

  const ordenadas = useMemo(() => {
    return [...rows].sort(
      (a, b) =>
        valorCenario(b, cenarioVotos) - valorCenario(a, cenarioVotos) ||
        a.nome.localeCompare(b.nome, 'pt-BR'),
    )
  }, [rows, cenarioVotos])

  const totalExpectativa = useMemo(
    () => ordenadas.reduce((acc, row) => acc + valorCenario(row, cenarioVotos), 0),
    [ordenadas, cenarioVotos],
  )

  const iniciarCriacao = () => {
    setCreating(true)
    setEditingId(null)
    setForm(EMPTY_FORM)
    setError(null)
  }

  const iniciarEdicao = (row: LiderancaCrudRow) => {
    setCreating(false)
    setEditingId(row.id)
    setForm({
      nome: row.nome,
      cargo: row.cargo === '-' ? '' : row.cargo,
      depEstadual: row.depEstadual,
      liderancaAtual: row.liderancaAtual,
      expectativaLegado: String(row.expectativaLegado || 0),
      expectativaAferida: String(row.expectativaAferida || 0),
      promessa: String(row.promessa || 0),
    })
    setError(null)
  }

  const cancelarForm = () => {
    setCreating(false)
    setEditingId(null)
    setForm(EMPTY_FORM)
  }

  const salvar = async () => {
    const nome = form.nome.trim()
    if (!nome) {
      setError('Informe o nome da liderança')
      return
    }

    setSaving(true)
    setError(null)
    const payload = {
      municipio: cidade,
      lideranca: nome,
      cargo_2024: form.cargo.trim() || null,
      dep_estadual: form.depEstadual.trim() || null,
      lideranca_atual: form.liderancaAtual.trim() || null,
      expectativa_votos_2026: parseNum(form.expectativaLegado),
      expectativa_jadyel_2026: parseNum(form.expectativaAferida),
      promessa_lideranca_2026: parseNum(form.promessa),
    }

    try {
      const res = editingId
        ? await fetch(`/api/territorio/liderancas/${editingId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : await fetch('/api/territorio/liderancas', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Erro ao salvar')
      cancelarForm()
      await loadRows()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const excluir = async (row: LiderancaCrudRow) => {
    const ok = window.confirm(`Excluir a liderança "${row.nome}"?`)
    if (!ok) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch(`/api/territorio/liderancas/${row.id}`, { method: 'DELETE' })
      const json = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(json.error || 'Erro ao excluir')
      if (editingId === row.id) cancelarForm()
      await loadRows()
      onChanged?.()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao excluir')
    } finally {
      setSaving(false)
    }
  }

  const formAberto = creating || editingId != null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-xl border border-card bg-surface">
        <div className="flex items-center justify-between border-b border-card px-4 py-3">
          <div>
            <h3 className="text-sm font-semibold text-text-primary">Lideranças de {cidade}</h3>
            <p className="text-xs text-text-secondary">
              {loading ? 'Carregando…' : `${rows.length} registro(s)`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={iniciarCriacao}
              disabled={saving || loading}
              className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-card bg-background px-2.5 text-xs font-medium text-text-primary hover:bg-surface disabled:opacity-50"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden />
              Nova
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded p-1.5 transition-colors hover:bg-background"
            >
              <X className="h-4 w-4 text-text-secondary" />
            </button>
          </div>
        </div>

        {error ? (
          <div className="border-b border-status-danger/30 bg-status-danger/10 px-4 py-2 text-xs text-status-danger">
            {error}
          </div>
        ) : null}

        {formAberto ? (
          <div className="border-b border-card bg-background/40 px-4 py-3">
            <p className="mb-2 text-xs font-medium text-text-secondary">
              {editingId ? 'Editar liderança' : 'Nova liderança'}
            </p>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 lg:grid-cols-3">
              <label className="text-xs text-text-secondary">
                Nome
                <input
                  value={form.nome}
                  onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-card bg-surface px-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Cargo
                <input
                  value={form.cargo}
                  onChange={(e) => setForm((prev) => ({ ...prev, cargo: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-card bg-surface px-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Dep. Estadual
                <input
                  value={form.depEstadual}
                  onChange={(e) => setForm((prev) => ({ ...prev, depEstadual: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-card bg-surface px-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Expectativa 2026 (Legado)
                <input
                  value={form.expectativaLegado}
                  onChange={(e) => setForm((prev) => ({ ...prev, expectativaLegado: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-card bg-surface px-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Aferido Jadyel 2026
                <input
                  value={form.expectativaAferida}
                  onChange={(e) =>
                    setForm((prev) => ({ ...prev, expectativaAferida: e.target.value }))
                  }
                  className="mt-1 h-9 w-full rounded-lg border border-card bg-surface px-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-secondary">
                Promessa 2026
                <input
                  value={form.promessa}
                  onChange={(e) => setForm((prev) => ({ ...prev, promessa: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-card bg-surface px-2 text-sm text-text-primary"
                />
              </label>
              <label className="text-xs text-text-secondary md:col-span-2 lg:col-span-3">
                Liderança atual
                <select
                  value={form.liderancaAtual}
                  onChange={(e) => setForm((prev) => ({ ...prev, liderancaAtual: e.target.value }))}
                  className="mt-1 h-9 w-full rounded-lg border border-card bg-surface px-2 text-sm text-text-primary"
                >
                  <option value="">(em branco)</option>
                  <option value="SIM">SIM</option>
                  <option value="NÃO">NÃO</option>
                  <option value="EM DIÁLOGO">EM DIÁLOGO</option>
                </select>
              </label>
            </div>
            <div className="mt-3 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={cancelarForm}
                disabled={saving}
                className="h-8 rounded-lg border border-card bg-surface px-3 text-xs text-text-primary disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void salvar()}
                disabled={saving}
                className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#ff9800] px-3 text-xs font-medium text-white disabled:opacity-50"
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : null}
                Salvar
              </button>
            </div>
          </div>
        ) : null}

        <div className="overflow-auto p-3">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando lideranças…
            </div>
          ) : ordenadas.length === 0 ? (
            <p className="py-6 text-center text-sm text-text-secondary">
              Nenhuma liderança cadastrada para esta cidade.
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="bg-background px-2 py-2 text-left text-text-secondary">Nome</th>
                  <th className="bg-background px-2 py-2 text-left text-text-secondary">Cargo</th>
                  <th className="bg-background px-2 py-2 text-right text-text-secondary">
                    {labelCenario(cenarioVotos)}
                  </th>
                  <th className="bg-background px-2 py-2 text-right text-text-secondary">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ordenadas.map((lideranca, rowIndex) => {
                  const emDialogo = Boolean(lideranca.emDialogo)
                  return (
                    <tr
                      key={lideranca.id}
                      className={cn(
                        'border-b border-card transition-colors',
                        emDialogo
                          ? 'bg-red-50 text-red-700 hover:bg-red-100/80'
                          : cn('text-text-primary hover:bg-background/50', resumoTrZebra(rowIndex)),
                      )}
                    >
                      <td className="px-2 py-1.5">
                        <span className={cn(emDialogo && 'font-semibold')}>{lideranca.nome || '-'}</span>
                        {emDialogo ? (
                          <span className="ml-1.5 inline-flex rounded bg-red-600 px-1 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                            Em diálogo
                          </span>
                        ) : null}
                      </td>
                      <td className="px-2 py-1.5">{lideranca.cargo || '-'}</td>
                      <td className="px-2 py-1.5 text-right">
                        {valorCenario(lideranca, cenarioVotos).toLocaleString('pt-BR')}
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => iniciarEdicao(lideranca)}
                            disabled={saving}
                            className="rounded p-1.5 text-text-secondary hover:bg-background hover:text-text-primary disabled:opacity-50"
                            title="Editar"
                          >
                            <Pencil className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <button
                            type="button"
                            onClick={() => void excluir(lideranca)}
                            disabled={saving}
                            className="rounded p-1.5 text-text-secondary hover:bg-status-danger/10 hover:text-status-danger disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-card bg-background/90 font-semibold text-text-primary">
                  <td className="px-2 py-1.5" colSpan={2}>
                    TOTAL
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums">
                    {totalExpectativa.toLocaleString('pt-BR')}
                  </td>
                  <td className="px-2 py-1.5" aria-hidden />
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
