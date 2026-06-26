'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { photofinderApi } from '@/lib/photofinder-api'
import type {
  PhotofinderStartSyncOptions,
  PhotofinderSyncEvent,
  PhotofinderSyncProgress,
} from '@/lib/photofinder/types'

const IDLE_PROGRESS: PhotofinderSyncProgress = {
  phase: 'idle',
  folderName: '',
  message: '',
  totalPhotos: null,
  processed: 0,
  added: 0,
  updated: 0,
  recognized: 0,
  recognizeProcessed: null,
  recognizeErrors: null,
  recognizeRemaining: null,
  recognizeOverwrite: false,
  percent: null,
  etaSeconds: null,
  error: null,
}

function formatEta(seconds: number | null): string | null {
  if (seconds == null || !Number.isFinite(seconds) || seconds <= 0) return null
  if (seconds < 60) return `~${Math.ceil(seconds)}s restantes`
  const mins = Math.ceil(seconds / 60)
  return mins === 1 ? '~1 min restante' : `~${mins} min restantes`
}

export function usePhotofinderSync(onChunkComplete?: () => void | Promise<void>) {
  const [syncStatus, setSyncStatus] = useState<PhotofinderSyncEvent | null>(null)
  const [progress, setProgress] = useState<PhotofinderSyncProgress>(IDLE_PROGRESS)
  const processingRef = useRef(false)
  const startedAtRef = useRef<number | null>(null)

  const checkStatus = useCallback(async () => {
    try {
      const status = await photofinderApi.getSyncStatus()
      setSyncStatus(status as PhotofinderSyncEvent)
    } catch (err) {
      console.error('Erro ao verificar sync:', err)
    }
  }, [])

  useEffect(() => {
    void checkStatus()
  }, [checkStatus])

  const resetProgress = useCallback(() => {
    setProgress(IDLE_PROGRESS)
    startedAtRef.current = null
  }, [])

  const runRecognition = useCallback(
    async (
      folderName: string,
      syncStats: { processed: number; added: number; updated: number },
      eventFolderIds?: string[],
      options?: { overwrite?: boolean },
    ) => {
      const overwrite = options?.overwrite === true
      let totalRecognized = 0
      let totalProcessed = 0
      let totalErrors = 0

      try {
        const status = await photofinderApi.getRecognizeStatus(eventFolderIds, { overwrite })
        const initial = overwrite ? (status.total ?? 0) : status.pending

        if (status.enrolledPersons === 0 || initial === 0) {
          return {
            recognized: 0,
            processed: 0,
            errors: 0,
            skipped: true,
            overwrite,
            reason:
              status.enrolledPersons === 0
                ? 'Cadastre pessoas em Cadastro de pessoas para identificação automática.'
                : eventFolderIds?.length === 0
                  ? 'Nenhuma pasta de evento selecionada.'
                  : overwrite
                    ? 'Nenhuma foto nas pastas selecionadas.'
                    : 'Nenhuma foto pendente de análise nas pastas selecionadas.',
          }
        }

        let done = false
        let remaining = initial
        let lastRemaining = remaining
        let staleChunks = 0
        let afterPhotoId: string | undefined
        startedAtRef.current = Date.now()

        setProgress((prev) => ({
          ...prev,
          phase: 'recognizing',
          recognizeOverwrite: overwrite,
          message: overwrite
            ? `Reidentificando fotos… 0 de ${remaining} · 0 identificadas`
            : `Analisando fotos… 0 de ${remaining} · 0 identificadas`,
          recognizeRemaining: remaining,
          recognizeProcessed: 0,
          recognizeErrors: 0,
          recognized: 0,
          percent: 0,
        }))

        while (!done) {
          const chunk = await photofinderApi.recognizeChunk({
            limit: 5,
            onlyUntagged: !overwrite,
            overwrite,
            afterPhotoId,
            eventFolderIds,
          })
          done = chunk.done
          totalRecognized += chunk.recognized
          totalProcessed += chunk.processed
          totalErrors += chunk.errors
          remaining = chunk.remaining
          afterPhotoId = chunk.lastPhotoId ?? undefined

          if (!overwrite && remaining === lastRemaining && chunk.processed > 0) {
            staleChunks += 1
            if (staleChunks >= 2) {
              done = true
            }
          } else {
            staleChunks = 0
          }
          lastRemaining = remaining

          const elapsedSec = (Date.now() - (startedAtRef.current ?? Date.now())) / 1000
          const rate = totalProcessed > 0 ? totalProcessed / elapsedSec : 0
          const etaSeconds = rate > 0 ? Math.max(0, remaining / rate) : null
          const analyzed = overwrite
            ? totalProcessed
            : Math.max(totalProcessed, initial - remaining)
          const percent =
            initial > 0 ? Math.min(100, Math.round((analyzed / initial) * 100)) : 100

          setProgress((prev) => ({
            ...prev,
            phase: 'recognizing',
            recognizeOverwrite: overwrite,
            message:
              !overwrite && remaining > 0 && staleChunks >= 2
                ? `Finalizando… ${analyzed} de ${initial} analisadas · ${remaining} com falha persistente`
                : overwrite
                  ? `Reidentificando fotos… ${analyzed} de ${initial} · ${totalRecognized} identificadas · ${remaining} restantes`
                  : `Analisando fotos… ${analyzed} de ${initial} · ${totalRecognized} identificadas · ${remaining} restantes`,
            recognized: totalRecognized,
            recognizeProcessed: analyzed,
            recognizeErrors: totalErrors,
            recognizeRemaining: remaining,
            percent,
            etaSeconds,
          }))
        }

        const stalled = !overwrite && lastRemaining > 0 && staleChunks >= 2
        return {
          recognized: totalRecognized,
          processed: overwrite ? totalProcessed : Math.max(totalProcessed, initial - lastRemaining),
          errors: totalErrors,
          skipped: false,
          overwrite,
          reason: stalled
            ? `${lastRemaining} foto(s) não puderam ser analisadas (arquivo inválido ou corrompido).`
            : totalErrors > 0
              ? `${totalErrors} foto(s) com erro de leitura.`
              : null,
        }
      } catch (err) {
        console.warn('Reconhecimento facial indisponível:', err)
        return {
          recognized: totalRecognized,
          processed: totalProcessed,
          errors: totalErrors,
          skipped: true,
          overwrite,
          reason:
            err instanceof Error
              ? err.message
              : 'Motor de reconhecimento indisponível (npm run dev)',
        }
      }
    },
    [],
  )

  const processChunks = useCallback(
    async (syncId: string, options: PhotofinderStartSyncOptions, totalPhotos: number | null) => {
      if (processingRef.current) return
      processingRef.current = true
      startedAtRef.current = Date.now()
      const folderName = options.folderName ?? 'Pasta selecionada'

      let syncProcessed = 0
      let syncAdded = 0
      let syncUpdated = 0

      try {
        let pageToken: string | null | undefined = null
        let done = false

        while (!done) {
          const result = await photofinderApi.processSyncChunk(syncId, pageToken, options)
          done = result.done
          pageToken = result.nextPageToken

          syncProcessed = result.totalStats?.processed ?? 0
          syncAdded = result.totalStats?.added ?? 0
          syncUpdated = result.totalStats?.updated ?? 0
          const elapsedSec = (Date.now() - (startedAtRef.current ?? Date.now())) / 1000
          const rate = syncProcessed > 0 ? syncProcessed / elapsedSec : 0
          const etaSeconds =
            totalPhotos != null && rate > 0 ? Math.max(0, (totalPhotos - syncProcessed) / rate) : null
          const percent =
            totalPhotos != null && totalPhotos > 0
              ? Math.min(100, Math.round((syncProcessed / totalPhotos) * 100))
              : null

          setProgress((prev) => ({
            ...prev,
            phase: 'syncing',
            message:
              totalPhotos != null
                ? `${syncProcessed} de ${totalPhotos} fotos importadas`
                : `${syncProcessed} fotos importadas`,
            totalPhotos,
            processed: syncProcessed,
            added: syncAdded,
            updated: syncUpdated,
            percent,
            etaSeconds,
          }))

          await checkStatus()
          if (onChunkComplete) await onChunkComplete()

          if (!done && !pageToken) break
        }

        const recognition = await runRecognition(folderName, {
          processed: syncProcessed,
          added: syncAdded,
          updated: syncUpdated,
        })

        const recognizeMsg =
          recognition.recognized > 0
            ? ` · ${recognition.recognized} pessoas identificadas`
            : recognition.reason
              ? ` · ${recognition.reason}`
              : ''

        setProgress((prev) => ({
          ...prev,
          phase: 'completed',
          message: `Sincronização concluída — ${syncProcessed} fotos (${syncAdded} novas, ${syncUpdated} atualizadas)${recognizeMsg}`,
          processed: syncProcessed,
          added: syncAdded,
          updated: syncUpdated,
          recognized: recognition.recognized,
          percent: 100,
          etaSeconds: 0,
        }))
      } finally {
        processingRef.current = false
        await checkStatus()
      }
    },
    [checkStatus, onChunkComplete, runRecognition],
  )

  const startSync = useCallback(
    async (options: PhotofinderStartSyncOptions) => {
      const folderName = options.folderName ?? 'Pasta selecionada'

      try {
        setProgress({
          phase: 'scanning',
          folderName,
          message: 'Coletando informações da pasta no Drive…',
          totalPhotos: null,
          processed: 0,
          added: 0,
          updated: 0,
          recognized: 0,
          recognizeProcessed: null,
          recognizeErrors: null,
          recognizeRemaining: null,
          recognizeOverwrite: false,
          percent: null,
          etaSeconds: null,
          error: null,
        })

        const scan = await photofinderApi.scanFolder(options.folderId)
        const syncOptions: PhotofinderStartSyncOptions = {
          ...options,
          folderIds: scan.folderIds,
        }

        setProgress({
          phase: 'scanning',
          folderName,
          message: `${scan.totalPhotos} ${scan.totalPhotos === 1 ? 'foto encontrada' : 'fotos encontradas'}. Iniciando sincronização…`,
          totalPhotos: scan.totalPhotos,
          processed: 0,
          added: 0,
          updated: 0,
          recognized: 0,
          recognizeProcessed: null,
          recognizeErrors: null,
          recognizeRemaining: null,
          recognizeOverwrite: false,
          percent: scan.totalPhotos > 0 ? 0 : 100,
          etaSeconds: null,
          error: null,
        })

        if (scan.totalPhotos === 0) {
          setProgress({
            phase: 'completed',
            folderName,
            message: 'Nenhuma foto encontrada nesta pasta.',
            totalPhotos: 0,
            processed: 0,
            added: 0,
            updated: 0,
            recognized: 0,
            recognizeProcessed: null,
            recognizeErrors: null,
            recognizeRemaining: null,
            recognizeOverwrite: false,
            percent: 100,
            etaSeconds: 0,
            error: null,
          })
          return
        }

        const { syncId } = await photofinderApi.startSync(syncOptions)

        setProgress((prev) => ({
          ...prev,
          phase: 'syncing',
          message: 'Importando fotos para o banco…',
        }))

        await processChunks(syncId, syncOptions, scan.totalPhotos)
      } catch (err) {
        console.error('Erro ao sincronizar:', err)
        const message = err instanceof Error ? err.message : 'Falha ao sincronizar fotos'
        setProgress({
          phase: 'error',
          folderName,
          message,
          totalPhotos: null,
          processed: 0,
          added: 0,
          updated: 0,
          recognized: 0,
          recognizeProcessed: null,
          recognizeErrors: null,
          recognizeRemaining: null,
          recognizeOverwrite: false,
          percent: null,
          etaSeconds: null,
          error: message,
        })
        throw err
      }
    },
    [processChunks],
  )

  const startRecognitionOnly = useCallback(
    async (eventFolderIds: string[], options?: { overwrite?: boolean }) => {
      const overwrite = options?.overwrite === true
      if (processingRef.current) return
      processingRef.current = true
      try {
        setProgress({
          phase: 'recognizing',
          folderName: '',
          message: overwrite
            ? 'Iniciando reidentificação de pessoas…'
            : 'Iniciando identificação de pessoas…',
          totalPhotos: null,
          processed: 0,
          added: 0,
          updated: 0,
          recognized: 0,
          recognizeProcessed: null,
          recognizeErrors: null,
          recognizeRemaining: null,
          recognizeOverwrite: overwrite,
          percent: null,
          etaSeconds: null,
          error: null,
        })

        const recognition = await runRecognition(
          '',
          { processed: 0, added: 0, updated: 0 },
          eventFolderIds,
          { overwrite },
        )

        const processedCount = recognition.processed ?? 0
        const errorSuffix =
          (recognition.errors ?? 0) > 0 ? ` · ${recognition.errors} com erro de leitura` : ''
        const stallSuffix =
          recognition.reason && !recognition.skipped ? ` · ${recognition.reason}` : ''

        setProgress((prev) => ({
          ...prev,
          phase: 'completed',
          recognizeOverwrite: overwrite,
          message:
            recognition.recognized > 0
              ? overwrite
                ? `Reidentificação concluída — ${recognition.recognized} de ${processedCount} fotos analisadas foram etiquetadas${errorSuffix}${stallSuffix}`
                : `Identificação concluída — ${recognition.recognized} de ${processedCount} fotos analisadas foram etiquetadas${errorSuffix}${stallSuffix}`
              : recognition.skipped
                ? (recognition.reason ?? (overwrite ? 'Nenhuma foto para reidentificar' : 'Nenhuma foto para identificar'))
                : processedCount > 0
                  ? overwrite
                    ? `Reidentificação concluída — ${processedCount} fotos analisadas, nenhuma pessoa identificada${errorSuffix}${stallSuffix}`
                    : `Análise concluída — ${processedCount} fotos analisadas, nenhuma pessoa identificada${errorSuffix}${stallSuffix}`
                  : recognition.reason ?? (overwrite ? 'Nenhuma foto reidentificada' : 'Nenhuma foto identificada'),
          recognized: recognition.recognized,
          recognizeProcessed: processedCount,
          recognizeErrors: recognition.errors ?? 0,
          recognizeRemaining: 0,
          percent: 100,
          etaSeconds: 0,
        }))
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Falha ao identificar pessoas'
        setProgress((prev) => ({
          ...prev,
          phase: 'error',
          message,
          error: message,
        }))
        throw err
      } finally {
        processingRef.current = false
      }
    },
    [runRecognition],
  )

  const isInProgress =
    progress.phase === 'scanning' || progress.phase === 'syncing' || progress.phase === 'recognizing'

  return {
    syncStatus,
    progress,
    isInProgress,
    startSync,
    startRecognitionOnly,
    resetProgress,
    refresh: checkStatus,
    formatEta,
  }
}
