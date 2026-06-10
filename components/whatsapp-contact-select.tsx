'use client'

import { useEffect, useMemo, useState } from 'react'
import { UserRound, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatPhoneDisplay } from '@/lib/whatsapp/send'
import type { WhatsAppContact, WhatsAppContactCategory } from '@/lib/whatsapp/contact-types'
import { WHATSAPP_CONTACT_CATEGORY_LABELS } from '@/lib/whatsapp/contact-types'
import { fetchWhatsAppContacts } from '@/lib/services/whatsapp-contacts'

interface WhatsAppContactSelectProps {
  value: string
  selectedContactId: string
  onContactChange: (contact: WhatsAppContact | null, phone: string) => void
  categoria?: WhatsAppContactCategory
  className?: string
  disabled?: boolean
}

function contactLabel(contact: WhatsAppContact): string {
  const phone = formatPhoneDisplay(contact.telefone)
  const cargo = contact.cargo ? ` · ${contact.cargo}` : ''
  return `${contact.nome}${cargo} — ${phone}`
}

export function WhatsAppContactSelect({
  value,
  selectedContactId,
  onContactChange,
  categoria,
  className,
  disabled = false,
}: WhatsAppContactSelectProps) {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [loadError, setLoadError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    void fetchWhatsAppContacts()
      .then((rows) => {
        if (!cancelled) setContacts(rows)
      })
      .catch((error: unknown) => {
        if (!cancelled) {
          setLoadError(error instanceof Error ? error.message : 'Erro ao carregar contatos')
          setContacts([])
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const options = useMemo(() => {
    return [...contacts].sort((a, b) => {
      if (a.is_default !== b.is_default) return a.is_default ? -1 : 1
      if (categoria) {
        const aMatch = a.categoria === categoria ? 1 : 0
        const bMatch = b.categoria === categoria ? 1 : 0
        if (aMatch !== bMatch) return bMatch - aMatch
      }
      return a.nome.localeCompare(b.nome, 'pt-BR')
    })
  }, [contacts, categoria])

  return (
    <div className={cn('space-y-2', className)}>
      <label htmlFor="whatsapp-contact-select" className="block text-xs font-semibold uppercase tracking-wide text-text-secondary">
        Contato salvo
      </label>
      <div className="relative">
        <UserRound
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-secondary"
          aria-hidden
        />
        <select
          id="whatsapp-contact-select"
          value={selectedContactId}
          disabled={disabled || loading}
          onChange={(e) => {
            const id = e.target.value
            if (!id) {
              onContactChange(null, value)
              return
            }
            const contact = options.find((c) => c.id === id) ?? null
            onContactChange(contact, contact?.telefone ?? value)
          }}
          className={cn(
            'w-full appearance-none rounded-md border border-card bg-background py-2 pl-9 pr-8 text-sm text-text-primary',
            'focus:outline-none focus:ring-2 focus:ring-accent-gold/40',
            disabled && 'cursor-not-allowed opacity-60',
          )}
        >
          <option value="">Digitar número manualmente</option>
          {options.map((contact) => (
            <option key={contact.id} value={contact.id}>
              {contact.is_default ? '★ ' : ''}
              {contactLabel(contact)}
              {contact.categoria !== 'geral'
                ? ` (${WHATSAPP_CONTACT_CATEGORY_LABELS[contact.categoria]})`
                : ''}
            </option>
          ))}
        </select>
        {loading && (
          <Loader2
            className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-secondary"
            aria-hidden
          />
        )}
      </div>
      {loadError ? (
        <p className="text-[11px] text-status-warning">
          {loadError}. Cadastre contatos em Dashboard → WhatsApp ou digite o número abaixo.
        </p>
      ) : options.length === 0 && !loading ? (
        <p className="text-[11px] text-text-secondary">
          Nenhum contato cadastrado ainda. Use o campo abaixo ou cadastre em Dashboard → WhatsApp.
        </p>
      ) : null}
    </div>
  )
}
