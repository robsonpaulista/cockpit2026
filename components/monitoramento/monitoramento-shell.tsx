'use client'

import type { ReactNode } from 'react'
import { Settings2, UserRound } from 'lucide-react'
import {
  TseFilterBar,
  TsePage,
  TseSelectGrande,
  TseTabs,
  tseBotaoCinzaClass,
  tseBotaoIconeClass,
  type TseAba,
} from '@/components/tse/tse-ui'
import { useAllowedHubTabs } from '@/hooks/use-allowed-hub-tabs'
import type { PoliticalActorWithTerms } from '@/lib/youtube-radar-types'
import { cn } from '@/lib/utils'

export type MonitoramentoTab = 'geral' | 'youtube' | 'trends' | 'google-alerts' | 'google-news' | 'meta-ads' | 'instagram'

const TABS: readonly TseAba<MonitoramentoTab>[] = [
  { id: 'geral', label: 'Panorama' },
  { id: 'youtube', label: 'YouTube' },
  { id: 'google-alerts', label: 'Alertas' },
  { id: 'google-news', label: 'Notícias' },
  { id: 'instagram', label: 'Instagram' },
  { id: 'meta-ads', label: 'Anúncios' },
  { id: 'trends', label: 'Buscas' },
]

interface MonitoramentoShellProps {
  activeTab: MonitoramentoTab
  onTabChange: (tab: MonitoramentoTab) => void
  ativos: PoliticalActorWithTerms[]
  candidato: string | null
  onCandidatoChange: (slug: string | null) => void
  /** Linha secundária do bloco de informações (ex.: janela e atualização do Panorama). */
  info?: ReactNode
  onAbrirCandidatos: () => void
  children: ReactNode
}

export function MonitoramentoShell({
  activeTab,
  onTabChange,
  ativos,
  candidato,
  onCandidatoChange,
  info,
  onAbrirCandidatos,
  children,
}: MonitoramentoShellProps) {
  const visibleTabs = useAllowedHubTabs('noticias', TABS, activeTab, onTabChange)

  return (
    <TsePage>
      <TseFilterBar>
        <TseSelectGrande
          icone={UserRound}
          rotulo="Candidato"
          value={candidato ?? ''}
          onChange={(e) => onCandidatoChange(e.target.value || null)}
        >
          <option value="">Todos os candidatos</option>
          {ativos.map((a) => (
            <option key={a.id} value={a.slug}>
              {a.name}
            </option>
          ))}
        </TseSelectGrande>
        <div className="text-[13px] leading-tight">
          <p className="font-bold">
            {ativos.length.toLocaleString('pt-BR')} {ativos.length === 1 ? 'candidato monitorado' : 'candidatos monitorados'}
          </p>
          <p className="text-[var(--tse-muted)]">{info ?? 'YouTube, notícias, Instagram, anúncios e buscas'}</p>
        </div>
        <button type="button" onClick={onAbrirCandidatos} className={cn(tseBotaoCinzaClass, 'ml-auto')}>
          <Settings2 className={tseBotaoIconeClass} />
          Candidatos
        </button>
      </TseFilterBar>

      <TseTabs className="mt-5" abas={visibleTabs} ativa={activeTab} onChange={onTabChange} />

      <div className="mt-5">{children}</div>
    </TsePage>
  )
}
