'use client'

import { useCallback, useRef, useState } from 'react'

type SpatialTiltOptions = {
  maxRotate?: number
  scale?: number
}

export function useSpatialTilt({ maxRotate = 7, scale = 1.02 }: SpatialTiltOptions = {}) {
  const ref = useRef<HTMLDivElement>(null)
  const [style, setStyle] = useState<{
    transform: string
    transition: string
  }>({
    transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
    transition: 'transform 0.5s cubic-bezier(0.23, 1, 0.32, 1)',
  })

  const onMouseMove = useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const px = ((event.clientX - rect.left) / rect.width - 0.5) * 2
      const py = ((event.clientY - rect.top) / rect.height - 0.5) * 2
      setStyle({
        transform: `perspective(1000px) rotateX(${py * -maxRotate}deg) rotateY(${px * maxRotate}deg) scale3d(${scale}, ${scale}, ${scale})`,
        transition: 'transform 0.08s ease-out',
      })
    },
    [maxRotate, scale]
  )

  const onMouseLeave = useCallback(() => {
    setStyle({
      transform: 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.55s cubic-bezier(0.23, 1, 0.32, 1)',
    })
  }, [])

  return { ref, style, onMouseMove, onMouseLeave }
}
