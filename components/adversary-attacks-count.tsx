'use client'

import { useEffect, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

interface AdversaryAttacksCountProps {
  adversaryId: string
}

export function AdversaryAttacksCount({ adversaryId }: AdversaryAttacksCountProps) {
  const [attacks, setAttacks] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchAttacks()
  }, [adversaryId])

  const fetchAttacks = async () => {
    try {
      const response = await fetch(`/api/noticias/adversarios/${adversaryId}/attacks`)
      if (response.ok) {
        const data = await response.json()
        // Pegar apenas os últimos 7 dias
        const sevenDaysAgo = new Date()
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
        
        const recentAttacks = data.filter((attack: any) => {
          const attackDate = new Date(attack.detected_at)
          return attackDate >= sevenDaysAgo
        })
        
        setAttacks(recentAttacks)
      }
    } catch (error) {
      console.error('Erro ao buscar ataques:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) return null

  const directAttacks = attacks.filter(a => a.attack_type === 'direct').length
  const indirectAttacks = attacks.filter(a => a.attack_type === 'indirect').length
  const totalAttacks = attacks.length

  if (totalAttacks === 0) return null

  return (
    <div className="mt-2 pt-2 border-t border-card">
      <div className="flex items-center gap-2 text-xs text-secondary">
        <AlertTriangle className="w-3 h-3 text-status-error" />
        <span>
          {totalAttacks} menção(ões) nos últimos 7 dias
          {directAttacks > 0 && ` • ${directAttacks} direto(s)`}
          {indirectAttacks > 0 && ` • ${indirectAttacks} indireto(s)`}
        </span>
      </div>
    </div>
  )
}




