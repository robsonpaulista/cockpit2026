'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'

type ApiPayload = {
  scope: 'total_geral'
  cenarioPrincipal: { id: string; nome: string }
  resultados2018: { nome: string; votos: number }[]
  resultados2022: { nome: string; votos: number }[]
  previsao2026: { nome: string; votos: number }[]
}

interface ResumoEleicoesHistoricoModalProps {
  isOpen: boolean
  onClose: () => void
}

function toTopRows(rows: Array<{ nome: string; votos: number }>, limit = 30) {
  return rows.slice(0, limit)
}

export function ResumoEleicoesHistoricoModal({
  isOpen,
  onClose,
}: ResumoEleicoesHistoricoModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [apiData, setApiData] = useState<ApiPayload | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await fetch('/api/resumo-eleicoes/historico-federal')
        const json = (await res.json()) as ApiPayload & { error?: string }
        if (!res.ok) throw new Error(json.error || 'Erro ao carregar histórico')
        if (!active) return
        setApiData(json)
      } catch (e) {
        if (!active) return
        setError(e instanceof Error ? e.message : 'Erro ao carregar histórico')
      } finally {
        if (active) setLoading(false)
      }
    }
    load()
    return () => {
      active = false
    }
  }, [isOpen])

  const resultados2018 = useMemo(() => toTopRows(apiData?.resultados2018 ?? []), [apiData])
  const resultados2022 = useMemo(() => toTopRows(apiData?.resultados2022 ?? []), [apiData])
  const previsao2026 = useMemo(() => toTopRows(apiData?.previsao2026 ?? []), [apiData])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl border border-card bg-surface">
        <div className="flex items-center justify-between border-b border-card px-5 py-4">
          <div>
            <h3 className="text-base font-semibold text-text-primary">Histórico</h3>
            <p className="mt-0.5 text-xs text-secondary">
              Federal 2018 x Federal 2022 x Cenário Principal
            </p>
          </div>
          <button onClick={onClose} className="rounded-lg p-2 hover:bg-background" title="Fechar">
            <X className="h-4 w-4 text-secondary" />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto p-5">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-14 text-secondary">
              <Loader2 className="h-5 w-5 animate-spin" />
              Carregando histórico...
            </div>
          ) : error ? (
            <div className="rounded-lg border border-status-error/30 bg-status-error/10 p-3 text-sm text-status-error">
              {error}
            </div>
          ) : !apiData ? (
            <div className="rounded-lg border border-dashed border-card p-4 text-sm text-secondary">
              Sem dados para exibir.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-card bg-background p-3 text-xs text-secondary">
                <strong className="text-text-primary">Escopo:</strong> Total geral (sem filtro de cidade)
                <span className="mx-2">|</span>
                <strong className="text-text-primary">Cenário principal:</strong>{' '}
                {apiData.cenarioPrincipal.nome}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {[
                  { title: 'Resultado 2018', data: resultados2018, accent: 'text-text-primary' },
                  { title: 'Resultado 2022', data: resultados2022, accent: 'text-text-primary' },
                  { title: 'Previsão 2026', data: previsao2026, accent: 'text-accent-gold' },
                ].map((section) => (
                  <div key={section.title} className="overflow-hidden rounded-xl border border-card">
                    <div className="border-b border-card bg-background px-3 py-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                      {section.title}
                    </div>
                    <div className="max-h-[55vh] overflow-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left text-xs uppercase tracking-wide text-secondary">
                            <th className="px-3 py-2">Candidato</th>
                            <th className="px-3 py-2 text-right">Votos</th>
                          </tr>
                        </thead>
                        <tbody>
                          {section.data.map((item) => (
                            <tr key={`${section.title}-${item.nome}`} className="border-t border-card">
                              <td className="px-3 py-2 font-medium text-text-primary">{item.nome}</td>
                              <td className={`px-3 py-2 text-right font-semibold ${section.accent}`}>
                                {item.votos.toLocaleString('pt-BR')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

