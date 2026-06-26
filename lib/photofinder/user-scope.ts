import type { SupabaseClient } from '@supabase/supabase-js'
import type { NextRequest } from 'next/server'
import {
  getPhotofinderSession,
  parsePhotofinderSessionFromRequest,
} from '@/lib/photofinder/session'

export function normalizePhotofinderUserId(id: string): string {
  return String(id).trim().toLowerCase()
}

export async function resolvePhotofinderUserIds(
  supabase: SupabaseClient,
  request?: NextRequest,
): Promise<string[] | null> {
  const session = request
    ? parsePhotofinderSessionFromRequest(request)
    : await getPhotofinderSession()

  if (!session?.userId) return null

  const ids = new Set<string>([normalizePhotofinderUserId(session.userId)])

  if (session.googleId) {
    const { data: byGoogleId } = await supabase
      .from('users')
      .select('id')
      .eq('google_id', session.googleId)

    byGoogleId?.forEach((row) => {
      if (row.id) ids.add(normalizePhotofinderUserId(String(row.id)))
    })
  }

  const { data: currentUser } = await supabase
    .from('users')
    .select('email')
    .eq('id', session.userId)
    .maybeSingle()

  if (currentUser?.email) {
    const { data: byEmail } = await supabase
      .from('users')
      .select('id')
      .ilike('email', currentUser.email)

    byEmail?.forEach((row) => {
      if (row.id) ids.add(normalizePhotofinderUserId(String(row.id)))
    })
  }

  return [...ids]
}

export function applyPhotofinderUserScope<T>(query: T, userIds: string[]): T {
  const q = query as T & { in: (column: string, values: string[]) => T }
  return q.in('user_id', userIds)
}

export async function linkPhotofinderPhotosToUser(
  supabase: SupabaseClient,
  canonicalUserId: string,
  googleId: string,
): Promise<void> {
  const canonical = normalizePhotofinderUserId(canonicalUserId)

  const { data: relatedUsers } = await supabase
    .from('users')
    .select('id')
    .eq('google_id', googleId)

  const legacyIds =
    relatedUsers
      ?.map((row) => normalizePhotofinderUserId(String(row.id)))
      .filter((id) => id !== canonical) ?? []

  if (legacyIds.length === 0) return

  const { error } = await supabase
    .from('photos')
    .update({ user_id: canonical })
    .in('user_id', legacyIds)

  if (error) {
    console.error('photofinder link legacy photos:', error)
  }
}
