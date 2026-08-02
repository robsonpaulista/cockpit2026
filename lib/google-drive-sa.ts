import { google, type drive_v3 } from 'googleapis'

function formatPrivateKey(key: string): string {
  return key.replace(/\\\\n/g, '\n').replace(/\\n/g, '\n')
}

export type GoogleDriveSaCredentials = {
  type: 'service_account'
  private_key: string
  client_email: string
  token_uri: string
}

/**
 * Credenciais da service account usada no Drive de Obras/Demandas.
 * Prioriza DEMANDAS; fallback para a conta genérica.
 */
export function getGoogleDriveObrasCredentials(): GoogleDriveSaCredentials | null {
  const email =
    process.env.GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL?.trim() ||
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL?.trim()
  const privateKey =
    process.env.GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY ||
    process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY

  if (!email || !privateKey) return null

  return {
    type: 'service_account',
    client_email: email,
    private_key: formatPrivateKey(privateKey),
    token_uri: 'https://oauth2.googleapis.com/token',
  }
}

export function defaultObrasDriveFolderId(): string {
  return (
    process.env.GOOGLE_DRIVE_OBRAS_FOLDER_ID?.trim() ||
    '1eb4-WgWX8uhoKw7rIr9VWAa4W9CcM2u3'
  )
}

/** Extrai ID de pasta a partir de URL do Drive ou ID puro. */
export function extractGoogleDriveFolderId(input: string): string | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  const folderMatch = trimmed.match(/\/folders\/([a-zA-Z0-9_-]+)/)
  if (folderMatch?.[1]) return folderMatch[1]

  const idParam = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/)
  if (idParam?.[1]) return idParam[1]

  if (/^[a-zA-Z0-9_-]{20,}$/.test(trimmed)) return trimmed

  return null
}

export async function createDriveSaClient(
  credentials?: GoogleDriveSaCredentials | null,
): Promise<{ drive: drive_v3.Drive; clientEmail: string }> {
  const creds = credentials ?? getGoogleDriveObrasCredentials()
  if (!creds) {
    throw new Error(
      'Credenciais não encontradas. Configure GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL e GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY.',
    )
  }

  const auth = new google.auth.GoogleAuth({
    credentials: creds,
    scopes: ['https://www.googleapis.com/auth/drive.readonly'],
  })

  return {
    drive: google.drive({ version: 'v3', auth }),
    clientEmail: creds.client_email,
  }
}

export type DriveFolderChild = {
  id: string
  name: string
  mimeType: string
  isFolder: boolean
  modifiedTime: string | null
  size: string | null
  webViewLink: string | null
}

export type DriveFolderAccessResult = {
  ok: true
  clientEmail: string
  folder: {
    id: string
    name: string
    mimeType: string
    shared: boolean | null
    webViewLink: string | null
  }
  children: DriveFolderChild[]
  childrenCount: number
  truncated: boolean
}

export type DriveFolderAccessError = {
  ok: false
  clientEmail: string | null
  folderId: string
  status: number
  error: string
  hint?: string
}

const FOLDER_MIME = 'application/vnd.google-apps.folder'

export async function validateAndListDriveFolder(opts: {
  folderIdOrUrl: string
  pageSize?: number
}): Promise<DriveFolderAccessResult | DriveFolderAccessError> {
  const folderId = extractGoogleDriveFolderId(opts.folderIdOrUrl)
  const creds = getGoogleDriveObrasCredentials()
  const clientEmail = creds?.client_email ?? null

  if (!folderId) {
    return {
      ok: false,
      clientEmail,
      folderId: opts.folderIdOrUrl.trim(),
      status: 400,
      error: 'ID ou URL de pasta inválido.',
      hint: 'Use um link no formato https://drive.google.com/drive/folders/ID',
    }
  }

  if (!creds) {
    return {
      ok: false,
      clientEmail: null,
      folderId,
      status: 400,
      error: 'Credenciais da service account não configuradas.',
      hint: 'Defina GOOGLE_SERVICE_ACCOUNT_DEMANDAS_EMAIL e GOOGLE_SERVICE_ACCOUNT_DEMANDAS_PRIVATE_KEY no .env.local.',
    }
  }

  try {
    const { drive } = await createDriveSaClient(creds)
    const pageSize = Math.min(Math.max(opts.pageSize ?? 50, 1), 100)

    const folderRes = await drive.files.get({
      fileId: folderId,
      fields: 'id,name,mimeType,shared,webViewLink',
      supportsAllDrives: true,
    })

    const folder = folderRes.data
    if (folder.mimeType !== FOLDER_MIME) {
      return {
        ok: false,
        clientEmail,
        folderId,
        status: 400,
        error: 'O ID informado não é uma pasta do Drive.',
        hint: `Tipo encontrado: ${folder.mimeType ?? 'desconhecido'}`,
      }
    }

    const listRes = await drive.files.list({
      q: `'${folderId}' in parents and trashed=false`,
      fields:
        'files(id,name,mimeType,modifiedTime,size,webViewLink),nextPageToken',
      pageSize,
      orderBy: 'folder,name_natural',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    })

    const files = listRes.data.files ?? []
    const children: DriveFolderChild[] = files.map((f) => ({
      id: f.id ?? '',
      name: f.name ?? '(sem nome)',
      mimeType: f.mimeType ?? '',
      isFolder: f.mimeType === FOLDER_MIME,
      modifiedTime: f.modifiedTime ?? null,
      size: f.size ?? null,
      webViewLink: f.webViewLink ?? null,
    }))

    return {
      ok: true,
      clientEmail: creds.client_email,
      folder: {
        id: folder.id ?? folderId,
        name: folder.name ?? '(sem nome)',
        mimeType: folder.mimeType ?? FOLDER_MIME,
        shared: folder.shared ?? null,
        webViewLink: folder.webViewLink ?? null,
      },
      children,
      childrenCount: children.length,
      truncated: Boolean(listRes.data.nextPageToken),
    }
  } catch (err: unknown) {
    const status =
      typeof err === 'object' &&
      err !== null &&
      'code' in err &&
      typeof (err as { code: unknown }).code === 'number'
        ? (err as { code: number }).code
        : typeof err === 'object' &&
            err !== null &&
            'response' in err &&
            typeof (err as { response?: { status?: number } }).response?.status ===
              'number'
          ? (err as { response: { status: number } }).response.status
          : 500

    const message =
      err instanceof Error ? err.message : 'Falha ao acessar o Google Drive.'

    let hint: string | undefined
    if (status === 404) {
      hint = [
        `1) No Drive, Compartilhar a pasta com ${clientEmail ?? 'a service account'} como Leitor (não use só “qualquer pessoa com o link”).`,
        '2) No Google Cloud do mesmo projeto da service account, ative a API “Google Drive API”.',
        '3) Aguarde 1–2 minutos e tente de novo.',
      ].join(' ')
    } else if (status === 403) {
      hint = `Sem permissão. Em Compartilhar no Drive, adicione ${clientEmail ?? 'a service account'} como Leitor. Se já compartilhou, ative a Google Drive API no projeto Cloud.`
    }

    return {
      ok: false,
      clientEmail,
      folderId,
      status,
      error: message,
      hint,
    }
  }
}
