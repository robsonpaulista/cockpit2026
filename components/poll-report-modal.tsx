'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  X,
  Upload,
  FileText,
  Loader2,
  Trash2,
  RefreshCw,
  Brain,
  FlaskConical,
  BarChart2,
  UserRound,
  Building2,
  MapPin,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  CheckSquare,
  Users,
  Layers,
} from 'lucide-react'

type PollInfo = {
  id: string
  instituto: string
  candidato_nome: string
  data: string
  cidade?: string
}

type AnalysisSections = {
  methodology?: string | null
  electoralScenario?: string | null
  candidatePerformance?: string | null
  managementEvaluation?: string | null
  voterProfile?: string | null
  cityProblems?: string[] | null
  segmentation?: string[] | null
}

type PollReport = {
  id: string
  poll_id: string
  file_name: string
  file_size?: number | null
  summary?: string | null
  highlights?: string[] | null
  opportunities?: string[] | null
  risks?: string[] | null
  action_plan?: string[] | null
  analysis_sections?: AnalysisSections | null
  analysis_status?: 'processing' | 'completed' | 'failed'
  analysis_error?: string | null
  file_url?: string | null
  updated_at?: string
}

interface PollReportModalProps {
  poll: PollInfo
  onClose: () => void
}

const REQUEST_TIMEOUT_MS = 30000

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

function formatDateOnly(dateValue: string): string {
  if (!dateValue) return '-'
  if (dateValue.includes('T')) {
    return new Date(dateValue).toLocaleDateString('pt-BR')
  }
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
}

function SectionTitle({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="w-4 h-4 text-accent-gold flex-shrink-0" />
      <p className="text-sm font-semibold text-text-primary">{label}</p>
    </div>
  )
}

