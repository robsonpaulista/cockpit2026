'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { usePermissions } from '@/hooks/use-permissions'
import {
  Users as UsersIcon,
  Plus,
  Edit,
  Trash2,
  Loader2,
  Shield,
  Key,
  AlertCircle,
  X,
} from 'lucide-react'
import { UsuariosSessoesPanel } from '@/components/usuarios-sessoes-panel'
import {
  PERMISSION_GROUPS,
  listLegacyPermissionKeys,
  legacyPermissionLabel,
  type PermissionPage,
} from '@/lib/page-permissions-catalog'
import {
  compactPermissions,
  expandStoredPermissions,
  isPageFullySelected,
  isPagePartiallySelected,
  isTabSelected,
  togglePagePermission,
  toggleTabPermission,
} from '@/lib/page-access'
import './usuarios-modals.css'

interface UserRow {
  id: string
  email: string
  name: string
  role: string
  is_admin: boolean
  permissions: string[]
  created_at?: string
}

const ROLES = [
  { value: 'coordenacao', label: 'Coordenação' },
  { value: 'candidato', label: 'Candidato' },
  { value: 'comunicacao', label: 'Comunicação' },
  { value: 'articulacao', label: 'Articulação' },
  { value: 'juridico', label: 'Jurídico' },
  { value: 'bi', label: 'BI' },
  { value: 'pesquisadores', label: 'Pesquisadores (campo)' },
]

