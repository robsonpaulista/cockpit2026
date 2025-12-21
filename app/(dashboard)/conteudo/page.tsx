'use client'

import { Header } from '@/components/header'
import { KPICard } from '@/components/kpi-card'
import { MessageSquare, TrendingUp, Users, Share2, Play } from 'lucide-react'
import { KPI } from '@/types'

const conteudoKPIs: KPI[] = [
  {
    id: 'engajamento',
    label: 'Engajamento Útil',
    value: '12.4K',
    variation: 8.2,
    status: 'success',
  },
  {
    id: 'retencao',
    label: 'Retenção de Vídeo',
    value: '68%',
    variation: 5.1,
    status: 'success',
  },
  {
    id: 'crescimento',
    label: 'Crescimento',
    value: '+15%',
    variation: 3.4,
    status: 'success',
  },
  {
    id: 'conversao',
    label: 'Conversão',
    value: '8.2%',
    variation: -1.2,
    status: 'warning',
  },
]

const producao = [
  { etapa: 'Roteiro', quantidade: 3, cor: 'bg-primary-soft border-primary/30' },
  { etapa: 'Gravação', quantidade: 2, cor: 'bg-status-warning/10 border-status-warning/30' },
  { etapa: 'Edição', quantidade: 4, cor: 'bg-status-warning/10 border-status-warning/30' },
  { etapa: 'Aprovação', quantidade: 1, cor: 'bg-status-success/10 border-status-success/30' },
  { etapa: 'Publicado', quantidade: 12, cor: 'bg-status-success/10 border-status-success/30' },
]

const posts = [
  {
    id: '1',
    plataforma: 'Instagram',
    tipo: 'Post',
    engajamento: 1240,
    alcance: 8500,
    status: 'replicavel',
  },
  {
    id: '2',
    plataforma: 'Facebook',
    tipo: 'Vídeo',
    engajamento: 3420,
    alcance: 12000,
    status: 'replicavel',
  },
  {
    id: '3',
    plataforma: 'Twitter',
    tipo: 'Tweet',
    engajamento: 890,
    alcance: 4500,
    status: 'normal',
  },
]

export default function ConteudoPage() {
  return (
    <div className="min-h-screen bg-background">
      <Header title="Conteúdo & Redes Sociais" subtitle="Comunicação orientada a resultado" />

      <div className="px-4 py-6 lg:px-6">
        {/* KPIs */}
        <section className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {conteudoKPIs.map((kpi) => (
              <KPICard key={kpi.id} kpi={kpi} />
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Kanban de Produção */}
          <div className="lg:col-span-2">
            <div className="bg-surface rounded-2xl border border-border p-6 mb-6">
              <h2 className="text-lg font-semibold text-text-strong mb-6">Produção</h2>

              <div className="grid grid-cols-5 gap-4">
                {producao.map((item) => (
                  <div key={item.etapa} className="space-y-2">
                    <h3 className="text-xs font-semibold text-text-muted uppercase">{item.etapa}</h3>
                    <div className={`p-4 rounded-xl border ${item.cor}`}>
                      <div className="text-2xl font-semibold text-text-strong text-center">
                        {item.quantidade}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Performance por Pilar */}
            <div className="bg-surface rounded-2xl border border-border p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-6">Performance por Pilar</h2>

              <div className="space-y-4">
                {posts.map((post) => (
                  <div
                    key={post.id}
                    className="p-4 rounded-xl border border-border hover:border-primary/20 hover:shadow-card transition-all duration-200 ease-premium"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <MessageSquare className="w-4 h-4 text-primary" />
                          <h3 className="text-sm font-semibold text-text-strong">{post.plataforma}</h3>
                          <span className="text-xs text-text-muted">• {post.tipo}</span>
                        </div>
                      </div>
                      {post.status === 'replicavel' && (
                        <span className="px-2 py-1 text-xs font-medium bg-status-success/10 text-status-success rounded-lg">
                          Replicável
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-text-muted mb-1">Engajamento</p>
                        <p className="text-lg font-semibold text-text-strong">
                          {post.engajamento.toLocaleString('pt-BR')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-text-muted mb-1">Alcance</p>
                        <p className="text-lg font-semibold text-text-strong">
                          {post.alcance.toLocaleString('pt-BR')}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Insights */}
          <div className="space-y-6">
            <div className="bg-beige rounded-2xl border border-beige-dark p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4">Insights</h2>
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-surface">
                  <p className="text-sm font-medium text-text-strong mb-1">
                    Posts com vídeo performam 3x melhor
                  </p>
                  <p className="text-xs text-text-muted">
                    Considere aumentar produção de vídeos
                  </p>
                </div>
                <div className="p-3 rounded-xl bg-surface">
                  <p className="text-sm font-medium text-text-strong mb-1">
                    Horário de pico: 18h-20h
                  </p>
                  <p className="text-xs text-text-muted">
                    Maior engajamento no período
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-primary-soft rounded-2xl border border-primary/30 p-6">
              <h2 className="text-lg font-semibold text-text-strong mb-4">Próximas Publicações</h2>
              <div className="space-y-3">
                {[
                  { hora: '14:00', conteudo: 'Post sobre Saúde', plataforma: 'Instagram' },
                  { hora: '18:00', conteudo: 'Vídeo Educação', plataforma: 'Facebook' },
                  { hora: '20:00', conteudo: 'Tweet Tema X', plataforma: 'Twitter' },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-start gap-3">
                    <div className="text-sm font-medium text-primary">{item.hora}</div>
                    <div className="flex-1">
                      <p className="text-sm text-text-strong">{item.conteudo}</p>
                      <p className="text-xs text-text-muted">{item.plataforma}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

