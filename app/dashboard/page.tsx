'use client'

import dynamic from 'next/dynamic'

const JarvisHomeAgent = dynamic(() => import('@/components/jarvis-home-agent'), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-0 flex-1 items-center justify-center text-sm text-text-secondary">
      Carregando Jarvis…
    </div>
  ),
})

/**
 * Visão Geral — núcleo neural Jarvis em tela cheia (voz + system log).
 */
export default function Home() {
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <JarvisHomeAgent
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
