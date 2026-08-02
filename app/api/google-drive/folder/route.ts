import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import {
  defaultObrasDriveFolderId,
  getGoogleDriveObrasCredentials,
  validateAndListDriveFolder,
} from '@/lib/google-drive-sa'

export const dynamic = 'force-dynamic'

/** Retorna o e-mail da SA e o folder ID padrão (sem listar conteúdo). */
export async function GET() {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const creds = getGoogleDriveObrasCredentials()
    return NextResponse.json({
      clientEmail: creds?.client_email ?? null,
      defaultFolderId: defaultObrasDriveFolderId() || null,
      configured: Boolean(creds),
    })
  } catch (error: unknown) {
    console.error('[google-drive/folder GET]', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erro interno' },
      { status: 500 },
    )
  }
}

/** Valida acesso da service account à pasta e lista o conteúdo. */
export async function POST(request: Request) {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Não autenticado' }, { status: 401 })
    }

    const body = (await request.json().catch(() => ({}))) as {
      folderIdOrUrl?: string
      pageSize?: number
    }

    const folderIdOrUrl =
      (body.folderIdOrUrl ?? '').trim() || defaultObrasDriveFolderId()

    if (!folderIdOrUrl) {
      return NextResponse.json(
        {
          ok: false,
          error: 'Informe a URL ou o ID da pasta do Drive.',
          hint: 'Ex.: https://drive.google.com/drive/folders/...',
        },
        { status: 400 },
      )
    }

    const result = await validateAndListDriveFolder({
      folderIdOrUrl,
      pageSize: body.pageSize,
    })

    if (!result.ok) {
      return NextResponse.json(result, { status: result.status >= 400 ? result.status : 400 })
    }

    return NextResponse.json(result)
  } catch (error: unknown) {
    console.error('[google-drive/folder POST]', error)
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : 'Erro interno',
      },
      { status: 500 },
    )
  }
}
