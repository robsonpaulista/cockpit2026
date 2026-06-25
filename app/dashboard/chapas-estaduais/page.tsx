'use client'

import { useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  resumoEleicoesHubHref,
  RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL,
} from '@/lib/resumo-eleicoes-hub-route'

/** Redireciona rota legada para o hub com guia Chapa Estadual. */
export default function ChapasEstaduaisLegacyRedirectPage() {
  const router = useRouter()
  const searchParams = useSearchParams()

  useEffect(() => {
    const extra: Record<string, string> = {}
    searchParams.forEach((value, key) => {
      extra[key] = value
    })
    router.replace(resumoEleicoesHubHref(RESUMO_ELEICOES_TAB_CHAPA_ESTADUAL, extra))
  }, [router, searchParams])

  return null
}
