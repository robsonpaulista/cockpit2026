'use client'

import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Plus, Star, Trash2, UserRound } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'
import { formatPhoneDisplay } from '@/lib/whatsapp/send'
import {
  WHATSAPP_CONTACT_CATEGORIES,
  WHATSAPP_CONTACT_CATEGORY_LABELS,
  type WhatsAppContact,
  type WhatsAppContactCategory,
} from '@/lib/whatsapp/contact-types'
import {
  createWhatsAppContact,
  deleteWhatsAppContact,
  fetchWhatsAppContacts,
  updateWhatsAppContact,
} from '@/lib/services/whatsapp-contacts'

const emptyForm = {
  nome: '',
  telefone: '',
  cargo: '',
  categoria: 'geral' as WhatsAppContactCategory,
  is_default: false,
  notas: '',
}

export function WhatsAppContactsPanel() {
  const [contacts, setContacts] = useState<WhatsAppContact[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [saving, setSaving] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState(emptyForm)

  const carregar = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const rows = await fetchWhatsAppContacts({ includeInactive: false })
      setContacts(rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar contatos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void carregar()
  }, [carregar])

  const resetForm = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setMessage(null)
    try {
      const payload = {
        nome: form.nome.trim(),
        telefone: form.telefone.trim(),
        cargo: form.cargo.trim() || null,
        categoria: form.categoria,
        is_default: form.is_default,
        notas: form.notas.trim() || null,
      }

      if (editingId) {
        await updateWhatsAppContact(editingId, payload)
        setMessage('Contato atualizado.')
      } else {
        await createWhatsAppContact(payload)
        setMessage('Contato cadastrado.')
      }
      resetForm()
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao salvar contato')
    } finally {
      setSaving(false)
    }
  }

  const iniciarEdicao = (contact: WhatsAppContact) => {
    setEditingId(contact.id)
    setForm({
      nome: contact.nome,
      telefone: contact.telefone,
      cargo: contact.cargo ?? '',
      categoria: contact.categoria,
      is_default: contact.is_default,
      notas: contact.notas ?? '',
    })
    setMessage(null)
    setError(null)
  }

  const remover = async (contact: WhatsAppContact) => {
    if (!window.confirm(`Remover ${contact.nome} da agenda?`)) return
    setError(null)
    setMessage(null)
    try {
      await deleteWhatsAppContact(contact.id)
      if (editingId === contact.id) resetForm()
      setMessage('Contato removido.')
      await carregar()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao remover contato')
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-card bg-surface p-6">
        <div className="mb-4 flex items-start gap-3">
          <div className="rounded-lg bg-accent-gold/10 p-2">
            <UserRound className="h-5 w-5 text-accent-gold" aria-hidden />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Agenda de contatos</h2>
            <p className="mt-1 text-sm text-text-secondary">
              Cadastre destinatários frequentes para envio rápido no Resumo Operacional, briefing de
              território e futuras ações do Jarvis — sem redigitar o telefone toda vez.
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Nome
            </label>
            <input
              required
              value={form.nome}
              onChange={(e) => setForm((f) => ({ ...f, nome: e.target.value }))}
              placeholder="Ex.: Jadyel"
              className="w-full rounded-md border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Telefone (WhatsApp)
            </label>
            <input
              required
              value={form.telefone}
              onChange={(e) => setForm((f) => ({ ...f, telefone: e.target.value }))}
              placeholder="86 99810-7492"
              inputMode="tel"
              className="w-full rounded-md border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Cargo / função
            </label>
            <input
              value={form.cargo}
              onChange={(e) => setForm((f) => ({ ...f, cargo: e.target.value }))}
              placeholder="Ex.: Candidato, Assessor"
              className="w-full rounded-md border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Categoria
            </label>
            <select
              value={form.categoria}
              onChange={(e) =>
                setForm((f) => ({ ...f, categoria: e.target.value as WhatsAppContactCategory }))
              }
              className="w-full rounded-md border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40"
            >
              {WHATSAPP_CONTACT_CATEGORIES.map((cat) => (
                <option key={cat} value={cat}>
                  {WHATSAPP_CONTACT_CATEGORY_LABELS[cat]}
                </option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              Observações
            </label>
            <input
              value={form.notas}
              onChange={(e) => setForm((f) => ({ ...f, notas: e.target.value }))}
              placeholder="Opcional"
              className="w-full rounded-md border border-card bg-background px-3 py-2 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold/40"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-text-primary md:col-span-2">
            <input
              type="checkbox"
              checked={form.is_default}
              onChange={(e) => setForm((f) => ({ ...f, is_default: e.target.checked }))}
              className="rounded border-card"
            />
            Usar como destinatário padrão nos envios
          </label>
          <div className="flex flex-wrap gap-2 md:col-span-2">
            <button
              type="submit"
              disabled={saving}
              className={cn(sidebarPrimaryCTAButtonClass(false), 'disabled:opacity-60')}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : editingId ? (
                <Pencil className="h-4 w-4" aria-hidden />
              ) : (
                <Plus className="h-4 w-4" aria-hidden />
              )}
              {editingId ? 'Salvar alterações' : 'Adicionar contato'}
            </button>
            {editingId ? (
              <button
                type="button"
                onClick={resetForm}
                className="rounded-lg border border-card px-3 py-1.5 text-sm font-medium text-text-primary hover:bg-background"
              >
                Cancelar edição
              </button>
            ) : null}
          </div>
        </form>

        {message ? <p className="mt-3 text-sm text-status-success">{message}</p> : null}
        {error ? <p className="mt-3 text-sm text-status-error">{error}</p> : null}
      </div>

      <div className="rounded-2xl border border-card bg-surface p-6">
        <h3 className="mb-4 text-base font-semibold text-text-primary">Contatos cadastrados</h3>
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            Carregando...
          </div>
        ) : contacts.length === 0 ? (
          <p className="text-sm text-text-secondary">Nenhum contato cadastrado ainda.</p>
        ) : (
          <ul className="divide-y divide-card">
            {contacts.map((contact) => (
              <li key={contact.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium text-text-primary">
                    {contact.is_default ? (
                      <Star className="h-4 w-4 shrink-0 text-accent-gold" aria-label="Padrão" />
                    ) : null}
                    <span className="truncate">{contact.nome}</span>
                    <span className="text-xs font-normal text-text-secondary">
                      ({WHATSAPP_CONTACT_CATEGORY_LABELS[contact.categoria]})
                    </span>
                  </p>
                  <p className="text-sm text-text-secondary">
                    {formatPhoneDisplay(contact.telefone)}
                    {contact.cargo ? ` · ${contact.cargo}` : ''}
                  </p>
                  {contact.notas ? (
                    <p className="mt-0.5 text-xs text-text-secondary/80">{contact.notas}</p>
                  ) : null}
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => iniciarEdicao(contact)}
                    className="rounded-lg border border-card px-2.5 py-1.5 text-xs font-medium text-text-primary hover:bg-background"
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => void remover(contact)}
                    className="rounded-lg border border-status-error/30 px-2.5 py-1.5 text-xs font-medium text-status-error hover:bg-status-error/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
