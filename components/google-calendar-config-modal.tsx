'use client'

import { useState } from 'react'
import { X, Save, ExternalLink, Info, Calendar } from 'lucide-react'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

interface GoogleCalendarConfigModalProps {
  onClose: () => void
  onSave: (config: {
    calendarId: string
    serviceAccountEmail: string
    credentials?: string
    subjectUser?: string
  }) => Promise<void> | void
  currentConfig?: {
    calendarId: string
    serviceAccountEmail?: string
    subjectUser?: string
    hasServerCredentials?: boolean
  }
}

export function GoogleCalendarConfigModal({
  onClose,
  onSave,
  currentConfig,
}: GoogleCalendarConfigModalProps) {
  const [formData, setFormData] = useState({
    calendarId: currentConfig?.calendarId || '',
    serviceAccountEmail: currentConfig?.serviceAccountEmail || '',
    credentials: '',
    subjectUser: currentConfig?.subjectUser || '',
  })
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)
  const isCockpit = false
  const serverAlreadyHasCredentials = Boolean(currentConfig?.hasServerCredentials)

  const handleTest = async () => {
    if (!formData.calendarId) {
      setTestResult({ success: false, message: 'ID do Calendário é obrigatório' })
      return
    }
    if (!formData.subjectUser) {
      setTestResult({
        success: false,
        message: 'Email do usuário Workspace (subjectUser) é obrigatório',
      })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      // Teste só no servidor — não envia private_key pelo browser
      const response = await fetch('/api/agenda/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: formData.calendarId,
          subjectUser: formData.subjectUser,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTestResult({
          success: true,
          message: `Conexão ok — ${data.events?.length || data.total || 0} eventos.`,
        })
      } else {
        setTestResult({
          success: false,
          message: data.error || 'Falha no teste',
        })
      }
    } catch (error: unknown) {
      setTestResult({
        success: false,
        message: error instanceof Error ? error.message : 'Erro ao testar',
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.calendarId || !formData.subjectUser) {
      alert('ID do Calendário e e-mail Workspace são obrigatórios')
      return
    }
    if (!serverAlreadyHasCredentials && !formData.credentials.trim() && !formData.serviceAccountEmail) {
      // Sem credenciais no servidor: precisa JSON ou pelo menos e-mail SA + env no backend
      if (!formData.credentials.trim()) {
        alert(
          'Cole o JSON da Service Account ou configure GOOGLE_SERVICE_ACCOUNT_* no ambiente do servidor.',
        )
        return
      }
    }

    try {
      await onSave({
        calendarId: formData.calendarId,
        serviceAccountEmail: formData.serviceAccountEmail,
        credentials: formData.credentials.trim() || undefined,
        subjectUser: formData.subjectUser || undefined,
      })
      onClose()
    } catch (error) {
      console.error('Erro ao salvar configuração:', error)
    }
  }

  const canSave =
    Boolean(formData.calendarId && formData.subjectUser) &&
    (serverAlreadyHasCredentials || Boolean(formData.credentials.trim()) || Boolean(formData.serviceAccountEmail))

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-card w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-card">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-accent-gold-soft">
              <Calendar className="w-5 h-5 text-accent-gold" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-primary">Configurar Google Calendar</h2>
              <p className="text-xs text-secondary mt-0.5">
                A chave fica só no servidor (env/banco). Só admin salva.
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg hover:bg-background transition-colors">
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          <div className="bg-accent-gold-soft border border-accent-gold/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-accent-gold flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2 text-sm text-secondary">
                <p>
                  Preferência: `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `PRIVATE_KEY` no Vercel / `.env.local`.
                  Aqui você define o calendário e o e-mail Workspace (impersonação).
                </p>
                {serverAlreadyHasCredentials ? (
                  <p className="text-status-success">Credenciais já disponíveis no servidor.</p>
                ) : null}
                <p>
                  <a
                    href="/CONFIGURAR_GOOGLE_CALENDAR.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent-gold hover:underline inline-flex items-center gap-1"
                  >
                    Ver guia <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              ID do Calendário <span className="text-status-error">*</span>
            </label>
            <input
              type="text"
              value={formData.calendarId}
              onChange={(e) => setFormData({ ...formData, calendarId: e.target.value })}
              placeholder="primary ou email@exemplo.com"
              className="w-full px-4 py-2.5 border border-card rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Email do Service Account
            </label>
            <input
              type="email"
              value={formData.serviceAccountEmail}
              onChange={(e) => setFormData({ ...formData, serviceAccountEmail: e.target.value })}
              placeholder="service-account@projeto.iam.gserviceaccount.com"
              className="w-full px-4 py-2.5 border border-card rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Credenciais JSON (opcional se já estiver no env)
            </label>
            <textarea
              value={formData.credentials}
              onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
              placeholder={
                serverAlreadyHasCredentials
                  ? 'Deixe em branco para manter as credenciais do servidor'
                  : '{"type": "service_account", "private_key": "...", "client_email": "..."}'
              }
              rows={6}
              className="w-full px-4 py-2.5 border border-card rounded-lg bg-surface text-text-primary font-mono text-xs focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
            <p className="mt-1.5 text-xs text-secondary">
              Se colar JSON aqui, ele é gravado no banco pelo servidor — não fica no localStorage.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              Email do Usuário Real (Workspace) <span className="text-status-error">*</span>
            </label>
            <input
              type="email"
              value={formData.subjectUser}
              onChange={(e) => setFormData({ ...formData, subjectUser: e.target.value })}
              placeholder="agenda@seudominio.com.br"
              className="w-full px-4 py-2.5 border border-card rounded-lg bg-surface text-text-primary focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              required
            />
          </div>

          <div>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || !formData.calendarId || !formData.subjectUser}
              className="w-full px-4 py-2.5 border border-card rounded-lg bg-background text-text-primary hover:bg-accent-gold-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? 'Testando...' : 'Testar Conexão (servidor)'}
            </button>
            {testResult ? (
              <div
                className={`mt-3 p-3 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-status-success/10 text-status-success border border-status-success/30'
                    : 'bg-status-error/10 text-status-error border border-status-error/30'
                }`}
              >
                {testResult.message}
              </div>
            ) : null}
          </div>

          <div className="flex items-center gap-3 pt-4 border-t border-card">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-card rounded-lg text-text-primary hover:bg-background transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className={sidebarPrimaryCTAButtonClass(isCockpit, 'flex-1 py-2.5')}
            >
              <Save className={cn('h-4 w-4 shrink-0', isCockpit ? 'text-white' : 'text-accent-gold')} aria-hidden />
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
