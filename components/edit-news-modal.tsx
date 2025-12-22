'use client'

import { useEffect, useState } from 'react'
import { X, Save } from 'lucide-react'
import { NewsItem } from '@/types'

interface EditNewsModalProps {
  news: NewsItem | null
  onClose: () => void
  onUpdate: () => void
}

const sentimentOptions = [
  { value: 'positive', label: 'Positivo' },
  { value: 'negative', label: 'Negativo' },
  { value: 'neutral', label: 'Neutro' },
]

const riskOptions = [
  { value: 'high', label: 'Alto' },
  { value: 'medium', label: 'Médio' },
  { value: 'low', label: 'Baixo' },
]

const commonThemes = [
  'Saúde',
  'Educação',
  'Infraestrutura',
  'Segurança',
  'Economia',
  'Meio Ambiente',
  'Social',
  'Política',
  'Ambiente Familiar',
  'Cultura',
  'Esporte',
  'Tecnologia',
  'Agricultura',
  'Turismo',
  'Transporte',
  'Energia',
  'Outro',
]

export function EditNewsModal({ news, onClose, onUpdate }: EditNewsModalProps) {
  const [formData, setFormData] = useState({
    sentiment: '',
    risk_level: '',
    theme: '',
  })
  const [customTheme, setCustomTheme] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (news) {
      setFormData({
        sentiment: news.sentiment || '',
        risk_level: news.risk_level || '',
        theme: news.theme || '',
      })
      // Se o tema não está na lista comum, colocar em customTheme
      if (news.theme && !commonThemes.includes(news.theme)) {
        setCustomTheme(news.theme)
        setFormData(prev => ({ ...prev, theme: 'Outro' }))
      } else {
        setCustomTheme('')
      }
    }
  }, [news])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!news) return

    setSubmitting(true)
    try {
      const themeToSave = formData.theme === 'Outro' ? customTheme : formData.theme

      const response = await fetch(`/api/noticias/${news.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sentiment: formData.sentiment || null,
          risk_level: formData.risk_level || null,
          theme: themeToSave || null,
        }),
      })

      if (response.ok) {
        onUpdate()
        onClose()
      } else {
        const error = await response.json()
        alert(error.error || 'Erro ao atualizar notícia')
      }
    } catch (error) {
      alert('Erro ao atualizar notícia')
    } finally {
      setSubmitting(false)
    }
  }

  if (!news) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-border p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-semibold text-text-strong">
            Editar Classificação da Notícia
          </h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
          >
            <X className="w-5 h-5 text-text-muted" />
          </button>
        </div>

        {/* Preview da Notícia */}
        <div className="mb-6 p-4 rounded-xl border border-border bg-background">
          <h3 className="text-sm font-semibold text-text-strong mb-2">{news.title}</h3>
          <div className="flex items-center gap-2 text-xs text-text-muted">
            <span>{news.source}</span>
            <span>•</span>
            <span>
              {news.published_at
                ? new Date(news.published_at).toLocaleDateString('pt-BR')
                : 'Data não disponível'}
            </span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Sentimento */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Sentimento
            </label>
            <div className="grid grid-cols-3 gap-2">
              {sentimentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, sentiment: option.value })}
                  className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    formData.sentiment === option.value
                      ? option.value === 'positive'
                        ? 'bg-status-success/10 text-status-success border-status-success/30'
                        : option.value === 'negative'
                        ? 'bg-status-error/10 text-status-error border-status-error/30'
                        : 'bg-primary-soft text-primary border-primary/30'
                      : 'bg-background border-border text-text-strong hover:bg-background/80'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Nível de Risco */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Nível de Risco
            </label>
            <div className="grid grid-cols-3 gap-2">
              {riskOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFormData({ ...formData, risk_level: option.value })}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    formData.risk_level === option.value
                      ? option.value === 'high'
                        ? 'bg-status-error/10 text-status-error'
                        : option.value === 'medium'
                        ? 'bg-status-warning/10 text-status-warning'
                        : 'bg-status-success/10 text-status-success'
                      : 'bg-background border border-border text-text-strong hover:bg-background/80'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {/* Tema */}
          <div>
            <label className="block text-sm font-medium text-text-strong mb-2">
              Tema
            </label>
            <select
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              className="w-full px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
            >
              <option value="">Selecione um tema</option>
              {commonThemes.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
            {formData.theme === 'Outro' && (
              <input
                type="text"
                value={customTheme}
                onChange={(e) => setCustomTheme(e.target.value)}
                placeholder="Digite o tema personalizado"
                className="w-full mt-2 px-4 py-2 border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-soft bg-surface"
              />
            )}
          </div>

          {/* Botões */}
          <div className="flex items-center gap-3 pt-4 border-t border-border">
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Salvando...' : 'Salvar Alterações'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-border rounded-lg hover:bg-background transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

