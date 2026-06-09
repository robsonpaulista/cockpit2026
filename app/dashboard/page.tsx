'use client'

import dynamic from 'next/dynamic'

const AIAgent = dynamic(
  () => import('@/components/ai-agent').then((mod) => ({ default: mod.AIAgent })),
  { ssr: false, loading: () => null }
)

/**
 * Visão Geral — núcleo neural Jarvis em tela cheia (voz + system log).
 */
export default function Home() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <AIAgent
        agentTitle="Jarvis"
        uiVariant="jarvis-hud"
        dockVariant="inline"
        immediateChatMode
        enableVoice
        fullPageHud
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
    </div>
  )
}
