import { engajaLeadersAsArena, ENGAJA_LEADERS } from '@/lib/arena/engaja-leaders'
import { scoreAllMembers } from '@/lib/arena/scoring'
import type {
  ArenaInteraction,
  ArenaLeader,
  ArenaMember,
  ArenaPost,
  LeaderGroupScore,
  MemberScoreBreakdown,
} from '@/lib/arena/types'

function daysAgo(n: number, hour = 12): string {
  const d = new Date()
  d.setHours(hour, 0, 0, 0)
  d.setDate(d.getDate() - n)
  return d.toISOString()
}

export const ARENA_TODAY_KEY = new Date().toISOString().slice(0, 10)

/** Lideranças da Arena = CSV Engaja (espelho do banco). */
export const ARENA_LEADERS: ArenaLeader[] = engajaLeadersAsArena()

const DEMO_MEMBER_SEEDS: Omit<ArenaMember, 'leaderId'>[] = [
  {
    id: 'm-1',
    name: 'Ana Paula Silva',
    instagramHandle: 'anapaula.pi',
    phone: '86999001122',
    email: 'ana@email.com',
    city: 'Teresina',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(40),
    createdAt: daysAgo(40),
  },
  {
    id: 'm-2',
    name: 'Bruno Oliveira',
    instagramHandle: 'bruno.olv',
    phone: '86999112233',
    email: 'bruno@email.com',
    city: 'Teresina',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(35),
    createdAt: daysAgo(35),
  },
  {
    id: 'm-3',
    name: 'Carla Souza',
    instagramHandle: 'carlasouza86',
    phone: '86999223344',
    email: 'carla@email.com',
    city: 'Altos',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(30),
    createdAt: daysAgo(30),
  },
  {
    id: 'm-4',
    name: 'Diego Santos',
    instagramHandle: 'diegosnts',
    phone: '86999334455',
    email: 'diego@email.com',
    city: 'Parnaíba',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(28),
    createdAt: daysAgo(28),
  },
  {
    id: 'm-5',
    name: 'Eduarda Lima',
    instagramHandle: 'edu.lima',
    phone: '86999445566',
    email: 'eduarda@email.com',
    city: 'Parnaíba',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(25),
    createdAt: daysAgo(25),
  },
  {
    id: 'm-6',
    name: 'Felipe Rocha',
    instagramHandle: 'feliperocha',
    phone: '86999556677',
    email: 'felipe@email.com',
    city: 'Campo Maior',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(22),
    createdAt: daysAgo(22),
  },
  {
    id: 'm-7',
    name: 'Gabriela Pinto',
    instagramHandle: 'gabipinto',
    phone: '86999667788',
    email: 'gabi@email.com',
    city: 'Campo Maior',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(20),
    createdAt: daysAgo(20),
  },
  {
    id: 'm-8',
    name: 'Hugo Almeida',
    instagramHandle: 'hugo.almeida',
    phone: '86999778899',
    email: 'hugo@email.com',
    city: 'Coivaras',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(18),
    createdAt: daysAgo(18),
  },
  {
    id: 'm-9',
    name: 'Isabela Freitas',
    instagramHandle: 'isafreitas',
    phone: '86999889900',
    email: 'isa@email.com',
    city: 'Piracuruca',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(15),
    createdAt: daysAgo(15),
  },
  {
    id: 'm-10',
    name: 'Lucas Ferreira',
    instagramHandle: 'lucasferr',
    phone: '86999990011',
    email: 'lucas@email.com',
    city: 'Teresina',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(12),
    createdAt: daysAgo(12),
  },
  {
    id: 'm-11',
    name: 'Marina Castro',
    instagramHandle: 'maricastro',
    phone: '86998112233',
    email: 'marina@email.com',
    city: 'Parnaíba',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(10),
    createdAt: daysAgo(10),
  },
  {
    id: 'm-12',
    name: 'Pedro Henrique',
    instagramHandle: 'pedrohenri',
    phone: '86998223344',
    email: 'pedro@email.com',
    city: 'Regeneração',
    lgpdConsent: true,
    lgpdConsentAt: daysAgo(8),
    createdAt: daysAgo(8),
  },
]

