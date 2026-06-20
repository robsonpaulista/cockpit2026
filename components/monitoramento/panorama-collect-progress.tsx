'use client'

import { CheckCircle2, Circle, Loader2, MinusCircle, XCircle } from 'lucide-react'
import type { MonitoramentoCollectAllProgress, MonitoramentoCollectStepStatus } from '@/lib/monitoramento-collect-all'
import { cn } from '@/lib/utils'

function StepIcon({ status }: { status: MonitoramentoCollectStepStatus }) {
  if (status === 'running') {
    return <Loader2 className="h-4 w-4 animate-spin text-[rgb(var(--color-primary))]" aria-hidden />
  }
  if (status === 'success') {
    return <CheckCircle2 className="h-4 w-4 text-[#3B6D11]" aria-hidden />
  }
  if (status === 'skipped') {
    return <MinusCircle className="h-4 w-4 text-amber-600" aria-hidden />
  }
  if (status === 'error') {
    return <XCircle className="h-4 w-4 text-status-danger" aria-hidden />
  }
  return <Circle className="h-4 w-4 text-text-muted" aria-hidden />
}

interface PanoramaCollectProgressProps {
  progress: MonitoramentoCollectAllProgress
}

export function PanoramaCollectProgress({ progress }: PanoramaCollectProgressProps) {
  const { steps, currentStepId, stepIndex, totalSteps, running } = progress
  const currentLabel = steps.find((s) => s.id === currentStepId)?.label

  return (
    <div className="rounded-xl border border-[rgb(var(--color-border-tertiary)/0.85)] bg-bg-surface px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium text-text-primary">
          {running
            ? `Atualizando fontes (${stepIndex}/${totalSteps})${currentLabel ? ` · ${currentLabel}` : ''}`
            : 'Atualização das fontes concluída'}
        </p>
        {running ? (
          <p className="text-xs text-text-muted">Não feche esta página — Meta Ads leva 1–3 min por candidato.</p>
        ) : null}
      </div>

      <ul className="mt-3 space-y-2">
        {steps.map((step) => (
          <li key={step.id} className="flex items-start gap-2 text-sm">
            <span className="mt-0.5 shrink-0">
              <StepIcon status={step.status} />
            </span>
            <span className="min-w-0">
              <span
                className={cn(
                  'font-medium',
                  step.status === 'error' ? 'text-status-danger' : 'text-text-primary'
                )}
              >
                {step.label}
              </span>
              {step.message ? (
                <span className="block text-xs text-text-secondary">{step.message}</span>
              ) : null}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
