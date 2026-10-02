'use client'

import { FormEvent, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ArenaShell, formatPts } from '@/components/arena/arena-shell'
import { ArenaCommentsSyncPanel } from '@/components/arena/arena-comments-sync-panel'
import {
  ARENA_LEADERS,
  ARENA_MEMBERS,
  getArenaScores,
  leaderName,
} from '@/lib/arena/mock-data'
import { ENGAJA_LEADERS } from '@/lib/arena/engaja-leaders'
import type { ArenaMember, ArenaViewerRole } from '@/lib/arena/types'
import { cn } from '@/lib/utils'

type DraftMember = ArenaMember & { _local?: boolean }

type ArenaLeaderRow = {
  id: string
  dbId?: string | null
  name: string
  city: string | null
  instagram: string | null
  phone: string | null
  email: string | null
  afiliacaoUrl: string | null
  lideradosCount: number
}

type ListTab = 'liderancas' | 'apoiadores'

export function ArenaMembrosView() {
  const searchParams = useSearchParams()
  const leaderFromUrl = searchParams.get('lideranca')
  const [role, setRole] = useState<ArenaViewerRole>('admin')
  const [listTab, setListTab] = useState<ListTab>(
    leaderFromUrl ? 'apoiadores' : 'liderancas',
  )
  const [query, setQuery] = useState('')
  const [leaderFilter, setLeaderFilter] = useState(leaderFromUrl ?? '')
  const [extra, setExtra] = useState<DraftMember[]>([])
  const [formOpen, setFormOpen] = useState(false)
  const [leaders, setLeaders] = useState<ArenaLeaderRow[]>(() =>
    ENGAJA_LEADERS.map((l) => ({
      id: l.id,
      dbId: null,
      name: l.name,
      city: l.city,
      instagram: l.instagram,
      phone: null,
      email: null,
      afiliacaoUrl: l.afiliacaoUrl,
      lideradosCount: l.lideradosCount,
    })),
  )
  const [leadersSource, setLeadersSource] = useState<'csv' | 'database' | 'loading'>('loading')

  useEffect(() => {
    if (leaderFromUrl) {
      setLeaderFilter(leaderFromUrl)
      setListTab('apoiadores')
    }
  }, [leaderFromUrl])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/arena/leaders', { cache: 'no-store' })
        if (!res.ok) throw new Error('fail')
        const data = (await res.json()) as {
          source?: 'csv' | 'database'
          leaders?: ArenaLeaderRow[]
        }
        if (cancelled) return
        if (data.leaders?.length) {
          setLeaders(data.leaders)
          setLeadersSource(data.source === 'database' ? 'database' : 'csv')
        } else {
          setLeadersSource('csv')
        }
      } catch {
        if (!cancelled) setLeadersSource('csv')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const leadersForSelect = useMemo(() => {
    if (leaders.length > 0) {
      return leaders.map((l) => ({ id: l.id, name: l.name, city: l.city }))
    }
    return ARENA_LEADERS
  }, [leaders])

  const scopedLeaderId = role === 'lideranca' ? leadersForSelect[0]?.id ?? null : leaderFilter || null

  const { scores } = useMemo(
    () => getArenaScores(role === 'lideranca' ? leadersForSelect[0]?.id ?? null : null),
    [role, leadersForSelect],
  )

  const allMembers = useMemo(() => [...ARENA_MEMBERS, ...extra], [extra])

  const leaderRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return leaders
      .filter((l) => {
        if (!q) return true
        return (
          l.name.toLowerCase().includes(q) ||
          (l.instagram ?? '').toLowerCase().includes(q) ||
          (l.city ?? '').toLowerCase().includes(q) ||
          (l.phone ?? '').includes(q)
        )
      })
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
  }, [leaders, query])

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return allMembers
      .filter((m) => {
        if (scopedLeaderId && m.leaderId !== scopedLeaderId) return false
        if (!q) return true
        return (
          m.name.toLowerCase().includes(q) ||
          m.instagramHandle.toLowerCase().includes(q) ||
          (m.city ?? '').toLowerCase().includes(q)
        )
      })
      .map((m) => {
        const score = scores.find((s) => s.memberId === m.id)
        return { member: m, score }
      })
      .sort((a, b) => (b.score?.total ?? 0) - (a.score?.total ?? 0))
  }, [allMembers, query, scopedLeaderId, scores])

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const consent = fd.get('lgpd') === 'on'
    if (!consent) {
      window.alert('Consentimento LGPD é obrigatório.')
      return
    }
    const handle = String(fd.get('instagram') ?? '')
      .trim()
      .replace(/^@/, '')
      .toLowerCase()
    const leaderId =
      role === 'lideranca'
        ? leadersForSelect[0]!.id
        : String(fd.get('leaderId') ?? leadersForSelect[0]!.id)
    const now = new Date().toISOString()
    const member: DraftMember = {
      id: `local-${Date.now()}`,
      name: String(fd.get('name') ?? '').trim(),
      instagramHandle: handle,
      phone: String(fd.get('phone') ?? '').trim(),
      email: String(fd.get('email') ?? '').trim(),
      city: String(fd.get('city') ?? '').trim() || null,
      leaderId,
      lgpdConsent: true,
      lgpdConsentAt: now,
      createdAt: now,
      _local: true,
    }
    setExtra((prev) => [member, ...prev])
    setFormOpen(false)
    e.currentTarget.reset()
    setListTab('apoiadores')
  }

  return (
    <ArenaShell
      role={role}
      onRoleChange={setRole}
      title="Membros"
      subtitle="Lideranças Engaja e apoiadores cadastrados"
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={cn('arena-nav__link', listTab === 'liderancas' && 'arena-nav__link--on')}
          onClick={() => setListTab('liderancas')}
        >
          Lideranças ({leaders.length})
        </button>
        <button
          type="button"
          className={cn('arena-nav__link', listTab === 'apoiadores' && 'arena-nav__link--on')}
          onClick={() => setListTab('apoiadores')}
        >
          Apoiadores ({allMembers.length})
        </button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div className="arena-field min-w-[200px] flex-1">
          <label htmlFor="arena-search">Buscar</label>
          <input
            id="arena-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={
              listTab === 'liderancas' ? 'Nome, @, cidade ou telefone' : 'Nome, @ ou cidade'
            }
          />
        </div>
        {listTab === 'apoiadores' && role === 'admin' ? (
          <div className="arena-field min-w-[180px]">
            <label htmlFor="arena-leader-filter">Filtrar por liderança</label>
            <select
              id="arena-leader-filter"
              value={leaderFilter}
              onChange={(e) => setLeaderFilter(e.target.value)}
            >
              <option value="">Todas</option>
              {leadersForSelect.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        ) : null}
        {listTab === 'apoiadores' ? (
          <button
            type="button"
            className="arena-btn arena-btn--primary"
            onClick={() => setFormOpen((v) => !v)}
          >
            {formOpen ? 'Fechar formulário' : 'Cadastrar novo membro'}
          </button>
        ) : null}
      </div>

      {listTab === 'liderancas' ? (
        <>
          <ArenaCommentsSyncPanel />
          <section className="arena-card">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="arena-section-title mb-0">Lideranças Engaja</h2>
            <p className="arena-sub">
              {leadersSource === 'loading'
                ? 'Carregando…'
                : leadersSource === 'database'
                  ? `${leaderRows.length} no banco · public.leaders`
                  : `${leaderRows.length} do CSV (fallback)`}
            </p>
          </div>
          <div className="arena-table-wrap">
            <table className="arena-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Instagram</th>
                  <th>WhatsApp</th>
                  <th>Cidade</th>
                  <th>Liderados</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {leaderRows.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <div className="font-semibold">{l.name}</div>
                      {l.email ? (
                        <div className="text-[var(--cx-muted,#686865)] text-xs">{l.email}</div>
                      ) : null}
                    </td>
                    <td className="text-[var(--cx-muted,#686865)]">
                      {l.instagram ? `@${l.instagram}` : '—'}
                    </td>
                    <td className="arena-mono text-xs">{l.phone ?? '—'}</td>
                    <td>{l.city ?? '—'}</td>
                    <td className="arena-mono font-bold">{l.lideradosCount}</td>
                    <td>
                      <button
                        type="button"
                        className="arena-podium__link border-0 bg-transparent p-0"
                        onClick={() => {
                          setLeaderFilter(l.id)
                          setListTab('apoiadores')
                        }}
                      >
                        Ver apoiadores
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
        </>
      ) : (
        <>
          {formOpen ? (
            <section className="arena-card">
              <h2 className="arena-section-title">Cadastrar novo membro</h2>
              <form className="arena-form-grid" onSubmit={onSubmit}>
                <div className="arena-field">
                  <label htmlFor="name">Nome completo</label>
                  <input id="name" name="name" required />
                </div>
                <div className="arena-field">
                  <label htmlFor="instagram">@ Instagram</label>
                  <input id="instagram" name="instagram" required placeholder="sem @" />
                </div>
                <div className="arena-field">
                  <label htmlFor="phone">Telefone / WhatsApp</label>
                  <input id="phone" name="phone" required />
                </div>
                <div className="arena-field">
                  <label htmlFor="email">E-mail</label>
                  <input id="email" name="email" type="email" required />
                </div>
                <div className="arena-field">
                  <label htmlFor="city">Cidade</label>
                  <input id="city" name="city" />
                </div>
                <div className="arena-field">
                  <label htmlFor="leaderId">Liderança responsável</label>
                  <select
                    id="leaderId"
                    name="leaderId"
                    required
                    disabled={role === 'lideranca'}
                    defaultValue={leadersForSelect[0]?.id}
                  >
                    {leadersForSelect.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="arena-field col-span-full flex flex-row items-center gap-2">
                  <input id="lgpd" name="lgpd" type="checkbox" required />
                  <label
                    htmlFor="lgpd"
                    className="!normal-case !tracking-normal !text-[0.85rem] !font-medium !text-[var(--cx-text,#2b2d31)]"
                  >
                    Consentimento LGPD (obrigatório) — autorizo o uso dos dados para a Arena de
                    Apoiadores
                  </label>
                </div>
                <div className="col-span-full">
                  <button type="submit" className="arena-btn arena-btn--primary">
                    Salvar membro
                  </button>
                </div>
              </form>
            </section>
          ) : null}

          <section className="arena-card">
            <h2 className="arena-section-title">Apoiadores</h2>
            <div className="arena-table-wrap">
              <table className="arena-table">
                <thead>
                  <tr>
                    <th>Nome + @</th>
                    <th>Contato</th>
                    <th>Cidade</th>
                    <th>Liderança</th>
                    <th>Nível</th>
                    <th>Pontos</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-[var(--cx-muted,#686865)]">
                        Nenhum apoiador neste filtro.
                      </td>
                    </tr>
                  ) : (
                    rows.map(({ member, score }) => (
                      <tr key={member.id}>
                        <td>
                          <div className="font-semibold">{member.name}</div>
                          <div className="text-[var(--cx-muted,#686865)] text-xs">
                            @{member.instagramHandle}
                          </div>
                        </td>
                        <td>
                          <div className="text-xs">{member.phone}</div>
                          <div className="text-[var(--cx-muted,#686865)] text-xs">
                            {member.email}
                          </div>
                        </td>
                        <td>{member.city ?? '—'}</td>
                        <td>{leaderName(member.leaderId)}</td>
                        <td>
                          {score ? `${score.level.id} — ${score.level.name}` : 'I — Recruta'}
                        </td>
                        <td className="arena-mono font-bold">
                          {formatPts(score?.total ?? 0)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </ArenaShell>
  )
}
