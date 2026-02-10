'use client'

import { useEffect, useState } from 'react'

/**
 * Overlay laranja que aparece sobre o dashboard após o splash screen.
 * Dissolve gradualmente revelando o conteúdo do dashboard por baixo,
 * criando uma transição fluida entre o splash e a página principal.
 * 
 * Usa leitura síncrona do localStorage no primeiro render para
 * garantir que o overlay esteja visível desde o primeiro frame.
 */
export function SplashOverlay() {
  // Ler flag SINCRONAMENTE no primeiro render (evita piscar o dashboard)
  const [ativo] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false
    try {
      const flag = localStorage.getItem('splash_transition')
      if (flag) {
        localStorage.removeItem('splash_transition')
        return true
      }
    } catch {
      // SSR ou erro de acesso
    }
    return false
  })

  const [opacidade, setOpacidade] = useState<number>(1)
  const [removido, setRemovido] = useState<boolean>(false)

  useEffect(() => {
    if (!ativo) return

    // Pequena pausa para o dashboard começar a renderizar por baixo
    const timerDissolver = setTimeout(() => {
      setOpacidade(0)
    }, 500)

    // Remover do DOM após a transição terminar
    const timerRemover = setTimeout(() => {
      setRemovido(true)
    }, 3500)

    return () => {
      clearTimeout(timerDissolver)
      clearTimeout(timerRemover)
    }
  }, [ativo])

  if (!ativo || removido) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'linear-gradient(145deg, #e85a10 0%, #de5a12 40%, #b84311 100%)',
        opacity: opacidade,
        transition: 'opacity 2.8s cubic-bezier(0.25, 0.1, 0.25, 1)',
        pointerEvents: 'none',
      }}
    >
      {/* Efeito de luz radial (mesmo da splash) */}
      <div
        style={{
          position: 'absolute',
          top: '-50%',
          left: '-50%',
          width: '200%',
          height: '200%',
          background: 'radial-gradient(circle at 30% 40%, rgba(255,255,255,0.08) 0%, transparent 50%)',
        }}
      />
    </div>
  )
}
