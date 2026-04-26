'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ConteudoPresencaNav } from '@/components/conteudo-presenca-nav'
import { Loader2, Pencil, Plus, Sparkles, Trash2, Wand2 } from 'lucide-react'

interface Obra {
  id: string
  municipio?: string | null
  obra: string
  tipo?: string | null
  orgao?: string | null
  status?: string | null
  valor_total?: number | null
  territorio?: string | null
  parceiro?: string | null
  imagem_url?: string | null
  descricao_obra?: string | null
}

const emptyForm: Omit<Obra, 'id'> = {
  municipio: '',
  obra: '',
  tipo: '',
  orgao: '',
  status: '',
  valor_total: undefined,
  territorio: '',
  parceiro: '',
  imagem_url: '',
  descricao_obra: '',
}

export default function ConteudoObrasPage() {
  const [obras, setObras] = useState<Obra[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [generatingId, setGeneratingId] = useState<string | null>(null)
  const [modal, setModal] = useState<{ mode: 'create' | 'edit'; obra: Obra | null } | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [filterMunicipio, setFilterMunicipio] = useState('')
  const [filterTipo, setFilterTipo] = useState('')
  const [filterStatus, setFilterStatus] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (filterMunicipio) q.set('municipio', filterMunicipio)
      if (filterTipo) q.set('tipo', filterTipo)
      if (filterStatus) q.set('status', filterStatus)
      const r = await fetch(`/api/obras?${q.toString()}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao listar')
      setObras(j.obras ?? [])
    } catch {
      setObras([])
    } finally {
      setLoading(false)
    }
  }, [filterMunicipio, filterTipo, filterStatus])

  useEffect(() => {
    load()
  }, [load])

  const openCreate = () => {
    setForm(emptyForm)
    setModal({ mode: 'create', obra: null })
  }

  const openEdit = (obra: Obra) => {
    setForm({
      municipio: obra.municipio ?? '',
      obra: obra.obra,
      tipo: obra.tipo ?? '',
      orgao: obra.orgao ?? '',
      status: obra.status ?? '',
      valor_total: obra.valor_total ?? undefined,
      territorio: obra.territorio ?? '',
      parceiro: obra.parceiro ?? '',
      imagem_url: obra.imagem_url ?? '',
      descricao_obra: obra.descricao_obra ?? '',
    })
    setModal({ mode: 'edit', obra })
  }

  const save = async () => {
    if (!form.obra.trim()) return
    setSaving(true)
    try {
      if (modal?.mode === 'create') {
        const r = await fetch('/api/obras', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            municipio: form.municipio || null,
            obra: form.obra,
            tipo: form.tipo || null,
            orgao: form.orgao || null,
            status: form.status || null,
            valor_total: form.valor_total ?? null,
            territorio: form.territorio || null,
            parceiro: form.parceiro || null,
            imagem_url: form.imagem_url || null,
            descricao_obra: form.descricao_obra || null,
          }),
        })
        if (!r.ok) throw new Error((await r.json()).error)
      } else if (modal?.obra) {
        const r = await fetch(`/api/obras/${modal.obra.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            municipio: form.municipio || null,
            obra: form.obra,
            tipo: form.tipo || null,
            orgao: form.orgao || null,
            status: form.status || null,
            valor_total: form.valor_total ?? null,
            territorio: form.territorio || null,
            parceiro: form.parceiro || null,
            imagem_url: form.imagem_url || null,
            descricao_obra: form.descricao_obra || null,
          }),
        })
        if (!r.ok) throw new Error((await r.json()).error)
      }
      setModal(null)
      await load()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir esta obra?')) return
    const r = await fetch(`/api/obras/${id}`, { method: 'DELETE' })
    if (r.ok) load()
  }

  const gerarConteudos = async (obraId: string) => {
    setGeneratingId(obraId)
    try {
      const r = await fetch('/api/conteudo/planejados/from-obra', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ obraId }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha')
      alert(`Criados ${j.created} rascunhos de conteúdo. Gere os cards em /conteudo/cards.`)
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro')
    } finally {
      setGeneratingId(null)
    }
  }

  const municipios = useMemo(() => {
    const s = new Set<string>()
    obras.forEach((o) => {
      if (o.municipio) s.add(o.municipio)
    })
    return Array.from(s).sort()
  }, [obras])

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-1">
        <Sparkles className="h-6 w-6 text-accent-gold" />
        Obras para cards
      </h1>
      <p className="text-sm text-text-secondary mb-4">
        Cadastro alinhado à tabela <code className="text-xs bg-bg-page px-1 rounded">obras</code> (mesma base do
        módulo Obras). Campos extras: imagem, território, parceiro, descrição curta.
      </p>
      <ConteudoPresencaNav />

      <div className="flex flex-wrap gap-2 mb-4 items-end">
        <select
          className="border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface"
          value={filterMunicipio}
          onChange={(e) => setFilterMunicipio(e.target.value)}
        >
          <option value="">Município (todos)</option>
          {municipios.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <input
          className="border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface min-w-[120px]"
          placeholder="Tipo"
          value={filterTipo}
          onChange={(e) => setFilterTipo(e.target.value)}
        />
        <input
          className="border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface min-w-[120px]"
          placeholder="Status"
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
        />
        <button
          type="button"
          onClick={openCreate}
          className="ml-auto inline-flex items-center gap-2 rounded-lg bg-accent-gold text-white px-4 py-2 text-sm font-medium"
        >
          <Plus className="h-4 w-4" />
          Nova obra
        </button>
      </div>

      {loading ? (
        <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border-card">
          <table className="w-full text-sm">
            <thead className="bg-bg-page text-text-secondary text-left">
              <tr>
                <th className="p-3">Município</th>
                <th className="p-3">Obra</th>
                <th className="p-3">Tipo</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Ações</th>
              </tr>
            </thead>
            <tbody>
              {obras.map((o) => (
                <tr key={o.id} className="border-t border-border-card">
                  <td className="p-3">{o.municipio ?? '—'}</td>
                  <td className="p-3 max-w-[220px] truncate">{o.obra}</td>
                  <td className="p-3">{o.tipo ?? '—'}</td>
                  <td className="p-3">{o.status ?? '—'}</td>
                  <td className="p-3 text-right whitespace-nowrap">
                    <button
                      type="button"
                      className="p-2 text-accent-gold hover:bg-accent-gold-soft rounded-lg"
                      title="Gerar conteúdos planejados"
                      onClick={() => gerarConteudos(o.id)}
                      disabled={generatingId === o.id}
                    >
                      {generatingId === o.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Wand2 className="h-4 w-4" />
                      )}
                    </button>
                    <button
                      type="button"
                      className="p-2 text-text-primary hover:bg-bg-page rounded-lg"
                      onClick={() => openEdit(o)}
                    >
                      <Pencil className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      className="p-2 text-status-danger hover:bg-status-danger/10 rounded-lg"
                      onClick={() => remove(o.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/40 p-4">
          <div className="w-full max-w-lg rounded-xl bg-bg-surface border border-border-card shadow-card p-4 max-h-[90vh] overflow-y-auto">
            <h2 className="font-semibold text-lg mb-3">
              {modal.mode === 'create' ? 'Nova obra' : 'Editar obra'}
            </h2>
            <div className="grid gap-3">
              <label className="text-xs text-text-secondary">
                Município
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.municipio ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, municipio: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Nome da obra *
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.obra}
                  onChange={(e) => setForm((f) => ({ ...f, obra: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Tipo
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.tipo ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Órgão / parceiro
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.orgao ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, orgao: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Parceiro (comunicação)
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.parceiro ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, parceiro: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Território
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.territorio ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, territorio: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Status
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.status ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Valor total (R$)
                <input
                  type="number"
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.valor_total ?? ''}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      valor_total: e.target.value === '' ? undefined : Number(e.target.value),
                    }))
                  }
                />
              </label>
              <label className="text-xs text-text-secondary">
                URL da imagem da obra
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={form.imagem_url ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, imagem_url: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary">
                Descrição curta (comunicação)
                <textarea
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm min-h-[72px]"
                  value={form.descricao_obra ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, descricao_obra: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="px-4 py-2 text-sm rounded-lg border border-border-card" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={saving}
                className="px-4 py-2 text-sm rounded-lg bg-accent-gold text-white font-medium inline-flex items-center gap-2"
                onClick={save}
              >
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
