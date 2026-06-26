import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'
import type { PhotofinderSessionData } from '@/lib/photofinder/types'

export const PHOTOFINDER_SESSION_COOKIE = 'photofinder_session'
const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60

function parseSessionValue(raw: string | undefined): PhotofinderSessionData | null {
  if (!raw) return null
  try {
    const session = JSON.parse(raw) as PhotofinderSessionData
    if (!session.userId || !session.expires) return null
    if (new Date(session.expires) < new Date()) return null
    return session
  } catch {
    return null
  }
}

export function parsePhotofinderSessionFromRequest(req: NextRequest): PhotofinderSessionData | null {
  const raw = req.cookies.get(PHOTOFINDER_SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    return parseSessionValue(decodeURIComponent(raw))
  } catch {
    return parseSessionValue(raw)
  }
}

export async function getPhotofinderSession(): Promise<PhotofinderSessionData | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(PHOTOFINDER_SESSION_COOKIE)?.value
  if (!raw) return null
  try {
    return parseSessionValue(decodeURIComponent(raw))
  } catch {
    return parseSessionValue(raw)
  }
}

export function buildPhotofinderSessionCookie(session: PhotofinderSessionData): string {
  const encoded = encodeURIComponent(JSON.stringify(session))
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
  return `${PHOTOFINDER_SESSION_COOKIE}=${encoded}; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=${SESSION_MAX_AGE_SECONDS}`
}

export function clearPhotofinderSessionCookie(): string {
  const secure = process.env.NODE_ENV === 'production' ? 'Secure; ' : ''
  return `${PHOTOFINDER_SESSION_COOKIE}=; HttpOnly; ${secure}SameSite=Lax; Path=/; Max-Age=0`
}

export function createPhotofinderSessionData(userId: string, googleId: string): PhotofinderSessionData {
  return {
    userId: String(userId).trim().toLowerCase(),
    googleId,
    expires: new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000).toISOString(),
  }
}

export function getPhotofinderAppOrigin(request: NextRequest): string {
  if (process.env.NEXT_PUBLIC_APP_URL) {
    return process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '')
  }
  if (process.env.NEXTAUTH_URL) {
    return process.env.NEXTAUTH_URL.replace(/\/$/, '')
  }
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL.replace(/\/$/, '')}`
  }
  return request.nextUrl.origin
}

export function getPhotofinderRedirectUri(request: NextRequest): string {
  return `${getPhotofinderAppOrigin(request)}/api/arquivos/photofinder/auth/callback`
}
