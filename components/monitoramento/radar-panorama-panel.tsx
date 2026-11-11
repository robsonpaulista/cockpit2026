'use client'

import { RefreshCw } from 'lucide-react'
import { PanoramaBoardTse } from '@/components/monitoramento/panorama-board-tse'
import {
  RadarAviso,
  RadarCodigo,
  RadarColetar,
  RadarProgresso,
  fmtDataHora,
  type RadarAbaProps,
} from '@/components/monitoramento/radar-ui'
import type { usePanoramaPanel } from '@/components/monitoramento/use-panorama-panel'
import { TseErro, tseBotaoCinzaClass, tseBotaoIconeClass } from '@/components/tse/tse-ui'
import type { MonitoramentoCollectAllProgress, MonitoramentoCollectStepStatus } from '@/lib/monitoramento-collect-all'
import { cn } from '@/lib/utils'

const ROTULO_STATUS: Record<MonitoramentoCollectStepStatus, string> = {
  pending: 'na fila',
  running: 'coletando',
  success: 'ok',
  skipped: 'pulado',
  error: 'erro',
}

function percentColeta(p: MonitoramentoCollectAllProgress): number {
  const feitas = p.steps.filter((s) => s.status !== 'pending' && s.status !== 'running').length
  return p.totalSteps > 0 ? (feitas / p.totalSteps) * 100 : 0
}

type PanoramaState = ReturnType<typeof usePanoramaPanel>

export function RadarPanoramaPanel({ state }: RadarAbaProps & { state: PanoramaState }) {
  const {
    panorama,
    loading,
    refreshing,
    collectingAll,
    collectProgress,
    metaAdsProgress,
    error,
    busy,
    animationEpoch,
  } = state

  const etapaAtual = collectProgress?.steps.find((s) => s.id === collectProgress.currentStepId)
  const coletaTerminada = !collectingAll && collectProgress && !collectProgress.running

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <span className="text-[13px] text-[var(--tse-muted)]">
          {panorama.windowLabel}
          {panorama.lastUpdated ? ` · atualizado em ${fmtDataHora(panorama.lastUpdated)}` : ''}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => void state.carregar(true)} disabled={busy} className={tseBotaoCinzaClass}>
            <RefreshCw className={cn(tseBotaoIconeClass, refreshing && 'animate-spin')} />
            Recarregar
          </button>
          <RadarColetar onClick={() => void state.coletarTodas()} ocupado={collectingAll} disabled={busy}>
            Coletar todas
          </RadarColetar>
        </div>
      </div>

      {panorama.setupRequired ? (
        <RadarAviso titulo="Tabelas do radar ausentes">
          Execute os scripts em <RadarCodigo>database/</RadarCodigo> do YouTube, Notícias, Trends e Meta Ads no Supabase
          antes da primeira coleta.
        </RadarAviso>
      ) : null}

      {collectingAll && collectProgress ? (
        <RadarProgresso
          titulo={`Atualizando fontes · ${collectProgress.stepIndex + 1} de ${collectProgress.totalSteps}`}
          detalhe={
            collectProgress.currentStepId === 'meta-ads' && metaAdsProgress
              ? `Anúncios: ${metaAdsProgress.message}`
              : etapaAtual
                ? `${etapaAtual.label}: ${etapaAtual.message || 'coletando…'}`
                : undefined
          }
          percent={percentColeta(collectProgress)}
          rodape={collectProgress.steps.map((s) => `${s.label} ${ROTULO_STATUS[s.status]}`).join(' · ')}
        />
      ) : null}

      {coletaTerminada ? (
        <RadarAviso tom={collectProgress.steps.some((s) => s.status === 'error') ? 'atencao' : 'ok'} titulo="Coleta concluída">
          {collectProgress.steps.map((s) => `${s.label}: ${s.message || ROTULO_STATUS[s.status]}`).join(' · ')}
        </RadarAviso>
      ) : null}

      {error ? <TseErro>{error}</TseErro> : null}

      <PanoramaBoardTse
        panorama={panorama}
        loading={loading}
        refreshing={refreshing}
        animationEpoch={animationEpoch}
      />
    </div>
  )
}
