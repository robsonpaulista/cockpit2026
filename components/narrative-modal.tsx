'use client'

import { useEffect, useState } from 'react'
import { X, Save, Plus, Trash2 } from 'lucide-react'

interface Narrative {
  id?: string
  theme: string
  target_audience: string
  key_message: string
  arguments: string[]
  proofs: any[]
  tested_phrases: string[]
  usage_count: number
  performance_score: number
  status: 'ativa' | 'rascunho' | 'arquivada'
}

interface NarrativeModalProps {
  narrative: Narrative | null
  onClose: () => void
  onUpdate: () => void
}

const statusOptions = [
  { value: 'ativa', label: 'Ativa' },
  { value: 'rascunho', label: 'Rascunho' },
  { value: 'arquivada', label: 'Arquivada' },
]

const themeOptions = [
  'Saúde',
  'Educação',
  'Segurança',
  'Economia',
  'Infraestrutura',
  'Meio Ambiente',
  'Trabalho',
  'Cultura',
  'Esporte',
  'Tecnologia',
  'Outro',
]

export function NarrativeModal({ narrative, onClose, onUpdate }: NarrativeModalProps) {
  const [formData, setFormData] = useState<Narrative>({
    theme: '',
    target_audience: '',
    key_message: '',
    arguments: [],
    proofs: [],
    tested_phrases: [],
    usage_count: 0,
    performance_score: 0,
    status: 'ativa',
  })
  const [newArgument, setNewArgument] = useState('')
  const [newPhrase, setNewPhrase] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [customTheme, setCustomTheme] = useState('')

  useEffect(() => {
    if (narrative) {
      // Verificar se o tema está na lista de opções padrão
      const isCustomTheme = !themeOptions.includes(narrative.theme)
      setFormData({
        ...narrative,
        theme: isCustomTheme ? 'Outro' : narrative.theme,
        arguments: narrative.arguments || [],
        proofs: narrative.proofs || [],
        tested_phrases: narrative.tested_phrases || [],
      })
      // Se for tema personalizado, preencher o campo customTheme
      if (isCustomTheme) {
        setCustomTheme(narrative.theme)
      } else {
        setCustomTheme('')
      }
    } else {
      setFormData({
        theme: '',
        target_audience: '',
        key_message: '',
        arguments: [],
        proofs: [],
        tested_phrases: [],
        usage_count: 0,
        performance_score: 0,
        status: 'ativa',
      })
      setCustomTheme('')
    }
  }, [narrative])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      // Se o tema for "Outro", usar o tema personalizado digitado
      const themeToSave = formData.theme === 'Outro' && customTheme.trim() 
        ? customTheme.trim() 
        : formData.theme

      if (!themeToSave || themeToSave === 'Outro') {
        alert('Por favor, digite um tema válido ou selecione uma opção da lista')
        setSubmitting(false)
        return
      }

      const url = narrative?.id
        ? `/api/narrativas/${narrative.id}`
        : '/api/narrativas'
      const method = narrative?.id ? 'PUT' : 'POST'

      const dataToSend = {
        ...formData,
        theme: themeToSave,
      }

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSend),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erro ao salvar narrativa')
      }

      onUpdate()
      onClose()
    } catch (error: any) {
      alert(error.message || 'Erro ao salvar narrativa')
    } finally {
      setSubmitting(false)
    }
  }

  const addArgument = () => {
    if (newArgument.trim()) {
      setFormData({
        ...formData,
        arguments: [...formData.arguments, newArgument.trim()],
      })
      setNewArgument('')
    }
  }

  const removeArgument = (index: number) => {
    setFormData({
      ...formData,
      arguments: formData.arguments.filter((_, i) => i !== index),
    })
  }

  const addPhrase = () => {
    if (newPhrase.trim()) {
      setFormData({
        ...formData,
        tested_phrases: [...formData.tested_phrases, newPhrase.trim()],
      })
      setNewPhrase('')
    }
  }

  const removePhrase = (index: number) => {
    setFormData({
      ...formData,
      tested_phrases: formData.tested_phrases.filter((_, i) => i !== index),
    })
  }

  const selectedTheme = formData.theme === 'Outro' ? customTheme : formData.theme

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card shadow-card max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-surface border-b border-card p-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold text-primary">
            {narrative ? 'Editar Narrativa' : 'Nova Narrativa'}
          </h2>
          <button
            onClick={onClose}
            className="p-2 hover:bg-accent-gold-soft rounded-lg transition-colors"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Tema */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Tema *
            </label>
            <select
              value={formData.theme}
              onChange={(e) => setFormData({ ...formData, theme: e.target.value })}
              className="w-full px-4 py-2 bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
              required
            >
              <option value="">Selecione um tema</option>
              {themeOptions.map((theme) => (
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
                className="w-full mt-2 px-4 py-2 bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
                required
              />
            )}
          </div>

          {/* Público-alvo */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Público-alvo *
            </label>
            <input
              type="text"
              value={formData.target_audience}
              onChange={(e) => setFormData({ ...formData, target_audience: e.target.value })}
              placeholder="Ex: Famílias, Jovens, Empresários..."
              className="w-full px-4 py-2 bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
              required
            />
          </div>

          {/* Mensagem-chave */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Mensagem-chave *
            </label>
            <textarea
              value={formData.key_message}
              onChange={(e) => setFormData({ ...formData, key_message: e.target.value })}
              placeholder="A mensagem principal que deve ser transmitida"
              rows={3}
              className="w-full px-4 py-2 bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold resize-none"
              required
            />
          </div>

          {/* Argumentos */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Argumentos
            </label>
            <div className="space-y-2">
              {formData.arguments.map((arg, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-2 bg-background border border-card rounded-lg text-sm">
                    {arg}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeArgument(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newArgument}
                  onChange={(e) => setNewArgument(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addArgument()
                    }
                  }}
                  placeholder="Adicionar argumento"
                  className="flex-1 px-3 py-2 bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold text-sm"
                />
                <button
                  type="button"
                  onClick={addArgument}
                  className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Frases testadas */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Frases testadas
            </label>
            <div className="space-y-2">
              {formData.tested_phrases.map((phrase, index) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="flex-1 px-3 py-2 bg-background border border-card rounded-lg text-sm">
                    {phrase}
                  </span>
                  <button
                    type="button"
                    onClick={() => removePhrase(index)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <div className="flex gap-2">
                <input
                  type="text"
                  value={newPhrase}
                  onChange={(e) => setNewPhrase(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      addPhrase()
                    }
                  }}
                  placeholder="Adicionar frase testada"
                  className="flex-1 px-3 py-2 bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold text-sm"
                />
                <button
                  type="button"
                  onClick={addPhrase}
                  className="px-4 py-2 bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-primary mb-2">
              Status
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
              className="w-full px-4 py-2 bg-background border border-card rounded-lg focus:outline-none focus:ring-2 focus:ring-accent-gold"
            >
              {statusOptions.map((status) => (
                <option key={status.value} value={status.value}>
                  {status.label}
                </option>
              ))}
            </select>
          </div>

          {/* Botões */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-card">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-secondary hover:text-primary transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm font-medium bg-accent-gold text-white rounded-lg hover:bg-accent-gold transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Save className="w-4 h-4" />
              {submitting ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

