'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { Suspense, useCallback } from 'react'
import { SplashScreen } from '@/components/splash-screen'
import { SPLASH_DEV_PREVIEW } from '@/lib/splash-screen-config'

function SplashCockpitPreviewContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const studio = searchParams.get('studio') !== '0'

  const handleComplete = useCallback(() => {
    if (SPLASH_DEV_PREVIEW) return

    const next = searchParams.get('next')
    if (next?.startsWith('/')) {
      router.replace(next)
      return
    }
    router.replace('/dashboard')
  }, [router, searchParams])

  return (
    <SplashScreen
      onComplete={handleComplete}
      studio={studio}
      autoEnter={!SPLASH_DEV_PREVIEW && !studio}
      holdOnComplete={SPLASH_DEV_PREVIEW}
    />
  )
}

/**
 * Preview da splash cinematográfica — sempre exibe (ignora sessão).
 * Estúdio frame a frame ativo por padrão (`?studio=0` desliga).
 * Produção: integrada via SplashScreenGate no layout do dashboard.
 */
export default function SplashCockpitPreviewPage() {
  return (
    <Suspense fallback={null}>
      <SplashCockpitPreviewContent />
    </Suspense>
  )
}