function pickLeaderId(city: string | null, index: number): string {
  const byCity = ENGAJA_LEADERS.filter(
    (l) => (l.city ?? '').toLowerCase() === (city ?? '').toLowerCase(),
  )
  if (byCity.length > 0) return byCity[index % byCity.length]!.id
  return ENGAJA_LEADERS[index % ENGAJA_LEADERS.length]!.id
}

export const ARENA_MEMBERS: ArenaMember[] = DEMO_MEMBER_SEEDS.map((m, i) => ({
  ...m,
  leaderId: pickLeaderId(m.city, i),
}))

export const ARENA_POSTS: ArenaPost[] = Array.from({ length: 14 }, (_, i) => ({
  id: `post-${i + 1}`,
  instagramMediaId: `ig_media_${i + 1}`,
  caption: `Publicação da campanha #${i + 1}`,
  publishedAt: daysAgo(13 - i, 9),
  permalink: `https://instagram.com/p/demo${i + 1}`,
}))

function buildInteractions(): ArenaInteraction[] {
  const out: ArenaInteraction[] = []
  let n = 0
  const push = (partial: Omit<ArenaInteraction, 'id' | 'capturedAt'>) => {
    n += 1
    out.push({
      ...partial,
      id: `ix-${n}`,
      capturedAt: partial.interactedAt ?? daysAgo(0),
    })
  }

  for (const member of ARENA_MEMBERS) {
    const seed = member.id.charCodeAt(2) + member.name.length
    const postCount = 6 + (seed % 7)
    for (let p = 0; p < postCount; p++) {
      const post = ARENA_POSTS[p % ARENA_POSTS.length]!
      const dayOffset = Math.min(13, p + (seed % 3))
      const early = p % 4 === 0
      const base = 10 + (seed % 5)
      push({
        memberId: member.id,
        postId: post.id,
        type: 'comentario',
        rawInstagramUsername: member.instagramHandle,
        basePoints: base,
        isEarlyComment: early,
        earlyBonusPoints: early ? 8 : 0,
        source: 'api_oficial',
        interactedAt: daysAgo(dayOffset, early ? 10 : 15),
      })
      if (p % 2 === 0) {
        push({
          memberId: member.id,
          postId: post.id,
          type: 'curtida',
          rawInstagramUsername: member.instagramHandle,
          basePoints: 3,
          isEarlyComment: false,
          earlyBonusPoints: 0,
          source: 'scraper',
          interactedAt: daysAgo(dayOffset, 18),
        })
      }
    }
  }

  // Interações de hoje para tiles
  for (const m of ARENA_MEMBERS.slice(0, 5)) {
    push({
      memberId: m.id,
      postId: ARENA_POSTS[ARENA_POSTS.length - 1]!.id,
      type: 'comentario',
      rawInstagramUsername: m.instagramHandle,
      basePoints: 12,
      isEarlyComment: true,
      earlyBonusPoints: 8,
      source: 'api_oficial',
      interactedAt: daysAgo(0, 11),
    })
  }

  return out
}

export const ARENA_INTERACTIONS = buildInteractions()

