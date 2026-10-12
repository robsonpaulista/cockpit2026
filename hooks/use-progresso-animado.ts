'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

/** Progresso de 0 a 1 avançando em `duracaoMs`, com tocar, pausar e posicionar. */
export function useProgressoAnimado(duracaoMs: number) {
  const [progresso, setProgresso] = useState<number>(0)
  const [tocando, setTocando] = useState<boolean>(false)
  const progressoRef = useRef<number>(0)

  useEffect(() => {
    if (!tocando) return
    let quadro = 0
    let anterior: number | null = null
    const passo = (agora: number) => {
      const dt = anterior == null ? 0 : agora - anterior
      anterior = agora
      const proximo = Math.min(1, progressoRef.current + dt / duracaoMs)
      progressoRef.current = proximo
      setProgresso(proximo)
      if (proximo >= 1) {
        setTocando(false)
        return
      }
      quadro = requestAnimationFrame(passo)
    }
    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [tocando, duracaoMs])

  const tocar = useCallback(() => {
    if (progressoRef.current >= 1) {
      progressoRef.current = 0
      setProgresso(0)
    }
    setTocando(true)
  }, [])

  const pausar = useCallback(() => setTocando(false), [])

  const irPara = useCallback((valor: number) => {
    const v = Math.max(0, Math.min(1, valor))
    progressoRef.current = v
    setProgresso(v)
  }, [])

  return { progresso, tocando, tocar, pausar, irPara }
}
