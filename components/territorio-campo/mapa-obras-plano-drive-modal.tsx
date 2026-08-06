'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  FolderOpen,
  Link2,
  Loader2,
  Search,
  Unlink,
  X,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { chromeButtonClass } from '@/lib/button-chrome'
import type { ObraMapaRow } from '@/lib/obras-mapa'
import {
  planoDriveTemArquivo,
  planoDriveTemNota,
  type ObraPlanoDriveLink,
} from '@/lib/obras-mapa-plano-drive'

type DriveChild = {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  webViewLink: string | null
}

type PathCrumb = { id: string; name: string }

type Props = {
  isOpen: boolean
  onClose: () => void
  obra: ObraMapaRow | null
  linkAtual: ObraPlanoDriveLink | null
  onLinked: (link: ObraPlanoDriveLink | null) => void
}

function normalizeNome(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}

/** Modal para vincular obra da lista ao plano de trabalho na pasta Drive. */
export function MapaObrasPlanoDriveModal({
  isOpen,
  onClose,
  obra,
  linkAtual,
  onLinked,
}: Props) {
  const [clientEmail, setClientEmail] = useState<string | null>(null)
  const [path, setPath] = useState<PathCrumb[]>([])
  const [children, setChildren] = useState<DriveChild[]>([])
  const [loadingFolder, setLoadingFolder] = useState(false)
  const [folderError, setFolderError] = useState<string | null>(null)
  const [folderHint, setFolderHint] = useState<string | null>(null)
  const [busca, setBusca] = useState('')
  const [savingId, setSavingId] = useState<string | null>(null)
  const [savingNota, setSavingNota] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [didAutoEnterMunicipio, setDidAutoEnterMunicipio] = useState(false)
  const [notaTexto, setNotaTexto] = useState('')

  const currentFolderName = path[path.length - 1]?.name ?? null

  const loadFolder = useCallback(async (folderIdOrUrl: string, opts?: { replacePath?: PathCrumb[] }) => {
    setLoadingFolder(true)
    setFolderError(null)
    setFolderHint(null)
    setBusca('')
    try {
      const res = await fetch('/api/google-drive/folder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ folderIdOrUrl, pageSize: 100 }),
      })
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean
        clientEmail?: string
        folder?: { id?: string; name?: string }
        children?: DriveChild[]
        error?: string
        hint?: string
      }

      if (data.clientEmail) setClientEmail(data.clientEmail)

      if (!res.ok || !data.ok || !data.folder?.id) {
        setFolderError(data.error || 'Não foi possível acessar a pasta do Drive.')
        setFolderHint(data.hint ?? null)
        setChildren([])
        return null
      }

      const crumb: PathCrumb = {
        id: data.folder.id,
        name: data.folder.name ?? '(pasta)',
      }
      setPath(opts?.replacePath ?? [crumb])
      setChildren(data.children ?? [])
      return { folder: crumb, children: data.children ?? [] }
    } catch (e) {
      setFolderError(e instanceof Error ? e.message : 'Falha de rede')
      setChildren([])
      return null
    } finally {
      setLoadingFolder(false)
    }
  }, [])

  useEffect(() => {
    if (!isOpen || !obra) return
    setActionError(null)
    setDidAutoEnterMunicipio(false)
    setPath([])
    setChildren([])
    setNotaTexto(linkAtual?.nota_texto?.trim() || '')

    void (async () => {
      try {
        const metaRes = await fetch('/api/google-drive/folder')
        const meta = (await metaRes.json().catch(() => ({}))) as {
          clientEmail?: string | null
          defaultFolderId?: string | null
        }
        if (meta.clientEmail) setClientEmail(meta.clientEmail)
        const rootId = meta.defaultFolderId?.trim() || ''
        await loadFolder(rootId)
      } catch (e) {
        setFolderError(e instanceof Error ? e.message : 'Falha de rede')
      }
    })()
  }, [isOpen, obra, loadFolder])

  // Entra automaticamente na subpasta do município, se existir (ex.: Parnaiba).
  useEffect(() => {
    if (!isOpen || !obra || loadingFolder || didAutoEnterMunicipio || path.length !== 1) return
    const alvo = normalizeNome(obra.municipio || '')
    if (!alvo) return
    const match = children.find(
      (c) => c.isFolder && normalizeNome(c.name) === alvo,
    )
    if (!match) {
      setDidAutoEnterMunicipio(true)
      return
    }
    setDidAutoEnterMunicipio(true)
    void loadFolder(match.id, {
      replacePath: [...path, { id: match.id, name: match.name }],
    })
  }, [
    children,
    didAutoEnterMunicipio,
    isOpen,
    loadingFolder,
    loadFolder,
    obra,
    path,
  ])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, onClose])

  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase()
    const list = !q
      ? children
      : children.filter((f) => f.name.toLowerCase().includes(q))
    return [...list].sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1
      return a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base' })
    })
  }, [busca, children])

  if (!isOpen || !obra) return null

  const entrarPasta = (folder: DriveChild) => {
    if (!folder.isFolder) return
    void loadFolder(folder.id, {
      replacePath: [...path, { id: folder.id, name: folder.name }],
    })
  }

  const irParaCrumb = (index: number) => {
    const crumb = path[index]
    if (!crumb) return
    void loadFolder(crumb.id, { replacePath: path.slice(0, index + 1) })
  }

  const vincular = async (file: DriveChild) => {
    if (file.isFolder) {
      entrarPasta(file)
      return
    }
    setSavingId(file.id)
    setActionError(null)
    try {
      const res = await fetch(
        `/api/campo/obras-mapa/plano-drive/${encodeURIComponent(obra.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            driveFileId: file.id,
            driveFileName: file.name,
            driveWebViewLink: file.webViewLink,
          }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        link?: ObraPlanoDriveLink
        error?: string
      }
      if (!res.ok || !data.link) {
        setActionError(data.error || 'Falha ao salvar vínculo')
        return
      }
      onLinked(data.link)
      onClose()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Falha de rede')
    } finally {
      setSavingId(null)
    }
  }

  const salvarNota = async () => {
    const texto = notaTexto.trim()
    if (!texto) {
      setActionError('Digite um texto sobre a situação do plano.')
      return
    }
    setSavingNota(true)
    setActionError(null)
    try {
      const res = await fetch(
        `/api/campo/obras-mapa/plano-drive/${encodeURIComponent(obra.id)}`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ notaTexto: texto }),
        },
      )
      const data = (await res.json().catch(() => ({}))) as {
        link?: ObraPlanoDriveLink
        error?: string
      }
      if (!res.ok || !data.link) {
        setActionError(data.error || 'Falha ao salvar texto')
        return
      }
      onLinked(data.link)
      onClose()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Falha de rede')
    } finally {
      setSavingNota(false)
    }
  }

  const desvincular = async () => {
    setRemoving(true)
    setActionError(null)
    try {
      const res = await fetch(
        `/api/campo/obras-mapa/plano-drive/${encodeURIComponent(obra.id)}`,
        { method: 'DELETE' },
      )
      const data = (await res.json().catch(() => ({}))) as { error?: string }
      if (!res.ok) {
        setActionError(data.error || 'Falha ao remover vínculo')
        return
      }
      onLinked(null)
      onClose()
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Falha de rede')
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mapa-obras-plano-drive-title"
      onClick={onClose}
    >
      <div
        className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border border-card bg-surface shadow-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-card px-4 py-3">
          <div className="min-w-0">
            <h2
              id="mapa-obras-plano-drive-title"
              className="flex items-center gap-2 text-base font-semibold text-text-primary"
            >
              <Link2 className="h-4 w-4 text-[#f04b23]" aria-hidden />
              Plano de trabalho (Drive)
            </h2>
            <p className="mt-0.5 line-clamp-2 text-xs text-text-secondary">
              {obra.municipio} · {obra.obra}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-card p-1.5 text-text-secondary hover:bg-background"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 overflow-y-auto px-4 py-3">
          {linkAtual && (planoDriveTemArquivo(linkAtual) || planoDriveTemNota(linkAtual)) ? (
            <div className="rounded-xl border border-status-success/30 bg-status-success/10 px-3 py-2.5 text-xs">
              <p className="font-semibold text-text-primary">
                {planoDriveTemArquivo(linkAtual) ? 'Arquivo vinculado' : 'Nota registrada'}
              </p>
              <p className="mt-0.5 text-text-secondary">
                {planoDriveTemArquivo(linkAtual)
                  ? linkAtual.drive_file_name || linkAtual.drive_file_id
                  : linkAtual.nota_texto}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {linkAtual.drive_web_view_link ? (
                  <a
                    href={linkAtual.drive_web_view_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={cn(chromeButtonClass, 'h-8 text-[11px]')}
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden />
                    Abrir
                  </a>
                ) : null}
                <button
                  type="button"
                  onClick={() => void desvincular()}
                  disabled={removing}
                  className={cn(chromeButtonClass, 'h-8 text-[11px] disabled:opacity-50')}
                >
                  {removing ? (
                    <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                  ) : (
                    <Unlink className="h-3 w-3" aria-hidden />
                  )}
                  Remover
                </button>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border border-card bg-background px-3 py-2.5">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
              Sem plano no Drive?
            </p>
            <p className="mt-0.5 text-[11px] text-text-secondary">
              Informe um texto (ex.: “aguardando envio”, “não se aplica”).
            </p>
            <textarea
              value={notaTexto}
              onChange={(e) => setNotaTexto(e.target.value)}
              rows={3}
              maxLength={2000}
              placeholder="Situação do plano de trabalho…"
              className="mt-2 w-full resize-y rounded-lg border border-card bg-surface px-3 py-2 text-xs text-text-primary outline-none focus:border-[#f04b23]"
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={() => void salvarNota()}
                disabled={savingNota || !notaTexto.trim()}
                className={cn(chromeButtonClass, 'h-8 text-[11px] disabled:opacity-50')}
              >
                {savingNota ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
                ) : (
                  <FileText className="h-3 w-3" aria-hidden />
                )}
                Salvar texto
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-card bg-background px-3 py-2 text-[11px] text-text-secondary">
            {currentFolderName ? (
              <p className="flex items-center gap-1.5 text-text-primary">
                <CheckCircle2 className="h-3.5 w-3.5 text-status-success" aria-hidden />
                Pasta: <span className="font-medium">{currentFolderName}</span>
              </p>
            ) : null}
            {clientEmail ? (
              <p className="mt-1 break-all">
                SA: <code className="text-text-primary">{clientEmail}</code>
              </p>
            ) : null}
          </div>

          {path.length > 0 ? (
            <nav
              className="flex flex-wrap items-center gap-0.5 text-[11px] text-text-secondary"
              aria-label="Caminho no Drive"
            >
              {path.map((crumb, index) => {
                const isLast = index === path.length - 1
                return (
                  <span key={crumb.id} className="inline-flex items-center gap-0.5">
                    {index > 0 ? (
                      <ChevronRight className="h-3 w-3 shrink-0 opacity-60" aria-hidden />
                    ) : null}
                    {isLast ? (
                      <span className="font-medium text-text-primary">{crumb.name}</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => irParaCrumb(index)}
                        className="rounded px-1 py-0.5 hover:bg-background hover:text-text-primary"
                      >
                        {crumb.name}
                      </button>
                    )}
                  </span>
                )
              })}
            </nav>
          ) : null}

          {loadingFolder ? (
            <div className="flex items-center gap-2 py-8 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              Carregando pasta do Drive…
            </div>
          ) : folderError ? (
            <div className="rounded-xl border border-status-danger/30 bg-status-danger/10 px-3 py-2.5 text-xs text-status-danger">
              <div className="flex items-start gap-2">
                <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <div>
                  <p className="font-semibold">{folderError}</p>
                  {folderHint ? (
                    <p className="mt-1 text-text-secondary">{folderHint}</p>
                  ) : null}
                </div>
              </div>
            </div>
          ) : (
            <>
              <label className="relative block">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-text-secondary"
                  aria-hidden
                />
                <input
                  type="search"
                  value={busca}
                  onChange={(e) => setBusca(e.target.value)}
                  placeholder="Filtrar pastas e arquivos…"
                  className="h-9 w-full rounded-lg border border-card bg-background pl-8 pr-3 text-xs text-text-primary outline-none focus:border-[#f04b23]"
                />
              </label>

              <ul className="max-h-64 space-y-1 overflow-y-auto rounded-xl border border-card bg-background p-2">
                {filtrados.length === 0 ? (
                  <li className="px-2 py-6 text-center text-xs text-text-secondary">
                    {busca.trim()
                      ? 'Nenhum item com esse filtro.'
                      : 'Pasta vazia — entre em uma subpasta se houver.'}
                  </li>
                ) : (
                  filtrados.map((item) => {
                    const selected = !item.isFolder && linkAtual?.drive_file_id === item.id
                    const busy = savingId === item.id
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          onClick={() => void vincular(item)}
                          disabled={Boolean(savingId) || loadingFolder}
                          className={cn(
                            'flex w-full items-center justify-between gap-2 rounded-lg px-2 py-2 text-left text-xs transition-colors',
                            selected
                              ? 'bg-[#f04b23]/15 text-text-primary'
                              : 'text-text-primary hover:bg-surface',
                            'disabled:opacity-50',
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-1.5">
                            {item.isFolder ? (
                              <FolderOpen
                                className="h-3.5 w-3.5 shrink-0 text-[#f04b23]"
                                aria-hidden
                              />
                            ) : (
                              <FileText
                                className="h-3.5 w-3.5 shrink-0 text-text-secondary"
                                aria-hidden
                              />
                            )}
                            <span className="truncate">
                              {item.name}
                              {item.isFolder ? (
                                <span className="text-text-secondary"> · pasta</span>
                              ) : null}
                            </span>
                          </span>
                          {busy ? (
                            <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" aria-hidden />
                          ) : item.isFolder ? (
                            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden />
                          ) : selected ? (
                            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-status-success" aria-hidden />
                          ) : (
                            <Link2 className="h-3.5 w-3.5 shrink-0 text-text-secondary" aria-hidden />
                          )}
                        </button>
                      </li>
                    )
                  })
                )}
              </ul>
              <p className="text-[10px] text-text-secondary">
                Clique numa pasta para abrir. Clique num arquivo para vincular.
              </p>
            </>
          )}

          {actionError ? (
            <p className="rounded-lg border border-status-danger/30 bg-status-danger/10 px-3 py-2 text-xs text-status-danger">
              {actionError}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end border-t border-card px-4 py-3">
          <button type="button" onClick={onClose} className={cn(chromeButtonClass, 'h-9')}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}
