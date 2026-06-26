import { NextResponse } from 'next/server'
import { clearPhotofinderSessionCookie } from '@/lib/photofinder/session'

export const dynamic = 'force-dynamic'

export async function POST() {
  const response = NextResponse.json({ ok: true })
  response.headers.set('Set-Cookie', clearPhotofinderSessionCookie())
  return response
}
