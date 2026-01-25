'use client'

import { useState } from 'react'
import { X, Save, ExternalLink, Info } from 'lucide-react'

interface GoogleSheetsConfigModalProps {
  onClose: () => void
  onSave: (config: {
    spreadsheetId: string
    sheetName: string
    range?: string
    serviceAccountEmail: string
    credentials: string
  }) => void
  currentConfig?: {
    spreadsheetId: string
    sheetName: string
    range?: string
    serviceAccountEmail?: string
  }
}

export function GoogleSheetsConfigModal({
  onClose,
  onSave,
  currentConfig,
}: GoogleSheetsConfigModalProps) {
  const [formData, setFormData] = useState({
    spreadsheetId: currentConfig?.spreadsheetId || '',
    sheetName: currentConfig?.sheetName || 'Sheet1',
    range: currentConfig?.range || '',
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

    setTesting(true)
    setTestResult(null)

    try {
      const response = await fetch('/api/territorio/google-sheets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spreadsheetId: formData.spreadsheetId,
          sheetName: formData.sheetName,
          range: formData.range || undefined,
          serviceAccountEmail: formData.serviceAccountEmail,
          credentials: formData.credentials,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setTestResult({
          success: true,
          message: `✅ Conexão bem-sucedida! ${data.total} registros encontrados.`,
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
    if (!formData.serviceAccountEmail || !formData.credentials) {
      alert('Email do Service Account e credenciais são obrigatórios')
      return
    }
    onSave({
      spreadsheetId: formData.spreadsheetId,
      sheetName: formData.sheetName,
      range: formData.range || undefined,
      serviceAccountEmail: formData.serviceAccountEmail,
      credentials: formData.credentials,
    })
    onClose()
  }

  const extractSpreadsheetId = (url: string) => {
    // Extrair ID de diferentes formatos de URL do Google Sheets
    const patterns = [
      /\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/,
      /id=([a-zA-Z0-9-_]+)/,
      /^([a-zA-Z0-9-_]+)$/,
    ]

    for (const pattern of patterns) {
      const match = url.match(pattern)
      if (match) {
        return match[1]
      }
    }
    return url
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-primary">
            Configurar Google Sheets
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              URL ou ID da Planilha
            </label>
            <input
              type="text"
              value={formData.spreadsheetId}
              onChange={(e) => {
                const value = e.target.value
                setFormData({
                  ...formData,
                  spreadsheetId: extractSpreadsheetId(value),
                })
              }}
              placeholder="https://docs.google.com/spreadsheets/d/1ABC... ou apenas o ID"
              required
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
            />
            <p className="text-xs text-secondary mt-1">
              Cole a URL completa da planilha ou apenas o ID. A planilha precisa estar pública.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Nome da Aba (Sheet)
            </label>
            <input
              type="text"
              value={formData.sheetName}
              onChange={(e) => setFormData({ ...formData, sheetName: e.target.value })}
              placeholder="Sheet1"
              required
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
            />
            <p className="text-xs text-secondary mt-1">
              Nome exato da aba que contém os dados (padrão: Sheet1)
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Intervalo (Opcional)
            </label>
            <input
              type="text"
              value={formData.range}
              onChange={(e) => setFormData({ ...formData, range: e.target.value })}
              placeholder="A1:Z100"
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
            />
            <p className="text-xs text-secondary mt-1">
              Especifique um intervalo específico (ex: A1:Z100). Deixe vazio para buscar toda a aba.
            </p>
          </div>

          {/* Informações sobre Service Account */}
          <div className="p-4 rounded-xl border border-accent-gold/30 bg-accent-gold-soft/50">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-accent-gold flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-primary mb-2">
                  Autenticação com Service Account
                </p>
                <p className="text-xs text-secondary mb-3">
                  Para acessar planilhas privadas, você precisa configurar um Service Account no Google Cloud Console e compartilhar a planilha com o email do Service Account.
                </p>
                <a
                  href="https://console.cloud.google.com/iam-admin/serviceaccounts"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-accent-gold hover:underline"
                >
                  Criar Service Account no Google Cloud Console →
                </a>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Email do Service Account *
            </label>
            <input
              type="email"
              value={formData.serviceAccountEmail}
              onChange={(e) => setFormData({ ...formData, serviceAccountEmail: e.target.value })}
              placeholder="seu-service-account@projeto.iam.gserviceaccount.com"
              required
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface"
            />
            <p className="text-xs text-secondary mt-1">
              Email do Service Account que terá acesso à planilha. Compartilhe a planilha com este email.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Credenciais JSON do Service Account *
            </label>
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setShowCredentials(!showCredentials)}
                className="text-xs text-accent-gold hover:underline"
              >
                {showCredentials ? 'Ocultar' : 'Mostrar'} campo de credenciais
              </button>
              {showCredentials && (
                <textarea
                  value={formData.credentials}
                  onChange={(e) => setFormData({ ...formData, credentials: e.target.value })}
                  placeholder='Cole aqui o conteúdo completo do arquivo JSON das credenciais do Service Account'
                  required
                  rows={8}
                  className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft bg-surface font-mono text-xs"
                />
              )}
            </div>
            <p className="text-xs text-secondary mt-1">
              Cole o conteúdo completo do arquivo JSON baixado do Google Cloud Console. As credenciais são armazenadas apenas no seu navegador.
            </p>
          </div>

          {/* Teste de Conexão */}
          <div className="pt-4 border-t border-card">
            <button
              type="button"
              onClick={handleTest}
              disabled={testing || !formData.spreadsheetId || !formData.sheetName || !formData.serviceAccountEmail || !formData.credentials}
              className="w-full px-4 py-2 text-sm font-medium border border-card rounded-lg hover:bg-background transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <ExternalLink className="w-4 h-4" />
              {testing ? 'Testando conexão...' : 'Testar Conexão'}
            </button>
            {testResult && (
              <p
                className={`mt-2 text-sm ${
                  testResult.success ? 'text-status-success' : 'text-status-error'
                }`}
              >
                {testResult.message}
              </p>
            )}
          </div>

          {/* Botões */}
          <div className="flex items-center gap-3 pt-4 border-t border-card">
            <button
              type="submit"
              disabled={!formData.spreadsheetId || !formData.sheetName || !formData.serviceAccountEmail || !formData.credentials}
              className="flex-1 px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              Salvar Configuração
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-card rounded-lg hover:bg-background transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

