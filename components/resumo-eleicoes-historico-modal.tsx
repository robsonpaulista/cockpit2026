'use client'

import { useEffect, useMemo, useState } from 'react'
import { Loader2, X } from 'lucide-react'

type ResultadoItem = { nome: string; votos: number; partido: string | null }
type ResumoMeta = { totalVotos: number; totalCandidatos: number; partidos: string[] }

type ApiPayload = {
  scope: 'total_geral'
  cenarioPrincipal: { id: string; nome: string }
  resultados2018: ResultadoItem[]
  resultados2022: ResultadoItem[]
  previsao2026: ResultadoItem[]
  resumo2018: ResumoMeta
  resumo2022: ResumoMeta
  resumo2026: ResumoMeta
}

interface ResumoEleicoesHistoricoModalProps {
  isOpen: boolean
  onClose: () => void
}

const STATIC_CACHE_KEY = 'historico_federal_static_v1'

type StaticPayload = Pick<ApiPayload, 'scope' | 'resultados2018' | 'resultados2022' | 'resumo2018' | 'resumo2022'>
type PrevisaoPayload = Pick<ApiPayload, 'scope' | 'cenarioPrincipal' | 'previsao2026' | 'resumo2026'>

export function ResumoEleicoesHistoricoModal({
  isOpen,
  onClose,
}: ResumoEleicoesHistoricoModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [staticData, setStaticData] = useState<StaticPayload | null>(null)
  const [previsaoData, setPrevisaoData] = useState<PrevisaoPayload | null>(null)

  useEffect(() => {
    if (!isOpen) return
    let active = true
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        let staticPayload: StaticPayload | null = null
        if (typeof window !== 'undefined') {
          const cached = window.localStorage.getItem(STATIC_CACHE_KEY)
          if (cached) {
            try {
              staticPayload = JSON.parse(cached) as StaticPayload
            } catch {
              window.localStorage.removeItem(STATIC_CACHE_KEY)
            }
          }
        }

        if (!staticPayload) {
          const staticRes = await fetch('/api/resumo-eleicoes/historico-federal?section=static')
          const staticJson = (await staticRes.json()) as StaticPayload & { error?: string }
          if (!staticRes.ok) throw new Error(staticJson.error || 'Erro ao carregar base histórica')
          staticPayload = staticJson
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(STATIC_CACHE_KEY, JSON.stringify(staticPayload))
          }
        }

        const previsaoRes = await fetch('/api/resumo-eleicoes/historico-federal?section=previsao', {
          cache: 'no-store',
        })
        const previsaoJson = (await previsaoRes.json()) as PrevisaoPayload & { error?: string }
        if (!previsaoRes.ok) throw new Error(previsaoJson.error || 'Erro ao carregar previsão 2026')

        if (!active) return
        setStaticData(staticPayload)
        setPrevisaoData(previsaoJson)
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

  const resultados2018 = useMemo(() => staticData?.resultados2018 ?? [], [staticData])
  const resultados2022 = useMemo(() => staticData?.resultados2022 ?? [], [staticData])
  const previsao2026 = useMemo(() => previsaoData?.previsao2026 ?? [], [previsaoData])

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
          ) : !staticData || !previsaoData ? (
            <div className="rounded-lg border border-dashed border-card p-4 text-sm text-secondary">
              Sem dados para exibir.
            </div>
          ) : (
            <>
              <div className="rounded-xl border border-card bg-background p-3 text-xs text-secondary">
                <strong className="text-text-primary">Escopo:</strong> Total geral (sem filtro de cidade)
                <span className="mx-2">|</span>
                <strong className="text-text-primary">Cenário principal:</strong>{' '}
                {previsaoData.cenarioPrincipal.nome}
              </div>

              <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
                {[
                  {
                    title: 'Resultado 2018',
                    data: resultados2018,
                    accent: 'text-text-primary',
                    meta: staticData.resumo2018,
                  },
                  {
                    title: 'Resultado 2022',
                    data: resultados2022,
                    accent: 'text-text-primary',
                    meta: staticData.resumo2022,
                  },
                  {
                    title: 'Previsão 2026',
                    data: previsao2026,
                    accent: 'text-accent-gold',
                    meta: previsaoData.resumo2026,
                  },
                ].map((section) => (
                  <div key={section.title} className="overflow-hidden rounded-xl border border-card">
                    <div className="border-b border-card bg-background px-3 py-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                      {section.title}
                    </div>
                    <div className="border-b border-card bg-surface px-3 py-2 text-[11px] text-text-secondary">
                      <span className="font-semibold text-text-primary">
                        {section.meta.totalCandidatos.toLocaleString('pt-BR')}
                      </span>{' '}
                      candidatos
                      <span className="mx-2">|</span>
                      Total de votos:{' '}
                      <span className="font-semibold text-text-primary">
                        {section.meta.totalVotos.toLocaleString('pt-BR')}
                      </span>
                      <div className="mt-1 truncate">
                        Partidos:{' '}
                        <span className="font-medium text-text-primary">
                          {section.meta.partidos.length > 0 ? section.meta.partidos.join(', ') : 'N/D'}
                        </span>
                      </div>
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

