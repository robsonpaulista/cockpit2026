'use client'

import { useState } from 'react'
import { X, Save, ExternalLink, Info, Calendar } from 'lucide-react'

interface GoogleCalendarConfigModalProps {
  onClose: () => void
  onSave: (config: {
    calendarId: string
    serviceAccountEmail: string
    credentials: string
  }) => void
  currentConfig?: {
    calendarId: string
    serviceAccountEmail?: string
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
  })
  const [showCredentials, setShowCredentials] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleTest = async () => {
    if (!formData.serviceAccountEmail || !formData.credentials) {
      setTestResult({
        success: false,
        message: '❌ Email do Service Account e credenciais são obrigatórios',
      })
      return
    }

    if (!formData.calendarId) {
      setTestResult({
        success: false,
        message: '❌ ID do Calendário é obrigatório',
      })
      return
    }

    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/agenda/google-calendar', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          calendarId: formData.calendarId,
          serviceAccountEmail: formData.serviceAccountEmail,
          credentials: formData.credentials,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTestResult({
          success: true,
          message: `✅ Conexão bem-sucedida! ${data.events?.length || 0} eventos encontrados.`,
        })
      } else {
        setTestResult({
          success: false,
          message: `❌ Erro: ${data.error}`,
        })
      }
    } catch (error: any) {
      setTestResult({
        success: false,
        message: `❌ Erro ao testar: ${error.message}`,
      })
    } finally {
      setTesting(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.serviceAccountEmail || !formData.credentials || !formData.calendarId) {
      alert('Todos os campos são obrigatórios')
      return
    }
    onSave({
      calendarId: formData.calendarId,
      serviceAccountEmail: formData.serviceAccountEmail,
      credentials: formData.credentials,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-xl border border-border w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/20">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-text-strong">Configurar Google Calendar</h2>
              <p className="text-xs text-text-muted mt-0.5">Conecte sua conta do Google Calendar</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Informações */}
          <div className="bg-primary-soft border border-primary/20 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1 space-y-2 text-sm text-text-muted">
                <p>
                  <strong className="text-text-strong">Para conectar ao Google Calendar, você precisa:</strong>
                </p>
                <ul className="list-disc list-inside space-y-1 ml-2">
                  <li>Uma Service Account do Google Cloud Platform</li>
                  <li>O email da Service Account (formato: nome@projeto.iam.gserviceaccount.com)</li>
                  <li>O arquivo JSON com as credenciais da Service Account</li>
                  <li>O ID do calendário (geralmente o email do calendário ou 'primary')</li>
                  <li>Compartilhar o calendário com o email da Service Account</li>
                </ul>
                <p className="pt-2">
                  <a
                    href="/CONFIGURAR_GOOGLE_CALENDAR.md"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:underline inline-flex items-center gap-1"
                  >
                    Ver guia completo <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                </p>
              </div>
            </div>
          </div>

          {/* ID do Calendário */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              ID do Calendário <span className="text-status-error">*</span>
            </label>
            <input
              type="text"
              value={formData.calendarId}
              onChange={(e) => setFormData({ ...formData, calendarId: e.target.value })}
              placeholder="primary ou email@exemplo.com"
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-surface text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-soft"
              required
            />
            <p className="mt-1.5 text-xs text-text-muted">
              Use "primary" para o calendário principal ou o email do calendário compartilhado
            </p>
          </div>

          {/* Email do Service Account */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Email do Service Account <span className="text-status-error">*</span>
            </label>
            <input
              type="email"
              value={formData.serviceAccountEmail}
              onChange={(e) => setFormData({ ...formData, serviceAccountEmail: e.target.value })}
              placeholder="service-account@projeto.iam.gserviceaccount.com"
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-surface text-text-strong focus:outline-none focus:ring-2 focus:ring-primary-soft"
              required
            />
            <p className="mt-1.5 text-xs text-text-muted">
              O email da Service Account que você criou no Google Cloud Console
            </p>
          </div>

          {/* Credenciais JSON */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Credenciais JSON (Service Account) <span className="text-status-error">*</span>
            </label>
            <div className="relative">
              <textarea
                value={formData.credentials}
                onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                placeholder='{"type": "service_account", "private_key": "...", "client_email": "..."}'
                rows={8}
                className="w-full px-4 py-2.5 border border-border rounded-lg bg-surface text-text-strong font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary-soft"
                required
              />
              <button
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className="absolute top-2 right-2 text-xs text-text-muted hover:text-text-strong"
              >
                {showCredentials ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-text-muted">
              Cole todo o conteúdo do arquivo JSON baixado do Google Cloud Console
            </p>
          </div>

          {/* Teste de Conexão */}
          <div>
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !formData.calendarId || !formData.serviceAccountEmail || !formData.credentials}
              className="w-full px-4 py-2.5 border border-border rounded-lg bg-background text-text-strong hover:bg-primary-soft transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {testing ? 'Testando...' : 'Testar Conexão'}
            </button>
            {testResult && (
              <div
                className={`mt-3 p-3 rounded-lg text-sm ${
                  testResult.success
                    ? 'bg-status-success/10 text-status-success border border-status-success/30'
                    : 'bg-status-error/10 text-status-error border border-status-error/30'
                }`}
              >
                {testResult.message}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-border rounded-lg text-text-strong hover:bg-background transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!formData.calendarId || !formData.serviceAccountEmail || !formData.credentials}
              className="flex-1 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar Configuração
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
