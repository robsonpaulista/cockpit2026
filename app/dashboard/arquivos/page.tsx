'use client'

import { Suspense, useCallback, useMemo } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Loader2 } from 'lucide-react'
import { ArquivosShell } from '@/components/arquivos/arquivos-shell'
import { FotosDrivePanel } from '@/components/arquivos/fotos-drive-panel'
import { PessoasCadastroPanel } from '@/components/arquivos/pessoas/pessoas-cadastro-panel'
import {
  ARQUIVOS_TAB_FOTOS_DRIVE,
  ARQUIVOS_TAB_CADASTRO_PESSOAS,
  arquivosHubHref,
  parseArquivosTab,
  type ArquivosTab,
} from '@/lib/arquivos-hub-route'

function ArquivosPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const activeTab = useMemo(() => parseArquivosTab(searchParams.get('tab')), [searchParams])

  const onTabChange = useCallback(
    (tab: ArquivosTab) => {
      router.replace(arquivosHubHref(tab))
    },
    [router],
  )

  return (
    <ArquivosShell activeTab={activeTab} onTabChange={onTabChange}>
      {activeTab === ARQUIVOS_TAB_FOTOS_DRIVE ? <FotosDrivePanel /> : null}
      {activeTab === ARQUIVOS_TAB_CADASTRO_PESSOAS ? <PessoasCadastroPanel /> : null}
    </ArquivosShell>
  )
}

export default function ArquivosPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center gap-2 py-20 text-text-muted">
          <Loader2 className="h-5 w-5 animate-spin text-[#C8900A]" />
          Carregando arquivos…
        </div>
      }
    >
      <ArquivosPageContent />
    </Suspense>
  )
}
