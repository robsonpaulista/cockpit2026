'use client'

import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'

interface ArrivalTimerProps {
  arrivalTime: string
  className?: string
}

export function ArrivalTimer({ arrivalTime, className = '' }: ArrivalTimerProps) {
  const [elapsedTime, setElapsedTime] = useState<string>('')

  useEffect(() => {
    if (!arrivalTime) return

    const calculateElapsedTime = () => {
      const arrival = new Date(arrivalTime)
      const now = new Date()
      const diffMs = now.getTime() - arrival.getTime()

      if (diffMs < 0) {
        setElapsedTime('0 min')
        return
      }

      const diffMinutes = Math.floor(diffMs / 60000)
      const diffHours = Math.floor(diffMinutes / 60)
      const diffDays = Math.floor(diffHours / 24)

      if (diffDays > 0) {
        setElapsedTime(`${diffDays}d ${diffHours % 24}h`)
      } else if (diffHours > 0) {
        setElapsedTime(`${diffHours}h ${diffMinutes % 60}min`)
      } else {
        setElapsedTime(`${diffMinutes}min`)
      }
    }

    // Calcular imediatamente
    calculateElapsedTime()

    // Atualizar a cada minuto (silenciosamente)
    const interval = setInterval(calculateElapsedTime, 60000)

    return () => clearInterval(interval)
  }, [arrivalTime])

  if (!arrivalTime) return null

  return (
    <div className={`flex items-center gap-2 text-sm ${className}`}>
      <Clock className="w-4 h-4 text-accent-gold" />
      <span className="text-secondary">
        Chegou há <span className="font-semibold text-primary">{elapsedTime}</span>
      </span>
    </div>
  )
}
