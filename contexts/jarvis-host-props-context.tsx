'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AIAgentPageContext } from '@/components/ai-agent'

/** Props dinâmicas que cada página pode registrar para o Jarvis global. */
export interface JarvisHostPageProps {
  pageContext?: AIAgentPageContext
  loadingKPIs?: boolean
  loadingPolls?: boolean
  loadingTerritorios?: boolean
  loadingAlerts?: boolean
  loadingBandeiras?: boolean
  kpisCount?: number
  expectativa2026?: number | string
  presencaTerritorial?: string
  pollsCount?: number
  candidatoPadrao?: string
  territoriosFriosCount?: number
  alertsCriticosCount?: number
  bandeirasCount?: number
  bandeirasPerformance?: number
  criticalAlerts?: Array<{ id: string; title: string; actionUrl?: string }>
  territoriosFrios?: Array<{
    cidade: string
    motivo: string
    expectativaVotos?: number
    visitas?: number
  }>
}

export const JARVIS_HOST_DEFAULT_PROPS: Required<
  Pick<
    JarvisHostPageProps,
    | 'loadingKPIs'
    | 'loadingPolls'
    | 'loadingTerritorios'
    | 'loadingAlerts'
    | 'loadingBandeiras'
    | 'territoriosFriosCount'
    | 'alertsCriticosCount'
    | 'bandeirasCount'
    | 'bandeirasPerformance'
  >
> &
  JarvisHostPageProps = {
  loadingKPIs: false,
  loadingPolls: false,
  loadingTerritorios: false,
  loadingAlerts: false,
  loadingBandeiras: false,
  kpisCount: 0,
  pollsCount: 0,
  territoriosFriosCount: 0,
  alertsCriticosCount: 0,
  bandeirasCount: 0,
  bandeirasPerformance: 0,
  criticalAlerts: [],
  territoriosFrios: [],
}

interface JarvisHostPropsContextValue {
  pageProps: JarvisHostPageProps
  setPageProps: (props: JarvisHostPageProps) => void
}

const JarvisHostPropsContext = createContext<JarvisHostPropsContextValue | null>(null)

export function JarvisHostPropsProvider({ children }: { children: ReactNode }) {
  const [pageProps, setPagePropsState] = useState<JarvisHostPageProps>({})

  const setPageProps = useCallback((props: JarvisHostPageProps) => {
    setPagePropsState(props)
  }, [])

  const value = useMemo(
    () => ({
      pageProps,
      setPageProps,
    }),
    [pageProps, setPageProps]
  )

  return (
    <JarvisHostPropsContext.Provider value={value}>{children}</JarvisHostPropsContext.Provider>
  )
}

export function useJarvisHostPropsContext(): JarvisHostPropsContextValue {
  const ctx = useContext(JarvisHostPropsContext)
  if (!ctx) {
    throw new Error('useJarvisHostPropsContext must be used within JarvisHostPropsProvider')
  }
  return ctx
}

/** Páginas registram contexto/KPIs enquanto montadas — limpa ao desmontar. */
export function useRegisterJarvisHostProps(props: JarvisHostPageProps): void {
  const { setPageProps } = useJarvisHostPropsContext()

  useEffect(() => {
    setPageProps(props)
    return () => setPageProps({})
  }, [
    setPageProps,
    props,
    props.pageContext,
    props.loadingKPIs,
    props.loadingPolls,
    props.loadingTerritorios,
    props.loadingAlerts,
    props.loadingBandeiras,
    props.kpisCount,
    props.expectativa2026,
    props.presencaTerritorial,
    props.pollsCount,
    props.candidatoPadrao,
    props.territoriosFriosCount,
    props.alertsCriticosCount,
    props.bandeirasCount,
    props.bandeirasPerformance,
    props.criticalAlerts,
    props.territoriosFrios,
  ])
}

export function useMergedJarvisHostProps(): JarvisHostPageProps {
  const { pageProps } = useJarvisHostPropsContext()
  return useMemo(
    () => ({
      ...JARVIS_HOST_DEFAULT_PROPS,
      ...pageProps,
    }),
    [pageProps]
  )
}
