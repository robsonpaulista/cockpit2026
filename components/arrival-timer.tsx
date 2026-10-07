'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ArrivalTimerProps {
  arrivalTime: string
  className?: string
}

function tempoDecorrido(arrivalTime: string): string {
  const diffMs = Date.now() - new Date(arrivalTime).getTime()
  if (diffMs < 0) return '0 min'
  const minutos = Math.floor(diffMs / 60000)
  const horas = Math.floor(minutos / 60)
  const dias = Math.floor(horas / 24)
  if (dias > 0) return `${dias}d ${horas % 24}h`
  if (horas > 0) return `${horas}h ${minutos % 60}min`
  return `${minutos}min`
}

/** Usado dentro de páginas TSE (`TsePage`), que definem as variáveis `--tse-*`. */
export function ArrivalTimer({ arrivalTime, className }: ArrivalTimerProps) {
  const [decorrido, setDecorrido] = useState<string>(() => (arrivalTime ? tempoDecorrido(arrivalTime) : ''))

  useEffect(() => {
    if (!arrivalTime) return
    setDecorrido(tempoDecorrido(arrivalTime))
    const intervalo = window.setInterval(() => setDecorrido(tempoDecorrido(arrivalTime)), 60000)
    return () => window.clearInterval(intervalo)
  }, [arrivalTime])

  if (!arrivalTime) return null

  return (
    <div className={cn('flex items-center gap-1.5 text-[12px] text-[var(--tse-muted)]', className)}>
      <Clock className="h-3.5 w-3.5 text-[var(--tse-gold-text)]" aria-hidden />
      <span>
        Chegou há <strong className="text-[var(--tse-text)]">{decorrido}</strong>
      </span>
    </div>
  )
}
