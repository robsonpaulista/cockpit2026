'use client'

import { useState } from 'react'
import { Loader2, UserPlus } from 'lucide-react'
import { fileToBase64, recfaceApi } from '@/lib/recface-api'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

export function RecfaceRegisterTab() {
  const [name, setName] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const onFile = (f: File | null) => {
    setFile(f)
    setPreview(f ? URL.createObjectURL(f) : null)
  }

  const submit = async () => {
    if (!name.trim() || !file) {
      setMessage('Informe o nome e selecione uma foto com rosto visível.')
      setIsError(true)
      return
    }
    try {
      setLoading(true)
      setMessage(null)
      const result = await recfaceApi.registerVisitor(name.trim(), file)
      setMessage(result.warning ?? `Cadastro concluído: ${result.name}`)
      setIsError(false)
      setName('')
      onFile(null)
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha no cadastro')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Cadastro facial</h2>
        <p className="text-sm text-text-muted">
          Registre nome e rosto. Use foto nítida, rosto de frente, boa iluminação.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-3 rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-4">
          <label className="block text-sm font-medium text-text-primary">Nome completo</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
            placeholder="Ex.: Maria Silva"
          />

          <label className="block text-sm font-medium text-text-primary">Foto de referência</label>
          <input
            type="file"
            accept="image/*"
            capture="user"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />

          <button
            type="button"
            disabled={loading}
            onClick={() => void submit()}
            className={cn(sidebarPrimaryCTAButtonClass, 'flex w-full items-center justify-center gap-2 py-2.5 text-sm')}
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
            Cadastrar visitante
          </button>
        </div>

        <div className="flex min-h-[240px] items-center justify-center rounded-xl border border-dashed border-[rgb(var(--color-border-secondary))] bg-bg-muted/30 p-4">
          {preview ? (
            <img src={preview} alt="Prévia" className="max-h-80 rounded-lg object-contain" />
          ) : (
            <p className="text-sm text-text-muted">Prévia da foto aparecerá aqui</p>
          )}
        </div>
      </div>

      {message ? (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            isError
              ? 'border-status-danger/30 bg-status-danger/5 text-status-danger'
              : 'border-status-success/30 bg-status-success/5 text-text-primary',
          )}
        >
          {message}
        </div>
      ) : null}
    </div>
  )
}
