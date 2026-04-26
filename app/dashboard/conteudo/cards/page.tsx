'use client'

import Link from 'next/link'
import { useCallback, useEffect, useState } from 'react'
import { ConteudoPresencaNav } from '@/components/conteudo-presenca-nav'
import { cn } from '@/lib/utils'
import { CheckCircle2, ImageIcon, Loader2, Megaphone, ShieldCheck, Wand2 } from 'lucide-react'

interface ConteudoRow {
  id: string
  cidade: string | null
  territorio: string | null
  fase: string | null
  formato: string | null
  template: string | null
  titulo: string | null
  texto_arte: string | null
  legenda: string | null
  status: string
  storage_path_rascunho: string | null
  imagem_url: string | null
  campanha_geral: boolean
  referencia_id?: string | null
  fundo_origem?: 'obra' | 'referencia' | 'referencia_ia' | 'unsplash' | 'solido' | null
  referencias_visuais?: { id: string; imagem_url: string; tema: string; formato: string } | null
  obras?: { obra: string; municipio?: string | null } | null
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    rascunho: 'bg-slate-500/15 text-slate-700 border-slate-400/40',
    gerado: 'bg-blue-500/15 text-blue-800 border-blue-400/40',
    aprovado: 'bg-emerald-500/15 text-emerald-800 border-emerald-400/40',
    publicado: 'bg-orange-500/15 text-orange-900 border-orange-400/40',
  }
  return map[status] ?? map.rascunho
}

