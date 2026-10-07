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
import municipiosPiaui from '@/lib/municipios-piaui.json'
import { normalizeMunicipioChaveVotacao } from '@/lib/votacao-secao'

export const MUNICIPIOS_PI_ORDENADOS: readonly string[] = municipiosPiaui
  .map((m) => m.nome)
  .sort((a, b) => a.localeCompare(b, 'pt-BR'))

interface TerritorioMunicipioContextValue {
  /** Nome do município selecionado no topo; `null` = Piauí inteiro. */
  municipio: string | null
  setMunicipio: (municipio: string | null) => void
  /** `true` quando não há filtro ou quando `nome` é o município selecionado (ignora acento/caixa). */
  noMunicipio: (nome: string | null | undefined) => boolean
}

const TerritorioMunicipioContext = createContext<TerritorioMunicipioContextValue | null>(null)

export function TerritorioMunicipioProvider({ children }: { children: ReactNode }) {
  const [municipio, setMunicipio] = useState<string | null>(null)
  const chave = useMemo(() => (municipio ? normalizeMunicipioChaveVotacao(municipio) : null), [municipio])

  const noMunicipio = useCallback(
    (nome: string | null | undefined) => !chave || normalizeMunicipioChaveVotacao(nome ?? '') === chave,
    [chave],
  )

  const value = useMemo<TerritorioMunicipioContextValue>(
    () => ({ municipio, setMunicipio, noMunicipio }),
    [municipio, noMunicipio],
  )

  return <TerritorioMunicipioContext.Provider value={value}>{children}</TerritorioMunicipioContext.Provider>
}

const SEM_PROVIDER: TerritorioMunicipioContextValue = {
  municipio: null,
  setMunicipio: () => undefined,
  noMunicipio: () => true,
}

export function useTerritorioMunicipio(): TerritorioMunicipioContextValue {
  return useContext(TerritorioMunicipioContext) ?? SEM_PROVIDER
}

/**
 * Linhas expansíveis por cidade: começam recolhidas e, com um município escolhido no topo,
 * abrem as linhas visíveis (normalmente só a do município).
 */
export function useCidadesExpandidas(chavesVisiveis: readonly string[], carregado: boolean) {
  const { municipio } = useTerritorioMunicipio()
  const [expandidas, setExpandidas] = useState<Set<string>>(new Set())
  const chavesRef = useRef<readonly string[]>(chavesVisiveis)
  chavesRef.current = chavesVisiveis

  useEffect(() => {
    setExpandidas(municipio ? new Set(chavesRef.current) : new Set())
  }, [municipio, carregado])

  const alternar = useCallback((chave: string) => {
    setExpandidas((atuais) => {
      const proximas = new Set(atuais)
      if (proximas.has(chave)) proximas.delete(chave)
      else proximas.add(chave)
      return proximas
    })
  }, [])

  const todasAbertas = chavesVisiveis.length > 0 && chavesVisiveis.every((c) => expandidas.has(c))
  const alternarTodas = useCallback(() => {
    setExpandidas(todasAbertas ? new Set() : new Set(chavesRef.current))
  }, [todasAbertas])

  return { expandidas, alternar, todasAbertas, alternarTodas }
}
