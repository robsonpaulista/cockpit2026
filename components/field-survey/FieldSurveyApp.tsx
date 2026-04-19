'use client'

import { useEffect, useState } from 'react'
import { FieldSurveyWizard } from '@/components/field-survey/FieldSurveyWizard'
import {
  cacheSurveyConfig,
  defaultListsFallback,
  parseSurveyConfigPayload,
  parseSurveyRuntimeOptions,
  readCachedSurveyConfig,
  type SurveyConfigLists,
} from '@/services/field-survey-sync'
import type { BuildSurveyStepsOptions } from '@/lib/field-survey-steps'
import { Loader2 } from 'lucide-react'

interface FieldSurveyAppProps {
  defaultInterviewerHint: string
}

export function FieldSurveyApp({ defaultInterviewerHint }: FieldSurveyAppProps) {
  const [lists, setLists] = useState<SurveyConfigLists | null>(null)
  const [stepOptions, setStepOptions] = useState<BuildSurveyStepsOptions | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/campo-pesquisa/config')
        if (res.ok) {
          const data: unknown = await res.json()
          if (!cancelled) {
            cacheSurveyConfig(data)
            setLists(parseSurveyConfigPayload(data))
            setStepOptions(parseSurveyRuntimeOptions(data))
          }
          return
        }
      } catch {
        /* offline / erro */
      }
      const cached = readCachedSurveyConfig()
      if (!cancelled) {
        setLists(
          cached ? parseSurveyConfigPayload(cached) : defaultListsFallback()
        )
        setStepOptions(cached ? parseSurveyRuntimeOptions(cached) : undefined)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!lists) {
    return (
      <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-zinc-500">
        <Loader2 className="h-10 w-10 animate-spin text-orange-600" />
        <p className="text-sm">Carregando questionário…</p>
      </div>
    )
  }

  return (
    <FieldSurveyWizard
      lists={lists}
      defaultInterviewerHint={defaultInterviewerHint}
      stepOptions={stepOptions}
    />
  )
}
