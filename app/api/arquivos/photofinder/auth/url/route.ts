import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getPhotofinderRedirectUri } from '@/lib/photofinder/session'
import { getPhotofinderAuthUrl } from '@/lib/photofinder/google'
import { arquivosHubHref } from '@/lib/arquivos-hub-route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const redirectUri = getPhotofinderRedirectUri(request)
    const returnUrl = `${request.nextUrl.origin}${arquivosHubHref()}`
    const authUrl = getPhotofinderAuthUrl(redirectUri, returnUrl)
    return NextResponse.json({ authUrl, redirectUri })
  } catch (error) {
    console.error('photofinder auth/url:', error)
    return NextResponse.json({ error: 'Falha ao gerar URL de autenticação' }, { status: 500 })
  }
}
