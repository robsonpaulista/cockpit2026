'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArenaShell, formatPts } from '@/components/arena/arena-shell'
import { ArenaCommentsSyncPanel } from '@/components/arena/arena-comments-sync-panel'
import { ArenaFiltroPeriodo } from '@/components/arena/arena-filtro-periodo'
import { ENGAJA_LEADERS } from '@/lib/arena/engaja-leaders'
import { hrefPainelArena, useArenaPerfis, useArenaPeriodo } from '@/hooks/use-arena-perfis'
import type { ArenaPerfil } from '@/lib/arena/types'
import { cn } from '@/lib/utils'

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
  const [listTab, setListTab] = useState<ListTab>('liderancas')
  const [query, setQuery] = useState<string>('')
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
  const filtro = useArenaPeriodo()
  const perfis = useArenaPerfis(filtro.intervalo)

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

  const perfilPorHandle = useMemo(() => {
    const mapa = new Map<string, ArenaPerfil>()
    if (perfis.status === 'ok') for (const p of perfis.perfis) mapa.set(p.instagram, p)
    return mapa
  }, [perfis])

  const apoiadores = useMemo(
    () => (perfis.status === 'ok' ? perfis.perfis.filter((p) => p.papel === 'liderado') : []),
    [perfis],
  )

  const leaderRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    const pontosDe = (l: ArenaLeaderRow) =>
      perfilPorHandle.get((l.instagram ?? '').toLowerCase())?.pontos ?? 0
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
      .sort((a, b) => pontosDe(b) - pontosDe(a) || a.name.localeCompare(b.name, 'pt-BR'))
  }, [leaders, query, perfilPorHandle])

  const apoiadoresRows = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return apoiadores
    return apoiadores.filter(
      (p) =>
        p.nome.toLowerCase().includes(q) ||
        p.instagram.includes(q.replace(/^@/, '')) ||
        (p.cidade ?? '').toLowerCase().includes(q) ||
        (p.regiao ?? '').toLowerCase().includes(q),
    )
  }, [apoiadores, query])

  return (
    <ArenaShell role="admin" title="Membros" subtitle="Lideranças Engaja e apoiadores cadastrados">
      <ArenaFiltroPeriodo filtro={filtro} />

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
          Apoiadores ({apoiadores.length})
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
              listTab === 'liderancas' ? 'Nome, @, cidade ou telefone' : 'Nome, @, cidade ou região'
            }
          />
        </div>
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
                  <th>Comentários</th>
                  <th>Pontos</th>
                </tr>
              </thead>
              <tbody>
                {leaderRows.map((l) => {
                  const perfil = perfilPorHandle.get((l.instagram ?? '').toLowerCase())
                  return (
                    <tr key={l.id}>
                      <td>
                        {perfil ? (
                          <Link
                            href={hrefPainelArena(perfil.id, filtro)}
                            className="font-semibold text-[var(--cx-ink,#14161a)] no-underline hover:text-[var(--cx-amber,#e8a825)]"
                          >
                            {l.name}
                          </Link>
                        ) : (
                          <div className="font-semibold">{l.name}</div>
                        )}
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
                      <td className="arena-mono">{perfil ? formatPts(perfil.comentarios) : '—'}</td>
                      <td className="arena-mono font-bold">{perfil ? formatPts(perfil.pontos) : '—'}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
        </>
      ) : (
        <section className="arena-card">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="arena-section-title mb-0">Apoiadores</h2>
            <p className="arena-sub">
              {perfis.status === 'loading' ? 'Calculando…' : `${apoiadoresRows.length} liderados`}
            </p>
          </div>
          <div className="arena-table-wrap">
            <table className="arena-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Nome + @</th>
                  <th>Cidade</th>
                  <th>Região</th>
                  <th>Nível</th>
                  <th>Comentários</th>
                  <th>Pontos</th>
                </tr>
              </thead>
              <tbody>
                {perfis.status === 'erro' ? (
                  <tr>
                    <td colSpan={7} className="text-[var(--cx-muted,#686865)]">
                      {perfis.mensagem}
                    </td>
                  </tr>
                ) : perfis.status === 'loading' ? (
                  <tr>
                    <td colSpan={7} className="text-[var(--cx-muted,#686865)]">
                      Calculando a pontuação do período…
                    </td>
                  </tr>
                ) : apoiadoresRows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-[var(--cx-muted,#686865)]">
                      Nenhum apoiador neste filtro.
                    </td>
                  </tr>
                ) : (
                  apoiadoresRows.map((p) => (
                    <tr key={p.id}>
                      <td className="arena-mono text-xs">{p.pontos > 0 ? p.posicao : '—'}</td>
                      <td>
                        <Link
                          href={hrefPainelArena(p.id, filtro)}
                          className="font-semibold text-[var(--cx-ink,#14161a)] no-underline hover:text-[var(--cx-amber,#e8a825)]"
                        >
                          {p.nome}
                        </Link>
                        <div className="text-[var(--cx-muted,#686865)] text-xs">@{p.instagram}</div>
                      </td>
                      <td>{p.cidade ?? '—'}</td>
                      <td>{p.regiao ?? '—'}</td>
                      <td>
                        {p.nivel.name}
                        {p.conquistas.includes('fiel') ? (
                          <span className="text-[var(--cx-muted,#686865)] text-xs"> · fiel</span>
                        ) : null}
                      </td>
                      <td className="arena-mono">{formatPts(p.comentarios)}</td>
                      <td className="arena-mono font-bold">{formatPts(p.pontos)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </ArenaShell>
  )
}
