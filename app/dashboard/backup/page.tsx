'use client'

import { useCallback, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Database,
  Download,
  HardDrive,
  Loader2,
  RefreshCw,
  Upload,
} from 'lucide-react'
import {
  DashboardPageChrome,
  DashboardPageContent,
  DashboardPageHeader,
  DashboardPageMetaStrip,
  DashboardPageShell,
} from '@/components/dashboard/dashboard-page-chrome'
import { usePermissions } from '@/hooks/use-permissions'
import { useDashboardTopbarVisible } from '@/hooks/use-dashboard-topbar-visible'
import {
  formatBackupBytes,
  type BackupRunSummary,
} from '@/lib/supabase-backup-types'
import {
  brandAmberButtonClass,
  brandAmberIconWrapClass,
  brandAmberPanelBorderClass,
} from '@/lib/sidebar-brand-styles'
import { typographyContentRootClass, typographyPageLeadClass } from '@/lib/typography-chrome'
import { cn } from '@/lib/utils'
import '@/app/dashboard/shared/ipt-page-palette.css'
import '@/app/dashboard/noticias/radar-eleitoral-clean.css'

type RunResult = {
  success: true
  stamp: string
  mode: string
  durationMs: number
  totals: {
    tablesOk: number
    tablesFail: number
    rows: number
    bytes: number
  }
  failures?: Array<{ table: string; error?: string }>
  via: 'download' | 'upload'
  filename?: string
  zipBytes?: number
}

type BusyMode =
  | 'download-standard'
  | 'download-full'
  | 'upload-standard'
  | 'upload-full'
  | null

const secondaryBtnClass =
  'inline-flex items-center gap-2 rounded-lg border border-[var(--radar-border,#ebe8e4)] bg-white px-4 py-2.5 text-sm font-medium text-text-primary transition-colors hover:bg-[#fafaf8] disabled:opacity-50'

function formatWhen(iso: string | null): string {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat('pt-BR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

function formatDuration(ms: number | null): string {
  if (ms == null || !Number.isFinite(ms)) return '—'
  if (ms < 1000) return `${ms} ms`
  const s = ms / 1000
  if (s < 60) return `${s.toFixed(1)} s`
  const m = Math.floor(s / 60)
  const rest = Math.round(s % 60)
  return `${m} min ${rest} s`
}

function modeLabel(mode: string | null): string {
  if (mode === 'full') return 'Completo'
  if (mode === 'standard') return 'Padrão'
  if (mode === 'custom') return 'Custom'
  return mode || '—'
}

function parseFilename(disposition: string | null): string {
  if (!disposition) return 'supabase-backup.zip'
  const m = /filename="([^"]+)"/i.exec(disposition)
  return m?.[1] || 'supabase-backup.zip'
}

