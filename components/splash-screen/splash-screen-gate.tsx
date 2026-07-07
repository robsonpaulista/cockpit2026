'use client'

import { useEffect, useState } from 'react'
import { SplashScreen } from '@/components/splash-screen/splash-screen'
import { useSplashScreenSession } from '@/hooks/use-splash-screen-session'

type SplashScreenGateProps = {
  children: React.ReactNode
}

/** Splash uma vez por sessão (`sessionStorage: cockpit_splash_shown`). */
export function SplashScreenGate({ children }: SplashScreenGateProps) {
  const { shouldShow, markShown } = useSplashScreenSession(false)
  const [done, setDone] = useState<boolean>(false)

  useEffect(() => {
    if (!shouldShow) setDone(true)
  }, [shouldShow])

  if (!done && shouldShow) {
    return (
      <SplashScreen
        onComplete={() => {
          markShown()
          setDone(true)
        }}
      />
    )
  }

  return <>{children}</>
}
