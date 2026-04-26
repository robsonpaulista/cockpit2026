'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Building2, Calendar, ImageIcon, LayoutGrid, Megaphone, Share2, Sparkles, type LucideIcon } from 'lucide-react'
import { ConteudoPresencaNav } from '@/components/conteudo-presenca-nav'
import { formatDate } from '@/lib/utils'
import { gerarMensagemWhatsApp } from '@/lib/conteudo/whatsapp-msg'

interface StatsResponse {
  kpis: {
    obras_cadastradas: number
    agendas_futuras: number
    conteudos_planejados: number
    cards_gerados: number
    cards_aprovados: number
    conteudos_publicados: number
  }
  proximas_agendas: Array<{
    id: string
    date: string
    type: string
    cities?: { name: string; state: string }
  }>
  cards_recentes: Array<{
    id: string
    cidade: string | null
    template: string | null
    status: string
    texto_arte: string | null
    created_at: string
  }>
  conteudos_distribuicao: Array<{
    id: string
    cidade: string | null
    titulo: string | null
    imagem_url: string | null
    legenda: string | null
  }>
}

function MiniKpi({ label, value, icon: Icon }: { label: string; value: number; icon: LucideIcon }) {
  return (
    <div className="rounded-xl border border-border-card bg-bg-surface p-4 shadow-card flex items-center gap-3">
      <div className="rounded-lg bg-accent-gold-soft p-2 text-accent-gold">
        <Icon className="h-5 w-5" />
      </div>
      <div>
        <p className="text-xs text-text-secondary font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-text-primary tabular-nums">{value.toLocaleString('pt-BR')}</p>
      </div>
    </div>
  )
}

export default function ConteudoPresencaHubPage() {
  const [data, setData] = useState<StatsResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    fetch('/api/conteudo/stats')
      .then(async (r) => {
        if (!r.ok) {
          const j = await r.json().catch(() => ({}))
          throw new Error(j.error || 'Falha ao carregar')
        }
        return r.json() as Promise<StatsResponse>
      })
      .then((d) => {
        if (!cancelled) setData(d)
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto">
      <div className="mb-2 flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-accent-gold" />
            Presença & Conteúdo
          </h1>
          <p className="text-text-secondary text-sm mt-1">
            Obras, agenda de campo, cards automáticos e análise de publicações.
          </p>
        </div>
      </div>

      <ConteudoPresencaNav />

      {loading && (
        <p className="text-text-secondary text-sm animate-pulse">Carregando indicadores…</p>
      )}
      {error && (
        <div className="rounded-lg border border-status-danger/40 bg-status-danger/10 text-status-danger px-4 py-3 text-sm">
          {error}
          <p className="mt-2 text-text-secondary text-xs">
            Execute a migração SQL em `database/add-conteudo-presenca-module.sql` no Supabase se ainda não rodou.
          </p>
        </div>
      )}

      {data && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3 md:gap-4 mb-8">
            <MiniKpi label="Obras" value={data.kpis.obras_cadastradas} icon={Building2} />
            <MiniKpi label="Agendas futuras" value={data.kpis.agendas_futuras} icon={Calendar} />
            <MiniKpi label="Planejados" value={data.kpis.conteudos_planejados} icon={LayoutGrid} />
            <MiniKpi label="Cards gerados" value={data.kpis.cards_gerados} icon={ImageIcon} />
            <MiniKpi label="Aprovados" value={data.kpis.cards_aprovados} icon={Share2} />
            <MiniKpi label="Publicados" value={data.kpis.conteudos_publicados} icon={Megaphone} />
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <section className="rounded-xl border border-border-card bg-bg-surface p-4 shadow-card">
              <h2 className="font-semibold text-text-primary mb-3 flex items-center gap-2">
                <Calendar className="h-4 w-4 text-accent-gold" />
                Próximas agendas
              </h2>
              <ul className="space-y-2 text-sm">
                {(data.proximas_agendas ?? []).length === 0 && (
                  <li className="text-text-secondary">Nenhuma agenda futura.</li>
                )}
                {(data.proximas_agendas ?? []).map((a) => (
                  <li key={a.id} className="flex justify-between gap-2 border-b border-border-card/60 pb-2">
                    <span className="text-text-primary">
                      {a.cities ? `${a.cities.name} (${a.cities.state})` : '—'}
                    </span>
                    <span className="text-text-secondary shrink-0">
                      {formatDate(a.date)} · {a.type}
                    </span>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/conteudo/agenda"
                className="inline-block mt-3 text-sm text-accent-gold font-medium hover:underline"
              >
                Gerenciar agenda
              </Link>
            </section>

            <section className="rounded-xl border border-border-card bg-bg-surface p-4 shadow-card">
              <h2 className="font-semibold text-text-primary mb-3">Cards recentes</h2>
              <ul className="space-y-2 text-sm">
                {(data.cards_recentes ?? []).length === 0 && (
                  <li className="text-text-secondary">Nenhum conteúdo ainda.</li>
                )}
                {(data.cards_recentes ?? []).map((c) => (
                  <li key={c.id} className="border-b border-border-card/60 pb-2">
                    <span className="text-text-primary font-medium">{c.cidade ?? '—'}</span>
                    <span className="text-text-secondary"> · {c.template}</span>
                    <span className="block text-xs text-text-secondary truncate">{c.texto_arte}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/dashboard/conteudo/cards"
                className="inline-block mt-3 text-sm text-accent-gold font-medium hover:underline"
              >
                Abrir revisão de cards
              </Link>
            </section>

            <section className="md:col-span-2 rounded-xl border border-border-card bg-bg-surface p-4 shadow-card">
              <h2 className="font-semibold text-text-primary mb-3">Conteúdos para distribuição (campanha geral)</h2>
              <p className="text-xs text-text-secondary mb-4">
                Itens com <code className="bg-bg-page px-1 rounded">campanha_geral</code> e imagem aprovada. Copie a
                mensagem para o WhatsApp.
              </p>
              <ul className="space-y-4">
                {(data.conteudos_distribuicao ?? []).length === 0 && (
                  <li className="text-text-secondary text-sm">Nenhum item marcado para campanha geral.</li>
                )}
                {(data.conteudos_distribuicao ?? []).map((c) => (
                  <li key={c.id} className="rounded-lg border border-border-card p-3 bg-bg-page">
                    <p className="text-sm font-medium text-text-primary">{c.titulo || c.cidade}</p>
                    <pre className="mt-2 text-xs whitespace-pre-wrap bg-bg-surface p-2 rounded border border-border-card text-text-secondary max-h-40 overflow-auto">
                      {gerarMensagemWhatsApp({ cidade: c.cidade, imagem_url: c.imagem_url })}
                    </pre>
                  </li>
                ))}
              </ul>
            </section>

            <section className="md:col-span-2 rounded-xl border border-dashed border-border-card p-4 text-sm text-text-secondary">
              <strong className="text-text-primary">Análise por território:</strong> use a página{' '}
              <Link href="/dashboard/conteudo/analise" className="text-accent-gold font-medium hover:underline">
                Análise
              </Link>{' '}
              para consolidar publicações e métricas manuais (sempre com data de coleta).
            </section>
          </div>
        </>
      )}
    </div>
  )
}