export function getArenaScores(leaderIdFilter?: string | null): {
  scores: MemberScoreBreakdown[]
  members: ArenaMember[]
  leaderRanking: LeaderGroupScore[]
} {
  const members = leaderIdFilter
    ? ARENA_MEMBERS.filter((m) => m.leaderId === leaderIdFilter)
    : ARENA_MEMBERS
  const memberIds = members.map((m) => m.id)
  const interactions = leaderIdFilter
    ? ARENA_INTERACTIONS.filter((i) => i.memberId && memberIds.includes(i.memberId))
    : ARENA_INTERACTIONS

  const scores = scoreAllMembers({
    memberIds,
    interactions,
    postsInPeriod: ARENA_POSTS,
    todayKey: ARENA_TODAY_KEY,
  }).sort((a, b) => b.total - a.total)

  const fullScores = scoreAllMembers({
    memberIds: ARENA_MEMBERS.map((m) => m.id),
    interactions: ARENA_INTERACTIONS,
    postsInPeriod: ARENA_POSTS,
    todayKey: ARENA_TODAY_KEY,
  })
  const fullByLeader = new Map<string, { points: number; count: number }>()
  for (const m of ARENA_MEMBERS) {
    const sc = fullScores.find((s) => s.memberId === m.id)
    const prev = fullByLeader.get(m.leaderId) ?? { points: 0, count: 0 }
    fullByLeader.set(m.leaderId, {
      points: prev.points + (sc?.total ?? 0),
      count: prev.count + 1,
    })
  }

  const leaderRanking: LeaderGroupScore[] = ARENA_LEADERS.map((leader) => {
    const agg = fullByLeader.get(leader.id) ?? { points: 0, count: 0 }
    return { leader, totalPoints: agg.points, memberCount: agg.count }
  }).sort((a, b) => b.totalPoints - a.totalPoints)

  return { scores, members, leaderRanking }
}

export function interactionsByDay(days: number): { day: string; comentarios: number; curtidas: number }[] {
  const out: { day: string; comentarios: number; curtidas: number }[] = []
  for (let i = days - 1; i >= 0; i--) {
    const key = daysAgo(i).slice(0, 10)
    let comentarios = 0
    let curtidas = 0
    for (const ix of ARENA_INTERACTIONS) {
      const d = (ix.interactedAt ?? ix.capturedAt).slice(0, 10)
      if (d !== key) continue
      if (ix.type === 'comentario') comentarios += 1
      else curtidas += 1
    }
    out.push({ day: key, comentarios, curtidas })
  }
  return out
}

export function todayStats(leaderIdFilter?: string | null) {
  const { members, scores } = getArenaScores(leaderIdFilter)
  const ids = new Set(members.map((m) => m.id))
  const todayIx = ARENA_INTERACTIONS.filter((i) => {
    if ((i.interactedAt ?? i.capturedAt).slice(0, 10) !== ARENA_TODAY_KEY) return false
    if (!i.memberId) return false
    return ids.has(i.memberId)
  })
  const comments = todayIx.filter((i) => i.type === 'comentario')
  const apiComments = comments.filter((i) => i.source === 'api_oficial')
  const pointsToday = todayIx.reduce(
    (s, i) => s + i.basePoints + i.earlyBonusPoints,
    0,
  )
  return {
    membersCount: members.length,
    interactionsToday: todayIx.length,
    pointsToday,
    apiCommentPct: comments.length ? Math.round((apiComments.length / comments.length) * 100) : 100,
    totalPoints: scores.reduce((s, x) => s + x.total, 0),
  }
}

export function leaderName(leaderId: string): string {
  return ARENA_LEADERS.find((l) => l.id === leaderId)?.name ?? '—'
}

export function memberById(id: string): ArenaMember | undefined {
  return ARENA_MEMBERS.find((m) => m.id === id)
}

export function pointsLast7Days(memberId: string): { day: string; points: number }[] {
  const out: { day: string; points: number }[] = []
  for (let i = 6; i >= 0; i--) {
    const key = daysAgo(i).slice(0, 10)
    let points = 0
    for (const ix of ARENA_INTERACTIONS) {
      if (ix.memberId !== memberId) continue
      if ((ix.interactedAt ?? ix.capturedAt).slice(0, 10) !== key) continue
      points += ix.basePoints + ix.earlyBonusPoints
    }
    out.push({ day: key, points })
  }
  return out
}
