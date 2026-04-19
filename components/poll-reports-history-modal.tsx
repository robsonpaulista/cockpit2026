'use client'

import { useEffect, useMemo, useState } from 'react'
import { X, Loader2, FileText, BarChart3, Brain } from 'lucide-react'
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'
import { PollReportModal } from '@/components/poll-report-modal'

type PollSummaryItem = {
  poll: {
    id: string
    data: string
    instituto: string
    candidato_nome: string
    intencao: number
    rejeicao: number
    cidade_id: string | null
    cidade_nome: string | null
  }
  report: {
    id: string
    poll_id: string
    file_name: string
    file_size: number | null
    file_url: string | null
    analysis_status: 'processing' | 'completed' | 'failed' | null
    updated_at: string | null
    summary: string | null
  } | null
}

interface PollReportsHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  cidadeNome: string
  cidadeId: string | null
}

function formatDateOnly(dateValue: string): string {
  if (!dateValue) return '-'
  if (dateValue.includes('T')) return new Date(dateValue).toLocaleDateString('pt-BR')
  const [year, month, day] = dateValue.split('-').map(Number)
  return new Date(year, month - 1, day).toLocaleDateString('pt-BR')
}

function formatBytes(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return '-'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

export function PollReportsHistoryModal({
  isOpen,
  onClose,
  cidadeNome,
  cidadeId,
}: PollReportsHistoryModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [items, setItems] = useState<PollSummaryItem[]>([])
  const [pollParaRelatorio, setPollParaRelatorio] = useState<PollSummaryItem['poll'] | null>(null)

  useEffect(() => {
    if (!isOpen || !cidadeId) return

    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const params = new URLSearchParams()
        params.set('cidade_id', cidadeId)
        params.set('limit', '120')

        const response = await fetch(`/api/pesquisa/reports/history?${params.toString()}`)
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || 'Erro ao buscar histórico de relatórios')
        }
        if (!active) return
        const list = Array.isArray(data.items) ? (data.items as PollSummaryItem[]) : []
        setItems(list.filter((item) => item.poll))
      } catch (err) {
        if (!active) return
        const message = err instanceof Error ? err.message : 'Erro ao buscar histórico de relatórios'
        setError(message)
      } finally {
        if (active) setLoading(false)
      }
    }

    load()
    return () => {
      active = false
    }
  }, [isOpen, cidadeId])

  const candidateKeys = useMemo(() => {
    const names = Array.from(new Set(items.map((item) => item.poll.candidato_nome).filter(Boolean)))
    return names.map((name) => ({
      name,
      key: `cand_${name.replace(/\s+/g, '_')}`,
    }))
  }, [items])

  const chartData = useMemo(() => {
    const byDate = new Map<string, Record<string, string | number | null>>()
    items.forEach((item) => {
      const iso = item.poll.data.includes('T') ? item.poll.data.split('T')[0] : item.poll.data
      const candidateKey = `cand_${item.poll.candidato_nome.replace(/\s+/g, '_')}`
      if (!byDate.has(iso)) {
        byDate.set(iso, {
          data: formatDateOnly(iso),
          dataIso: iso,
        })
      }
      const row = byDate.get(iso)
      if (row) {
        row[candidateKey] = Number(item.poll.intencao || 0)
      }
    })
    return Array.from(byDate.values()).sort((a, b) => {
      const da = String(a.dataIso || '')
      const db = String(b.dataIso || '')
      return da.localeCompare(db)
    })
  }, [items])

  const indicadores = useMemo(() => {
    if (items.length === 0) {
      return {
        total: 0,
        mediaIntencao: 0,
        mediaRejeicao: 0,
        comPdf: 0,
      }
    }
    const mediaIntencao = items.reduce((sum, item) => sum + Number(item.poll.intencao || 0), 0) / items.length
    const mediaRejeicao = items.reduce((sum, item) => sum + Number(item.poll.rejeicao || 0), 0) / items.length
    const comPdf = items.filter((item) => Boolean(item.report)).length
    return {
      total: items.length,
      mediaIntencao,
      mediaRejeicao,
      comPdf,
    }
  }, [items])

  const registrosComPdf = useMemo(() => {
    return [...items]
      .filter((item) => Boolean(item.report))
      .sort((a, b) => (a.poll.data > b.poll.data ? -1 : 1))
  }, [items])

  const colors = ['#C49A2C', '#2563EB', '#DC2626', '#059669', '#8B5CF6', '#D97706', '#0F766E', '#4F46E5']

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="w-full max-w-6xl max-h-[92vh] bg-surface rounded-2xl border border-card flex flex-col overflow-hidden">
        <div className="px-5 py-4 border-b border-card flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Histórico de pesquisas do município</h3>
            <p className="text-xs text-secondary mt-0.5">{cidadeNome}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-background transition-colors" title="Fechar">
            <X className="w-4 h-4 text-secondary" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {loading ? (
            <div className="py-14 flex items-center justify-center gap-2 text-secondary">
              <Loader2 className="w-5 h-5 animate-spin" />
              Carregando histórico...
            </div>
          ) : error ? (
            <div className="p-3 rounded-lg border border-status-error/30 bg-status-error/10 text-sm text-status-error">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="p-6 rounded-xl border border-dashed border-card text-center">
              <p className="text-sm text-secondary">Nenhuma pesquisa encontrada para esta cidade.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="rounded-xl border border-card p-3 bg-background">
                  <p className="text-xs text-secondary">Total de pesquisas</p>
                  <p className="text-xl font-bold text-text-primary">{indicadores.total}</p>
                  <p className="text-[11px] text-secondary mt-0.5">Com PDF: {indicadores.comPdf}</p>
                </div>
                <div className="rounded-xl border border-card p-3 bg-background">
                  <p className="text-xs text-secondary">Média intenção</p>
                  <p className="text-xl font-bold text-accent-gold">{indicadores.mediaIntencao.toFixed(1)}%</p>
                </div>
                <div className="rounded-xl border border-card p-3 bg-background">
                  <p className="text-xs text-secondary">Média rejeição</p>
                  <p className="text-xl font-bold text-status-error">{indicadores.mediaRejeicao.toFixed(1)}%</p>
                </div>
              </div>

              <div className="rounded-xl border border-card p-4">
                <div className="flex items-center gap-2 mb-3">
                  <BarChart3 className="w-4 h-4 text-accent-gold" />
                  <p className="text-sm font-semibold text-text-primary">Tendência temporal de intenção (todos candidatos)</p>
                </div>
                <div className="h-[280px] bg-white rounded-lg">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgb(var(--border-card))" />
                      <XAxis dataKey="data" angle={-35} textAnchor="end" height={55} fontSize={11} />
                      <YAxis domain={[0, 100]} fontSize={11} />
                      <Tooltip />
                      {candidateKeys.map((candidate, idx) => (
                        <Line
                          key={candidate.key}
                          type="monotone"
                          dataKey={candidate.key}
                          name={candidate.name}
                          stroke={colors[idx % colors.length]}
                          strokeWidth={2.2}
                          dot={{ r: 3 }}
                        />
                      ))}
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="rounded-xl border border-card overflow-hidden">
                <div className="px-4 py-3 bg-background border-b border-card">
                  <p className="text-sm font-semibold text-text-primary">Registro sintético</p>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-card">
                        <th className="text-left py-2 px-3">Data</th>
                        <th className="text-left py-2 px-3">Instituto</th>
                        <th className="text-left py-2 px-3">Candidato</th>
                        <th className="text-right py-2 px-3">Intenção</th>
                        <th className="text-right py-2 px-3">Rejeição</th>
                        <th className="text-left py-2 px-3">Arquivo/PDF</th>
                        <th className="text-center py-2 px-3">Ações</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registrosComPdf.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="py-4 px-3 text-center text-secondary">
                            Nenhum registro com PDF encontrado.
                          </td>
                        </tr>
                      ) : (
                        registrosComPdf.map((item) => (
                          <tr key={item.poll.id} className="border-b border-card">
                            <td className="py-2 px-3 text-text-primary">{formatDateOnly(item.poll.data || '')}</td>
                            <td className="py-2 px-3 text-text-primary">{item.poll.instituto || '-'}</td>
                            <td className="py-2 px-3 text-text-primary">{item.poll.candidato_nome || '-'}</td>
                            <td className="py-2 px-3 text-right font-semibold text-accent-gold">
                              {Number(item.poll.intencao || 0).toFixed(1)}%
                            </td>
                            <td className="py-2 px-3 text-right font-semibold text-status-error">
                              {Number(item.poll.rejeicao || 0).toFixed(1)}%
                            </td>
                            <td className="py-2 px-3 text-text-primary">
                              <div className="flex flex-col">
                                <span>{item.report?.file_name || '-'}</span>
                                <span className="text-[10px] text-secondary">{formatBytes(item.report?.file_size || null)}</span>
                              </div>
                            </td>
                            <td className="py-2 px-3">
                              <div className="flex items-center justify-center gap-2">
                                {item.report?.file_url && (
                                  <a
                                    href={item.report.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="px-2 py-1 rounded border border-card hover:bg-surface inline-flex items-center gap-1"
                                    title="Abrir PDF"
                                  >
                                    <FileText className="w-3.5 h-3.5" />
                                    PDF
                                  </a>
                                )}
                                <button
                                  type="button"
                                  onClick={() => setPollParaRelatorio(item.poll)}
                                  className="px-2 py-1 rounded border border-card hover:bg-surface inline-flex items-center gap-1"
                                  title="Abrir análise desta pesquisa"
                                >
                                  <Brain className="w-3.5 h-3.5" />
                                  Análise
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
      {pollParaRelatorio && (
        <PollReportModal
          poll={{
            id: pollParaRelatorio.id,
            instituto: pollParaRelatorio.instituto,
            candidato_nome: pollParaRelatorio.candidato_nome,
            data: pollParaRelatorio.data,
            cidade: pollParaRelatorio.cidade_nome || undefined,
          }}
          onClose={() => setPollParaRelatorio(null)}
        />
      )}
    </div>
  )
}

