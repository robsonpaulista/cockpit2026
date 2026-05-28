'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Save, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { MODALIDADE_LIMITE_LABEL, type ModalidadeLimite } from '@/lib/emenda-modalidade'
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
  const [papIndividual, setPapIndividual] = useState('')
  const [papColetiva, setPapColetiva] = useState('')
  const [macIndividual, setMacIndividual] = useState('')
  const [macColetiva, setMacColetiva] = useState('')
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

      setPapIndividual(formatInputMoney(limites.pap?.individual?.valor ?? null))
      setPapColetiva(formatInputMoney(limites.pap?.coletiva?.valor ?? null))
      setMacIndividual(formatInputMoney(limites.mac?.individual?.valor ?? null))
      setMacColetiva(formatInputMoney(limites.mac?.coletiva?.valor ?? null))
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

      const salvarLimite = async (
        tipo: 'pap' | 'mac',
        modalidade: ModalidadeLimite,
        valor: number,
      ) => {
        const res = await fetch('/api/limites-tetos', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tipo, exercicio, municipio, modalidade, valor }),
        })
        if (!res.ok) {
          const d = await res.json().catch(() => ({}))
          throw new Error(d.error || `Erro ao salvar ${tipo.toUpperCase()} ${modalidade}`)
        }
      }

      await salvarLimite('pap', 'individual', parseInputMoney(papIndividual))
      await salvarLimite('pap', 'coletiva', parseInputMoney(papColetiva))
      await salvarLimite('mac', 'individual', parseInputMoney(macIndividual))
      await salvarLimite('mac', 'coletiva', parseInputMoney(macColetiva))

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
                Tetos por modalidade (individual e coletiva) para o município no exercício indicado.
                As faixas SUAS são globais (por população) para todo o estado.
              </p>

              {(['individual', 'coletiva'] as const).map((mod) => (
                <div key={mod} className="space-y-2 rounded-lg border border-card/80 p-3">
                  <h3 className="text-xs font-semibold text-text-primary">
                    Emendas {MODALIDADE_LIMITE_LABEL[mod]}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-text-secondary">
                        Limite PAP {MODALIDADE_LIMITE_LABEL[mod]} (R$)
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={mod === 'individual' ? papIndividual : papColetiva}
                        onChange={(e) =>
                          mod === 'individual'
                            ? setPapIndividual(e.target.value)
                            : setPapColetiva(e.target.value)
                        }
                        placeholder="0,00"
                        className="rounded-lg border border-card bg-background px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-xs font-medium text-text-secondary">
                        Limite MAC {MODALIDADE_LIMITE_LABEL[mod]} (R$)
                      </span>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={mod === 'individual' ? macIndividual : macColetiva}
                        onChange={(e) =>
                          mod === 'individual'
                            ? setMacIndividual(e.target.value)
                            : setMacColetiva(e.target.value)
                        }
                        placeholder="0,00"
                        className="rounded-lg border border-card bg-background px-3 py-2 text-sm tabular-nums"
                      />
                    </label>
                  </div>
                </div>
              ))}

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
                {importing
                  ? 'Importando…'
                  : `Importar JSON individuais (ex. ${exercicio}) — coletivas em planilha separada`}
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
