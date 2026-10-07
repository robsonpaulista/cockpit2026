'use client'

import { useState } from 'react'
import { ExternalLink, Info, Loader2, Save, X } from 'lucide-react'
import { TSE_TOKENS } from '@/components/tse/tse-tokens'
import {
  tseBotaoCinzaClass,
  tseBotaoPrimarioClass,
  tseCampoClass,
  tseLinkAcaoClass,
  tseRotuloCampoClass,
} from '@/components/tse/tse-ui'
import {
  testAgendaCalendarConnection,
  type AgendaCalendarConfig,
  type AgendaCalendarConfigInput,
} from '@/lib/services/agenda-google-client'
import { cn } from '@/lib/utils'

interface GoogleCalendarConfigModalProps {
  onClose: () => void
  onSave: (config: AgendaCalendarConfigInput) => Promise<void>
  currentConfig?: AgendaCalendarConfig
}

interface FormState {
  calendarId: string
  serviceAccountEmail: string
  credentials: string
  subjectUser: string
}

type ResultadoTeste = { success: boolean; message: string }

export function GoogleCalendarConfigModal({ onClose, onSave, currentConfig }: GoogleCalendarConfigModalProps) {
  const [formData, setFormData] = useState<FormState>({
    calendarId: currentConfig?.calendarId || '',
    serviceAccountEmail: currentConfig?.serviceAccountEmail || '',
    credentials: '',
    subjectUser: currentConfig?.subjectUser || '',
  })
  const [testing, setTesting] = useState<boolean>(false)
  const [saving, setSaving] = useState<boolean>(false)
  const [testResult, setTestResult] = useState<ResultadoTeste | null>(null)
  const [erroSalvar, setErroSalvar] = useState<string | null>(null)
  const serverAlreadyHasCredentials = Boolean(currentConfig?.hasServerCredentials)

  const atualizar = (campo: keyof FormState, valor: string) => setFormData((prev) => ({ ...prev, [campo]: valor }))

  const handleTest = async () => {
    if (!formData.calendarId || !formData.subjectUser) {
      setTestResult({ success: false, message: 'ID do calendário e e-mail Workspace são obrigatórios.' })
      return
    }
    setTesting(true)
    setTestResult(null)
    try {
      // O teste roda no servidor; a private_key nunca passa pelo navegador.
      const total = await testAgendaCalendarConnection(formData.calendarId, formData.subjectUser)
      setTestResult({ success: true, message: `Conexão ok — ${total} eventos.` })
    } catch (error) {
      setTestResult({ success: false, message: error instanceof Error ? error.message : 'Erro ao testar' })
    } finally {
      setTesting(false)
    }
  }

  const canSave =
    Boolean(formData.calendarId && formData.subjectUser) &&
    (serverAlreadyHasCredentials || Boolean(formData.credentials.trim()) || Boolean(formData.serviceAccountEmail))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!canSave) return
    setSaving(true)
    setErroSalvar(null)
    try {
      await onSave({
        calendarId: formData.calendarId,
        serviceAccountEmail: formData.serviceAccountEmail,
        credentials: formData.credentials.trim() || undefined,
        subjectUser: formData.subjectUser || undefined,
      })
      onClose()
    } catch (error) {
      setErroSalvar(error instanceof Error ? error.message : 'Erro ao salvar configuração.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={TSE_TOKENS} className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="gcal-config-title"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white text-[var(--tse-text)] shadow-xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[#EEEEEE] px-6 py-4">
          <div>
            <h2 id="gcal-config-title" className="text-[17px] font-bold">
              Configurar Google Calendar
            </h2>
            <p className="mt-0.5 text-[12px] text-[var(--tse-muted)]">
              A chave fica só no servidor (env/banco). Só admin salva.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-md p-1 text-[var(--tse-muted)] hover:bg-[var(--tse-bar)] hover:text-[var(--tse-text)]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 px-6 py-5">
          <div className="flex gap-3 rounded-xl bg-[var(--tse-yellow-soft)] p-4 text-[13px]">
            <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--tse-gold-text)]" aria-hidden />
            <div className="space-y-1.5">
              <p>
                Preferência: <code>GOOGLE_SERVICE_ACCOUNT_EMAIL</code> + <code>PRIVATE_KEY</code> no Vercel /{' '}
                <code>.env.local</code>. Aqui você define o calendário e o e-mail Workspace (impersonação).
              </p>
              {serverAlreadyHasCredentials ? (
                <p className="font-semibold text-[var(--tse-olive)]">Credenciais já disponíveis no servidor.</p>
              ) : null}
              <a
                href="/CONFIGURAR_GOOGLE_CALENDAR.md"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(tseLinkAcaoClass, 'inline-flex items-center gap-1')}
              >
                Ver guia <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          </div>

          <label className="block">
            <span className={tseRotuloCampoClass}>ID do calendário *</span>
            <input
              type="text"
              required
              value={formData.calendarId}
              onChange={(e) => atualizar('calendarId', e.target.value)}
              placeholder="primary ou email@exemplo.com"
              className={tseCampoClass}
            />
          </label>

          <label className="block">
            <span className={tseRotuloCampoClass}>E-mail do service account</span>
            <input
              type="email"
              value={formData.serviceAccountEmail}
              onChange={(e) => atualizar('serviceAccountEmail', e.target.value)}
              placeholder="service-account@projeto.iam.gserviceaccount.com"
              className={tseCampoClass}
            />
          </label>

          <label className="block">
            <span className={tseRotuloCampoClass}>Credenciais JSON (opcional se já estiver no env)</span>
            <textarea
              rows={6}
              value={formData.credentials}
              onChange={(e) => atualizar('credentials', e.target.value)}
              placeholder={
                serverAlreadyHasCredentials
                  ? 'Deixe em branco para manter as credenciais do servidor'
                  : '{"type": "service_account", "private_key": "...", "client_email": "..."}'
              }
              className={cn(tseCampoClass, 'h-auto py-2 font-mono text-[12px]')}
            />
            <span className="mt-1 block text-[11px] text-[var(--tse-muted)]">
              Se colar o JSON aqui, ele é gravado no banco pelo servidor — não fica no navegador.
            </span>
          </label>

          <label className="block">
            <span className={tseRotuloCampoClass}>E-mail do usuário real (Workspace) *</span>
            <input
              type="email"
              required
              value={formData.subjectUser}
              onChange={(e) => atualizar('subjectUser', e.target.value)}
              placeholder="agenda@seudominio.com.br"
              className={tseCampoClass}
            />
          </label>

          <div>
            <button
              type="button"
              onClick={() => void handleTest()}
              disabled={testing || !formData.calendarId || !formData.subjectUser}
              className={cn(tseBotaoCinzaClass, 'h-9 w-full justify-center')}
            >
              {testing ? <Loader2 className="h-4 w-4 animate-spin text-[var(--tse-yellow)]" /> : null}
              {testing ? 'Testando…' : 'Testar conexão (servidor)'}
            </button>
            {testResult ? (
              <p
                className={cn(
                  'mt-2 rounded-md px-3 py-2 text-[13px] font-semibold',
                  testResult.success ? 'bg-[var(--tse-bar)] text-[var(--tse-olive)]' : 'bg-red-50 text-red-700',
                )}
              >
                {testResult.message}
              </p>
            ) : null}
          </div>

          {erroSalvar ? (
            <p className="rounded-md bg-red-50 px-3 py-2 text-[13px] font-semibold text-red-700">{erroSalvar}</p>
          ) : null}

          <div className="flex items-center justify-end gap-2 border-t border-[#EEEEEE] pt-4">
            <button type="button" onClick={onClose} className={tseBotaoCinzaClass}>
              Cancelar
            </button>
            <button type="submit" disabled={!canSave || saving} className={tseBotaoPrimarioClass}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              Salvar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
