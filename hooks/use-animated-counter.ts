'use client'

import { useEffect, useRef, useState } from 'react'

function easeOutCubic(t: number): number {
  return 1 - (1 - t) ** 3
}

export function useAnimatedCounter(
  target: number,
  options?: {
    durationMs?: number
    enabled?: boolean
    resetKey?: string | number
  }
): number {
  const durationMs = options?.durationMs ?? 1000
  const enabled = options?.enabled ?? true
  const resetKey = options?.resetKey ?? target

  const [display, setDisplay] = useState(enabled ? 0 : target)
  const frameRef = useRef<number | null>(null)
  const startRef = useRef<number | null>(null)
  const fromRef = useRef(0)

  useEffect(() => {
    if (!enabled || !Number.isFinite(target)) {
      setDisplay(target)
      return
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current)
    }

    fromRef.current = display
    startRef.current = null

    const step = (now: number) => {
      if (startRef.current === null) startRef.current = now
      const elapsed = now - startRef.current
      const progress = Math.min(elapsed / durationMs, 1)
      const eased = easeOutCubic(progress)
      const next = fromRef.current + (target - fromRef.current) * eased
      setDisplay(next)
      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      } else {
        setDisplay(target)
        frameRef.current = null
      }
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- resetKey dispara nova animação
  }, [target, durationMs, enabled, resetKey])

  return display
}
