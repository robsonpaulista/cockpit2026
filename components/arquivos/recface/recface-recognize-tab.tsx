'use client'

import { useState } from 'react'
import { CheckCircle2, Loader2, ScanFace, XCircle } from 'lucide-react'
import { fileToBase64, recfaceApi, type RecfaceRecognitionResult } from '@/lib/recface-api'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

export function RecfaceRecognizeTab() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [logPresence, setLogPresence] = useState(true)
  const [result, setResult] = useState<RecfaceRecognitionResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const onFile = (f: File | null) => {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
    setResult(null)
    setError(null)
  }

  const recognize = async () => {
    if (!file) {
      setError('Selecione ou capture uma foto.')
      return
    }
    try {
      setLoading(true)
      setError(null)
      const b64 = await fileToBase64(file)
      const out = await recfaceApi.recognize(b64, { log: logPresence })
      setResult(out)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha no reconhecimento')
      setResult(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Reconhecimento</h2>
        <p className="text-sm text-text-muted">
          Envie uma foto para identificar o visitante e validar a agenda (janela ±90 min).
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-4">
          <input
            type="file"
            accept="image/*"
            capture="user"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-text-muted">
            <input
              type="checkbox"
              checked={logPresence}
              onChange={(e) => setLogPresence(e.target.checked)}
            />
            Registrar presença nos logs quando reconhecido
          </label>
          <button
            type="button"
            disabled={loading}
            onClick={() => void recognize()}
            className={cn(sidebarPrimaryCTAButtonClass, 'flex w-full items-center justify-center gap-2 py-2.5 text-sm')}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ScanFace className="h-4 w-4" />}
            Reconhecer
          </button>
        </div>

        <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-[rgb(var(--color-border-secondary))] bg-bg-muted/30 p-4">
          {preview ? (
            <img src={preview} alt="Captura" className="max-h-80 rounded-lg object-contain" />
          ) : (
            <p className="text-sm text-text-muted">Prévia da captura</p>
          )}
        </div>
      </div>

      {error ? (
        <div className="rounded-lg border border-status-danger/30 bg-status-danger/5 px-4 py-3 text-sm text-status-danger">
          {error}
        </div>
      ) : null}

      {result ? (
        <div
          className={cn(
            'rounded-xl border px-4 py-4',
            result.recognized
              ? 'border-status-success/30 bg-status-success/5'
              : 'border-[rgb(var(--color-border-secondary))] bg-bg-surface',
          )}
        >
          <div className="flex items-start gap-3">
            {result.recognized ? (
              <CheckCircle2 className="mt-0.5 h-6 w-6 text-status-success" />
            ) : (
              <XCircle className="mt-0.5 h-6 w-6 text-text-muted" />
            )}
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-text-primary">
                {result.recognized ? result.name : 'Não reconhecido'}
              </p>
              <p className="text-text-muted">{result.statusMessage}</p>
              <p className="text-xs text-text-muted">
                Confiança: {(result.confidence * 100).toFixed(1)}% · Distância: {result.distance.toFixed(4)}
              </p>
              {result.agendaEntry ? (
                <p className="text-xs text-[#C8900A]">
                  Agenda: {result.agendaEntry.time} — {result.agendaEntry.location}
                  {result.agendaValid ? ' ✓' : ' (fora da janela)'}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
