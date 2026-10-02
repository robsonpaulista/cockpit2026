'use client'

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  ArenaShell,
  ArenaSourcePill,
  formatPts,
  initials,
} from '@/components/arena/arena-shell'
import { ArenaBadgeGlyph, ArenaBreakdownRow } from '@/components/arena/arena-icons'
import { ArenaPointsBarChart } from '@/components/arena/arena-charts'
import { ARENA_BADGES, SCORING_RULES } from '@/lib/arena/constants'
import {
  ARENA_INTERACTIONS,
  ARENA_MEMBERS,
  ARENA_POSTS,
  getArenaScores,
  pointsLast7Days,
} from '@/lib/arena/mock-data'
import { sourceLabel } from '@/lib/arena/scoring'

export function ArenaPainelView() {
  const searchParams = useSearchParams()
  const memberId = searchParams.get('membro') ?? ARENA_MEMBERS[0]!.id
  const member = ARENA_MEMBERS.find((m) => m.id === memberId) ?? ARENA_MEMBERS[0]!

  const { scores } = useMemo(() => getArenaScores(), [])
  const score = scores.find((s) => s.memberId === member.id) ?? scores[0]!
  const rank = scores.findIndex((s) => s.memberId === member.id) + 1
  const chart = useMemo(() => pointsLast7Days(member.id), [member.id])

  const recent = useMemo(() => {
    return ARENA_INTERACTIONS.filter((i) => i.memberId === member.id)
      .sort((a, b) =>
        (b.interactedAt ?? b.capturedAt).localeCompare(a.interactedAt ?? a.capturedAt),
      )
      .slice(0, 12)
  }, [member.id])

  const fidelityPct = Math.round(score.engagementRate * 100)

  return (
    <ArenaShell
      role="apoiador"
      title="Seu painel"
      subtitle="Pontuação, nível, conquistas e histórico"
    >
      <div className="arena-grid-2">
        <section className="arena-card arena-card--elevated">
          <div className="mb-4 flex items-center gap-3">
            <div className="arena-podium__avatar">{initials(member.name)}</div>
            <div>
              <h2 className="m-0 text-xl font-bold text-[var(--cx-ink,#14161a)]">
                {member.name}
              </h2>
              <p className="m-0 text-sm text-[var(--cx-muted,#686865)]">@{member.instagramHandle}</p>
            </div>
          </div>
          <p className="mb-1 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--cx-label,#969692)]">
            Nível {score.level.id} — {score.level.name}
          </p>
          <p className="arena-mono mb-2 text-2xl font-bold text-[var(--cx-ink,#14161a)]">{formatPts(score.total)} pts</p>
          <div className="arena-progress mb-2">
            <span style={{ width: `${Math.round(score.progressToNext * 100)}%` }} />
          </div>
          <p className="arena-sub mb-3">
            {score.nextLevel
              ? `${formatPts(score.nextLevel.minPoints - score.total)} pts para ${score.nextLevel.name}`
              : 'Nível máximo alcançado'}
          </p>
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-[var(--cx-muted,#686865)]">Ranking </span>
              <strong className="arena-mono">{rank}º</strong>
            </div>
            <div>
              <span className="text-[var(--cx-muted,#686865)]">Streak </span>
              <strong className="arena-mono">{score.streakDays} dias</strong>
            </div>
          </div>
        </section>

        <section className="arena-card">
          <h2 className="arena-section-title">De onde vieram seus pontos</h2>
          <ul className="arena-breakdown">
            <ArenaBreakdownRow
              kind="comentario"
              subtitle="Pontos base por relevância"
              trailing={
                <strong className="arena-mono">{formatPts(score.commentPoints)}</strong>
              }
            />
            <ArenaBreakdownRow
              kind="cedo"
              label="Bônus comentar cedo"
              subtitle="Até 1h após o post"
              trailing={
                <strong className="arena-mono">{formatPts(score.earlyBonusPoints)}</strong>
              }
            />
            <ArenaBreakdownRow
              kind="curtida"
              subtitle="3 pts cada"
              trailing={
                <strong className="arena-mono">{formatPts(score.likePoints)}</strong>
              }
            />
            <ArenaBreakdownRow
              kind="fidelidade"
              label="Bônus fidelidade"
              subtitle="+15% se ≥70%"
              trailing={
                <strong className="arena-mono">{formatPts(score.fidelityBonus)}</strong>
              }
            />
          </ul>
          <p className="arena-sub mt-4">
            Engajou em {score.postsEngaged} de {score.postsTotal} posts do período ({fidelityPct}%)
          </p>
          <div className="arena-progress mt-2" title="Progresso até 70% de fidelidade">
            <span style={{ width: `${Math.min(100, Math.round((score.engagementRate / 0.7) * 100))}%` }} />
          </div>
        </section>
      </div>

      <section className="arena-card">
        <h2 className="arena-section-title">Atividade · 7 dias</h2>
        <ArenaPointsBarChart data={chart} />
      </section>

      <section className="arena-card">
        <h2 className="arena-section-title">Conquistas</h2>
        <div className="arena-badges">
          {ARENA_BADGES.map((b) => {
            const unlocked = score.badges.includes(b.id)
            return (
              <article
                key={b.id}
                className={`arena-badge${unlocked ? '' : ' arena-badge--locked'}`}
              >
                <div className="arena-badge__icon">
                  <ArenaBadgeGlyph unlocked={unlocked} />
                </div>
                <p className="arena-badge__label">{b.label}</p>
                <p className="arena-badge__desc">{b.description}</p>
              </article>
            )
          })}
        </div>
      </section>

      <section className="arena-card">
        <h2 className="arena-section-title">Interações recentes</h2>
        <ul className="arena-feed">
          {recent.map((ix) => {
            const post = ARENA_POSTS.find((p) => p.id === ix.postId)
            const pts = ix.basePoints + ix.earlyBonusPoints
            return (
              <li key={ix.id}>
                <div>
                  <strong>{ix.type === 'comentario' ? 'Comentário' : 'Curtida'}</strong>
                  {ix.isEarlyComment ? ' · cedo' : ''}
                  <div className="text-xs text-[var(--cx-muted,#686865)]">
                    {post?.caption ?? ix.postId}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="arena-mono font-bold">+{pts}</span>
                  <ArenaSourcePill kind={ix.source} />
                  <span className="sr-only">{sourceLabel(ix.source)}</span>
                </div>
              </li>
            )
          })}
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
      </section>
    </ArenaShell>
  )
}
