import { ARENA_BADGES, ARENA_LEVELS } from '@/lib/arena/constants'
import type {
  ArenaBadgeId,
  ArenaInteraction,
  ArenaLevel,
  ArenaPost,
  MemberScoreBreakdown,
} from '@/lib/arena/types'

function dayKey(iso: string): string {
  return iso.slice(0, 10)
}

export function resolveLevel(totalPoints: number): {
  level: ArenaLevel
  nextLevel: ArenaLevel | null
  progressToNext: number
} {
  let level = ARENA_LEVELS[0]!
  for (const l of ARENA_LEVELS) {
    if (totalPoints >= l.minPoints) level = l
  }
  const idx = ARENA_LEVELS.findIndex((l) => l.id === level.id)
  const nextLevel = idx >= 0 && idx < ARENA_LEVELS.length - 1 ? ARENA_LEVELS[idx + 1]! : null
  if (!nextLevel) {
    return { level, nextLevel: null, progressToNext: 1 }
  }
  const span = nextLevel.minPoints - level.minPoints
  const progressToNext =
    span <= 0 ? 1 : Math.min(1, Math.max(0, (totalPoints - level.minPoints) / span))
  return { level, nextLevel, progressToNext }
}

export function computeStreakDays(
  interactions: ArenaInteraction[],
  memberId: string,
  todayKey: string,
): number {
  const days = new Set(
    interactions
      .filter((i) => i.memberId === memberId)
      .map((i) => dayKey(i.interactedAt ?? i.capturedAt)),
  )
  let streak = 0
  const cursor = new Date(`${todayKey}T12:00:00Z`)
  for (;;) {
    const key = cursor.toISOString().slice(0, 10)
    if (!days.has(key)) break
    streak += 1
    cursor.setUTCDate(cursor.getUTCDate() - 1)
  }
  return streak
}

export function scoreMember(opts: {
  memberId: string
  interactions: ArenaInteraction[]
  postsInPeriod: ArenaPost[]
  todayKey: string
  top10MemberIds: Set<string>
}): MemberScoreBreakdown {
  const { memberId, interactions, postsInPeriod, todayKey, top10MemberIds } = opts
  const mine = interactions.filter((i) => i.memberId === memberId)

  let commentPoints = 0
  let earlyBonusPoints = 0
  let likeCount = 0
  let commentCount = 0
  let earlyCommentCount = 0
  const engagedPosts = new Set<string>()

  for (const i of mine) {
    engagedPosts.add(i.postId)
    if (i.type === 'comentario') {
      commentPoints += i.basePoints
      earlyBonusPoints += i.earlyBonusPoints
      commentCount += 1
      if (i.isEarlyComment) earlyCommentCount += 1
    } else {
      likeCount += 1
    }
  }

  const likePoints = likeCount * 3
  const subtotal = commentPoints + earlyBonusPoints + likePoints
  const postsTotal = postsInPeriod.length
  const postsEngaged = [...engagedPosts].filter((id) =>
    postsInPeriod.some((p) => p.id === id),
  ).length
  const engagementRate = postsTotal > 0 ? postsEngaged / postsTotal : 0
  const fidelityBonus = engagementRate >= 0.7 ? Math.round(subtotal * 0.15) : 0
  const total = subtotal + fidelityBonus
  const { level, nextLevel, progressToNext } = resolveLevel(total)
  const streakDays = computeStreakDays(interactions, memberId, todayKey)

  const badges: ArenaBadgeId[] = []
  if (likeCount >= 1) badges.push('primeira_curtida')
  if (commentCount >= 150) badges.push('voz_ativa')
  if (streakDays >= 3) badges.push('sequencia_3')
  if (earlyCommentCount >= 10) badges.push('comentarista_relampago')
  if (engagementRate >= 0.7) badges.push('fiel')
  if (top10MemberIds.has(memberId)) badges.push('top_10')

  return {
    memberId,
    commentPoints,
    earlyBonusPoints,
    likePoints,
    subtotal,
    engagementRate,
    postsEngaged,
    postsTotal,
    fidelityBonus,
    total,
    level,
    nextLevel,
    progressToNext,
    streakDays,
    badges,
  }
}

export function scoreAllMembers(opts: {
  memberIds: string[]
  interactions: ArenaInteraction[]
  postsInPeriod: ArenaPost[]
  todayKey: string
}): MemberScoreBreakdown[] {
  const prelim = opts.memberIds.map((memberId) =>
    scoreMember({
      memberId,
      interactions: opts.interactions,
      postsInPeriod: opts.postsInPeriod,
      todayKey: opts.todayKey,
      top10MemberIds: new Set(),
    }),
  )
  const ranked = [...prelim].sort((a, b) => b.total - a.total)
  const top10 = new Set(ranked.slice(0, 10).map((r) => r.memberId))
  return opts.memberIds.map((memberId) =>
    scoreMember({
      memberId,
      interactions: opts.interactions,
      postsInPeriod: opts.postsInPeriod,
      todayKey: opts.todayKey,
      top10MemberIds: top10,
    }),
  )
}

export function badgeMeta(id: ArenaBadgeId) {
  return ARENA_BADGES.find((b) => b.id === id)!
}

export function sourceLabel(source: 'api_oficial' | 'scraper' | 'interno'): string {
  if (source === 'api_oficial') return 'API oficial'
  if (source === 'scraper') return 'Verificação periódica'
  return 'Sistema interno'
}
