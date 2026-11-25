'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '@/lib/utils'

export type FotoCandidatoVariante = 'miniatura' | 'ficha'

export function srcFotoCandidatoTse(ano: string, sq: string): string | null {
  const sequencial = sq.trim()
  if ((ano !== '2024' && ano !== '2026') || !/^\d{10,14}$/.test(sequencial)) return null
  return `/api/candidatos-foto/${ano}/${sequencial}`
}

/**
 * Foto TSE (ZIP DivulgaCand) — miniatura com hover na tabela, ou retrato na ficha de liderança.
 */
export function FotoCandidato({
  ano,
  sq,
  variante = 'miniatura',
  alt = '',
  className,
  onFalhou,
}: {
  ano: string
  sq: string
  variante?: FotoCandidatoVariante
  alt?: string
  className?: string
  onFalhou?: () => void
}) {
  const [falhou, setFalhou] = useState<boolean>(false)
  const [ampliada, setAmpliada] = useState<{ top: number; left: number } | null>(null)
  const miniaturaRef = useRef<HTMLImageElement>(null)
  const src = srcFotoCandidatoTse(ano, sq)

  useEffect(() => {
    setFalhou(false)
  }, [ano, sq])

  const marcarFalha = () => {
    setFalhou(true)
    onFalhou?.()
  }

  if (falhou || !src) return null

  if (variante === 'ficha') {
    return (
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        onError={marcarFalha}
        className={cn('h-36 w-28 object-cover border border-slate-300', className)}
      />
    )
  }

  const ampliar = () => {
    const caixa = miniaturaRef.current?.getBoundingClientRect()
    if (!caixa) return
    const largura = 138
    const altura = 192
    const margem = 8
    let left = caixa.right + margem
    let top = caixa.top - margem
    if (left + largura > window.innerWidth - margem) left = Math.max(margem, caixa.left - largura - margem)
    if (top + altura > window.innerHeight - margem) top = window.innerHeight - altura - margem
    if (top < margem) top = margem
    setAmpliada({ top, left })
  }

  return (
    <>
      <img
        ref={miniaturaRef}
        src={src}
        alt={alt}
        width={20}
        height={20}
        loading="lazy"
        decoding="async"
        onError={marcarFalha}
        onMouseEnter={ampliar}
        onMouseLeave={() => setAmpliada(null)}
        className={cn('h-5 w-5 shrink-0 rounded-full object-cover ring-1 ring-[#EEEEEE]', className)}
      />
      {ampliada
        ? createPortal(
            <span
              className="pointer-events-none fixed z-[200] overflow-hidden rounded-lg bg-white shadow-[0_16px_40px_-16px_rgba(2,43,58,0.45)] ring-1 ring-[#EEEEEE]"
              style={{ top: ampliada.top, left: ampliada.left }}
            >
              <img src={src} alt="" className="block h-48 w-auto max-w-none" />
            </span>,
            document.body,
          )
        : null}
    </>
  )
}
