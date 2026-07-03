'use client'

import { useEffect, useMemo, useState } from 'react'
import { ExternalLink, ImageIcon, Loader2, Save } from 'lucide-react'
import {
  googleDriveImagePreviewUrl,
  isGoogleDriveUrl,
} from '@/lib/google-drive-image-url'
import { chromeButtonClass } from '@/lib/button-chrome'
import { typographyBodyMutedClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'

interface ObraFotoUrlFieldProps {
  obraId: string
  initialUrl?: string | null
  compact?: boolean
  onSaved?: (imagemUrl: string | null) => void
}

export function ObraFotoUrlField({
  obraId,
  initialUrl,
  compact = false,
  onSaved,
}: ObraFotoUrlFieldProps) {
  const [draftUrl, setDraftUrl] = useState(initialUrl ?? '')
  const [savedUrl, setSavedUrl] = useState(initialUrl ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [previewSize, setPreviewSize] = useState(1200)
  const [previewFailed, setPreviewFailed] = useState(false)

  useEffect(() => {
    setDraftUrl(initialUrl ?? '')
    setSavedUrl(initialUrl ?? '')
    setPreviewFailed(false)
    setPreviewSize(1200)
  }, [initialUrl, obraId])

  const previewUrl = useMemo(() => {
    const source = draftUrl.trim() || savedUrl.trim()
    if (!source) return null
    return googleDriveImagePreviewUrl(source, previewSize)
  }, [draftUrl, previewSize, savedUrl])

  const dirty = draftUrl.trim() !== (savedUrl ?? '').trim()
  const driveLink = isGoogleDriveUrl(draftUrl.trim() || savedUrl.trim())

  const salvar = async () => {
    setSaving(true)
    setError('')
    try {
      const imagem_url = draftUrl.trim() || null
      const res = await fetch(`/api/obras/${obraId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imagem_url }),
      })
      const json = (await res.json()) as { error?: string; obra?: { imagem_url?: string | null } }
      if (!res.ok) throw new Error(json.error ?? 'Falha ao salvar foto.')
      const next = json.obra?.imagem_url ?? imagem_url
      setSavedUrl(next ?? '')
      setDraftUrl(next ?? '')
      setPreviewFailed(false)
      setPreviewSize(1200)
      onSaved?.(next ?? null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar foto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={cn('rounded-lg border border-card bg-bg-app/60', compact ? 'p-2.5' : 'p-3')}>
      <div className="flex items-center gap-2 text-xs font-medium text-text-primary">
        <ImageIcon className="h-3.5 w-3.5 text-accent-gold" aria-hidden />
        Link da foto
        {driveLink ? (
          <span className="rounded-full bg-bg-surface px-2 py-0.5 text-[10px] font-normal text-text-muted">
            Google Drive
          </span>
        ) : null}
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="url"
          value={draftUrl}
          onChange={(e) => {
            setDraftUrl(e.target.value)
            setError('')
            setPreviewFailed(false)
          }}
          placeholder="Cole o link do Google Drive (compartilhado)"
          className="min-w-0 flex-1 rounded-md border border-[rgb(var(--color-border-secondary)/0.65)] bg-bg-surface px-2.5 py-1.5 text-xs text-text-primary"
        />
        <button
          type="button"
          onClick={() => void salvar()}
          disabled={saving || !dirty}
          className={cn(chromeButtonClass, 'shrink-0 px-2.5 py-1.5 text-xs')}
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
          Salvar
        </button>
      </div>

      <p className={cn('mt-1.5', typographyBodyMutedClass)}>
        Cole o link de compartilhamento ou só o ID do arquivo. Formato direto:{' '}
        <code className="text-[10px]">drive.google.com/uc?export=view&amp;id=ID</code>
      </p>

      {error ? <p className="mt-1 text-xs text-status-danger">{error}</p> : null}

      {previewUrl && !previewFailed ? (
        <div className="mt-3 overflow-hidden rounded-lg border border-card bg-bg-surface">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={previewUrl}
            alt="Prévia da foto da obra"
            className="max-h-56 w-full object-cover"
            onError={() => {
              if (previewSize > 400 && isGoogleDriveUrl(draftUrl.trim() || savedUrl.trim())) {
                setPreviewSize(400)
                return
              }
              setPreviewFailed(true)
            }}
          />
        </div>
      ) : null}

      {previewFailed ? (
        <p className="mt-2 text-xs text-status-danger">
          Não foi possível carregar a prévia. Verifique se o arquivo está compartilhado publicamente no Drive.
        </p>
      ) : null}

      {(draftUrl.trim() || savedUrl.trim()) ? (
        <a
          href={(draftUrl.trim() || savedUrl.trim())}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2 inline-flex items-center gap-1 text-xs text-[rgb(var(--color-primary))] hover:underline"
        >
          Abrir link original
          <ExternalLink className="h-3 w-3" aria-hidden />
        </a>
      ) : null}
    </div>
  )
}
