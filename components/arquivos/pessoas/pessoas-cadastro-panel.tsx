'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Camera,
  Loader2,
  Pencil,
  Plus,
  ScanFace,
  Trash2,
  User,
  UserPlus,
  X,
} from 'lucide-react'
import { RecfaceServiceBanner } from '@/components/arquivos/recface/recface-service-banner'
import { pessoasApi, type Pessoa } from '@/lib/pessoas-api'
import { cn } from '@/lib/utils'
import { sidebarPrimaryCTAButtonClass } from '@/lib/sidebar-menu-active-style'

function PersonAvatar({ pessoa }: { pessoa: Pessoa }) {
  const cacheKey = encodeURIComponent(pessoa.updated_at ?? pessoa.id)
  const src =
    pessoa.reference_image_url ??
    `${pessoasApi.getReferenceImageUrl(pessoa.id)}?v=${cacheKey}`
  const [error, setError] = useState(false)

  if (pessoa.enrollment_count > 0 && pessoa.reference_image_path && !error) {
    return (
      <img
        key={src}
        src={src}
        alt={pessoa.name}
        onError={() => setError(true)}
        className="h-full w-full object-cover"
      />
    )
  }

  if (pessoa.enrollment_count > 0 && !pessoa.reference_image_path) {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center gap-0.5 bg-[#C8900A]/10 px-1 text-center text-[#C8900A]">
        <Camera className="h-4 w-4 opacity-70" />
        <span className="text-[8px] font-medium leading-tight">Reenvie foto</span>
      </div>
    )
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[#C8900A]/10 text-sm font-semibold text-[#C8900A]">
      {pessoa.name.charAt(0).toUpperCase()}
    </div>
  )
}

export function PessoasCadastroPanel() {
  const [pessoas, setPessoas] = useState<Pessoa[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState<string | null>(null)
  const [isError, setIsError] = useState(false)

  const [formOpen, setFormOpen] = useState(false)
  const [name, setName] = useState('')
  const [roleTag, setRoleTag] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)

  const [editing, setEditing] = useState<Pessoa | null>(null)
  const [enrollingId, setEnrollingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      setPessoas(await pessoasApi.list())
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao carregar pessoas')
      setIsError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const resetForm = () => {
    setName('')
    setRoleTag('')
    setNotes('')
    setFormOpen(false)
    setEditing(null)
  }

  const submitPerson = async () => {
    const trimmed = name.trim()
    if (!trimmed) {
      setMessage('Informe o nome da pessoa.')
      setIsError(true)
      return
    }
    try {
      setSaving(true)
      setMessage(null)
      if (editing) {
        await pessoasApi.update(editing.id, {
          name: trimmed,
          roleTag: roleTag.trim() || null,
          notes: notes.trim() || null,
        })
        setMessage('Pessoa atualizada.')
      } else {
        await pessoasApi.create({
          name: trimmed,
          roleTag: roleTag.trim() || undefined,
          notes: notes.trim() || undefined,
        })
        setMessage('Pessoa cadastrada. Agora envie uma foto de referência do rosto.')
      }
      setIsError(false)
      resetForm()
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao salvar')
      setIsError(true)
    } finally {
      setSaving(false)
    }
  }

  const startEdit = (p: Pessoa) => {
    setEditing(p)
    setName(p.name)
    setRoleTag(p.role_tag ?? '')
    setNotes(p.notes ?? '')
    setFormOpen(true)
  }

  const removePerson = async (p: Pessoa) => {
    if (!confirm(`Excluir ${p.name} e os embeddings faciais?`)) return
    try {
      await pessoasApi.remove(p.id)
      setMessage(`${p.name} removido(a).`)
      setIsError(false)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao excluir')
      setIsError(true)
    }
  }

  const enrollFace = async (p: Pessoa, file: File) => {
    try {
      setEnrollingId(p.id)
      setMessage(null)
      await pessoasApi.enrollFace(p.id, file)
      setMessage(`Rosto de ${p.name} cadastrado com sucesso.`)
      setIsError(false)
      await load()
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Falha ao cadastrar rosto')
      setIsError(true)
    } finally {
      setEnrollingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <RecfaceServiceBanner />

      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#C8900A]/15">
            <ScanFace className="h-5 w-5 text-[#C8900A]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">Cadastro de pessoas</p>
            <p className="text-xs text-text-muted">
              {pessoas.length} {pessoas.length === 1 ? 'pessoa' : 'pessoas'} · base para reconhecimento nas fotos
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            resetForm()
            setFormOpen(true)
          }}
          className={cn(sidebarPrimaryCTAButtonClass, 'flex items-center gap-2 px-4 py-2 text-sm')}
        >
          <Plus className="h-4 w-4" />
          Nova pessoa
        </button>
      </div>

      {message ? (
        <div
          className={cn(
            'rounded-lg border px-4 py-3 text-sm',
            isError
              ? 'border-status-danger/30 bg-status-danger/5 text-status-danger'
              : 'border-status-success/30 bg-status-success/5 text-text-primary',
          )}
        >
          {message}
        </div>
      ) : null}

      {formOpen ? (
        <div className="rounded-xl border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-text-primary">
              {editing ? 'Editar pessoa' : 'Nova pessoa'}
            </h3>
            <button type="button" onClick={resetForm} className="rounded p-1 text-text-muted hover:bg-bg-muted">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Nome *</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
                placeholder="Nome completo"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-text-muted">Função / tag</label>
              <input
                value={roleTag}
                onChange={(e) => setRoleTag(e.target.value)}
                className="w-full rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
                placeholder="Ex.: Deputado, Assessor"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-text-muted">Observações</label>
              <input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full rounded-lg border border-[rgb(var(--color-border-secondary))] px-3 py-2 text-sm"
                placeholder="Opcional"
              />
            </div>
          </div>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              disabled={saving}
              onClick={() => void submitPerson()}
              className={cn(sidebarPrimaryCTAButtonClass, 'flex items-center gap-2 px-4 py-2 text-sm')}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
              {editing ? 'Salvar alterações' : 'Cadastrar'}
            </button>
            <button
              type="button"
              onClick={resetForm}
              className="rounded-lg border border-[rgb(var(--color-border-secondary))] px-4 py-2 text-sm text-text-muted"
            >
              Cancelar
            </button>
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-[#C8900A]" />
        </div>
      ) : pessoas.length === 0 ? (
        <div className="rounded-xl border border-dashed border-[rgb(var(--color-border-secondary))] px-6 py-16 text-center">
          <User className="mx-auto mb-3 h-10 w-10 text-text-muted" />
          <p className="font-medium text-text-primary">Nenhuma pessoa cadastrada</p>
          <p className="mt-1 text-sm text-text-muted">
            Cadastre nomes e fotos de referência para o reconhecimento automático nas fotos do Drive.
          </p>
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
          {pessoas.map((p) => (
            <article
              key={p.id}
              className="flex gap-2.5 overflow-hidden rounded-lg border border-[rgb(var(--color-border-secondary)/0.85)] bg-bg-surface p-2.5"
            >
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-bg-muted">
                <PersonAvatar pessoa={p} />
                {p.enrollment_count > 0 ? (
                  <span className="absolute bottom-0 left-0 right-0 bg-status-success/90 py-px text-center text-[8px] font-medium text-white">
                    OK
                  </span>
                ) : (
                  <span className="absolute bottom-0 left-0 right-0 bg-amber-500/90 py-px text-center text-[8px] font-medium text-white">
                    —
                  </span>
                )}
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium leading-tight text-text-primary" title={p.name}>
                  {p.name}
                </p>
                {p.role_tag ? (
                  <p className="truncate text-[11px] text-[#C8900A]">{p.role_tag}</p>
                ) : null}

                <div className="mt-1.5 flex items-center gap-1">
                  <label
                    className={cn(
                      'flex flex-1 cursor-pointer items-center justify-center gap-1 rounded border border-dashed py-1 text-[10px]',
                      enrollingId === p.id
                        ? 'border-[#C8900A]/50 text-[#C8900A]'
                        : 'border-[rgb(var(--color-border-secondary))] text-text-muted hover:bg-bg-muted',
                    )}
                    title={p.enrollment_count > 0 ? 'Atualizar foto do rosto' : 'Cadastrar rosto'}
                  >
                    {enrollingId === p.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <Camera className="h-3 w-3" />
                    )}
                    <span className="truncate">{p.enrollment_count > 0 ? 'Foto' : 'Rosto'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={enrollingId === p.id}
                      onChange={(e) => {
                        const f = e.target.files?.[0]
                        if (f) void enrollFace(p, f)
                        e.target.value = ''
                      }}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => startEdit(p)}
                    className="rounded border p-1 text-text-muted hover:bg-bg-muted"
                    title="Editar"
                  >
                    <Pencil className="h-3 w-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => void removePerson(p)}
                    className="rounded border p-1 text-status-danger hover:bg-status-danger/5"
                    title="Excluir"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  )
}
