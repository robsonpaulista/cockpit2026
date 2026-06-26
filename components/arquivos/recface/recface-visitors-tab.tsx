'use client'

import { useCallback, useEffect, useState } from 'react'
import { Loader2, Pencil, Trash2, User } from 'lucide-react'
import { recfaceApi, type RecfaceVisitor } from '@/lib/recface-api'
import { cn } from '@/lib/utils'

export function RecfaceVisitorsTab() {
  const [visitors, setVisitors] = useState<RecfaceVisitor[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [newName, setNewName] = useState('')
  const [faceFile, setFaceFile] = useState<File | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setVisitors(await recfaceApi.listVisitors())
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao carregar visitantes')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const saveName = async (id: string) => {
    try {
      await recfaceApi.updateVisitorName(id, newName)
      setEditingId(null)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao renomear')
    }
  }

  const updateFace = async (id: string) => {
    if (!faceFile) return
    try {
      await recfaceApi.updateVisitorFace(id, faceFile)
      setFaceFile(null)
      setMessage('Rosto atualizado.')
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao atualizar rosto')
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Excluir este visitante e seus embeddings?')) return
    try {
      await recfaceApi.deleteVisitor(id)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao excluir')
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-[#C8900A]" />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-base font-semibold text-text-primary">Visitantes</h2>
        <p className="text-sm text-text-muted">Edite nomes, atualize rosto ou exclua cadastros.</p>
      </div>

      {message ? <p className="text-sm text-text-muted">{message}</p> : null}

      {visitors.length === 0 ? (
        <p className="rounded-xl border border-dashed px-6 py-12 text-center text-sm text-text-muted">
          Nenhum visitante — use Cadastro para incluir o primeiro.
        </p>
      ) : (
        <div className="space-y-3">
          {visitors.map((v) => (
            <div
              key={v.id}
              className="rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-4"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#C8900A]/15">
                    <User className="h-5 w-5 text-[#C8900A]" />
                  </div>
                  <div>
                    {editingId === v.id ? (
                      <div className="flex gap-2">
                        <input
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          className="rounded-lg border px-2 py-1 text-sm"
                        />
                        <button
                          type="button"
                          onClick={() => void saveName(v.id)}
                          className="text-xs text-[#C8900A]"
                        >
                          Salvar
                        </button>
                      </div>
                    ) : (
                      <p className="font-medium text-text-primary">{v.name}</p>
                    )}
                    <p className="text-xs text-text-muted">
                      Cadastro: {v.registered_at?.slice(0, 16) ?? '—'}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingId(v.id)
                      setNewName(v.name)
                    }}
                    className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-text-muted hover:bg-bg-muted"
                  >
                    <Pencil className="h-3.5 w-3.5" />
                    Renomear
                  </button>
                  <label className="flex cursor-pointer items-center gap-1 rounded-lg border px-2 py-1 text-xs text-text-muted hover:bg-bg-muted">
                    Nova foto
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) {
                          setFaceFile(f)
                          void updateFace(v.id)
                        }
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => void remove(v.id)}
                    className="flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-status-danger hover:bg-status-danger/5"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    Excluir
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