export default function UsuariosPage() {
  const router = useRouter()
  const { isAdmin, loading: permLoading } = usePermissions()
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showFormModal, setShowFormModal] = useState(false)
  const [showPermsModal, setShowPermsModal] = useState(false)
  const [formUser, setFormUser] = useState<UserRow | null>(null)
  const [permsUser, setPermsUser] = useState<UserRow | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const fetchUsers = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/users')
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        setError(d.error || 'Erro ao carregar usuários')
        setUsers([])
        return
      }
      const { users: u } = await res.json()
      setUsers(u ?? [])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar usuários')
      setUsers([])
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
    fetchUsers()
  }, [permLoading, isAdmin, router, fetchUsers])

  const openCreate = () => {
    setFormUser(null)
    setShowFormModal(true)
  }

  const openEdit = (u: UserRow) => {
    setFormUser(u)
    setShowFormModal(true)
  }

  const openPerms = (u: UserRow) => {
    setPermsUser(u)
    setShowPermsModal(true)
  }

  const handleDelete = async (u: UserRow) => {
    if (!window.confirm(`Excluir o usuário "${u.email}"?`)) return
    setDeletingId(u.id)
    try {
      const res = await fetch(`/api/users/${u.id}`, { method: 'DELETE' })
      if (res.ok) await fetchUsers()
      else {
        const d = await res.json().catch(() => ({}))
        alert(d.error || 'Erro ao excluir')
      }
    } finally {
      setDeletingId(null)
    }
  }

  if (permLoading || !isAdmin) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg-surface">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 animate-spin text-accent-gold" />
          <p className="text-sm text-text-secondary">Carregando...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-bg-surface">

      <div className="px-4 py-6 lg:px-6">
        {error && (
          <div className="mb-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
            <AlertCircle className="h-5 w-5 shrink-0" />
            {error}
          </div>
        )}

        <div className="rounded-2xl border border-border-card bg-bg-surface shadow-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border-card p-6">
            <h2 className="flex items-center gap-2 text-lg font-semibold text-text-primary">
              <UsersIcon className="h-5 w-5 text-accent-gold" />
              Usuários
            </h2>
            <button
              onClick={openCreate}
              className="flex items-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-white hover:bg-accent-gold/90"
            >
              <Plus className="h-4 w-4" />
              Novo usuário
            </button>
          </div>

          {loading ? (
            <div className="flex items-center justify-center gap-2 py-12">
              <Loader2 className="h-6 w-6 animate-spin text-accent-gold" />
              <span className="text-sm text-text-secondary">Carregando...</span>
            </div>
          ) : users.length === 0 ? (
            <div className="py-12 text-center">
              <UsersIcon className="mx-auto mb-4 h-16 w-16 text-text-secondary opacity-50" />
              <p className="text-sm text-text-secondary">
                {error ? 'Não foi possível carregar os usuários.' : 'Nenhum usuário cadastrado.'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-border-card bg-bg-app">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Nome / E-mail
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Perfil
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary">
                      Admin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-secondary w-40">
                      Ações
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-card">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-bg-app/50">
                      <td className="px-6 py-4">
                        <div className="font-medium text-text-primary">{u.name || '-'}</div>
                        <div className="text-sm text-text-secondary">{u.email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-text-secondary">
                        {ROLES.find((r) => r.value === u.role)?.label ?? u.role}
                      </td>
                      <td className="px-6 py-4">
                        {u.is_admin ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-accent-gold-soft px-2.5 py-1 text-xs font-medium text-accent-gold">
                            <Shield className="h-3.5 w-3.5" />
                            Sim
                          </span>
                        ) : (
                          <span className="text-sm text-text-secondary">Não</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => openPerms(u)}
                            className="rounded-lg p-2 hover:bg-bg-app"
                            title="Permissões"
                          >
                            <Key className="h-4 w-4 text-text-secondary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className="rounded-lg p-2 hover:bg-bg-app"
                            title="Editar"
                          >
                            <Edit className="h-4 w-4 text-text-secondary" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={deletingId === u.id}
                            className="rounded-lg p-2 hover:bg-red-50 disabled:opacity-50"
                            title="Excluir"
                          >
                            <Trash2 className="h-4 w-4 text-red-600" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <UsuariosSessoesPanel />
      </div>

      {showFormModal && (
        <UserFormModal
          user={formUser}
          onClose={() => {
            setShowFormModal(false)
            setFormUser(null)
          }}
          onSuccess={() => {
            fetchUsers()
            setShowFormModal(false)
            setFormUser(null)
          }}
        />
      )}

      {showPermsModal && permsUser && (
        <UserPermissionsModal
          user={permsUser}
          onClose={() => {
            setShowPermsModal(false)
            setPermsUser(null)
          }}
          onSuccess={() => {
            fetchUsers()
            setShowPermsModal(false)
            setPermsUser(null)
          }}
        />
      )}
    </div>
  )
}

interface UserFormModalProps {
  user: UserRow | null
  onClose: () => void
  onSuccess: () => void
}

function UserFormModal({ user, onClose, onSuccess }: UserFormModalProps) {
  const isEdit = Boolean(user?.id)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('coordenacao')
  const [isAdmin, setIsAdmin] = useState(false)

  useEffect(() => {
    if (user) {
      setName(user.name ?? '')
      setEmail(user.email ?? '')
      setRole(user.role ?? 'coordenacao')
      setIsAdmin(user.is_admin ?? false)
      setPassword('')
    } else {
      setName('')
      setEmail('')
      setPassword('')
      setRole('coordenacao')
      setIsAdmin(false)
    }
  }, [user])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    if (!name.trim()) {
      setErr('Nome é obrigatório.')
      return
    }
    if (!isEdit && !email.trim()) {
      setErr('E-mail é obrigatório.')
      return
    }
    if (!isEdit && (!password || String(password).length < 6)) {
      setErr('Senha com no mínimo 6 caracteres é obrigatória.')
      return
    }

    setLoading(true)
    try {
      const url = isEdit ? `/api/users/${user!.id}` : '/api/users'
      const method = isEdit ? 'PATCH' : 'POST'
      const body: Record<string, unknown> = isEdit
        ? { name: name.trim(), role: role.trim() || 'coordenacao', is_admin: isAdmin }
        : {
            email: email.trim(),
            password: String(password),
            name: name.trim(),
            role: role.trim() || 'coordenacao',
            is_admin: isAdmin,
          }

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(data.error || (isEdit ? 'Erro ao atualizar.' : 'Erro ao criar.'))
        return
      }
      onSuccess()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="usuarios-modal-panel w-full max-w-md rounded-2xl border border-border-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border-card p-6">
          <h3 className="text-lg font-semibold text-text-primary">
            {isEdit ? 'Editar usuário' : 'Novo usuário'}
          </h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-bg-app" aria-label="Fechar">
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Nome</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full rounded-lg border border-border-card bg-bg-app px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
              placeholder="Ex.: Maria Silva"
            />
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isEdit}
              className="w-full rounded-lg border border-border-card bg-bg-app px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft disabled:opacity-60"
              placeholder="email@exemplo.com"
            />
          </div>

          {!isEdit && (
            <div>
              <label className="mb-1 block text-sm font-medium text-text-primary">Senha</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-border-card bg-bg-app px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
                placeholder="Mín. 6 caracteres"
              />
            </div>
          )}

          <div>
            <label className="mb-1 block text-sm font-medium text-text-primary">Perfil</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-border-card bg-bg-app px-3 py-2 focus:outline-none focus:ring-2 focus:ring-accent-gold-soft"
            >
              {ROLES.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="is_admin"
              checked={isAdmin}
              onChange={(e) => setIsAdmin(e.target.checked)}
              className="rounded border-border-card"
            />
            <label htmlFor="is_admin" className="text-sm font-medium text-text-primary">
              Administrador (acesso total + gestão de usuários)
            </label>
          </div>

          <div className="flex gap-3 border-t border-border-card pt-4">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 flex items-center justify-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-white hover:bg-accent-gold/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : isEdit ? (
                'Salvar'
              ) : (
                'Criar usuário'
              )}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-border-card px-4 py-2 hover:bg-bg-app">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface UserPermissionsModalProps {
  user: UserRow
  onClose: () => void
  onSuccess: () => void
}

function UserPermissionsModal({ user, onClose, onSuccess }: UserPermissionsModalProps) {
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [selected, setSelected] = useState<Set<string>>(() => expandStoredPermissions(user.permissions))
  const legacyKeys = listLegacyPermissionKeys(user.permissions)

  useEffect(() => {
    setSelected(expandStoredPermissions(user.permissions))
  }, [user])

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const togglePage = (page: PermissionPage) => {
    setSelected((prev) => togglePagePermission(prev, page))
  }

  const toggleTab = (page: PermissionPage, tabKey: string) => {
    setSelected((prev) => toggleTabPermission(prev, page, tabKey))
  }

  const toggleGroup = (pages: PermissionPage[], checked: boolean) => {
    setSelected((prev) => {
      let next = new Set(prev)
      for (const page of pages) {
        const fully = isPageFullySelected(next, page)
        const partial = isPagePartiallySelected(next, page)
        if (checked && !fully) next = togglePagePermission(next, page)
        if (!checked && (fully || partial || next.has(page.key))) {
          next.delete(page.key)
          for (const tab of page.tabs ?? []) next.delete(tab.key)
        }
      }
      return next
    })
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr(null)
    setLoading(true)
    try {
      const res = await fetch(`/api/users/${user.id}/permissions`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: compactPermissions(selected) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setErr(data.error || 'Erro ao salvar permissões.')
        return
      }
      onSuccess()
      onClose()
    } catch (e) {
      setErr(e instanceof Error ? e.message : 'Erro ao salvar.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center overflow-y-auto bg-black/60 p-4">
      <div className="usuarios-modal-panel w-full max-w-lg rounded-2xl border border-border-card shadow-xl">
        <div className="flex items-center justify-between border-b border-border-card p-6">
          <h3 className="text-lg font-semibold text-text-primary">Permissões — {user.name || user.email}</h3>
          <button type="button" onClick={onClose} className="rounded-lg p-2 hover:bg-bg-app" aria-label="Fechar">
            <X className="h-5 w-5 text-text-secondary" />
          </button>
        </div>
        <form onSubmit={submit} className="space-y-4 p-6">
          {err && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {err}
            </div>
          )}

          {user.is_admin && (
            <p className="rounded-lg border border-accent-gold-soft bg-accent-gold-soft/30 p-3 text-sm text-text-primary">
              Administradores têm acesso a todas as páginas. As permissões abaixo não se aplicam.
            </p>
          )}

          <p className="text-sm text-text-secondary">
            Marque a página inteira ou só as abas que a pessoa pode ver. O perfil (Articulação,
            Comunicação, etc.) não libera acesso sozinho.
          </p>

          <div className="usuarios-perms-list max-h-[min(62vh,32rem)] space-y-4 overflow-y-auto rounded-lg border border-border-card p-3">
            {PERMISSION_GROUPS.map((group) => {
              const allOn = group.pages.every((page) => isPageFullySelected(selected, page))
              return (
                <section key={group.id} className="space-y-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <div>
                      <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                        {group.label}
                      </h4>
                      {group.hint ? (
                        <p className="text-[11px] text-text-secondary/80">{group.hint}</p>
                      ) : null}
                    </div>
                    <button
                      type="button"
                      disabled={user.is_admin}
                      onClick={() => toggleGroup(group.pages, !allOn)}
                      className="text-[11px] font-medium text-text-secondary hover:text-text-primary disabled:opacity-50"
                    >
                      {allOn ? 'Limpar' : 'Todas'}
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {group.pages.map((page) => {
                      const fully = isPageFullySelected(selected, page)
                      const partial = isPagePartiallySelected(selected, page)
                      return (
                        <div key={page.key} className="rounded-md">
                          <label className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-bg-app">
                            <input
                              type="checkbox"
                              checked={fully}
                              ref={(el) => {
                                if (el) el.indeterminate = partial
                              }}
                              onChange={() => togglePage(page)}
                              disabled={user.is_admin}
                              className="rounded border-border-card"
                            />
                            <span className="text-sm font-medium text-text-primary">{page.label}</span>
                          </label>
                          {page.tabs && page.tabs.length > 0 ? (
                            <div className="ml-6 mt-0.5 space-y-0.5 border-l border-border-card pl-3">
                              {page.tabs.map((tab) => (
                                <label
                                  key={tab.key}
                                  className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-bg-app"
                                >
                                  <input
                                    type="checkbox"
                                    checked={isTabSelected(selected, page, tab.key)}
                                    onChange={() => toggleTab(page, tab.key)}
                                    disabled={user.is_admin}
                                    className="rounded border-border-card"
                                  />
                                  <span className="text-[13px] text-text-primary">{tab.label}</span>
                                </label>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      )
                    })}
                  </div>
                </section>
              )
            })}

            {legacyKeys.length > 0 ? (
              <section className="space-y-2 border-t border-border-card pt-3">
                <h4 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-text-secondary">
                  Chaves antigas
                </h4>
                <p className="text-[11px] text-text-secondary">
                  Não fazem mais parte do menu. Desmarque para remover.
                </p>
                {legacyKeys.map((key) => (
                  <label key={key} className="flex cursor-pointer items-center gap-2 rounded-md px-1 py-0.5 hover:bg-bg-app">
                    <input
                      type="checkbox"
                      checked={selected.has(key)}
                      onChange={() => toggle(key)}
                      disabled={user.is_admin}
                      className="rounded border-border-card"
                    />
                    <span className="text-sm text-text-primary">{legacyPermissionLabel(key)}</span>
                  </label>
                ))}
              </section>
            ) : null}
          </div>

          <div className="flex gap-3 border-t border-border-card pt-4">
            <button
              type="submit"
              disabled={loading || user.is_admin}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-accent-gold px-4 py-2 text-white hover:bg-accent-gold/90 disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                'Salvar permissões'
              )}
            </button>
            <button type="button" onClick={onClose} className="rounded-lg border border-border-card px-4 py-2 hover:bg-bg-app">
              Fechar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
