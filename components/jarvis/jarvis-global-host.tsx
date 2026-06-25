'use client'

import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'
import { cn } from '@/lib/utils'
import { isDashboardHomePath } from '@/lib/dashboard-home-chrome'
import { COCKPIT_AGENT_NAME } from '@/lib/agent/cockpit-agent-brand'
import { useJarvisVisibility } from '@/contexts/jarvis-visibility-context'
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
  const { visible, hydrated } = useJarvisVisibility()
  const mergedProps = useMergedJarvisHostProps()
  const { setPageProps } = useJarvisHostPropsContext()

  useEffect(() => {
    if (!isHome) return
    setPageProps({})
  }, [isHome, setPageProps])

  if (!hydrated || !visible) return null

  /** Home = tela de descanso — Jarvis fica oculto; use o menu para navegar. */
  if (isHome) return null

  return (
    <div
      className={cn(
        'pointer-events-none',
        isHome
          ? 'relative z-20 flex h-full min-h-0 w-full shrink-0 flex-col border-[rgba(0,212,255,0.08)] max-xl:max-h-[40vh] max-xl:min-h-[16rem] max-xl:border-l-0 max-xl:border-t xl:shrink-0 xl:border-l xl:border-t-0 xl:w-[min(26vw,21rem)] xl:min-w-[16rem] xl:max-w-[22rem] 2xl:w-[min(24vw,24rem)] 2xl:min-w-[18rem] 2xl:max-w-[26rem] min-[1800px]:w-[28rem] min-[1800px]:min-w-[24rem] min-[1800px]:max-w-[28rem]'
          : 'fixed bottom-4 right-4 z-[120] sm:bottom-5 sm:right-5'
      )}
      aria-live="polite"
    >
      <div className={cn('pointer-events-auto', isHome ? 'flex h-full min-h-0 flex-1 flex-col' : '')}>
        <AIAgent
          agentTitle={COCKPIT_AGENT_NAME}
          uiVariant="jarvis-hud"
          fullPageHud={isHome}
          hudLayout={isHome ? 'column' : 'compact'}
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
