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
import { getWhatsAppCeoPhone } from '@/lib/whatsapp/ceo-phone'
import { WhatsAppContactSelect } from '@/components/whatsapp-contact-select'
import { WhatsAppRecipientQueuePanel } from '@/components/whatsapp-recipient-queue-panel'
import { fetchWhatsAppContacts } from '@/lib/services/whatsapp-contacts'
import type { WhatsAppContact, WhatsAppContactCategory } from '@/lib/whatsapp/contact-types'
import {
  createQueueRecipient,
  dedupeQueueRecipients,
  sendWhatsAppQueue,
  type QueueItemStatus,
  type WhatsAppQueueRecipient,
} from '@/lib/whatsapp/recipient-queue'

interface WhatsAppSendModalProps {
  isOpen: boolean
  onClose: () => void
  text: string
  source?: string
  cidade?: string
  title?: string
  description?: string
  defaultPhone?: string
  preferCeoPhone?: boolean
  contactCategory?: WhatsAppContactCategory
  /** Permite selecionar vários destinatários e enviar em fila sequencial. */
  allowMultipleRecipients?: boolean
}

type EnvioStatus =
  | { kind: 'idle' }
  | { kind: 'sending'; label?: string }
  | { kind: 'success'; message?: string }
  | { kind: 'error'; message: string }