export default function BackupPage() {
  const router = useRouter()
  const topbarVisible = useDashboardTopbarVisible()
  const { isAdmin, loading: permLoading } = usePermissions()
  const [runs, setRuns] = useState<BackupRunSummary[]>([])
  const [bucket, setBucket] = useState<string>('db-backups')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState<BusyMode>(null)
  const [lastResult, setLastResult] = useState<RunResult | null>(null)
  const [runError, setRunError] = useState<string | null>(null)

  useEffect(() => {
    document.body.setAttribute('data-ipt-palette', '')
    document.body.setAttribute('data-radar-clean', '')
    return () => {
      document.body.removeAttribute('data-ipt-palette')
      document.body.removeAttribute('data-radar-clean')
    }
  }, [])

  const fetchRuns = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/admin/backup-supabase')
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(typeof data.error === 'string' ? data.error : 'Erro ao listar backups')
        setRuns([])
        return
      }
      setBucket(typeof data.bucket === 'string' ? data.bucket : 'db-backups')
      setRuns(Array.isArray(data.runs) ? (data.runs as BackupRunSummary[]) : [])
      if (typeof data.listError === 'string' && data.listError) {
        setError(data.listError)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao listar backups')
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (permLoading) return
    if (!isAdmin) {
      router.replace('/dashboard')
      return
    }
    void fetchRuns()
  }, [fetchRuns, isAdmin, permLoading, router])

  const downloadBackup = async (full: boolean) => {
    setBusy(full ? 'download-full' : 'download-standard')
    setRunError(null)
    setLastResult(null)
    try {
      const res = await fetch('/api/admin/backup-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full, download: true }),
      })
      const contentType = res.headers.get('content-type') || ''
      if (!res.ok || !contentType.includes('application/zip')) {
        const data = await res.json().catch(() => ({}))
        setRunError(typeof data.error === 'string' ? data.error : 'Falha ao gerar backup')
        return
      }
      const blob = await res.blob()
      const filename = parseFilename(res.headers.get('content-disposition'))
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)

      setLastResult({
        success: true,
        via: 'download',
        stamp: res.headers.get('x-backup-stamp') || filename,
        mode: res.headers.get('x-backup-mode') || (full ? 'full' : 'standard'),
        durationMs: Number(res.headers.get('x-backup-duration-ms') || 0),
        totals: {
          tablesOk: Number(res.headers.get('x-backup-tables-ok') || 0),
          tablesFail: Number(res.headers.get('x-backup-tables-fail') || 0),
          rows: Number(res.headers.get('x-backup-rows') || 0),
          bytes: Number(res.headers.get('x-backup-bytes') || 0),
        },
        filename,
        zipBytes: blob.size,
      })
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Falha ao gerar backup')
    } finally {
      setBusy(null)
    }
  }

  const uploadBackup = async (full: boolean) => {
    setBusy(full ? 'upload-full' : 'upload-standard')
    setRunError(null)
    setLastResult(null)
    try {
      const res = await fetch('/api/admin/backup-supabase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full, upload: true }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setRunError(typeof data.error === 'string' ? data.error : 'Falha ao enviar ao Storage')
        return
      }
      setLastResult({ ...(data as Omit<RunResult, 'via'>), via: 'upload', success: true })
      await fetchRuns()
    } catch (e) {
      setRunError(e instanceof Error ? e.message : 'Falha ao enviar ao Storage')
    } finally {
      setBusy(null)
    }
  }

  if (permLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#f04b23]" />
      </div>
    )
  }

  const latest = runs[0] ?? null
  const isBusy = busy !== null
  const description = (
    <span className={typographyPageLeadClass}>
      Gere um ZIP no seu computador ou envie ao Storage (
      <span className="font-mono text-[12px]">{bucket}</span>).
    </span>
  )

  const refreshAction = (
    <button
      type="button"
      onClick={() => void fetchRuns()}
      disabled={loading || isBusy}
      className={secondaryBtnClass}
    >
      <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
      Atualizar lista
    </button>
  )

  return (
    <DashboardPageShell>
      <DashboardPageChrome>
        {topbarVisible ? (
          <DashboardPageMetaStrip>
            <div className="flex w-full flex-wrap items-center justify-between gap-3">
              {description}
              {refreshAction}
            </div>
          </DashboardPageMetaStrip>
        ) : (
          <DashboardPageHeader
            title="Backup Supabase"
            description={description}
            action={refreshAction}
          />
        )}
      </DashboardPageChrome>

      <DashboardPageContent className={typographyContentRootClass}>
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-5">
          <article className={cn(brandAmberPanelBorderClass, 'p-5')}>
            <div className="mb-4 flex items-start gap-3">
              <span className={brandAmberIconWrapClass}>
                <Download className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-text-primary">Baixar no computador</h2>
                <p className={cn(typographyPageLeadClass, 'mt-1')}>
                  Gera o export e dispara o download do ZIP (manifest + tabelas .jsonl.gz). Não usa
                  o Storage. Padrão omite tabelas grandes; completo inclui todas e pode demorar.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void downloadBackup(false)}
                className={brandAmberButtonClass}
              >
                {busy === 'download-standard' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Baixar padrão
              </button>
              <button
                type="button"
                disabled={isBusy}
                onClick={() => void downloadBackup(true)}
                className={secondaryBtnClass}
              >
                {busy === 'download-full' ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Download className="h-4 w-4" />
                )}
                Baixar completo
              </button>
            </div>

            <div className="mt-6 border-t border-[var(--radar-border,#ebe8e4)] pt-5">
              <div className="mb-3 flex items-start gap-3">
                <span className={brandAmberIconWrapClass}>
                  <Upload className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-text-primary">Enviar ao Storage</h3>
                  <p className={cn(typographyPageLeadClass, 'mt-1')}>
                    Opcional — exige bucket configurado e limite de arquivo suficiente no projeto.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void uploadBackup(false)}
                  className={secondaryBtnClass}
                >
                  {busy === 'upload-standard' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload padrão
                </button>
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void uploadBackup(true)}
                  className={secondaryBtnClass}
                >
                  {busy === 'upload-full' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <HardDrive className="h-4 w-4" />
                  )}
                  Upload completo
                </button>
              </div>
            </div>

            {isBusy ? (
              <p className={cn(typographyPageLeadClass, 'mt-4')}>
                Backup em andamento — não feche esta página…
              </p>
            ) : null}

            {runError ? (
              <div className="mt-4 flex items-start gap-2 rounded-[14px] border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{runError}</span>
              </div>
            ) : null}

            {lastResult ? (
              <div className="mt-4 rounded-[14px] border border-[#ffc9b8] bg-[#fff1ed] px-3 py-3 text-sm text-text-primary">
                <p className="font-medium">
                  {lastResult.via === 'download' ? 'Download pronto' : 'Enviado ao Storage'}
                  {' · '}
                  {modeLabel(lastResult.mode)}
                  {' · '}
                  {lastResult.stamp}
                </p>
                <p className={cn(typographyPageLeadClass, 'mt-1')}>
                  {lastResult.totals.tablesOk} tabelas ok
                  {lastResult.totals.tablesFail
                    ? ` · ${lastResult.totals.tablesFail} falha(s)`
                    : ''}
                  {' · '}
                  {lastResult.totals.rows.toLocaleString('pt-BR')} linhas
                  {' · '}
                  {formatBackupBytes(lastResult.totals.bytes)}
                  {lastResult.zipBytes != null
                    ? ` · ZIP ${formatBackupBytes(lastResult.zipBytes)}`
                    : ''}
                  {' · '}
                  {formatDuration(lastResult.durationMs)}
                </p>
                {lastResult.filename ? (
                  <p className="mt-1 font-mono text-[11px] text-text-muted">{lastResult.filename}</p>
                ) : null}
                {lastResult.failures && lastResult.failures.length > 0 ? (
                  <ul className="mt-2 space-y-1 text-xs text-red-700">
                    {lastResult.failures.map((f) => (
                      <li key={f.table}>
                        <span className="font-mono">{f.table}</span>
                        {f.error ? `: ${f.error}` : ''}
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            ) : null}
          </article>

          {latest ? (
            <div className="grid gap-3 sm:grid-cols-4">
              {[
                {
                  label: 'Último no Storage',
                  value: formatWhen(latest.createdAt),
                  sub: latest.stamp,
                },
                { label: 'Modo', value: modeLabel(latest.mode) },
                {
                  label: 'Volume',
                  value: latest.totals
                    ? `${latest.totals.rows.toLocaleString('pt-BR')} linhas`
                    : '—',
                  sub: latest.totals ? formatBackupBytes(latest.totals.bytes) : undefined,
                },
                {
                  label: 'Status',
                  value: latest.totals
                    ? `${latest.totals.tablesOk} ok${
                        latest.totals.tablesFail ? ` · ${latest.totals.tablesFail} falha` : ''
                      }`
                    : latest.hasManifest
                      ? '—'
                      : 'Sem manifest',
                  sub: formatDuration(latest.durationMs),
                },
              ].map((card) => (
                <div key={card.label} className={cn(brandAmberPanelBorderClass, 'p-3.5')}>
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    {card.label}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-text-primary">{card.value}</p>
                  {card.sub ? (
                    <p className="mt-0.5 font-mono text-[11px] text-text-muted">{card.sub}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}

          <article className={cn(brandAmberPanelBorderClass, 'overflow-hidden p-0')}>
            <div className="flex items-center gap-3 border-b border-[var(--radar-border,#ebe8e4)] px-5 py-3.5">
              <span className={brandAmberIconWrapClass}>
                <Database className="h-4 w-4" />
              </span>
              <h2 className="text-sm font-semibold text-text-primary">Backups no Storage</h2>
            </div>

            {error ? (
              <div className="flex items-start gap-2 px-5 py-6 text-sm text-red-700">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            ) : loading && runs.length === 0 ? (
              <div className="flex items-center justify-center gap-2 py-12 text-text-muted">
                <Loader2 className="h-5 w-5 animate-spin text-[#f04b23]" />
                <span className="text-sm">Carregando…</span>
              </div>
            ) : runs.length === 0 ? (
              <p className={cn(typographyPageLeadClass, 'px-5 py-10 text-center')}>
                Nenhum backup no Storage. Use <strong className="font-medium text-text-primary">Baixar</strong>{' '}
                acima ou configure o bucket.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-[var(--radar-border,#ebe8e4)] text-[11px] uppercase tracking-wider text-text-muted">
                      <th className="px-5 py-2.5 font-medium">Stamp</th>
                      <th className="px-5 py-2.5 font-medium">Quando</th>
                      <th className="px-5 py-2.5 font-medium">Modo</th>
                      <th className="px-5 py-2.5 font-medium">Tabelas</th>
                      <th className="px-5 py-2.5 font-medium">Linhas</th>
                      <th className="px-5 py-2.5 font-medium">Tamanho</th>
                      <th className="px-5 py-2.5 font-medium">Duração</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.map((run) => (
                      <tr
                        key={run.stamp}
                        className="border-b border-[var(--radar-border,#ebe8e4)] last:border-0"
                      >
                        <td className="px-5 py-2.5 font-mono text-xs text-text-primary">
                          {run.stamp}
                        </td>
                        <td className="px-5 py-2.5 text-text-muted">{formatWhen(run.createdAt)}</td>
                        <td className="px-5 py-2.5 text-text-primary">{modeLabel(run.mode)}</td>
                        <td className="px-5 py-2.5 text-text-muted">
                          {run.totals
                            ? `${run.totals.tablesOk}${
                                run.totals.tablesFail ? ` / ${run.totals.tablesFail}✗` : ''
                              }`
                            : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-text-muted">
                          {run.totals ? run.totals.rows.toLocaleString('pt-BR') : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-text-muted">
                          {run.totals ? formatBackupBytes(run.totals.bytes) : '—'}
                        </td>
                        <td className="px-5 py-2.5 text-text-muted">
                          {formatDuration(run.durationMs)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </article>
        </div>
      </DashboardPageContent>
    </DashboardPageShell>
  )
}
