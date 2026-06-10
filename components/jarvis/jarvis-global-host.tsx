'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { isDashboardHomePath } from '@/lib/dashboard-home-chrome'
import {
  JARVIS_HOST_DEFAULT_PROPS,
  useJarvisHostPropsContext,
  useMergedJarvisHostProps,
} from '@/contexts/jarvis-host-props-context'

const AIAgent = dynamic(() => import('@/components/ai-agent').then((m) => m.AIAgent), {
  ssr: false,
  loading: () => null,
})

/**
 * Jarvis único no layout — estado de conversa persiste entre páginas.
 * Home: HUD full-screen. Demais rotas: bolha flutuante compacta.
 */
export function JarvisGlobalHost() {
  const pathname = usePathname() ?? ''
  const isHome = isDashboardHomePath(pathname)
  const mergedProps = useMergedJarvisHostProps()
  const { setPageProps } = useJarvisHostPropsContext()

  useEffect(() => {
    if (!isHome) return
    setPageProps({})
  }, [isHome, setPageProps])

  return (
    <div
      className={cn(
        'pointer-events-none',
        isHome
          ? 'absolute inset-0 z-30 flex flex-col'
          : 'fixed bottom-4 right-4 z-[120] sm:bottom-5 sm:right-5'
      )}
      aria-live="polite"
    >
      <div className={cn('pointer-events-auto', isHome ? 'flex h-full min-h-0 flex-1 flex-col' : '')}>
        <AIAgent
          agentTitle="Jarvis"
          uiVariant="jarvis-hud"
          fullPageHud={isHome}
          hudLayout={isHome ? 'full' : 'compact'}
          floatingMode={!isHome}
          dockVariant={isHome ? 'inline' : 'fixed'}
          maxPanelHeight={isHome ? 720 : 380}
          enableVoice
          immediateChatMode
          loadingKPIs={mergedProps.loadingKPIs ?? JARVIS_HOST_DEFAULT_PROPS.loadingKPIs}
          loadingPolls={mergedProps.loadingPolls ?? JARVIS_HOST_DEFAULT_PROPS.loadingPolls}
          loadingTerritorios={
            mergedProps.loadingTerritorios ?? JARVIS_HOST_DEFAULT_PROPS.loadingTerritorios
          }
          loadingAlerts={mergedProps.loadingAlerts ?? JARVIS_HOST_DEFAULT_PROPS.loadingAlerts}
          loadingBandeiras={mergedProps.loadingBandeiras ?? JARVIS_HOST_DEFAULT_PROPS.loadingBandeiras}
          kpisCount={mergedProps.kpisCount}
          expectativa2026={mergedProps.expectativa2026}
          presencaTerritorial={mergedProps.presencaTerritorial}
          pollsCount={mergedProps.pollsCount}
          candidatoPadrao={mergedProps.candidatoPadrao}
          territoriosFriosCount={
            mergedProps.territoriosFriosCount ?? JARVIS_HOST_DEFAULT_PROPS.territoriosFriosCount
          }
          alertsCriticosCount={
            mergedProps.alertsCriticosCount ?? JARVIS_HOST_DEFAULT_PROPS.alertsCriticosCount
          }
          bandeirasCount={mergedProps.bandeirasCount ?? JARVIS_HOST_DEFAULT_PROPS.bandeirasCount}
          bandeirasPerformance={
            mergedProps.bandeirasPerformance ?? JARVIS_HOST_DEFAULT_PROPS.bandeirasPerformance
          }
          criticalAlerts={mergedProps.criticalAlerts ?? JARVIS_HOST_DEFAULT_PROPS.criticalAlerts}
          territoriosFrios={mergedProps.territoriosFrios ?? JARVIS_HOST_DEFAULT_PROPS.territoriosFrios}
          pageContext={mergedProps.pageContext}
        />
      </div>
    </div>
  )
}