export function WhatsAppSendModal({
  isOpen,
  onClose,
  text,
  source,
  cidade,
  title = 'Enviar pelo WhatsApp',
  description,
  defaultPhone,
  preferCeoPhone = false,
  contactCategory,
  allowMultipleRecipients = false,
}: WhatsAppSendModalProps) {
  const [phoneInput, setPhoneInput] = useState<string>('')
  const [selectedContactId, setSelectedContactId] = useState<string>('')
  const [status, setStatus] = useState<EnvioStatus>({ kind: 'idle' })
  const [contacts, setContacts] = useState<WhatsAppContact[]>([])
  const [contactsLoading, setContactsLoading] = useState<boolean>(false)
  const [queue, setQueue] = useState<WhatsAppQueueRecipient[]>([])
  const [selectedContactIds, setSelectedContactIds] = useState<string[]>([])
  const [queueStatus, setQueueStatus] = useState<Record<string, QueueItemStatus>>({})

  const isBusy = status.kind === 'sending'

  useEffect(() => {
    if (!isOpen) return
    let cancelled = false

    const boot = async () => {
      const ceo = getWhatsAppCeoPhone()
      const last = getLastUsedPhone()
      let suggested = defaultPhone?.trim() || ''
      let contactId = ''
      let loadedContacts: WhatsAppContact[] = []

      setContactsLoading(true)
      try {
        loadedContacts = await fetchWhatsAppContacts()
        if (cancelled) return
        setContacts(loadedContacts)

        const defaultContact = loadedContacts.find((c) => c.is_default) ?? loadedContacts[0]
        if (!suggested && defaultContact) {
          suggested = defaultContact.telefone
          contactId = defaultContact.id
        }
      } catch {
        if (!cancelled) setContacts([])
      } finally {
        if (!cancelled) setContactsLoading(false)
      }

      if (!suggested) {
        if (preferCeoPhone && ceo) suggested = ceo
        else if (last) suggested = last
        else suggested = ceo
      }

      if (!cancelled) {
        setPhoneInput(suggested)
        setSelectedContactId(contactId)
        setStatus({ kind: 'idle' })
        setQueueStatus({})

        if (allowMultipleRecipients) {
          const defaultContact = loadedContacts.find((c) => c.is_default)
          if (defaultContact) {
            const item = createQueueRecipient({
              nome: defaultContact.nome,
              phone: defaultContact.telefone,
              contactId: defaultContact.id,
            })
            if (item) {
              setQueue([item])
              setSelectedContactIds([defaultContact.id])
            } else {
              setQueue([])
              setSelectedContactIds([])
            }
          } else {
            setQueue([])
            setSelectedContactIds([])
          }
        } else {
          setQueue([])
          setSelectedContactIds([])
        }
      }
    }

    void boot()

    return () => {
      cancelled = true
    }
  }, [isOpen, defaultPhone, preferCeoPhone, contactCategory, allowMultipleRecipients])

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

  const podeEnviar = useMemo(() => {
    if (!text.trim() || isBusy) return false
    if (allowMultipleRecipients) return queue.length > 0
    return Boolean(jidPreview)
  }, [text, isBusy, allowMultipleRecipients, queue.length, jidPreview])

  const syncQueueFromContactIds = useCallback(
    (ids: string[], currentQueue: WhatsAppQueueRecipient[]) => {
      const manualItems = currentQueue.filter((q) => !q.contactId)
      const fromContacts: WhatsAppQueueRecipient[] = []
      for (const id of ids) {
        const contact = contacts.find((c) => c.id === id)
        if (!contact) continue
        const item = createQueueRecipient({
          nome: contact.nome,
          phone: contact.telefone,
          contactId: contact.id,
        })
        if (item) fromContacts.push(item)
      }
      return dedupeQueueRecipients([...fromContacts, ...manualItems])
    },
    [contacts],
  )

  const handleToggleContact = useCallback(
    (contact: WhatsAppContact, checked: boolean) => {
      setSelectedContactIds((prev) => {
        const next = checked ? [...prev, contact.id] : prev.filter((id) => id !== contact.id)
        setQueue((q) => syncQueueFromContactIds(next, q))
        return next
      })
      if (status.kind === 'error') setStatus({ kind: 'idle' })
    },
    [syncQueueFromContactIds, status.kind],
  )

  const handleAddManualToQueue = useCallback(() => {
    if (!jidPreview) {
      setStatus({
        kind: 'error',
        message: 'Telefone inválido. Use o formato com DDD (ex.: 86 99810-7492).',
      })
      return
    }
    const selected = contacts.find((c) => c.id === selectedContactId)
    const nome = selected?.nome ?? formatPhoneDisplay(phoneInput)
    const item = createQueueRecipient({
      nome,
      phone: phoneInput,
      contactId: selectedContactId || undefined,
    })
    if (!item) return

    setQueue((prev) => {
      if (prev.some((p) => p.jid === item.jid)) return prev
      return dedupeQueueRecipients([...prev, item])
    })
    if (status.kind === 'error') setStatus({ kind: 'idle' })
  }, [jidPreview, phoneInput, selectedContactId, contacts, status.kind])

  const handleRemoveFromQueue = useCallback((id: string) => {
    setQueue((prev) => {
      const removed = prev.find((p) => p.id === id)
      if (removed?.contactId) {
        setSelectedContactIds((ids) => ids.filter((cid) => cid !== removed.contactId))
      }
      return prev.filter((p) => p.id !== id)
    })
  }, [])

  const handleEnviar = useCallback(async () => {
    if (allowMultipleRecipients) {
      if (queue.length === 0) {
        setStatus({ kind: 'error', message: 'Adicione pelo menos um destinatário à fila.' })
        return
      }

      setStatus({ kind: 'sending', label: `Enviando 1 de ${queue.length}...` })
      const initialStatus: Record<string, QueueItemStatus> = {}
      queue.forEach((q) => {
        initialStatus[q.id] = 'pending'
      })
      setQueueStatus(initialStatus)

      const summary = await sendWhatsAppQueue(queue, {
        text,
        source,
        cidade,
        onProgress: (progress) => {
          setQueueStatus((prev) => ({
            ...prev,
            [progress.recipient.id]: progress.status,
          }))
          if (progress.status === 'sending') {
            setStatus({
              kind: 'sending',
              label: `Enviando ${progress.index + 1} de ${progress.total} — ${progress.recipient.nome}`,
            })
          }
        },
      })

      if (summary.failed === 0) {
        rememberLastUsedPhone(queue[0]?.phone ?? phoneInput)
        setStatus({
          kind: 'success',
          message: `Mensagem enviada para ${summary.sent} destinatário${summary.sent === 1 ? '' : 's'}.`,
        })
        window.setTimeout(() => {
          setStatus({ kind: 'idle' })
          onClose()
        }, 1800)
      } else if (summary.sent > 0) {
        setStatus({
          kind: 'error',
          message: `Enviado para ${summary.sent}; falhou em ${summary.failed}. Verifique a fila e tente novamente os pendentes.`,
        })
      } else {
        setStatus({
          kind: 'error',
          message: summary.results[0]?.error || 'Falha ao enviar para todos os destinatários.',
        })
      }
      return
    }

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
  }, [allowMultipleRecipients, queue, text, source, cidade, jidPreview, phoneInput, onClose])

  const sortedContacts = useMemo(() => {
    return [...contacts].sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
      if (contactCategory) {
        const aMatch = a.categoria === contactCategory ? 1 : 0
        const bMatch = b.categoria === contactCategory ? 1 : 0
        if (aMatch !== bMatch) return bMatch - aMatch
      }
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [contacts, contactCategory])

  if (!isOpen || typeof document === 'undefined') return null

  const sendButtonLabel = allowMultipleRecipients
    ? queue.length > 0
      ? `Enviar para ${queue.length}`
      : 'Enviar'
    : 'Enviar'

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
            disabled={isBusy}
            className="rounded-lg p-1.5 text-secondary transition-colors hover:bg-background disabled:opacity-50"
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto p-5">
          {allowMultipleRecipients ? (
            <>
              <WhatsAppRecipientQueuePanel
                contacts={sortedContacts}
                contactsLoading={contactsLoading}
                queue={queue}
                queueStatus={queueStatus}
                selectedContactIds={selectedContactIds}
                phoneInput={phoneInput}
                jidPreview={jidPreview}
                disabled={isBusy}
                onToggleContact={handleToggleContact}
                onAddManual={handleAddManualToQueue}
                onRemoveFromQueue={handleRemoveFromQueue}
              />

              <div>
                <label
                  htmlFor="whatsapp-phone-input-queue"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  Número manual (opcional)
                </label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary"
                    aria-hidden
                  />
                  <input
                    id="whatsapp-phone-input-queue"
                    type="tel"
                    inputMode="tel"
                    value={phoneInput}
                    disabled={isBusy}
                    onChange={(e) => {
                      setPhoneInput(e.target.value)
                      setSelectedContactId('')
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
                {jidPreview ? (
                  <p className="mt-1 text-[11px] text-text-secondary">
                    → {phoneFormatted}
                  </p>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <WhatsAppContactSelect
                value={phoneInput}
                selectedContactId={selectedContactId}
                categoria={contactCategory}
                disabled={isBusy}
                onContactChange={(contact, phone) => {
                  setSelectedContactId(contact?.id ?? '')
                  setPhoneInput(phone)
                  if (status.kind === 'error') setStatus({ kind: 'idle' })
                }}
              />

              <div>
                <label
                  htmlFor="whatsapp-phone-input"
                  className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary"
                >
                  Telefone do destinatário
                </label>
                <div className="relative">
                  <Phone
                    className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary"
                    aria-hidden
                  />
                  <input
                    id="whatsapp-phone-input"
                    type="tel"
                    inputMode="tel"
                    value={phoneInput}
                    disabled={isBusy}
                    onChange={(e) => {
                      setPhoneInput(e.target.value)
                      setSelectedContactId('')
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
                  <span>Aceita formato livre (com ou sem DDI/DDD).</span>
                  {jidPreview && (
                    <span className="font-mono text-text-primary">→ {phoneFormatted}</span>
                  )}
                </div>
              </div>
            </>
          )}

          <div>
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Pré-visualização da mensagem
            </p>
            <pre className="max-h-48 overflow-auto whitespace-pre-wrap break-words rounded-md border border-card bg-background p-3 font-sans text-xs leading-relaxed text-text-primary">
              {text || 'Nenhum conteúdo para enviar.'}
            </pre>
          </div>

          {status.kind === 'sending' && status.label ? (
            <div className="flex items-center gap-2 rounded-md border border-accent-gold/30 bg-accent-gold/10 p-3 text-xs text-text-primary">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-accent-gold" aria-hidden />
              <span>{status.label}</span>
            </div>
          ) : null}

          {status.kind === 'error' && (
            <div className="flex items-start gap-2 rounded-md border border-status-error/40 bg-status-error/10 p-3 text-xs text-status-error">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span>{status.message}</span>
            </div>
          )}

          {status.kind === 'success' && (
            <div className="flex items-center gap-2 rounded-md border border-status-success/40 bg-status-success/10 p-3 text-xs text-status-success">
              <Check className="h-4 w-4 shrink-0" aria-hidden />
              <span>{status.message ?? 'Mensagem enviada com sucesso!'}</span>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-card bg-background/50 p-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isBusy}
            className="rounded-lg border border-card px-3 py-1.5 text-sm font-medium text-text-primary transition-colors hover:bg-background disabled:opacity-50"
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
                {sendButtonLabel}
              </>
            )}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
