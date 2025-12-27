'use client'

import { useState } from 'react'
import { X, Save, ExternalLink, Info, Loader2 } from 'lucide-react'
import { validateInstagramToken } from '@/lib/instagramApi'

interface InstagramConfigModalProps {
  onClose: () => void
  onSave: (config: { token: string; businessAccountId: string }) => void
  currentConfig?: {
    token?: string
    businessAccountId?: string
  }
}

export function InstagramConfigModal({
  onClose,
  onSave,
  currentConfig,
}: InstagramConfigModalProps) {
  const [formData, setFormData] = useState({
    token: currentConfig?.token || '',
    businessAccountId: currentConfig?.businessAccountId || '',
  })
  const [showToken, setShowToken] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<{ success: boolean; message: string } | null>(null)

  const handleValidate = async () => {
    if (!formData.token || !formData.businessAccountId) {
      setValidationResult({
        success: false,
        message: 'Token e Business Account ID são obrigatórios',
      })
      return
    }

    setValidating(true)
    setValidationResult(null)

    try {
      const isValid = await validateInstagramToken(formData.token, formData.businessAccountId)

      if (isValid) {
        setValidationResult({
          success: true,
          message: '✅ Credenciais válidas! Conexão bem-sucedida.',
        })
      } else {
        setValidationResult({
          success: false,
          message: '❌ Token inválido ou expirado. Verifique suas credenciais.',
        })
      }
    } catch (error: any) {
      setValidationResult({
        success: false,
        message: `❌ Erro ao validar: ${error.message || 'Erro desconhecido'}`,
      })
    } finally {
      setValidating(false)
    }
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!formData.token || !formData.businessAccountId) {
      alert('Token e Business Account ID são obrigatórios')
      return
    }
    onSave({
      token: formData.token,
      businessAccountId: formData.businessAccountId,
    })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-border p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-strong">
            Configurar Instagram
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="bg-primary-soft border border-primary/30 rounded-lg p-4 mb-4">
            <div className="flex items-start gap-3">
              <Info className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm font-medium text-text-strong mb-1">
                  Como obter as credenciais:
                </p>
                <ol className="text-xs text-text-muted space-y-1 list-decimal list-inside">
                  <li>Acesse o Facebook Developers</li>
                  <li>Crie ou selecione um App</li>
                  <li>Obtenha o Access Token</li>
                  <li>Obtenha o ID da Página do Facebook (Business Account ID)</li>
                </ol>
                <a
                  href="https://developers.facebook.com/docs/instagram-api/getting-started"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-primary hover:underline mt-2 inline-flex items-center gap-1"
                >
                  Ver documentação <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Access Token *
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={formData.token}
                onChange={(e) => setFormData({ ...formData, token: e.target.value })}
                placeholder="EAAH..."
                required
                className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface pr-10"
              />
              <button
                type="button"
                onClick={() => setShowToken(!showToken)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-text-strong"
              >
                {showToken ? 'Ocultar' : 'Mostrar'}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Business Account ID (ID da Página do Facebook) *
            </label>
            <input
              type="text"
              value={formData.businessAccountId}
              onChange={(e) => setFormData({ ...formData, businessAccountId: e.target.value })}
              placeholder="123456789"
              required
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
            />
            <p className="text-xs text-text-muted mt-1">
              ID da página do Facebook que está conectada à conta Instagram Business
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleValidate}
              disabled={validating || !formData.token || !formData.businessAccountId}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {validating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Validando...
                </>
              ) : (
                'Validar Credenciais'
              )}
            </button>
          </div>

          {validationResult && (
            <div
              className={`p-3 rounded-lg border ${
                validationResult.success
                  ? 'bg-status-success/10 border-status-success/30'
                  : 'bg-status-error/10 border-status-error/30'
              }`}
            >
              <p
                className={`text-sm ${
                  validationResult.success ? 'text-status-success' : 'text-status-error'
                }`}
              >
                {validationResult.message}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-border">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!validationResult?.success}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center gap-2"
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