export default function ConteudoCardsPage() {
  const [items, setItems] = useState<ConteudoRow[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('')
  const [previewById, setPreviewById] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [publishOpen, setPublishOpen] = useState<ConteudoRow | null>(null)
  const [pubForm, setPubForm] = useState({ plataforma: 'Instagram', link: '', data_coleta: '' })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = filter ? `?status=${encodeURIComponent(filter)}` : ''
      const r = await fetch(`/api/conteudo/planejados${q}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error)
      setItems(j as ConteudoRow[])
      setPreviewById({})
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  /** Assina URL do PNG no bucket rascunhos (após listagem). */
  useEffect(() => {
    if (loading || items.length === 0) return
    let cancelled = false

    const run = async () => {
      const updates: Record<string, string> = {}
      await Promise.all(
        items.map(async (row) => {
          if (row.imagem_url && ['aprovado', 'publicado'].includes(row.status)) {
            updates[row.id] = row.imagem_url
            return
          }
          if (!row.storage_path_rascunho) return
          try {
            const res = await fetch(`/api/conteudo/planejados/${row.id}/preview-url`)
            const body = (await res.json()) as { url?: string }
            if (!cancelled && res.ok && body.url) {
              updates[row.id] = body.url
            }
          } catch {
            /* ignore */
          }
        })
      )
      if (!cancelled && Object.keys(updates).length > 0) {
        setPreviewById((prev) => ({ ...prev, ...updates }))
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [loading, items])

  const loadPreview = async (row: ConteudoRow) => {
    if (row.imagem_url && ['aprovado', 'publicado'].includes(row.status)) {
      setPreviewById((m) => ({ ...m, [row.id]: row.imagem_url! }))
      return
    }
    if (!row.storage_path_rascunho) return
    const r = await fetch(`/api/conteudo/planejados/${row.id}/preview-url`)
    const j = await r.json()
    if (r.ok && j.url) {
      setPreviewById((m) => ({ ...m, [row.id]: j.url as string }))
    }
  }

  const handleGenerate = async (row: ConteudoRow) => {
    setBusy(`gen:${row.id}`)
    try {
      const r = await fetch(`/api/conteudo/planejados/${row.id}/generate`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha na geração')
      await load()
      await new Promise((res) => setTimeout(res, 2000))
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  const handleApprove = async (row: ConteudoRow) => {
    setBusy(`appr:${row.id}`)
    try {
      const r = await fetch(`/api/conteudo/planejados/${row.id}/approve`, { method: 'POST' })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha na aprovação')
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  const openPublish = (row: ConteudoRow) => {
    setPubForm({
      plataforma: 'Instagram',
      link: '',
      data_coleta: new Date().toISOString().slice(0, 10),
    })
    setPublishOpen(row)
  }

  const submitPublish = async () => {
    if (!publishOpen) return
    setBusy(`pub:${publishOpen.id}`)
    try {
      const r = await fetch(`/api/conteudo/planejados/${publishOpen.id}/publish`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          plataforma: pubForm.plataforma,
          link: pubForm.link,
          data_coleta: pubForm.data_coleta || undefined,
        }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Falha')
      setPublishOpen(null)
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro')
    } finally {
      setBusy(null)
    }
  }

  const toggleCampanha = async (row: ConteudoRow) => {
    const r = await fetch(`/api/conteudo/planejados/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ campanha_geral: !row.campanha_geral }),
    })
    if (r.ok) load()
  }

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-3xl mx-auto pb-24">
      <h1 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-1">
        <ImageIcon className="h-6 w-6 text-accent-gold" />
        Cards — revisão
      </h1>
      <p className="text-sm text-text-secondary mb-3">Mobile first: gerar texto + PNG, aprovar e publicar.</p>
      <ConteudoPresencaNav />

      <div className="flex flex-wrap gap-2 mb-4">
        <select
          className="border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
        >
          <option value="">Todos os status</option>
          <option value="rascunho">Rascunho</option>
          <option value="gerado">Gerado</option>
          <option value="aprovado">Aprovado</option>
          <option value="publicado">Publicado</option>
        </select>
        <button
          type="button"
          className="text-sm px-3 py-2 rounded-lg border border-border-card"
          onClick={() => load()}
        >
          Atualizar
        </button>
      </div>

      {loading ? (
        <Loader2 className="h-10 w-10 animate-spin text-accent-gold mx-auto" />
      ) : (
        <ul className="space-y-4">
          {items.map((row) => {
            const cardPreviewUrl = previewById[row.id]
            const refUrl = row.referencias_visuais?.imagem_url ?? null
            const displayUrl = cardPreviewUrl ?? refUrl
            const isFallbackFundo = Boolean(!cardPreviewUrl && refUrl && row.storage_path_rascunho)
            const genBusy = busy === `gen:${row.id}`
            const apprBusy = busy === `appr:${row.id}`
            return (
              <li
                key={row.id}
                className="rounded-2xl border border-border-card bg-bg-surface shadow-card overflow-hidden"
              >
                <div className="p-4 space-y-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-text-primary">
                        {row.cidade ?? row.obras?.municipio ?? '—'}
                        {row.obras?.obra ? (
                          <span className="text-text-secondary font-normal"> · {row.obras.obra}</span>
                        ) : null}
                      </p>
                      <p className="text-xs text-text-secondary mt-0.5">
                        Fase: {row.fase ?? '—'} · Formato: {row.formato ?? '—'} · Template: {row.template ?? '—'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-1 rounded-full border shrink-0',
                        statusBadge(row.status)
                      )}
                    >
                      {row.status}
                    </span>
                  </div>

                  {row.titulo && <p className="text-sm font-medium text-text-primary">{row.titulo}</p>}
                  {row.texto_arte && (
                    <p className="text-base text-text-primary leading-snug">{row.texto_arte}</p>
                  )}
                  {row.legenda && <p className="text-xs text-text-secondary whitespace-pre-wrap">{row.legenda}</p>}

                  <div className="rounded-xl bg-bg-page border border-border-card overflow-hidden aspect-square max-w-full w-full max-h-[min(90vw,420px)] mx-auto flex flex-col items-stretch justify-center">
                    {displayUrl ? (
                      <div className="relative w-full h-full min-h-[200px]">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={displayUrl} alt="" className="w-full h-full object-contain" />
                        {isFallbackFundo ? (
                          <p className="absolute bottom-2 left-2 right-2 rounded bg-black/55 text-[10px] text-white px-2 py-1 text-center">
                            Fundo da referência; o PNG do card substitui quando o preview assinado estiver pronto.
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="text-xs text-accent-gold px-4 py-2"
                        onClick={() => loadPreview(row)}
                      >
                        Carregar preview
                      </button>
                    )}
                  </div>

                  {row.referencias_visuais?.id ? (
                    <div className="rounded-lg border border-border-card bg-bg-page p-2 flex items-center gap-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={row.referencias_visuais.imagem_url}
                        alt=""
                        className="h-10 w-10 rounded object-cover border border-border-card"
                      />
                      <div className="text-xs text-text-secondary">
                        <p className="text-text-primary font-medium">Referência usada</p>
                        <p>
                          {row.referencias_visuais.tema} · {row.referencias_visuais.formato}
                        </p>
                      </div>
                      <Link href="/dashboard/conteudo/referencias" className="ml-auto text-xs text-accent-gold hover:underline">
                        Ver banco
                      </Link>
                    </div>
                  ) : (
                    <p className="text-xs text-text-secondary">
                      Fundo:{' '}
                      {row.fundo_origem === 'obra'
                        ? 'foto da obra'
                        : row.fundo_origem === 'referencia_ia'
                          ? 'imagem nova (IA) inspirada na referência'
                          : row.fundo_origem === 'unsplash'
                            ? 'Unsplash'
                            : 'sólido'}
                    </p>
                  )}

                  <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={row.campanha_geral}
                      onChange={() => toggleCampanha(row)}
                      className="rounded border-border-card"
                    />
                    Campanha geral (distribuição / WhatsApp no hub)
                  </label>

                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="button"
                      disabled={!!busy}
                      onClick={() => handleGenerate(row)}
                      className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 text-white py-3 text-sm font-medium disabled:opacity-50"
                    >
                      {genBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                      Gerar
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || row.status === 'rascunho' || !row.storage_path_rascunho}
                      onClick={() => handleApprove(row)}
                      className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 text-white py-3 text-sm font-medium disabled:opacity-40"
                    >
                      {apprBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
                      Aprovar
                    </button>
                    <button
                      type="button"
                      disabled={!!busy || !row.imagem_url}
                      onClick={() => openPublish(row)}
                      className="flex-1 min-w-[120px] inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 text-white py-3 text-sm font-medium disabled:opacity-40"
                    >
                      <Megaphone className="h-4 w-4" />
                      Publicar
                    </button>
                  </div>
                </div>
              </li>
            )
          })}
        </ul>
      )}

      {publishOpen && (
        <div className="fixed inset-0 z-[220] flex items-end sm:items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-2xl bg-bg-surface border border-border-card p-4 shadow-card">
            <h3 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-accent-gold" />
              Registrar publicação
            </h3>
            <div className="space-y-3">
              <label className="text-xs text-text-secondary block">
                Plataforma
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={pubForm.plataforma}
                  onChange={(e) => setPubForm((f) => ({ ...f, plataforma: e.target.value }))}
                />
              </label>
              <label className="text-xs text-text-secondary block">
                Link do post
                <input
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={pubForm.link}
                  onChange={(e) => setPubForm((f) => ({ ...f, link: e.target.value }))}
                  placeholder="https://..."
                />
              </label>
              <label className="text-xs text-text-secondary block">
                Data da coleta das métricas
                <input
                  type="date"
                  className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
                  value={pubForm.data_coleta}
                  onChange={(e) => setPubForm((f) => ({ ...f, data_coleta: e.target.value }))}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button type="button" className="px-4 py-2 text-sm rounded-lg border border-border-card" onClick={() => setPublishOpen(null)}>
                Cancelar
              </button>
              <button
                type="button"
                disabled={!!busy}
                className="px-4 py-2 text-sm rounded-lg bg-accent-gold text-white font-medium inline-flex items-center gap-2"
                onClick={submitPublish}
              >
                {busy?.startsWith('pub:') && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
