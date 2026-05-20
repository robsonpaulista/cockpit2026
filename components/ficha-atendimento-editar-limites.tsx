'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { LimitesMunicipioResponse, SuasFaixaPorte } from '@/lib/limites-tetos-types'
import { SUAS_FAIXAS_PADRAO } from '@/lib/limites-tetos-types'

interface Props {
  open: boolean
  municipio: string
  onClose: () => void
  onSaved: () => void
}

function parseInputMoney(s: string): number {
  const cleaned = s.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return Number.isFinite(n) ? n : 0
}

function formatInputMoney(n: number | null): string {
  if (n == null || !Number.isFinite(n)) return ''
  return n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

export function FichaAtendimentoEditarLimites({ open, municipio, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [importing, setImporting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [exercicio, setExercicio] = useState(2025)
  const [exercicioGlobal, setExercicioGlobal] = useState(2025)
  const [papValor, setPapValor] = useState('')
  const [macValor, setMacValor] = useState('')
  const [faixas, setFaixas] = useState<SuasFaixaPorte[]>(SUAS_FAIXAS_PADRAO)

  const load = useCallback(async () => {
    if (!municipio) return
    setLoading(true)
    setError(null)
    try {
      const configRes = await fetch('/api/limites-tetos?config=true')
      const config = await configRes.json().catch(() => ({}))
      const exAtivo = config.exercicio_ativo ?? 2025
      setExercicioGlobal(exAtivo)
      const exLoad = exercicio || exAtivo

      const [limitesRes, faixasRes] = await Promise.all([
        fetch(`/api/limites-tetos?municipio=${encodeURIComponent(municipio)}&exercicio=${exLoad}`),
        fetch(`/api/limites-tetos?faixas_suas=true&exercicio=${exLoad}`),
      ])
      const limites = (await limitesRes.json()) as LimitesMunicipioResponse & { error?: string }
      const faixasData = await faixasRes.json().catch(() => ({}))

      if (!limitesRes.ok) {
        throw new Error(limites.error || 'Erro ao carregar limites')
      }

      setExercicio(limites.exercicio ?? exLoad)

      setPapValor(formatInputMoney(limites.pap?.valor ?? null))
      setMacValor(formatInputMoney(limites.mac?.valor ?? null))
      setFaixas(faixasData.faixas ?? limites.suas_faixas ?? SUAS_FAIXAS_PADRAO)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar')
    } finally {
      setLoading(false)
    }
  }, [municipio, exercicio])

  useEffect(() => {
    if (open && municipio) {
      void load()
    }
  }, [open, municipio, load])

  const saveExercicioAtivo = async () => {
    const res = await fetch('/api/limites-tetos', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tipo: 'exercicio_ativo', exercicio: exercicioGlobal }),
    })
    if (!res.ok) {
      const data = await res.json().catch(() => ({}))
      throw new Error(data.error || 'Erro ao salvar exercício')
    }
  }

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      await saveExercicioAtivo()

      const papRes = await fetch('/api/limites-tetos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'pap',
          exercicio,
          municipio,
          valor: parseInputMoney(papValor),
        }),
      })
      if (!papRes.ok) {
        const d = await papRes.json().catch(() => ({}))
        throw new Error(d.error || 'Erro ao salvar PAP')
      }

      const macRes = await fetch('/api/limites-tetos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tipo: 'mac',
          exercicio,
          municipio,
          valor: parseInputMoney(macValor),
        }),
      })
      if (!macRes.ok) {
        const d = await macRes.json().catch(() => ({}))
        throw new Error(d.error || 'Erro ao salvar MAC')
      }

      const faixasRes = await fetch('/api/limites-tetos', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tipo: 'suas_faixas', exercicio, faixas }),
      })
      if (!faixasRes.ok) {
        const d = await faixasRes.json().catch(() => ({}))
        throw new Error(d.error || 'Erro ao salvar faixas SUAS')
      }

      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const importarJson = async () => {
    setImporting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/limites-tetos?importar=true&exercicio=${encodeURIComponent(String(exercicio))}`,
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro na importação')
      await load()
      onSaved()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro na importação')
    } finally {
      setImporting(false)
    }
  }

  const updateFaixa = (index: number, field: keyof SuasFaixaPorte, value: string) => {
    setFaixas((prev) => {
      const next = [...prev]
      const row = { ...next[index] }
      if (field === 'porte') {
        row.porte = value
      } else if (field === 'populacao_max') {
        row.populacao_max = value === '' ? null : parseInt(value, 10)
      } else if (field === 'valor') {
        row.valor = parseInputMoney(value)
      } else if (field === 'ordem') {
        row.ordem = parseInt(value, 10) || index + 1
      }
      next[index] = row
      return next
    })
  }

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="editar-limites-title"
    >
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-card bg-surface shadow-xl">
        <div className="flex items-center justify-between border-b border-card px-5 py-4">
          <div>
            <h2 id="editar-limites-title" className="text-base font-semibold text-text-primary">
              Limites MAC, PAP e SUAS
            </h2>
            <p className="text-xs text-text-secondary mt-0.5">{municipio}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-text-secondary hover:bg-background"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
            </p>
          )}

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-text-secondary py-8 justify-center">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando…
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">
                    Exercício ativo (todos os usuários)
                  </span>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={exercicioGlobal}
                    onChange={(e) => setExercicioGlobal(parseInt(e.target.value, 10) || 2025)}
                    className="rounded-lg border border-card bg-background px-3 py-2 text-sm"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">
                    Exercício desta edição
                  </span>
                  <input
                    type="number"
                    min={2000}
                    max={2100}
                    value={exercicio}
                    onChange={(e) => setExercicio(parseInt(e.target.value, 10) || 2025)}
                    className="rounded-lg border border-card bg-background px-3 py-2 text-sm"
                  />
                </label>
              </div>

              <p className="text-xs text-text-secondary">
                Os valores abaixo valem para o município selecionado no exercício indicado. As faixas
                SUAS são globais (por população) para todo o estado no mesmo exercício.
              </p>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">Limite PAP (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={papValor}
                    onChange={(e) => setPapValor(e.target.value)}
                    placeholder="0,00"
                    className="rounded-lg border border-card bg-background px-3 py-2 text-sm tabular-nums"
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-text-secondary">Limite MAC (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={macValor}
                    onChange={(e) => setMacValor(e.target.value)}
                    placeholder="0,00"
                    className="rounded-lg border border-card bg-background px-3 py-2 text-sm tabular-nums"
                  />
                </label>
              </div>

              <div>
                <h3 className="text-sm font-semibold text-text-primary mb-2">Faixas SUAS por porte</h3>
                <div className="overflow-x-auto rounded-lg border border-card">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-card text-text-secondary">
                        <th className="px-2 py-2 font-medium">Até pop.</th>
                        <th className="px-2 py-2 font-medium">Porte</th>
                        <th className="px-2 py-2 font-medium text-right">Teto (R$)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {faixas.map((f, i) => (
                        <tr key={f.ordem} className="border-b border-card/60">
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              placeholder="∞"
                              value={f.populacao_max ?? ''}
                              onChange={(e) => updateFaixa(i, 'populacao_max', e.target.value)}
                              className="w-24 rounded border border-card bg-background px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-1.5">
                            <input
                              type="text"
                              value={f.porte}
                              onChange={(e) => updateFaixa(i, 'porte', e.target.value)}
                              className="w-full min-w-[8rem] rounded border border-card bg-background px-2 py-1"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-right">
                            <input
                              type="text"
                              inputMode="decimal"
                              value={formatInputMoney(f.valor)}
                              onChange={(e) => updateFaixa(i, 'valor', e.target.value)}
                              className="w-28 rounded border border-card bg-background px-2 py-1 text-right tabular-nums"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <button
                type="button"
                onClick={() => void importarJson()}
                disabled={importing}
                className="text-xs text-accent-gold hover:underline disabled:opacity-50"
              >
                {importing ? 'Importando…' : 'Importar limites dos arquivos JSON (carga inicial 2025)'}
              </button>
            </>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-card px-5 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-background/80"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || loading || !municipio}
            className={cn(
              'inline-flex items-center gap-2 rounded-xl bg-accent-gold px-4 py-2 text-sm font-medium text-white disabled:opacity-50',
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
