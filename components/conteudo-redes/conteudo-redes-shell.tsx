'use client'

import type { ReactNode } from 'react'
import { CalendarDays, RefreshCw } from 'lucide-react'
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
import { FOLLOWERS_HISTORY_RANGE_OPTIONS } from '@/lib/instagram-followers-history-chart'
import { cn } from '@/lib/utils'

export type ConteudoRedesTab = 'posts' | 'audience' | 'locations'

const TABS: readonly TseAba<ConteudoRedesTab>[] = [
  { id: 'posts', label: 'Posts & Insights' },
  { id: 'audience', label: 'Audiência' },
  { id: 'locations', label: 'Por Cidade' },
]

interface ConteudoRedesShellProps {
  activeTab: ConteudoRedesTab
  onTabChange: (tab: ConteudoRedesTab) => void
  dateRange: string
  onDateRangeChange: (range: string) => void
  username?: string
  seguidores?: number
  publicacoes: number
  loading: boolean
  onAtualizar: () => void
  children: ReactNode
}

export function ConteudoRedesShell({
  activeTab,
  onTabChange,
  dateRange,
  onDateRangeChange,
  username,
  seguidores,
  publicacoes,
  loading,
  onAtualizar,
  children,
}: ConteudoRedesShellProps) {
  const visibleTabs = useAllowedHubTabs('conteudo', TABS, activeTab, onTabChange)

  return (
    <TsePage>
      <TseFilterBar>
        <TseSelectGrande
          icone={CalendarDays}
          rotulo="Período"
          value={dateRange}
          onChange={(e) => onDateRangeChange(e.target.value)}
        >
          {FOLLOWERS_HISTORY_RANGE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              Últimos {o.label}
            </option>
          ))}
        </TseSelectGrande>
        {username ? (
          <div className="text-[13px] leading-tight">
            <p className="font-bold">@{username}</p>
            <p className="text-[var(--tse-muted)]">
              {(seguidores ?? 0).toLocaleString('pt-BR')} seguidores ·{' '}
              {publicacoes.toLocaleString('pt-BR')} {publicacoes === 1 ? 'publicação' : 'publicações'} no período
            </p>
          </div>
        ) : null}
        <button type="button" onClick={onAtualizar} disabled={loading} className={cn(tseBotaoCinzaClass, 'ml-auto')}>
          <RefreshCw className={cn(tseBotaoIconeClass, loading && 'animate-spin')} />
          Atualizar
        </button>
      </TseFilterBar>

      <TseTabs className="mt-5" abas={visibleTabs} ativa={activeTab} onChange={onTabChange} />

      <div className="mt-5">{children}</div>
    </TsePage>
  )
}
