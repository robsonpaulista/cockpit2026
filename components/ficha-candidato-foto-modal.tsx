'use client'

import { useEffect, useState } from 'react'
import { ExternalLink, Loader2, Printer, Save, Trash2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  URL_DIVULGACAND_HOME,
  pareceUrlImagem,
  type CandidatoFotoDivulgacand,
  type CargoFotoCandidato,
} from '@/lib/candidatos-foto-divulgacand'
import type { ResultadoEleicao } from '@/lib/resumo-eleicoes-dados'

interface Props {
  open: boolean
  municipio: string
  cargo: CargoFotoCandidato
  candidato: ResultadoEleicao | null
  fotoExistente: CandidatoFotoDivulgacand | null
  onClose: () => void
  onSaved: () => void
  onImprimirFicha?: () => void
}

export function FichaCandidatoFotoModal({
  open,
  municipio,
  cargo,
  candidato,
  fotoExistente,
  onClose,
  onSaved,
  onImprimirFicha,
}: Props) {
  const [urlImagem, setUrlImagem] = useState('')
  const [urlDivulgacand, setUrlDivulgacand] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [previewErro, setPreviewErro] = useState(false)

  useEffect(() => {
    if (!open || !candidato) return
    setUrlImagem(fotoExistente?.url_imagem ?? '')
    setUrlDivulgacand(fotoExistente?.url_divulgacand ?? '')
    setError(null)
    setPreviewErro(false)
  }, [open, candidato, fotoExistente])

  if (!open || !candidato) return null

  const cargoLabel = cargo === 'prefeito' ? 'Prefeito 2024' : 'Vereador 2024'

  const salvar = async () => {
    const url = urlImagem.trim()
    if (!url) {
      setError('Informe a URL da imagem.')
      return
    }
    if (!pareceUrlImagem(url)) {
      setError('URL da imagem inválida. Use o link direto da foto no DivulgaCand.')
      return
    }

    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/candidatos-foto-divulgacand', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          municipio,
          cargo,
          ano_eleicao: 2024,
          numero_urna: candidato.numeroUrna,
          nome_urna: candidato.nomeUrnaCandidato,
          url_imagem: url,
          url_divulgacand: urlDivulgacand.trim() || null,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao salvar')
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const remover = async () => {
    if (!fotoExistente?.id) {
      setUrlImagem('')
      setUrlDivulgacand('')
      return
    }
    setDeleting(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/candidatos-foto-divulgacand?id=${encodeURIComponent(fotoExistente.id)}`,
        { method: 'DELETE' },
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Erro ao remover')
      onSaved()
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Erro ao remover')
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-card bg-surface shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-card px-5 py-4">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-text-primary">Foto DivulgaCand</h2>
            <p className="text-xs text-text-secondary mt-0.5">
              {cargoLabel} · {candidato.nomeUrnaCandidato}
              {candidato.numeroUrna ? ` (${candidato.numeroUrna})` : ''}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-lg p-1.5 text-text-secondary hover:bg-background"
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

          <p className="text-xs text-text-secondary leading-relaxed">
            No{' '}
            <a
              href={URL_DIVULGACAND_HOME}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-gold hover:underline inline-flex items-center gap-0.5"
            >
              DivulgaCand
              <ExternalLink className="h-3 w-3" />
            </a>
            , abra a ficha do candidato, clique com o botão direito na foto e copie o endereço da
            imagem.
          </p>

          {urlImagem.trim() && !previewErro ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={urlImagem.trim()}
                alt={candidato.nomeUrnaCandidato}
                className="h-28 w-28 rounded-full object-cover border-2 border-card shadow-sm"
                onError={() => setPreviewErro(true)}
              />
            </div>
          ) : null}

          {previewErro && urlImagem.trim() ? (
            <p className="text-xs text-amber-700 text-center">
              Não foi possível carregar a pré-visualização. A URL ainda pode funcionar após salvar.
            </p>
          ) : null}

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">URL da imagem *</span>
            <input
              type="url"
              value={urlImagem}
              onChange={(e) => {
                setUrlImagem(e.target.value)
                setPreviewErro(false)
              }}
              placeholder="https://..."
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm"
            />
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-xs font-medium text-text-secondary">
              Link da ficha no DivulgaCand (opcional)
            </span>
            <input
              type="url"
              value={urlDivulgacand}
              onChange={(e) => setUrlDivulgacand(e.target.value)}
              placeholder="https://divulgacandcontas.tse.jus.br/..."
              className="rounded-lg border border-card bg-background px-3 py-2 text-sm"
            />
          </label>
        </div>

        <div className="flex flex-wrap justify-between gap-2 border-t border-card px-5 py-4">
          <div className="flex flex-wrap gap-2">
            {onImprimirFicha ? (
              <button
                type="button"
                onClick={onImprimirFicha}
                className="inline-flex items-center gap-1.5 rounded-xl border border-card px-3 py-2 text-sm font-medium text-text-primary hover:bg-background"
                title="Abrir ficha resumo e imprimir"
              >
                <Printer className="h-4 w-4 text-accent-gold" />
                Imprimir ficha
              </button>
            ) : null}
            {fotoExistente?.id ? (
              <button
                type="button"
                onClick={() => void remover()}
                disabled={deleting || saving}
                className="inline-flex items-center gap-1.5 rounded-xl border border-red-200 px-3 py-2 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {deleting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4" />
                )}
                Remover
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-card px-4 py-2 text-sm font-medium text-text-primary hover:bg-background/80"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void salvar()}
              disabled={saving || deleting}
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
    </div>
  )
}
