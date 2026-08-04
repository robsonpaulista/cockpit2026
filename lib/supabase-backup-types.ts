/** Tipos e helpers compartilhados (seguros no client). */

export type BackupTableResult = {
  table: string
  rows: number
  bytes: number
  ok: boolean
  error?: string
}

export type BackupManifest = {
  createdAt: string
  projectUrl: string
  mode: 'standard' | 'full' | 'custom'
  durationMs: number
  stamp: string
  tables: BackupTableResult[]
  totals: {
    tablesOk: number
    tablesFail: number
    rows: number
    bytes: number
  }
}

export type BackupRunSummary = {
  stamp: string
  createdAt: string | null
  mode: BackupManifest['mode'] | null
  durationMs: number | null
  totals: BackupManifest['totals'] | null
  hasManifest: boolean
}

export function formatBackupBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}
