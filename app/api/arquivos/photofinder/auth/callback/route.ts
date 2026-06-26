import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { google } from 'googleapis'
import { createAdminClient } from '@/lib/supabase/admin'
import {
  buildPhotofinderSessionCookie,
  createPhotofinderSessionData,
  getPhotofinderRedirectUri,
} from '@/lib/photofinder/session'
import { linkPhotofinderPhotosToUser, normalizePhotofinderUserId } from '@/lib/photofinder/user-scope'
import {
  createPhotofinderOAuth2Client,
  getPhotofinderTokensFromCode,
} from '@/lib/photofinder/google'
import { arquivosHubHref } from '@/lib/arquivos-hub-route'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const code = searchParams.get('code')
  const authError = searchParams.get('error')
  const state = searchParams.get('state')

  let returnUrl = `${request.nextUrl.origin}${arquivosHubHref()}`
  if (state) {
    try {
      const parsed = JSON.parse(Buffer.from(state, 'base64').toString()) as { returnUrl?: string }
      if (parsed.returnUrl) returnUrl = parsed.returnUrl
    } catch {
      // ignora state inválido
    }
  }

  if (authError) {
    return NextResponse.redirect(`${returnUrl}&auth=error&reason=${encodeURIComponent(authError)}`)
  }

  if (!code) {
    return NextResponse.redirect(`${returnUrl}&auth=error&reason=no_code`)
  }

  try {
    const redirectUri = getPhotofinderRedirectUri(request)
    const tokens = await getPhotofinderTokensFromCode(code, redirectUri)

    const oauth2Client = createPhotofinderOAuth2Client(redirectUri)
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const { data: userInfo } = await oauth2.userinfo.get()

    if (!userInfo.id || !userInfo.email) {
      return NextResponse.redirect(`${returnUrl}&auth=error&reason=no_user_info`)
    }

    const supabase = createAdminClient()
    const { data: user, error: dbError } = await supabase
      .from('users')
      .upsert(
        {
          google_id: userInfo.id,
          email: userInfo.email,
          name: userInfo.name ?? null,
          access_token: tokens.access_token,
          refresh_token: tokens.refresh_token,
          token_expiry: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        },
        { onConflict: 'google_id' },
      )
      .select('id')
      .single()

    if (dbError || !user) {
      console.error('photofinder callback db:', dbError)
      return NextResponse.redirect(`${returnUrl}&auth=error&reason=db_error`)
    }

    const canonicalUserId = normalizePhotofinderUserId(String(user.id))
    await linkPhotofinderPhotosToUser(supabase, canonicalUserId, userInfo.id)

    const session = createPhotofinderSessionData(canonicalUserId, userInfo.id)
    const response = NextResponse.redirect(`${returnUrl}&auth=success`)
    response.headers.set('Set-Cookie', buildPhotofinderSessionCookie(session))
    return response
  } catch (error) {
    console.error('photofinder callback:', error)
    return NextResponse.redirect(`${returnUrl}&auth=error&reason=callback_failed`)
  }
}
