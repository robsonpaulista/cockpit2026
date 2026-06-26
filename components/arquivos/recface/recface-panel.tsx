'use client'

import { useState } from 'react'
import { ScanFace } from 'lucide-react'
import { cn } from '@/lib/utils'
import { RecfaceServiceBanner } from '@/components/arquivos/recface/recface-service-banner'
import { RecfaceHomeTab } from '@/components/arquivos/recface/recface-home-tab'
import { RecfaceRegisterTab } from '@/components/arquivos/recface/recface-register-tab'
import { RecfaceAgendaTab } from '@/components/arquivos/recface/recface-agenda-tab'
import { RecfaceVisitorsTab } from '@/components/arquivos/recface/recface-visitors-tab'
import { RecfaceRecognizeTab } from '@/components/arquivos/recface/recface-recognize-tab'
import { RecfaceLogsTab } from '@/components/arquivos/recface/recface-logs-tab'

const SUB_TABS = [
  { id: 'inicio', label: 'Início' },
  { id: 'cadastro', label: 'Cadastro' },
  { id: 'agenda', label: 'Agenda' },
  { id: 'visitantes', label: 'Visitantes' },
  { id: 'reconhecimento', label: 'Reconhecimento' },
  { id: 'logs', label: 'Logs' },
] as const

type RecfaceSubTab = (typeof SUB_TABS)[number]['id']

export function RecfacePanel() {
  const [tab, setTab] = useState<RecfaceSubTab>('inicio')

  return (
    <div className="space-y-4">
      <RecfaceServiceBanner />

      <div className="flex items-center gap-3 rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-4 py-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8900A]/15">
          <ScanFace className="h-5 w-5 text-[#C8900A]" />
        </div>
        <div>
          <p className="text-sm font-semibold text-text-primary">Reconhecimento facial (FaceAgenda)</p>
          <p className="text-xs text-text-muted">InsightFace · mesmas funções do projeto recface</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-muted/40 p-1">
        {SUB_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-sm transition-colors',
              tab === t.id
                ? 'bg-bg-surface font-medium text-text-primary shadow-sm'
                : 'text-text-muted hover:text-text-primary',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'inicio' ? <RecfaceHomeTab /> : null}
      {tab === 'cadastro' ? <RecfaceRegisterTab /> : null}
      {tab === 'agenda' ? <RecfaceAgendaTab /> : null}
      {tab === 'visitantes' ? <RecfaceVisitorsTab /> : null}
      {tab === 'reconhecimento' ? <RecfaceRecognizeTab /> : null}
      {tab === 'logs' ? <RecfaceLogsTab /> : null}
    </div>
  )
}
