'use client'

import { useEffect } from 'react'
import { WarRoomFontBootstrap } from '@/components/war-room/war-room-font-bootstrap'
import '@/app/dashboard/war-room/war-room-fonts.css'
import '@/app/dashboard/war-room/war-room-clean.css'

/**
 * Ativa o tema premium clean cinza em todo o `/dashboard`
 * (mesmo visual de War Room / Copiloto / Cidades).
 * Dono do atributo `body[data-war-room-clean]` — shells de página não devem removê-lo.
 */
export function DashboardCleanThemeBootstrap() {
  useEffect(() => {
    document.body.setAttribute('data-war-room-clean', '')
    return () => {
      document.body.removeAttribute('data-war-room-clean')
    }
  }, [])

  return <WarRoomFontBootstrap />
}
