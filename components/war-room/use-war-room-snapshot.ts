'use client'

import { useEffect, useRef } from 'react'
import {
  diffFingerprints,
  summarizeChange,
  type WarRoomCardId,
} from '@/lib/war-room/change-snapshots'
import {
  useWarRoomCardChange,
  useWarRoomRefresh,
} from '@/components/war-room/war-room-refresh-context'

type Options = {
  cardId: WarRoomCardId
  /** Linhas `chave\t...` — a chave (antes do tab) identifica o item alterado. */
  lines: string[] | null
  noun?: string
  ready?: boolean
}

/**
 * Mantém snapshot entre atualizações e reporta mudanças ao contexto da War Room.
 */
export function useWarRoomSnapshot({
  cardId,
  lines,
  noun = 'item',
  ready = true,
}: Options): { changedKeys: string[] } {
  const { reportChange } = useWarRoomRefresh()
  const change = useWarRoomCardChange(cardId)
  const prevFpRef = useRef<string | null>(null)

  useEffect(() => {
    if (!ready || lines == null) return
    const nextFp = lines.slice().sort((a, b) => a.localeCompare(b, 'pt-BR')).join('\n')
    const prev = prevFpRef.current
    if (prev == null) {
      prevFpRef.current = nextFp
      return
    }
    if (prev === nextFp) return

    const { changed, keys } = diffFingerprints(prev, nextFp)
    prevFpRef.current = nextFp
    if (!changed) {
      reportChange(cardId, null)
      return
    }
    reportChange(cardId, {
      summary: summarizeChange(keys.length || 1, noun),
      keys,
    })
  }, [cardId, lines, noun, ready, reportChange])

  return { changedKeys: change?.keys ?? [] }
}
