'use client'

import { Loader2, Save, Send, X } from 'lucide-react'
import { useEffect, useId, useState } from 'react'
import Image from 'next/image'
import {
  applyComunicarLideresTemplate,
  COMUNICAR_LIDERES_TEMPLATE_DEFAULT,
  mensagemToComunicarLideresTemplate,
} from '@/lib/war-room/comunicar-lideres-mensagem'
import { cn } from '@/lib/utils'

export type ComunicarLideresVisita = {
  municipio: string
  dataLabel: string
  horario: string
}

type Props = {
  visita: ComunicarLideresVisita
  onClose: () => void
}

/** Prévia editável da mensagem (modelo salvo em JSON com {{cidade}}/{{data}}/{{hora}}). */
export function WarRoomComunicarLideresModal({ visita, onClose }: Props) {
  const tituloId = useId()
  const [mensagem, setMensagem] = useState('')
  const [baseline, setBaseline] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [savedHint, setSavedHint] = useState<string | null>(null)

  const dirty = mensagem.trim() !== baseline.trim()

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      e.stopPropagation()
      onClose()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      setError(null)
      setSavedHint(null)
      try {
        const res = await fetch('/api/war-room/comunicar-lideres-mensagem', {
          cache: 'no-store',
        })
        const json = (await res.json().catch(() => null)) as {
          template?: string
          error?: string
        } | null
        if (!res.ok) {
          throw new Error(json?.error || 'Falha ao carregar mensagem')
        }
        const template =
          typeof json?.template === 'string' && json.template.trim()
            ? json.template
            : COMUNICAR_LIDERES_TEMPLATE_DEFAULT
        const filled = applyComunicarLideresTemplate(template, visita)
        if (!cancelled) {
          setMensagem(filled)
          setBaseline(filled)
        }
      } catch (e) {
        const filled = applyComunicarLideresTemplate(
          COMUNICAR_LIDERES_TEMPLATE_DEFAULT,
          visita,
        )
        if (!cancelled) {
          setMensagem(filled)
          setBaseline(filled)
          setError(e instanceof Error ? e.message : 'Erro ao carregar')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [visita])

  const salvar = async () => {
    if (!dirty || saving) return
    setSaving(true)
    setError(null)
    setSavedHint(null)
    try {
      const template = mensagemToComunicarLideresTemplate(mensagem, visita)
      const res = await fetch('/api/war-room/comunicar-lideres-mensagem', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ template }),
      })
      const json = (await res.json().catch(() => null)) as {
        template?: string
        error?: string
      } | null
      if (!res.ok) {
        throw new Error(json?.error || 'Falha ao salvar mensagem')
      }
      const savedTemplate =
        typeof json?.template === 'string' && json.template.trim()
          ? json.template
          : template
      const filled = applyComunicarLideresTemplate(savedTemplate, visita)
      setMensagem(filled)
      setBaseline(filled)
      setSavedHint('Modelo atualizado no JSON')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="wr-visita-modal wr-visita-modal--nested" role="presentation">
      <button
        type="button"
        className="wr-visita-modal__backdrop"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={tituloId}
        className="wr-visita-modal__panel wr-comunicar-lideres-modal__panel"
      >
        <header className="wr-visita-modal__head">
          <div className="wr-visita-modal__head-main min-w-0">
            <span className="wr-visita-modal__icon" aria-hidden>
              <Send className="h-4 w-4" strokeWidth={1.5} />
            </span>
            <div className="min-w-0">
              <p className="wr-visita-modal__eyebrow">Comunicar líderes</p>
              <h2 id={tituloId} className="wr-visita-modal__title truncate">
                {visita.municipio}
              </h2>
            </div>
          </div>
          <button
            type="button"
            className="wr-visita-modal__close"
            aria-label="Fechar"
            onClick={onClose}
          >
            <X className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </header>

        <div className="wr-comunicar-lideres-modal__body">
          <div className="wr-comunicar-lideres-modal__media">
            <Image
              src="/war-room/imagemenviomensagens.png"
              alt="Arte da mensagem para lideranças"
              width={1200}
              height={675}
              className="wr-comunicar-lideres-modal__image"
              priority
            />
          </div>

          {loading ? (
            <p className="wr-comunicar-lideres-modal__state">
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.5} aria-hidden />
              Carregando mensagem…
            </p>
          ) : (
            <>
              <label className="wr-comunicar-lideres-modal__label" htmlFor="wr-comunicar-texto">
                Mensagem
              </label>
              <textarea
                id="wr-comunicar-texto"
                className="wr-comunicar-lideres-modal__texto wr-comunicar-lideres-modal__texto--edit"
                value={mensagem}
                onChange={(e) => {
                  setMensagem(e.target.value)
                  setSavedHint(null)
                }}
                rows={6}
              />
              <div className="wr-comunicar-lideres-modal__actions">
                <button
                  type="button"
                  className={cn(
                    'wr-comunicar-lideres-modal__save',
                    dirty && 'wr-comunicar-lideres-modal__save--dirty',
                  )}
                  disabled={!dirty || saving}
                  onClick={() => void salvar()}
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.5} aria-hidden />
                  ) : (
                    <Save className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  )}
                  Salvar modelo
                </button>
                <button
                  type="button"
                  className="wr-comunicar-lideres-modal__enviar"
                  disabled={loading || !mensagem.trim()}
                  title="Em breve: envio pelo webhook n8n"
                >
                  <Send className="h-3.5 w-3.5" strokeWidth={1.5} aria-hidden />
                  Enviar
                </button>
                {savedHint ? (
                  <span className="wr-comunicar-lideres-modal__hint">{savedHint}</span>
                ) : dirty ? (
                  <span className="wr-comunicar-lideres-modal__hint wr-comunicar-lideres-modal__hint--warn">
                    Alterada — salve para atualizar o JSON
                  </span>
                ) : (
                  <span className="wr-comunicar-lideres-modal__hint">
                    Tokens do modelo: {'{{cidade}}'} · {'{{data}}'} · {'{{hora}}'}
                  </span>
                )}
              </div>
            </>
          )}

          {error ? <p className="wr-comunicar-lideres-modal__error">{error}</p> : null}
        </div>
      </div>
    </div>
  )
}
