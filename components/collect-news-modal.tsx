'use client'

import { useState } from 'react'
import { X, RefreshCw } from 'lucide-react'

interface CollectNewsModalProps {
  onClose: () => void
  onSuccess: () => void
}

export function CollectNewsModal({ onClose, onSuccess }: CollectNewsModalProps) {
  const [rssUrl, setRssUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<any>(null)

  const handleCollect = async () => {
    if (!rssUrl.trim()) {
      setError('Por favor, informe a URL do feed RSS')
      return
    }

    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await fetch('/api/noticias/collect/google-alerts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rss_url: rssUrl.trim(),
          auto_classify: true,
        }),
      })

      const data = await response.json()

      if (response.ok) {
        setResult(data)
        setTimeout(() => {
          onSuccess()
          onClose()
        }, 2000)
      } else {
        setError(data.error || 'Erro ao coletar notícias')
      }
    } catch (err) {
      setError('Erro ao conectar com o servidor')
      console.error('Erro:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card p-6 w-full max-w-md">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-primary">
            Coletar do Google Alerts
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-2">
              URL do Feed RSS do Google Alerts
            </label>
            <input
              type="url"
              value={rssUrl}
              onChange={(e) => setRssUrl(e.target.value)}
              placeholder="https://www.google.com/alerts/feeds/..."
              className="w-full px-4 py-2 border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            />
            <p className="text-xs text-secondary mt-1">
              Cole a URL do feed RSS do Google Alerts aqui
            </p>
          </div>

          {error && (
            <div className="p-3 bg-status-error/10 border border-status-error/30 rounded-lg">
              <p className="text-sm text-status-error">{error}</p>
            </div>
          )}

          {result && (
            <div className="p-3 bg-status-success/10 border border-status-success/30 rounded-lg">
              <p className="text-sm text-status-success font-medium">
                ✅ {result.collected} notícias coletadas!
              </p>
              {result.high_risk > 0 && (
                <p className="text-xs text-status-error mt-1">
                  ⚠️ {result.high_risk} notícias de alto risco detectadas
                </p>
              )}
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-card rounded-lg hover:bg-background transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleCollect}
              disabled={loading || !rssUrl.trim()}
              className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {loading ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  Coletando...
                </>
              ) : (
                <>
                  <RefreshCw className="w-4 h-4" />
                  Coletar Notícias
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}




