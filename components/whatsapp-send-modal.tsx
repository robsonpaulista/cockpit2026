'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { X, Send, Loader2, Check, AlertCircle, Phone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import {
  formatPhoneDisplay,
  getLastUsedPhone,
  normalizePhoneToJid,
  rememberLastUsedPhone,
  sendWhatsAppMessage,
} from '@/lib/whatsapp/send'

interface WhatsAppSendModalProps {
  isOpen: boolean
  onClose: () => void
  /** Texto pronto da mensagem a ser enviada (ex.: briefing executivo já formatado). */
  text: string
  /** Origem funcional gravada no log de auditoria. */
  source?: string
  /** Município/contexto principal gravado no log de auditoria. */
  cidade?: string
  /** Título exibido no cabeçalho do modal. Default: "Enviar pelo WhatsApp". */
  title?: string
  /** Descrição curta abaixo do título — útil para indicar o contexto. */
  description?: string
}

type EnvioStatus =
  | { kind: 'idle' }
  | { kind: 'sending' }
  | { kind: 'success' }
  | { kind: 'error'; message: string }

/**
 * Modal de envio de WhatsApp: coleta o telefone do destinatário, mostra um
 * preview do texto que será enviado e dispara a chamada para a rota local
 * `/api/whatsapp/send`. Mantém o último número usado em `localStorage` para
 * agilizar envios sequenciais.
 */
export function WhatsAppSendModal({
  isOpen,
  onClose,
  text,
  source,
  cidade,
  title = 'Enviar pelo WhatsApp',
  description,
}: WhatsAppSendModalProps) {
  const [phoneInput, setPhoneInput] = useState<string>('')
  const [status, setStatus] = useState<EnvioStatus>({ kind: 'idle' })

  useEffect(() => {
    if (!isOpen) return
    setPhoneInput(getLastUsedPhone())
    setStatus({ kind: 'idle' })
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = original
    }
  }, [isOpen])

  const jidPreview = useMemo(() => normalizePhoneToJid(phoneInput), [phoneInput])
  const phoneFormatted = useMemo(() => formatPhoneDisplay(phoneInput), [phoneInput])
  const podeEnviar = Boolean(jidPreview && text.trim()) && status.kind !== 'sending'

  const handleEnviar = useCallback(async () => {
    if (!jidPreview) {
      setStatus({
        kind: 'error',
        message: 'Telefone inválido. Use o formato com DDD (ex.: 86 99810-7492).',
      })
      return
    }
    setStatus({ kind: 'sending' })
    const result = await sendWhatsAppMessage({
      jid: jidPreview,
      phone: phoneInput,
      text,
      source,
      cidade,
    })
    if (result.ok) {
      rememberLastUsedPhone(phoneInput)
      setStatus({ kind: 'success' })
      window.setTimeout(() => {
        setStatus({ kind: 'idle' })
        onClose()
      }, 1400)
    } else {
      setStatus({
        kind: 'error',
        message: result.error || 'Falha ao enviar mensagem.',
      })
    }
  }, [jidPreview, text, phoneInput, source, cidade, onClose])

  if (!isOpen || typeof document === 'undefined') return null

  return createPortal(
    <div className="fixed inset-0 z-[1300] flex items-center justify-center bg-black/55 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-card bg-surface shadow-xl">
        <div className="flex items-start justify-between border-b border-card p-5">
          <div className="min-w-0">
            <h2 className="flex items-center gap-2 text-base font-semibold text-text-primary">
              <Send className="h-4 w-4 text-accent-gold" aria-hidden />
              <span className="truncate">{title}</span>
            </h2>
            {description && (
              <p className="mt-1 text-xs text-text-secondary">{description}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-secondary transition-colors hover:bg-background"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          <div>
            <label htmlFor="whatsapp-phone-input" className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Destinatário
            </label>
            <div className="relative">
              <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary" aria-hidden />
              <input
                id="whatsapp-phone-input"
                type="tel"
                inputMode="tel"
                value={phoneInput}
                onChange={(e) => {
                  setPhoneInput(e.target.value)
                  if (status.kind === 'error') setStatus({ kind: 'idle' })
                }}
                placeholder="86 99810-7492"
                className={cn(
                  'w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm text-text-primary',
                  'focus:outline-none focus:ring-2 focus:ring-accent-gold/40',
                  status.kind === 'error' ? 'border-status-error' : 'border-card',
                )}
                autoComplete="tel"
              />
            </div>
            <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-text-secondary">
              <span>
                Aceita formato livre (com ou sem DDI/DDD). Brasil é assumido por padrão.
              </span>
              {jidPreview && (
                <span className="font-mono text-text-primary">
                  → {phoneFormatted}
                </span>
              )}
            </div>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Pré-visualização da mensagem
            </p>
            <pre
              className="max-h-72 overflow-auto whitespace-pre-wrap break-words rounded-md border border-card bg-background p-3 font-sans text-xs leading-relaxed text-text-primary"
            >
              {text || 'Nenhum conteúdo para enviar.'}
            </pre>
          </div>

          {status.kind === 'error' && (
            <div className="flex items-start gap-2 rounded-md border border-status-error/40 bg-status-error/10 p-3 text-xs text-status-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{status.message}</span>
            </div>
          )}

          {status.kind === 'success' && (
            <div className="flex items-center gap-2 rounded-md border border-status-success/40 bg-status-success/10 p-3 text-xs text-status-success">
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              <span>Mensagem enviada com sucesso!</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-card bg-background/50 p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-background"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleEnviar}
            disabled={!podeEnviar}
            className={cn(
              sidebarPrimaryCTAButtonClass(false),
              'disabled:cursor-not-allowed disabled:opacity-60',
            )}
            title={podeEnviar ? 'Enviar mensagem agora' : 'Informe um telefone válido'}
          >
            {status.kind === 'sending' ? (
              <>
                <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-gold" aria-hidden />
                Enviando...
              </>
            ) : status.kind === 'success' ? (
              <>
                <Check className="h-4 w-4 shrink-0 text-accent-gold" aria-hidden />
                Enviado
              </>
            ) : (
              <>
                <Send className="h-4 w-4 shrink-0 text-accent-gold" aria-hidden />
                Enviar
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
