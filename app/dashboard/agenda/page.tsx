'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import {
  resumoEleicoesHubHref,
  RESUMO_ELEICOES_TAB_AGENDA,
} from '@/lib/resumo-eleicoes-hub-route'

/** Redireciona rota legada para o hub Painel de Atendimentos · guia Agenda. */
export default function AgendaLegacyRedirectPage() {
  const router = useRouter()

  useEffect(() => {
    router.replace(resumoEleicoesHubHref(RESUMO_ELEICOES_TAB_AGENDA))
  }, [router])

  return null
}