function BulletList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-secondary italic">{emptyLabel}</p>
  }
  return (
    <ul className="space-y-2">
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`} className="text-xs text-secondary leading-relaxed flex gap-2">
          <span className="text-accent-gold mt-0.5 flex-shrink-0">•</span>
          <span>{item}</span>
        </li>
      ))}
    </ul>
  )
}

function NumberedList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-secondary italic">{emptyLabel}</p>
  }
  return (
    <ol className="space-y-2">
      {items.map((item, idx) => (
        <li key={`${item}-${idx}`} className="text-xs text-secondary leading-relaxed flex gap-2.5">
          <span className="w-5 h-5 rounded-full bg-accent-gold/15 text-accent-gold text-[10px] font-bold flex-shrink-0 flex items-center justify-center mt-0.5">
            {idx + 1}
          </span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  )
}

function TagList({ items, emptyLabel }: { items: string[]; emptyLabel: string }) {
  if (items.length === 0) {
    return <p className="text-xs text-secondary italic">{emptyLabel}</p>
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((item, idx) => (
        <span
          key={`${item}-${idx}`}
          className="px-2.5 py-1 rounded-full bg-background border border-card text-xs text-secondary leading-relaxed"
        >
          {item}
        </span>
      ))}
    </div>
  )
}

export function PollReportModal({ poll, onClose }: PollReportModalProps) {
  const [report, setReport] = useState<PollReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [reprocessing, setReprocessing] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [manualContext, setManualContext] = useState('')

  const hasReport = Boolean(report)
  const highlights = useMemo(() => report?.highlights || [], [report])
  const opportunities = useMemo(() => report?.opportunities || [], [report])
  const risks = useMemo(() => report?.risks || [], [report])
  const actionPlan = useMemo(() => report?.action_plan || [], [report])
  const sections = useMemo<AnalysisSections>(() => report?.analysis_sections || {}, [report])

  const requestJson = async <T,>(url: string, init?: RequestInit): Promise<T> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)

    try {
      const response = await fetch(url, { ...init, signal: controller.signal })
      const data = await response.json()
      if (!response.ok) {
        const message = typeof data?.error === 'string' ? data.error : 'Erro na requisição'
        throw new Error(message)
      }
      return data as T
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        throw new Error('A requisição demorou mais que o esperado. Tente novamente.')
      }
      throw err
    } finally {
      clearTimeout(timeoutId)
    }
  }

  const carregarRelatorio = async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await requestJson<{ report: PollReport | null }>(
        `/api/pesquisa/reports?poll_id=${encodeURIComponent(poll.id)}`
      )
      setReport(data.report || null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao buscar relatório'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    carregarRelatorio()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.id])

  const handleUpload = async () => {
    if (!selectedFile) return
    setUploading(true)
    setError(null)
    try {
      const formData = new FormData()
      formData.append('poll_id', poll.id)
      formData.append('file', selectedFile)
      if (manualContext.trim()) {
        formData.append('manual_context', manualContext.trim())
      }

      const data = await requestJson<{ report: PollReport | null }>('/api/pesquisa/reports', {
        method: 'POST',
        body: formData,
      })
      setReport(data.report || null)
      setSelectedFile(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao enviar PDF'
      setError(message)
    } finally {
      setUploading(false)
    }
  }

  const handleDelete = async () => {
    if (!window.confirm('Deseja remover o PDF e a análise desta pesquisa?')) return
    setDeleting(true)
    setError(null)
    try {
      await requestJson<{ success: boolean }>(`/api/pesquisa/reports?poll_id=${encodeURIComponent(poll.id)}`, {
        method: 'DELETE',
      })
      setReport(null)
      setSelectedFile(null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao excluir relatório'
      setError(message)
    } finally {
      setDeleting(false)
    }
  }

  const handleReprocess = async () => {
    setReprocessing(true)
    setError(null)
    try {
      const data = await requestJson<{ report: PollReport | null }>(
        `/api/pesquisa/reports?poll_id=${encodeURIComponent(poll.id)}`,
        {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          manual_context: manualContext.trim() || undefined,
        }),
        }
      )
      setReport(data.report || null)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao reprocessar análise'
      setError(message)
    } finally {
      setReprocessing(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-surface rounded-2xl border border-card w-full max-w-5xl max-h-[94vh] flex flex-col">
        {/* Header fixo */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-card flex-shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-text-primary">Relatório Interno da Pesquisa</h2>
            <p className="text-xs text-secondary mt-0.5">
              {poll.instituto} • {formatDateOnly(poll.data)} • {poll.cidade || 'Estado'} • {poll.candidato_nome}
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-background transition-colors"
            title="Fechar"
          >
            <X className="w-5 h-5 text-secondary" />
          </button>
        </div>

        {/* Corpo scrollável */}
        <div className="overflow-y-auto flex-1 p-6 space-y-5">
          {error && (
            <div className="p-3 rounded-lg border border-status-error/30 bg-status-error/10 text-sm text-status-error">
              {error}
            </div>
          )}

          {/* Upload */}
          <div className="rounded-xl border border-card p-4">
            <p className="text-sm font-semibold text-text-primary mb-3">Anexar PDF da pesquisa</p>
            <div className="flex flex-col md:flex-row md:items-center gap-3 flex-wrap">
              <input
                type="file"
                accept="application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                className="text-sm text-secondary"
              />
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="px-3 py-2 rounded-lg bg-accent-gold text-white hover:bg-accent-gold/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm inline-flex items-center gap-2"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  {uploading ? 'Processando PDF...' : hasReport ? 'Substituir PDF' : 'Enviar e Analisar'}
                </button>
                <button
                  type="button"
                  onClick={carregarRelatorio}
                  disabled={loading}
                  className="px-3 py-2 rounded-lg border border-card hover:bg-background transition-colors text-sm inline-flex items-center gap-2"
                >
                  <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
                {hasReport && (
                  <button
                    type="button"
                    onClick={handleReprocess}
                    disabled={reprocessing}
                    className="px-3 py-2 rounded-lg border border-card hover:bg-background transition-colors text-sm inline-flex items-center gap-2 disabled:opacity-50"
                    title="Reprocessar análise com IA a partir do PDF atual"
                  >
                    {reprocessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Brain className="w-4 h-4" />}
                    Reanalisar
                  </button>
                )}
                {hasReport && (
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={deleting}
                    className="px-3 py-2 rounded-lg border border-status-error/40 text-status-error hover:bg-status-error/10 transition-colors text-sm inline-flex items-center gap-2 disabled:opacity-50"
                  >
                    {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                    Remover
                  </button>
                )}
              </div>
            </div>
            {selectedFile && (
              <p className="text-xs text-secondary mt-2">
                Selecionado: <strong>{selectedFile.name}</strong> ({formatBytes(selectedFile.size)})
              </p>
            )}
          </div>

          {/* Estados de carregamento / vazio */}
          {loading ? (
            <div className="py-16 flex items-center justify-center gap-2 text-secondary">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando relatório...
            </div>
          ) : !report ? (
            <div className="py-16 text-center rounded-xl border border-dashed border-card">
              <FileText className="w-10 h-10 text-secondary mx-auto mb-3" />
              <p className="text-sm font-medium text-text-primary mb-1">Nenhum PDF anexado</p>
              <p className="text-xs text-secondary">Envie o PDF desta pesquisa para gerar o relatório estratégico.</p>
            </div>
          ) : (
            <div className="space-y-5">
              {/* Barra de arquivo */}
              <div className="rounded-xl border border-card p-3 bg-background flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-text-primary">{report.file_name}</p>
                  <p className="text-xs text-secondary">
                    {formatBytes(report.file_size)} •{' '}
                    {report.analysis_status === 'completed'
                      ? 'Análise concluída'
                      : report.analysis_status === 'failed'
                      ? 'Falha na análise'
                      : 'Processando'}
                    {report.updated_at ? ` • ${new Date(report.updated_at).toLocaleString('pt-BR')}` : ''}
                  </p>
                </div>
                {report.file_url && (
                  <a
                    href={report.file_url}
                    target="_blank"
                    rel="noreferrer"
                    className="px-3 py-2 rounded-lg border border-card hover:bg-surface transition-colors text-sm inline-flex items-center gap-2 w-fit"
                  >
                    <FileText className="w-4 h-4" />
                    Abrir PDF original
                  </a>
                )}
              </div>

              {/* Alerta de análise parcial */}
              {report.analysis_error && (
                <div className="rounded-xl border border-status-warning/40 bg-status-warning/10 p-4 flex gap-3">
                  <AlertTriangle className="w-4 h-4 text-status-warning flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-status-warning mb-0.5">Observação da análise</p>
                    <p className="text-xs text-secondary">{report.analysis_error}</p>
                  </div>
                </div>
              )}

              {/* ─── CENÁRIO ELEITORAL + DESEMPENHO DO CANDIDATO ─── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-card p-4">
                  <SectionTitle icon={BarChart2} label="Cenário Eleitoral" />
                  {sections.electoralScenario ? (
                    <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">
                      {sections.electoralScenario}
                    </p>
                  ) : (
                    <p className="text-xs text-secondary italic">Dados não identificados no PDF.</p>
                  )}
                </div>

                <div className="rounded-xl border border-card p-4">
                  <SectionTitle icon={TrendingUp} label="Desempenho do Candidato" />
                  {sections.candidatePerformance ? (
                    <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">
                      {sections.candidatePerformance}
                    </p>
                  ) : (
                    <p className="text-xs text-secondary italic">Dados não identificados no PDF.</p>
                  )}
                </div>
              </div>

              {/* ─── AVALIAÇÃO DE GESTÃO + PERFIL DO ELEITORADO ─── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-card p-4">
                  <SectionTitle icon={Building2} label="Avaliação da Gestão" />
                  {sections.managementEvaluation ? (
                    <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">
                      {sections.managementEvaluation}
                    </p>
                  ) : (
                    <p className="text-xs text-secondary italic">Dados não identificados no PDF.</p>
                  )}
                </div>

                <div className="rounded-xl border border-card p-4">
                  <SectionTitle icon={Users} label="Perfil do Eleitorado" />
                  {sections.voterProfile ? (
                    <p className="text-xs text-secondary leading-relaxed whitespace-pre-line">
                      {sections.voterProfile}
                    </p>
                  ) : (
                    <p className="text-xs text-secondary italic">Dados não identificados no PDF.</p>
                  )}
                </div>
              </div>

              {/* ─── PROBLEMAS DA CIDADE ─── */}
              {(sections.cityProblems?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-card p-4">
                  <SectionTitle icon={MapPin} label="Principais Problemas da Cidade" />
                  <TagList
                    items={sections.cityProblems || []}
                    emptyLabel="Nenhum problema identificado no PDF."
                  />
                </div>
              )}

              {/* ─── SEGMENTAÇÃO ESTRATÉGICA ─── */}
              {(sections.segmentation?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-card p-4">
                  <SectionTitle icon={Layers} label="Segmentação Estratégica" />
                  <BulletList
                    items={sections.segmentation || []}
                    emptyLabel="Nenhuma segmentação identificada no PDF."
                  />
                </div>
              )}

              {/* ─── PRINCIPAIS INDICADORES ─── */}
              <div className="rounded-xl border border-card p-4">
                <SectionTitle icon={FlaskConical} label="Principais Indicadores Estratégicos" />
                <BulletList items={highlights} emptyLabel="Sem indicadores identificados." />
              </div>

              {/* ─── OPORTUNIDADES + RISCOS ─── */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
                  <SectionTitle icon={Lightbulb} label="Oportunidades" />
                  <BulletList items={opportunities} emptyLabel="Nenhuma oportunidade identificada." />
                </div>

                <div className="rounded-xl border border-status-error/20 bg-status-error/5 p-4">
                  <SectionTitle icon={AlertTriangle} label="Riscos" />
                  <BulletList items={risks} emptyLabel="Nenhum risco identificado." />
                </div>
              </div>

              {/* ─── PLANO DE AÇÃO ─── */}
              <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4">
                <SectionTitle icon={CheckSquare} label="Plano de Ação" />
                <NumberedList items={actionPlan} emptyLabel="Nenhum plano gerado." />
              </div>

              {/* ─── METODOLOGIA ─── */}
              {sections.methodology && (
                <div className="rounded-xl border border-card p-4">
                  <SectionTitle icon={UserRound} label="Metodologia da Pesquisa" />
                  <p className="text-xs text-secondary leading-relaxed">{sections.methodology}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
