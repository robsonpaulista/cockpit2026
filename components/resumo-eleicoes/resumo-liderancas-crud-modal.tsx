'use client'

import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { FileText, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { canonicalizeLiderancaAtual } from '@/lib/territorio-lideranca-atual'
import {
  TseCarregando,
  TseErro,
  TseModal,
  TsePill,
  TseVazio,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseRotuloCampoClass,
  tseTabela,
} from '@/components/tse/tse-ui'

export type CenarioVotosLiderancasModal =
  | 'revisao_final'
  | 'aferido_jadyel'
  | 'promessa_lideranca'
  | 'legado_anterior'

export type LiderancaCrudRow = {
  id: number
  municipio: string
  nome: string
  cargo: string
  depEstadual: string
  governador: string
  liderancaAtual: string
  emDialogo: boolean
  expectativaLegado: number
  expectativaAferida: number
  promessa: number
  previsto?: number
  votos2024?: number
  votacaoFinal2022: number
}

type FormState = {
  nome: string
  cargo: string
  depEstadual: string
  governador: string
  liderancaAtual: string
  expectativaLegado: string
  expectativaAferida: string
  promessa: string
  previsto: string
}

export type LiderancaFormPrefill = {
  nome: string
  cargo?: string
  depEstadual?: string
  governador?: string
  liderancaAtual?: string
  expectativaLegado?: number
  expectativaAferida?: number
  promessa?: number
  previsto?: number
}

const EMPTY_FORM: FormState = {
  nome: '',
  cargo: '',
  depEstadual: '',
  governador: 'Rafael',
  // Default SIM para a nova liderança entrar na lista/soma da cidade (aba Lideranças).
  liderancaAtual: 'SIM',
  expectativaLegado: '0',
  expectativaAferida: '0',
  promessa: '0',
  previsto: '0',
}

function formFromPrefill(prefill: LiderancaFormPrefill): FormState {
  return {
    nome: String(prefill.nome || '').trim(),
    cargo: String(prefill.cargo || '').trim(),
    depEstadual: String(prefill.depEstadual || '').trim(),
    governador: String(prefill.governador || '').trim() || 'Rafael',
    liderancaAtual: canonicalizeLiderancaAtual(prefill.liderancaAtual) ?? 'SIM',
    expectativaLegado: String(prefill.expectativaLegado ?? 0),
    expectativaAferida: String(prefill.expectativaAferida ?? 0),
    promessa: String(prefill.promessa ?? 0),
    previsto: String(prefill.previsto ?? 0),
  }
}

function valorCenario(row: LiderancaCrudRow, cenario: CenarioVotosLiderancasModal): number {
  if (cenario === 'revisao_final') return row.previsto ?? 0
  if (cenario === 'promessa_lideranca') return row.promessa
  if (cenario === 'aferido_jadyel') return row.expectativaAferida
  return row.expectativaLegado
}

function labelCenario(cenario: CenarioVotosLiderancasModal): string {
  if (cenario === 'revisao_final') return 'Revisão Final 2026'
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
  initialEditingId?: number | null
  startCreating?: boolean
  onClose: () => void
  onChanged?: () => void
  /** Abre demandas já filtradas pela liderança (ex.: Atendimento). */
  onAbrirDemandas?: (nomeLideranca: string) => void
}

export function ResumoLiderancasCrudModal({
  cidade,
  cenarioVotos,
  prefillNova = null,
  initialEditingId = null,
  startCreating = false,
  onClose,
  onChanged,
  onAbrirDemandas,
}: ResumoLiderancasCrudModalProps) {
  const tituloId = useId()
  const [rows, setRows] = useState<LiderancaCrudRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [creating, setCreating] = useState(false)
  const [form, setForm] = useState<FormState>(EMPTY_FORM)
  const prefillAppliedRef = useRef<string | null>(null)
  const initialActionAppliedRef = useRef(false)

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

  useEffect(() => {
    if (initialActionAppliedRef.current || loading) return
    if (initialEditingId != null) {
      const row = rows.find((item) => item.id === initialEditingId)
      if (!row) return
      initialActionAppliedRef.current = true
      setCreating(false)
      setEditingId(row.id)
      setForm({
        nome: row.nome,
        cargo: row.cargo === '-' ? '' : row.cargo,
        depEstadual: row.depEstadual,
        governador: row.governador || 'Rafael',
        liderancaAtual: canonicalizeLiderancaAtual(row.liderancaAtual) ?? '',
        expectativaLegado: String(row.expectativaLegado || 0),
        expectativaAferida: String(row.expectativaAferida || 0),
        promessa: String(row.promessa || 0),
        previsto: String(row.previsto || 0),
      })
      return
    }
    if (startCreating) {
      initialActionAppliedRef.current = true
      setCreating(true)
      setEditingId(null)
      setForm(EMPTY_FORM)
    }
  }, [initialEditingId, loading, rows, startCreating])

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
      governador: row.governador || 'Rafael',
      liderancaAtual: canonicalizeLiderancaAtual(row.liderancaAtual) ?? '',
      expectativaLegado: String(row.expectativaLegado || 0),
      expectativaAferida: String(row.expectativaAferida || 0),
      promessa: String(row.promessa || 0),
      previsto: String(row.previsto || 0),
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
      governador: form.governador.trim() || null,
      lideranca_atual: canonicalizeLiderancaAtual(form.liderancaAtual),
      expectativa_votos_2026: parseNum(form.expectativaLegado),
      expectativa_jadyel_2026: parseNum(form.expectativaAferida),
      promessa_lideranca_2026: parseNum(form.promessa),
      previsto_2026: parseNum(form.previsto),
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
  const subtitulo = loading
    ? 'Carregando…'
    : `${rows.length} registro${rows.length === 1 ? '' : 's'} · ${labelCenario(cenarioVotos)}`
  const thCompacta = cn(tseTabela.th, '!py-1.5')
  const tdCompacta = cn(tseTabela.td, '!py-1')
  const acaoIconeClass =
    'inline-flex h-7 w-7 items-center justify-center rounded-md text-[var(--tse-muted)] disabled:opacity-50'

  return (
    <TseModal
      id={tituloId}
      titulo={`Lideranças de ${cidade}`}
      subtitulo={subtitulo}
      onClose={onClose}
      largura="max-w-4xl"
      rodape={
        <>
          <span className="text-[12px] text-[var(--tse-muted)]">
            Total {labelCenario(cenarioVotos)}:{' '}
            <strong className="tabular-nums text-[var(--tse-text)]">
              {totalExpectativa.toLocaleString('pt-BR')}
            </strong>
          </span>
          <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
            Fechar
          </button>
        </>
      }
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[13px] text-[var(--tse-muted)]">
          Cadastro e expectativa por liderança no município.
        </p>
        <button
          type="button"
          onClick={iniciarCriacao}
          disabled={saving || loading}
          className={tseBotaoPrimarioClass}
        >
          <Plus className={tseBotaoIconeClass} aria-hidden />
          Nova
        </button>
      </div>

      {error ? <TseErro>{error}</TseErro> : null}

      {formAberto ? (
        <div className="rounded-xl bg-white p-4 shadow-sm">
          <p className="mb-3 text-[13px] font-bold text-[var(--tse-text)]">
            {editingId ? 'Editar liderança' : 'Nova liderança'}
          </p>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            <label>
              <span className={tseRotuloCampoClass}>Nome</span>
              <input
                value={form.nome}
                onChange={(e) => setForm((prev) => ({ ...prev, nome: e.target.value }))}
                className={tseCampoClass}
              />
            </label>
            <label>
              <span className={tseRotuloCampoClass}>Cargo</span>
              <input
                value={form.cargo}
                onChange={(e) => setForm((prev) => ({ ...prev, cargo: e.target.value }))}
                className={tseCampoClass}
              />
            </label>
            <label>
              <span className={tseRotuloCampoClass}>Dep. Estadual</span>
              <input
                value={form.depEstadual}
                onChange={(e) => setForm((prev) => ({ ...prev, depEstadual: e.target.value }))}
                className={tseCampoClass}
              />
            </label>
            <label>
              <span className={tseRotuloCampoClass}>Governador</span>
              <input
                value={form.governador}
                onChange={(e) => setForm((prev) => ({ ...prev, governador: e.target.value }))}
                className={tseCampoClass}
              />
            </label>
            <label>
              <span className={tseRotuloCampoClass}>Expectativa 2026 (Legado)</span>
              <input
                value={form.expectativaLegado}
                onChange={(e) => setForm((prev) => ({ ...prev, expectativaLegado: e.target.value }))}
                className={tseCampoClass}
              />
            </label>
            <label>
              <span className={tseRotuloCampoClass}>Aferido Jadyel 2026</span>
              <input
                value={form.expectativaAferida}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, expectativaAferida: e.target.value }))
                }
                className={tseCampoClass}
              />
            </label>
            <label>
              <span className={tseRotuloCampoClass}>Promessa 2026</span>
              <input
                value={form.promessa}
                onChange={(e) => setForm((prev) => ({ ...prev, promessa: e.target.value }))}
                className={tseCampoClass}
              />
            </label>
            <label>
              <span className={tseRotuloCampoClass}>Revisão Final</span>
              <input
                value={form.previsto}
                onChange={(e) => setForm((prev) => ({ ...prev, previsto: e.target.value }))}
                className={tseCampoClass}
              />
            </label>
            <label className="md:col-span-2 lg:col-span-3">
              <span className={tseRotuloCampoClass}>Liderança atual</span>
              <select
                value={form.liderancaAtual}
                onChange={(e) => setForm((prev) => ({ ...prev, liderancaAtual: e.target.value }))}
                className={tseCampoClass}
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
              className={tseBotaoCinzaClass}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={saving}
              className={tseBotaoPrimarioClass}
            >
              {saving ? (
                <Loader2 className={cn(tseBotaoIconeClass, 'animate-spin')} aria-hidden />
              ) : null}
              Salvar
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <TseCarregando texto="Carregando lideranças…" className="min-h-[20vh]" />
      ) : ordenadas.length === 0 ? (
        <TseVazio>Nenhuma liderança cadastrada para esta cidade.</TseVazio>
      ) : (
        <div className={tseTabela.container} data-tse-tabela="">
          <table className={tseTabela.table}>
            <thead className={tseTabela.thead}>
              <tr>
                <th className={thCompacta}>Nome</th>
                <th className={thCompacta}>Cargo</th>
                <th className={cn(thCompacta, 'text-right')}>{labelCenario(cenarioVotos)}</th>
                {onAbrirDemandas ? (
                  <th className={cn(thCompacta, 'text-center')}>Demandas</th>
                ) : null}
                <th className={cn(thCompacta, 'text-right')}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {ordenadas.map((lideranca) => {
                const emDialogo = Boolean(lideranca.emDialogo)
                const nomeLideranca = String(lideranca.nome || '').trim()
                return (
                  <tr
                    key={lideranca.id}
                    className={cn(
                      tseTabela.tr,
                      emDialogo && 'bg-[color-mix(in_srgb,#b45309_8%,white)]',
                    )}
                  >
                    <td className={cn(tdCompacta, 'font-semibold')}>
                      <span className="inline-flex flex-wrap items-center gap-1.5">
                        {lideranca.nome || '-'}
                        {emDialogo ? <TsePill tom="amarelo">Em diálogo</TsePill> : null}
                      </span>
                    </td>
                    <td className={tdCompacta}>{lideranca.cargo || '-'}</td>
                    <td className={cn(tdCompacta, 'text-right tabular-nums')}>
                      {valorCenario(lideranca, cenarioVotos).toLocaleString('pt-BR')}
                    </td>
                    {onAbrirDemandas ? (
                      <td className={cn(tdCompacta, 'text-center')}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!nomeLideranca) return
                            onAbrirDemandas(nomeLideranca)
                          }}
                          disabled={!nomeLideranca}
                          className={cn(
                            acaoIconeClass,
                            'hover:bg-[var(--tse-bar)] hover:text-[var(--tse-yellow)] disabled:opacity-40',
                          )}
                          title={`Demandas de ${nomeLideranca || 'liderança'}`}
                          aria-label={`Abrir demandas de ${nomeLideranca || 'liderança'}`}
                        >
                          <FileText className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </td>
                    ) : null}
                    <td className={tdCompacta}>
                      <div className="flex items-center justify-end gap-0.5">
                        <button
                          type="button"
                          onClick={() => iniciarEdicao(lideranca)}
                          disabled={saving}
                          className={cn(
                            acaoIconeClass,
                            'hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]',
                          )}
                          title="Editar"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden />
                        </button>
                        <button
                          type="button"
                          onClick={() => void excluir(lideranca)}
                          disabled={saving}
                          className={cn(
                            acaoIconeClass,
                            'hover:bg-[#FEE2E2] hover:text-[#B42318]',
                          )}
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
              <tr className="border-t border-[var(--tse-border)] bg-[var(--tse-bar)] font-bold">
                <td className={tdCompacta} colSpan={2}>
                  TOTAL
                </td>
                <td className={cn(tdCompacta, 'text-right tabular-nums')}>
                  {totalExpectativa.toLocaleString('pt-BR')}
                </td>
                {onAbrirDemandas ? <td className={tdCompacta} aria-hidden /> : null}
                <td className={tdCompacta} aria-hidden />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </TseModal>
  )
}
