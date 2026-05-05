'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Bot } from 'lucide-react'
import { DashboardHomeWelcome } from '@/components/dashboard-home-welcome'
import { useDashboardHomeChrome } from '@/contexts/dashboard-home-chrome-context'
import { cn } from '@/lib/utils'

const AIAgent = dynamic(
  () => import('@/components/ai-agent').then((mod) => ({ default: mod.AIAgent })),
  { ssr: false, loading: () => null }
)

/**
 * Página inicial do dashboard: boas-vindas alinhadas à splash (conteúdo e animação),
 * com cores dadas pelas variáveis do tema e pela aparência claro/escuro.
 * Indicadores detalhados ficam nos módulos específicos (menu lateral).
 */
export default function Home() {
  const [agenteMontado, setAgenteMontado] = useState(false)
  const isGradientHome = useDashboardHomeChrome()

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col',
        isGradientHome ? 'bg-transparent' : 'bg-bg-surface',
      )}
    >
      <DashboardHomeWelcome />

      {!agenteMontado ? (
        <button
          type="button"
          onClick={() => setAgenteMontado(true)}
          className="fixed bottom-6 right-6 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent-gold to-accent-gold-dark shadow-lg shadow-accent-gold/30 transition-transform hover:scale-110"
          title="Abrir Agente de IA"
        >
          <Bot className="h-7 w-7 text-white" />
        </button>
      ) : (
        <AIAgent
          loadingKPIs={false}
          loadingPolls={false}
          loadingTerritorios={false}
          loadingAlerts={false}
          loadingBandeiras={false}
          kpisCount={0}
          expectativa2026={undefined}
          presencaTerritorial={undefined}
          pollsCount={0}
          candidatoPadrao={undefined}
          territoriosFriosCount={0}
          alertsCriticosCount={0}
          bandeirasCount={0}
          bandeirasPerformance={0}
          criticalAlerts={[]}
          territoriosFrios={[]}
        />
      )}
    </div>
  )
}
