'use client'

import { createContext, useContext, type ReactNode } from 'react'

const DashboardHomeChromeContext = createContext(false)

export function DashboardHomeChromeProvider({
  value,
  children,
}: {
  value: boolean
  children: ReactNode
}) {
  return (
    <DashboardHomeChromeContext.Provider value={value}>
      {children}
    </DashboardHomeChromeContext.Provider>
  )
}

export function useDashboardHomeChrome(): boolean {
  return useContext(DashboardHomeChromeContext)
}
