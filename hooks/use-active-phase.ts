'use client'

import { useEffect, useState } from 'react'

interface CampaignPhase {
  id: string
  name: string
  start_date: string
  end_date: string
  active: boolean
  indicators: string[]
  restrictions: string[]
  automations: string[]
}

export function useActivePhase() {
  const [activePhase, setActivePhase] = useState<CampaignPhase | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchActivePhase()
  }, [])

  const fetchActivePhase = async () => {
    try {
      const response = await fetch('/api/fases')
      if (response.ok) {
        const phases: CampaignPhase[] = await response.json()
        const active = phases.find((p) => p.active)
        setActivePhase(active || null)
      }
    } catch (error) {
      console.error('Erro ao buscar fase ativa:', error)
    } finally {
      setLoading(false)
    }
  }

  return { activePhase, loading, refetch: fetchActivePhase }
}




