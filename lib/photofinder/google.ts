import { google } from 'googleapis'

export const PHOTOFINDER_GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/drive.readonly',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/userinfo.email',
]

function getClientId(): string {
  const id = process.env.PHOTOFINDER_GOOGLE_CLIENT_ID ?? process.env.GOOGLE_CLIENT_ID
  if (!id) throw new Error('PHOTOFINDER_GOOGLE_CLIENT_ID ou GOOGLE_CLIENT_ID não configurado')
  return id
}

function getClientSecret(): string {
  const secret = process.env.PHOTOFINDER_GOOGLE_CLIENT_SECRET ?? process.env.GOOGLE_CLIENT_SECRET
  if (!secret) throw new Error('PHOTOFINDER_GOOGLE_CLIENT_SECRET ou GOOGLE_CLIENT_SECRET não configurado')
  return secret
}

export function createPhotofinderOAuth2Client(redirectUri?: string) {
  return new google.auth.OAuth2(getClientId(), getClientSecret(), redirectUri)
}

export function getPhotofinderAuthUrl(redirectUri: string, returnUrl: string): string {
  const client = createPhotofinderOAuth2Client(redirectUri)
  const state = Buffer.from(JSON.stringify({ returnUrl })).toString('base64')
  return client.generateAuthUrl({
    access_type: 'offline',
    scope: PHOTOFINDER_GOOGLE_SCOPES,
    prompt: 'consent select_account',
    state,
  })
}

export async function getPhotofinderTokensFromCode(code: string, redirectUri: string) {
  const client = createPhotofinderOAuth2Client(redirectUri)
  const { tokens } = await client.getToken(code)
  return tokens
}

export function createDriveClient(tokens: {
  access_token?: string | null
  refresh_token?: string | null
  expiry_date?: number | null
}) {
  const client = createPhotofinderOAuth2Client()
  client.setCredentials(tokens)
  return google.drive({ version: 'v3', auth: client })
}

export function extractImageMetadata(imageMediaMetadata?: {
  width?: number | null
  height?: number | null
  location?: { latitude?: number | null; longitude?: number | null } | null
} | null) {
  return {
    width: imageMediaMetadata?.width ?? null,
    height: imageMediaMetadata?.height ?? null,
    location:
      imageMediaMetadata?.location?.latitude != null &&
      imageMediaMetadata?.location?.longitude != null
        ? {
            latitude: imageMediaMetadata.location.latitude,
            longitude: imageMediaMetadata.location.longitude,
          }
        : null,
  }
}
