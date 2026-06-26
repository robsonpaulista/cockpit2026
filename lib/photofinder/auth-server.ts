import type { NextRequest } from 'next/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { createDriveClient } from '@/lib/photofinder/google'
import { getPhotofinderSession, parsePhotofinderSessionFromRequest } from '@/lib/photofinder/session'
import { normalizePhotofinderUserId } from '@/lib/photofinder/user-scope'

export interface PhotofinderAuthContext {
  userId: string
  accessToken: string
  refreshToken: string | null
  tokenExpiry: string | null
}

async function loadUserTokens(userId: string): Promise<PhotofinderAuthContext | null> {
  const supabase = createAdminClient()
  const { data: user, error } = await supabase
    .from('users')
    .select('id, access_token, refresh_token, token_expiry')
    .eq('id', userId)
    .single()

  if (error || !user?.access_token) return null

  return {
    userId: normalizePhotofinderUserId(String(user.id)),
    accessToken: user.access_token,
    refreshToken: user.refresh_token,
    tokenExpiry: user.token_expiry,
  }
}

export async function requirePhotofinderAuth(
  request?: NextRequest,
): Promise<PhotofinderAuthContext | null> {
  const session = request
    ? parsePhotofinderSessionFromRequest(request)
    : await getPhotofinderSession()

  if (!session?.userId) return null
  return loadUserTokens(session.userId)
}

export function getPhotofinderDrive(auth: PhotofinderAuthContext) {
  return createDriveClient({
    access_token: auth.accessToken,
    refresh_token: auth.refreshToken,
    expiry_date: auth.tokenExpiry ? new Date(auth.tokenExpiry).getTime() : undefined,
  })
}
