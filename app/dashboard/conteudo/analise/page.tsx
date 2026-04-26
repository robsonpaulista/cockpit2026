'use client'

import { useEffect, useState } from 'react'
import { ConteudoPresencaNav } from '@/components/conteudo-presenca-nav'
import { BarChart3, Loader2 } from 'lucide-react'

interface AnalisePayload {
  resumo: {
    publicacoes: number
    engajamento_total: number
    melhor_cidade: { chave: string; engajamento: number } | null
    melhor_territorio: { chave: string; engajamento: number } | null
    melhor_template: { chave: string; engajamento: number } | null
    obras_sem_conteudo_publicado: number
    agendas_sem_conteudo: number
  }
  por_cidade: Array<{ cidade: string; count: number; eng: number; ultima_coleta: string | null }>
  por_territorio: Array<{ territorio: string; count: number; eng: number; ultima_coleta: string | null }>
  por_template: Array<{ template: string; count: number; eng: number; ultima_coleta: string | null }>
  por_tipo_obra: Array<{ tipo_obra: string; count: number; eng: number; ultima_coleta: string | null }>
  publicacoes_recentes: Array<{
    id: string
    plataforma: string | null
    link: string | null
    views: number | null
    likes: number | null
    comentarios: number | null
    compartilhamentos: number | null
    data_coleta: string
    conteudos_planejados: {
      cidade?: string | null
      template?: string | null
    } | null
  }>
  insights: string[]
}

export default function ConteudoAnalisePage() {
  const [data, setData] = useState<AnalisePayload | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/conteudo/analise')
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || 'Erro')
        }
        return r.json() as Promise<AnalisePayload>
      })
      .then(setData)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <h1 className="text-xl font-bold text-text-primary flex items-center gap-2 mb-1">
        <BarChart3 className="h-6 w-6 text-accent-gold" />
        Análise de conteúdo
      </h1>
      <p className="text-sm text-text-secondary mb-4">
        Métricas são inseridas manualmente na publicação; cada número deve ser lido junto da{' '}
        <strong>data de coleta</strong>.
      </p>
      <ConteudoPresencaNav />

      {loading && <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />}
      {error && <p className="text-status-danger text-sm">{error}</p>}

      {data && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            <div className="rounded-xl border border-border-card bg-bg-surface p-4">
              <p className="text-xs text-text-secondary uppercase">Publicações</p>
              <p className="text-3xl font-bold text-text-primary">{data.resumo.publicacoes}</p>
            </div>
            <div className="rounded-xl border border-border-card bg-bg-surface p-4">
              <p className="text-xs text-text-secondary uppercase">Engajamento total (soma)</p>
              <p className="text-3xl font-bold text-text-primary">{data.resumo.engajamento_total}</p>
            </div>
            <div className="rounded-xl border border-border-card bg-bg-surface p-4">
              <p className="text-xs text-text-secondary uppercase">Obras sem publicação</p>
              <p className="text-3xl font-bold text-text-primary">{data.resumo.obras_sem_conteudo_publicado}</p>
            </div>
            <div className="rounded-xl border border-border-card bg-bg-surface p-4">
              <p className="text-xs text-text-secondary uppercase">Agendas sem conteúdo</p>
              <p className="text-3xl font-bold text-text-primary">{data.resumo.agendas_sem_conteudo}</p>
            </div>
            {data.resumo.melhor_cidade && (
              <div className="rounded-xl border border-border-card bg-bg-surface p-4">
                <p className="text-xs text-text-secondary uppercase">Cidade (engajamento)</p>
                <p className="text-lg font-semibold text-text-primary">{data.resumo.melhor_cidade.chave}</p>
                <p className="text-sm text-text-secondary">{data.resumo.melhor_cidade.engajamento} pts</p>
              </div>
            )}
            {data.resumo.melhor_template && (
              <div className="rounded-xl border border-border-card bg-bg-surface p-4">
                <p className="text-xs text-text-secondary uppercase">Template</p>
                <p className="text-lg font-semibold text-text-primary">{data.resumo.melhor_template.chave}</p>
                <p className="text-sm text-text-secondary">{data.resumo.melhor_template.engajamento} pts</p>
              </div>
            )}
          </div>

          {data.insights.length > 0 && (
            <section className="mb-8 rounded-xl border border-dashed border-border-card p-4 bg-bg-surface">
              <h2 className="font-semibold text-text-primary mb-2">Insights (neutros)</h2>
              <ul className="list-disc pl-5 text-sm text-text-secondary space-y-1">
                {data.insights.map((t, i) => (
                  <li key={i}>{t}</li>
                ))}
              </ul>
            </section>
          )}

          <div className="grid lg:grid-cols-2 gap-6 mb-8">
            <TableBlock title="Por cidade" rows={data.por_cidade.map((r) => ({ ...r, key: r.cidade }))} />
            <TableBlock title="Por território" rows={data.por_territorio.map((r) => ({ ...r, key: r.territorio }))} />
            <TableBlock title="Por template" rows={data.por_template.map((r) => ({ ...r, key: r.template }))} />
            <TableBlock title="Por tipo de obra" rows={data.por_tipo_obra.map((r) => ({ ...r, key: r.tipo_obra }))} />
          </div>

          <section className="rounded-xl border border-border-card overflow-hidden">
            <h2 className="font-semibold p-4 bg-bg-page border-b border-border-card">Publicações recentes</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-text-secondary bg-bg-surface">
                  <tr>
                    <th className="p-2">Cidade</th>
                    <th className="p-2">Template</th>
                    <th className="p-2">Plataforma</th>
                    <th className="p-2">Views</th>
                    <th className="p-2">Likes</th>
                    <th className="p-2">Coleta</th>
                  </tr>
                </thead>
                <tbody>
                  {data.publicacoes_recentes.map((p) => (
                    <tr key={p.id} className="border-t border-border-card">
                      <td className="p-2">{p.conteudos_planejados?.cidade ?? '—'}</td>
                      <td className="p-2">{p.conteudos_planejados?.template ?? '—'}</td>
                      <td className="p-2">{p.plataforma}</td>
                      <td className="p-2 tabular-nums">{p.views ?? '—'}</td>
                      <td className="p-2 tabular-nums">{p.likes ?? '—'}</td>
                      <td className="p-2 text-xs text-text-secondary">{p.data_coleta}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}

function TableBlock({
  title,
  rows,
}: {
  title: string
  rows: Array<{ key: string; count: number; eng: number; ultima_coleta: string | null }>
}) {
  return (
    <section className="rounded-xl border border-border-card overflow-hidden">
      <h3 className="font-semibold p-3 bg-bg-page border-b border-border-card text-sm">{title}</h3>
      <table className="w-full text-sm">
        <thead className="text-left text-text-secondary">
          <tr>
            <th className="p-2">Chave</th>
            <th className="p-2">Qtd</th>
            <th className="p-2">Eng.</th>
            <th className="p-2">Última coleta</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-t border-border-card">
              <td className="p-2 max-w-[140px] truncate">{r.key}</td>
              <td className="p-2 tabular-nums">{r.count}</td>
              <td className="p-2 tabular-nums">{r.eng}</td>
              <td className="p-2 text-xs text-text-secondary">{r.ultima_coleta ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}
