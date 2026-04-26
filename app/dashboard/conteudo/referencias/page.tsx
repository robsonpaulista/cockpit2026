'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ConteudoPresencaNav } from '@/components/conteudo-presenca-nav'
import {
  type ReferenciaEngajamento,
  type ReferenciaFormato,
  type ReferenciaOrigem,
  type ReferenciaTema,
  uploadReferencia,
} from '@/lib/referencias'
import { ImageIcon, Loader2, UploadCloud } from 'lucide-react'

interface ReferenciaRow {
  id: string
  imagem_url: string
  storage_path: string
  tema: ReferenciaTema
  formato: ReferenciaFormato
  engajamento: ReferenciaEngajamento
  origem: ReferenciaOrigem
  observacoes: string | null
  ativa: boolean
  created_at: string
  uso_em_cards: number
}

const temas: ReferenciaTema[] = [
  'pavimentacao',
  'turismo',
  'saude',
  'educacao',
  'saneamento',
  'iluminacao',
  'geral',
]
const formatos: ReferenciaFormato[] = ['feed', 'story', 'reels_capa']
const engajamentos: ReferenciaEngajamento[] = ['alto', 'medio', 'baixo']

export default function ConteudoReferenciasPage() {
  const [items, setItems] = useState<ReferenciaRow[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [file, setFile] = useState<File | null>(null)
  const [form, setForm] = useState({
    tema: 'geral' as ReferenciaTema,
    formato: 'feed' as ReferenciaFormato,
    engajamento: 'medio' as ReferenciaEngajamento,
    origem: 'instagram' as ReferenciaOrigem,
    observacoes: '',
  })
  const [fTema, setFTema] = useState<string>('')
  const [fFormato, setFFormato] = useState<string>('')
  const [fEng, setFEng] = useState<string>('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const q = new URLSearchParams()
      if (fTema) q.set('tema', fTema)
      if (fFormato) q.set('formato', fFormato)
      if (fEng) q.set('engajamento', fEng)
      const r = await fetch(`/api/conteudo/referencias?${q.toString()}`)
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || 'Erro ao carregar')
      setItems(j as ReferenciaRow[])
    } catch {
      setItems([])
    } finally {
      setLoading(false)
    }
  }, [fTema, fFormato, fEng])

  useEffect(() => {
    load()
  }, [load])

  const onUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      await uploadReferencia(file, {
        tema: form.tema,
        formato: form.formato,
        engajamento: form.engajamento,
        origem: form.origem,
        observacoes: form.observacoes || undefined,
      })
      setFile(null)
      setForm((f) => ({ ...f, observacoes: '' }))
      await load()
    } catch (e) {
      alert(e instanceof Error ? e.message : 'Erro no upload')
    } finally {
      setUploading(false)
    }
  }

  const toggleAtiva = async (row: ReferenciaRow) => {
    const r = await fetch(`/api/conteudo/referencias/${row.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ativa: !row.ativa }),
    })
    if (r.ok) load()
  }

  const grid = useMemo(() => items, [items])

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-6xl mx-auto pb-24">
      <h1 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-1">
        <ImageIcon className="h-6 w-6 text-accent-gold" />
        Banco de referências visuais
      </h1>
      <p className="text-sm text-text-secondary mb-3">
        Upload de posts históricos (tema + formato + engajamento) para servir como fundo nos cards.
      </p>
      <ConteudoPresencaNav />

      <section className="rounded-xl border border-border-card bg-bg-surface p-4 mb-6 space-y-3">
        <h2 className="font-semibold text-text-primary text-sm">Nova referência</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3">
          <label className="text-xs text-text-secondary">
            Arquivo
            <input
              type="file"
              accept="image/*"
              className="mt-1 block w-full text-xs"
              onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            />
          </label>

          <label className="text-xs text-text-secondary">
            Tema
            <select
              className="mt-1 w-full border border-border-card rounded-lg px-2 py-2 text-sm"
              value={form.tema}
              onChange={(e) => setForm((f) => ({ ...f, tema: e.target.value as ReferenciaTema }))}
            >
              {temas.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-text-secondary">
            Formato
            <select
              className="mt-1 w-full border border-border-card rounded-lg px-2 py-2 text-sm"
              value={form.formato}
              onChange={(e) => setForm((f) => ({ ...f, formato: e.target.value as ReferenciaFormato }))}
            >
              {formatos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-text-secondary">
            Engajamento
            <select
              className="mt-1 w-full border border-border-card rounded-lg px-2 py-2 text-sm"
              value={form.engajamento}
              onChange={(e) => setForm((f) => ({ ...f, engajamento: e.target.value as ReferenciaEngajamento }))}
            >
              {engajamentos.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>

          <label className="text-xs text-text-secondary">
            Origem
            <select
              className="mt-1 w-full border border-border-card rounded-lg px-2 py-2 text-sm"
              value={form.origem}
              onChange={(e) => setForm((f) => ({ ...f, origem: e.target.value as ReferenciaOrigem }))}
            >
              <option value="instagram">instagram</option>
              <option value="criado_no_cockpit">criado_no_cockpit</option>
            </select>
          </label>
        </div>
        <label className="text-xs text-text-secondary block">
          Observações
          <input
            className="mt-1 w-full border border-border-card rounded-lg px-3 py-2 text-sm"
            value={form.observacoes}
            onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))}
          />
        </label>
        <button
          type="button"
          disabled={!file || uploading}
          onClick={onUpload}
          className="inline-flex items-center gap-2 rounded-lg bg-accent-gold text-white px-4 py-2 text-sm font-medium disabled:opacity-50"
        >
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}
          Enviar referência
        </button>
      </section>

      <section className="flex flex-wrap gap-2 mb-4">
        <select
          className="border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface"
          value={fTema}
          onChange={(e) => setFTema(e.target.value)}
        >
          <option value="">Tema (todos)</option>
          {temas.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface"
          value={fFormato}
          onChange={(e) => setFFormato(e.target.value)}
        >
          <option value="">Formato (todos)</option>
          {formatos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <select
          className="border border-border-card rounded-lg px-3 py-2 text-sm bg-bg-surface"
          value={fEng}
          onChange={(e) => setFEng(e.target.value)}
        >
          <option value="">Engajamento (todos)</option>
          {engajamentos.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        <button className="text-sm px-3 py-2 rounded-lg border border-border-card" onClick={() => load()}>
          Atualizar
        </button>
      </section>

      {loading ? (
        <Loader2 className="h-10 w-10 animate-spin text-accent-gold mx-auto" />
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {grid.map((r) => (
            <article key={r.id} className="rounded-xl border border-border-card bg-bg-surface overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={r.imagem_url} alt="" className="w-full aspect-square object-cover" />
              <div className="p-2 space-y-2">
                <div className="flex flex-wrap gap-1 text-[10px]">
                  <span className="px-2 py-0.5 rounded-full bg-bg-page border border-border-card">{r.tema}</span>
                  <span className="px-2 py-0.5 rounded-full bg-bg-page border border-border-card">{r.formato}</span>
                  <span className="px-2 py-0.5 rounded-full bg-bg-page border border-border-card">{r.engajamento}</span>
                </div>
                <p className="text-[11px] text-text-secondary">Usada em {r.uso_em_cards} card(s)</p>
                <button
                  type="button"
                  onClick={() => toggleAtiva(r)}
                  className="w-full text-xs rounded-lg border border-border-card px-2 py-1.5"
                >
                  {r.ativa ? 'Desativar' : 'Ativar'}
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <p className="text-xs text-text-secondary mt-6">
        Referências usadas aparecem nos cards em{' '}
        <Link href="/dashboard/conteudo/cards" className="text-accent-gold hover:underline">
          /conteudo/cards
        </Link>
        .
      </p>
    </div>
  )
}
