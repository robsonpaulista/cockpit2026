'use client'

import { useState, useEffect, useMemo } from 'react'
import { X, Loader2, AlertCircle } from 'lucide-react'
import municipiosPiaui from '@/lib/municipios-piaui.json'

export const OBRAS_TIPOS = ['pavimentação', 'obras diversas'] as const
export type ObraTipo = (typeof OBRAS_TIPOS)[number]

export interface ObraFormData {
  id?: string
  municipio?: string
  obra: string
  tipo?: string | null
  orgao?: string
  sei?: string
  sei_medicao?: string
  status?: string
  publicacao_os?: string
  solicitacao_medicao?: string
  data_medicao?: string
  status_medicao?: string
  valor_total?: number | null
}

interface ObraFormModalProps {
  obra?: ObraFormData | null
  defaultTipo?: string
  onClose: () => void
  onSuccess: () => void
}

function toYyyyMmDd(dateString?: string): string {
  if (!dateString) return ''
  const s = String(dateString).trim()
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/)
  return m ? m[0] : ''
}

export function ObraFormModal({ obra, defaultTipo, onClose, onSuccess }: ObraFormModalProps) {
  const isEdit = Boolean(obra?.id)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<ObraFormData>({
    municipio: '',
    obra: '',
    tipo: '',
    orgao: '',
    sei: '',
    sei_medicao: '',
    status: '',
    publicacao_os: '',
    solicitacao_medicao: '',
    data_medicao: '',
    status_medicao: '',
    valor_total: null,
  })

  const municipios = useMemo(
    () => [...municipiosPiaui].map((m) => m.nome).sort((a, b) => a.localeCompare(b, 'pt-BR')),
    []
  )

  useEffect(() => {
    if (obra) {
      let municipioVal = obra.municipio ?? ''
      if (municipioVal.trim()) {
        const found = municipios.find(
          (n) => n.localeCompare(municipioVal.trim(), undefined, { sensitivity: 'base' }) === 0
        )
        if (found) municipioVal = found
      }
      setForm({
        id: obra.id,
        municipio: municipioVal,
        obra: obra.obra ?? '',
        tipo: (obra as { tipo?: string }).tipo ?? '',
        orgao: obra.orgao ?? '',
        sei: obra.sei ?? '',
        sei_medicao: obra.sei_medicao ?? '',
        status: obra.status ?? '',
        publicacao_os: toYyyyMmDd(obra.publicacao_os) || '',
        solicitacao_medicao: toYyyyMmDd(obra.solicitacao_medicao) || '',
        data_medicao: toYyyyMmDd(obra.data_medicao) || '',
        status_medicao: obra.status_medicao ?? '',
        valor_total: obra.valor_total ?? null,
      })
    } else {
      setForm({
        municipio: '',
        obra: '',
        tipo: defaultTipo ?? '',
        orgao: '',
        sei: '',
        sei_medicao: '',
        status: '',
        publicacao_os: '',
        solicitacao_medicao: '',
        data_medicao: '',
        status_medicao: '',
        valor_total: null,
      })
    }
  }, [obra, defaultTipo, municipios])

  const update = (key: keyof ObraFormData, value: string | number | null) => {
    setForm((prev) => ({ ...prev, [key]: value }))
    setError(null)
  }

  const setValorTotal = (v: string) => {
    const n = v === '' ? null : Number(v)
    setForm((prev) => ({ ...prev, valor_total: Number.isNaN(n) ? prev.valor_total : n }))
    setError(null)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.obra.trim()) {
      setError('Nome da obra é obrigatório.')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const payload = {
        municipio: (form.municipio ?? '').trim() || null,
        obra: (form.obra ?? '').trim(),
        tipo: (form.tipo ?? '').trim() || null,
        orgao: (form.orgao ?? '').trim() || null,
        sei: (form.sei ?? '').trim() || null,
        sei_medicao: (form.sei_medicao ?? '').trim() || null,
        status: (form.status ?? '').trim() || null,
        publicacao_os: (form.publicacao_os ?? '').trim() || null,
        solicitacao_medicao: (form.solicitacao_medicao ?? '').trim() || null,
        data_medicao: (form.data_medicao ?? '').trim() || null,
        status_medicao: (form.status_medicao ?? '').trim() || null,
        valor_total: form.valor_total != null ? Number(form.valor_total) : null,
      }

      const url = isEdit ? `/api/obras/${form.id}` : '/api/obras'
      const method = isEdit ? 'PATCH' : 'POST'

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || (isEdit ? 'Erro ao atualizar obra.' : 'Erro ao criar obra.'))
        return
      }
      onSuccess()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div className="bg-surface rounded-2xl border border-card w-full max-w-2xl my-8">
        <div className="flex items-center justify-between p-6 border-b border-card">
          <h2 className="text-xl font-semibold text-primary">
            {isEdit ? 'Editar obra' : 'Nova obra'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
            aria-label="Fechar"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Município</label>
              <select
                value={form.municipio ?? ''}
                onChange={(e) => update('municipio', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Selecione o município</option>
                {(() => {
                  const m = form.municipio ?? ''
                  return m && !municipios.includes(m) ? (
                    <option value={m}>{m}</option>
                  ) : null
                })()}
                {municipios.map((nome) => (
                  <option key={nome} value={nome}>
                    {nome}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-primary mb-1">Obra *</label>
              <input
                type="text"
                value={form.obra}
                onChange={(e) => update('obra', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                placeholder="Nome ou descrição da obra"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Tipo</label>
              <select
                value={form.tipo ?? ''}
                onChange={(e) => update('tipo', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              >
                <option value="">Selecione o tipo</option>
                {OBRAS_TIPOS.map((t) => (
                  <option key={t} value={t}>
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Órgão</label>
              <input
                type="text"
                value={form.orgao}
                onChange={(e) => update('orgao', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                placeholder="Ex.: SEINFRA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">SEI</label>
              <input
                type="text"
                value={form.sei}
                onChange={(e) => update('sei', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft font-mono"
                placeholder="Ex.: 00317.000886/2025-94"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">SEI Medição</label>
              <input
                type="text"
                value={form.sei_medicao}
                onChange={(e) => update('sei_medicao', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft font-mono"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Status</label>
              <input
                type="text"
                value={form.status}
                onChange={(e) => update('status', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                placeholder="Ex.: O.S. PUBLICADA"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Pub. OS</label>
              <input
                type="date"
                value={form.publicacao_os}
                onChange={(e) => update('publicacao_os', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Solicitação Medição</label>
              <input
                type="date"
                value={form.solicitacao_medicao}
                onChange={(e) => update('solicitacao_medicao', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Data Medição</label>
              <input
                type="date"
                value={form.data_medicao}
                onChange={(e) => update('data_medicao', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Status Medição</label>
              <input
                type="text"
                value={form.status_medicao}
                onChange={(e) => update('status_medicao', e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-primary mb-1">Valor Total (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={form.valor_total ?? ''}
                onChange={(e) => setValorTotal(e.target.value)}
                className="w-full px-3 py-2 border border-card rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                placeholder="0,00"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4 border-t border-card">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                isEdit ? 'Salvar' : 'Criar obra'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-card rounded-lg hover:bg-background transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
