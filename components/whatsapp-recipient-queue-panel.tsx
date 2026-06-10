'use client'

import { Plus, Trash2, Loader2, Check, AlertCircle, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPhoneDisplay } from '@/lib/whatsapp/send'
import type { WhatsAppContact } from '@/lib/whatsapp/contact-types'
import { WHATSAPP_CONTACT_CATEGORY_LABELS } from '@/lib/whatsapp/contact-types'
import type { QueueItemStatus, WhatsAppQueueRecipient } from '@/lib/whatsapp/recipient-queue'

interface WhatsAppRecipientQueuePanelProps {
  contacts: WhatsAppContact[]
  contactsLoading: boolean
  queue: WhatsAppQueueRecipient[]
  queueStatus: Record<string, QueueItemStatus>
  selectedContactIds: string[]
  phoneInput: string
  jidPreview: string | null
  disabled?: boolean
  onToggleContact: (contact: WhatsAppContact, checked: boolean) => void
  onAddManual: () => void
  onRemoveFromQueue: (id: string) => void
}

function statusIcon(status: QueueItemStatus | undefined) {
  if (status === 'sending') return <Loader2 className="h-3.5 w-3.5 animate-spin text-accent-gold" />
  if (status === 'sent') return <Check className="h-3.5 w-3.5 text-status-success" />
  if (status === 'failed') return <AlertCircle className="h-3.5 w-3.5 text-status-error" />
  return <Clock className="h-3.5 w-3.5 text-text-secondary" />
}

export function WhatsAppRecipientQueuePanel({
  contacts,
  contactsLoading,
  queue,
  queueStatus,
  selectedContactIds,
  phoneInput,
  jidPreview,
  disabled = false,
  onToggleContact,
  onAddManual,
  onRemoveFromQueue,
}: WhatsAppRecipientQueuePanelProps) {
  const selectedSet = new Set(selectedContactIds)

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Selecionar contatos
        </p>
        {contactsLoading ? (
          <div className="flex items-center gap-2 text-xs text-text-secondary">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Carregando contatos...
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-xs text-text-secondary">
            Nenhum contato cadastrado. Adicione números manualmente abaixo ou cadastre em Dashboard → WhatsApp.
          </p>
        ) : (
          <ul className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-card bg-background p-2">
            {contacts.map((contact) => {
              const checked = selectedSet.has(contact.id)
              return (
                <li key={contact.id}>
                  <label
                    className={cn(
                      'flex cursor-pointer items-start gap-2 rounded-md px-2 py-1.5 text-xs transition-colors hover:bg-surface',
                      disabled && 'cursor-not-allowed opacity-60',
                    )}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 rounded border-card"
                      checked={checked}
                      disabled={disabled}
                      onChange={(e) => onToggleContact(contact, e.target.checked)}
                    />
                    <span className="min-w-0 flex-1 text-text-primary">
                      <span className="font-medium">
                        {contact.is_default ? '★ ' : ''}
                        {contact.nome}
                      </span>
                      <span className="block text-text-secondary">
                        {formatPhoneDisplay(contact.telefone)}
                        {contact.cargo ? ` · ${contact.cargo}` : ''}
                        {contact.categoria !== 'geral'
                          ? ` · ${WHATSAPP_CONTACT_CATEGORY_LABELS[contact.categoria]}`
                          : ''}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || !jidPreview}
          onClick={onAddManual}
          className="inline-flex items-center gap-1.5 rounded-lg border border-card px-2.5 py-1.5 text-xs font-medium text-text-primary transition-colors hover:bg-background disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          Adicionar número à fila
        </button>
        {phoneInput && !jidPreview ? (
          <span className="text-[11px] text-status-error">Telefone inválido</span>
        ) : null}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-text-secondary">
          Fila de envio ({queue.length})
        </p>
        {queue.length === 0 ? (
          <p className="rounded-md border border-dashed border-card bg-background/50 p-3 text-xs text-text-secondary">
            Marque contatos ou adicione um número manualmente para montar a fila.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {queue.map((item, index) => {
              const status = queueStatus[item.id] ?? 'pending'
              return (
                <li
                  key={item.id}
                  className="flex items-center justify-between gap-2 rounded-md border border-card bg-background px-2.5 py-2 text-xs"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {statusIcon(status)}
                    <span className="truncate text-text-primary">
                      <span className="font-medium">
                        {index + 1}. {item.nome}
                      </span>
                      <span className="block text-text-secondary">{formatPhoneDisplay(item.phone)}</span>
                    </span>
                  </div>
                  {status === 'pending' && !disabled ? (
                    <button
                      type="button"
                      onClick={() => onRemoveFromQueue(item.id)}
                      className="shrink-0 rounded p-1 text-text-secondary hover:bg-surface hover:text-status-error"
                      aria-label={`Remover ${item.nome} da fila`}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
