'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
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

const JARVIS_HOST_PROP_KEYS: (keyof JarvisHostPageProps)[] = [
  'pageContext',
  'loadingKPIs',
  'loadingPolls',
  'loadingTerritorios',
  'loadingAlerts',
  'loadingBandeiras',
  'kpisCount',
  'expectativa2026',
  'presencaTerritorial',
  'pollsCount',
  'candidatoPadrao',
  'territoriosFriosCount',
  'alertsCriticosCount',
  'bandeirasCount',
  'bandeirasPerformance',
  'criticalAlerts',
  'territoriosFrios',
]

function pageContextSemanticEqual(
  a: AIAgentPageContext | undefined,
  b: AIAgentPageContext | undefined
): boolean {
  if (a === b) return true
  if (!a || !b) return !a && !b
  if (a.kind !== b.kind) return false

  if (a.kind === 'campo' && b.kind === 'campo') {
    return a.cidades === b.cidades && a.totalAgendas === b.totalAgendas
  }

  if (a.kind === 'territorio' && b.kind === 'territorio') {
    return (
      a.cidades === b.cidades &&
      a.loading === b.loading &&
      a.planilhaConfigurada === b.planilhaConfigurada &&
      a.cidadesExpandidas === b.cidadesExpandidas &&
      a.modalObrasAberto === b.modalObrasAberto &&
      a.cidadeObrasAtual === b.cidadeObrasAtual
    )
  }

  if (a.kind === 'resumo-eleicoes' && b.kind === 'resumo-eleicoes') {
    return (
      a.cidades === b.cidades &&
      a.cidadeAtual === b.cidadeAtual &&
      a.buscaIniciada === b.buscaIniciada &&
      a.loadingCidades === b.loadingCidades &&
      a.loadingDados === b.loadingDados &&
      a.resumoTemDados === b.resumoTemDados &&
      a.seletorDemandasAberto === b.seletorDemandasAberto &&
      a.seletorDemandasCarregando === b.seletorDemandasCarregando &&
      a.liderancasDemandasDisponiveis === b.liderancasDemandasDisponiveis &&
      a.painelResumoCardsVisivel === b.painelResumoCardsVisivel &&
      a.modalLiderancasAberto === b.modalLiderancasAberto &&
      a.modalPesquisasAberto === b.modalPesquisasAberto &&
      a.modalDemandasCidadeAberto === b.modalDemandasCidadeAberto
    )
  }

  return false
}

function jarvisHostPropsEqual(a: JarvisHostPageProps, b: JarvisHostPageProps): boolean {
  for (const key of JARVIS_HOST_PROP_KEYS) {
    if (key === 'pageContext') {
      if (!pageContextSemanticEqual(a.pageContext, b.pageContext)) return false
      continue
    }
    if (a[key] !== b[key]) return false
  }
  return true
}

function buildJarvisHostPropsSyncToken(props: JarvisHostPageProps): string {
  const pc = props.pageContext
  const parts: unknown[] = [
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
    pc?.kind,
  ]

  if (pc?.kind === 'resumo-eleicoes') {
    parts.push(
      pc.cidadeAtual,
      pc.buscaIniciada,
      pc.loadingCidades,
      pc.loadingDados,
      pc.resumoTemDados,
      pc.cidades.length,
      pc.seletorDemandasAberto,
      pc.seletorDemandasCarregando,
      pc.liderancasDemandasDisponiveis.join('\0'),
      pc.painelResumoCardsVisivel,
      pc.modalLiderancasAberto,
      pc.modalPesquisasAberto,
      pc.modalDemandasCidadeAberto
    )
  } else if (pc?.kind === 'campo') {
    parts.push(pc.cidades.length, pc.totalAgendas)
  } else if (pc?.kind === 'territorio') {
    parts.push(
      pc.loading,
      pc.planilhaConfigurada,
      pc.cidades.length,
      pc.cidadesExpandidas.join('\0'),
      pc.modalObrasAberto,
      pc.cidadeObrasAtual
    )
  }

  return JSON.stringify(parts)
}

export function JarvisHostPropsProvider({ children }: { children: ReactNode }) {
  const [pageProps, setPagePropsState] = useState<JarvisHostPageProps>({})

  const setPageProps = useCallback((props: JarvisHostPageProps) => {
    setPagePropsState((prev) => (jarvisHostPropsEqual(prev, props) ? prev : props))
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
  const propsRef = useRef(props)
  propsRef.current = props
  const syncToken = buildJarvisHostPropsSyncToken(props)

  useEffect(() => {
    setPageProps(propsRef.current)
    return () => setPageProps({})
  }, [setPageProps, syncToken])
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
