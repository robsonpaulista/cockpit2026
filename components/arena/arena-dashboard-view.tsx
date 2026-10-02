'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArenaShell, ArenaSourcePill, formatPts } from '@/components/arena/arena-shell'
import { ArenaBreakdownRow } from '@/components/arena/arena-icons'
import { ArenaPodium } from '@/components/arena/arena-podium'
import { ArenaInteractionsChart } from '@/components/arena/arena-charts'
import { ArenaCommentsSyncPanel } from '@/components/arena/arena-comments-sync-panel'
import { SCORING_RULES } from '@/lib/arena/constants'
import {
  ARENA_LEADERS,
  getArenaScores,
  interactionsByDay,
  leaderName,
  memberById,
  todayStats,
} from '@/lib/arena/mock-data'
import type { ArenaViewerRole } from '@/lib/arena/types'

export function ArenaDashboardView() {
  const [role, setRole] = useState<ArenaViewerRole>('admin')
  const leaderFilter = role === 'lideranca' ? ARENA_LEADERS[0]!.id : null

  const { scores, leaderRanking } = useMemo(
    () => getArenaScores(leaderFilter),
    [leaderFilter],
  )
  const stats = useMemo(() => todayStats(leaderFilter), [leaderFilter])
  const chart = useMemo(() => interactionsByDay(14), [])

  return (
    <ArenaShell
      role={role}
      onRoleChange={setRole}
      title="Dashboard"
      subtitle={
        role === 'lideranca'
          ? `Escopo: grupo de ${ARENA_LEADERS[0]!.name} (protótipo)`
          : 'Visão geral da campanha — dados de demonstração'
      }
    >
      <section className="arena-tiles" aria-label="Números do dia">
        <article className="arena-card">
          <span className="arena-tile__label">Apoiadores</span>
          <strong className="arena-tile__val">{stats.membersCount}</strong>
        </article>
        <article className="arena-card">
          <span className="arena-tile__label">Interações hoje</span>
          <strong className="arena-tile__val">{stats.interactionsToday}</strong>
        </article>
        <article className="arena-card">
          <span className="arena-tile__label">Pontos hoje</span>
          <strong className="arena-tile__val">{formatPts(stats.pointsToday)}</strong>
        </article>
        <article className="arena-card">
          <span className="arena-tile__label">Comentários via API</span>
          <strong className="arena-tile__val">{stats.apiCommentPct}%</strong>
        </article>
      </section>

      <ArenaCommentsSyncPanel />

      <section className="arena-card">
        <h2 className="arena-section-title">Interações por dia · 14 dias</h2>
        <ArenaInteractionsChart data={chart} />
      </section>

      {role !== 'lideranca' ? (
        <section className="arena-card">
          <h2 className="arena-section-title">Lideranças que mais mobilizam</h2>
          <ArenaPodium ranking={leaderRanking} />
        </section>
      ) : null}

      <section className="arena-card">
        <h2 className="arena-section-title">Ranking de apoiadores</h2>
        <div className="arena-table-wrap">
          <table className="arena-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Nome</th>
                <th>@</th>
                <th>Nível</th>
                <th>Pontos</th>
              </tr>
            </thead>
            <tbody>
              {scores.map((s, i) => {
                const m = memberById(s.memberId)
                if (!m) return null
                return (
                  <tr key={s.memberId}>
                    <td className="arena-mono">{i + 1}</td>
                    <td>
                      <Link
                        href={`/dashboard/mobilizacao/painel?membro=${m.id}`}
                        className="font-semibold text-[var(--cx-ink,#14161a)] no-underline hover:text-[var(--cx-amber,#e8a825)]"
                      >
                        {m.name}
                      </Link>
                    </td>
                    <td className="text-[var(--arena-text-muted)]">@{m.instagramHandle}</td>
                    <td>
                      {s.level.id} — {s.level.name}
                    </td>
                    <td className="arena-mono font-bold">{formatPts(s.total)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <div className="arena-grid-2">
        <section className="arena-card">
          <h2 className="arena-section-title">De onde vêm os pontos</h2>
          <ul className="arena-breakdown">
            <ArenaBreakdownRow
              kind="comentario"
              subtitle="Graph API · match por @"
              source="api_oficial"
            />
            <ArenaBreakdownRow
              kind="cedo"
              subtitle="Até 1h após o post"
              source="interno"
            />
            <ArenaBreakdownRow
              kind="curtida"
              subtitle="Apify · verificação periódica"
              source="scraper"
            />
            <ArenaBreakdownRow
              kind="fidelidade"
              subtitle="≥70% dos posts do período"
              source="interno"
            />
          </ul>
        </section>

        <section className="arena-card">
          <h2 className="arena-section-title">Tabela de pontuação</h2>
          <div className="arena-table-wrap">
            <table className="arena-table">
              <thead>
                <tr>
                  <th>Ação</th>
                  <th>Pontos</th>
                  <th>Fonte</th>
                </tr>
              </thead>
              <tbody>
                {SCORING_RULES.map((r) => (
                  <tr key={r.id}>
                    <td>{r.action}</td>
                    <td className="arena-mono">{r.points}</td>
                    <td>
                      <ArenaSourcePill kind={r.sourceKind} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {role === 'lideranca' ? (
            <p className="arena-sub mt-3">
              Liderança responsável: {leaderName(ARENA_LEADERS[0]!.id)}
            </p>
          ) : null}
        </section>
      </div>
    </ArenaShell>
  )
}
